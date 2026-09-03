'use client';

/**
 * Exportación PDF client-side con @react-pdf/renderer.
 * Genera PDFs con texto real (seleccionable) estructurado por secciones de la
 * historia clínica. La librería se importa dinámicamente para no cargar
 * ~400 KB en el bundle principal.
 */

import type {
  ClinicalHistoryExportDocument,
  ClinicalHistoryExportRecord,
  Patient,
} from '@/features/patients';
import type { ClinicalRecord } from '@/features/clinical-records';
import {
  getRecordDetailsPresentation,
  recordDetailsIncludeValue,
} from '@/features/clinical-records/lib/record-details-presentation';
import {
  fitRecordAttachmentDimensions,
  formatRecordAttachmentSize,
  getRecordExportAttachments,
  resolveRequiredAttachmentData,
  type AttachmentBlobLoader,
  type AttachmentDataUrlEncoder,
  type RecordExportAttachment,
  type ResolvedAttachment,
} from '@/features/clinical-records/lib/record-attachments-presentation';
import { getRecordTypeDefinition } from '@/features/clinical-records/lib/record-type-definitions';
import { CLINICVIEW_BRAND_ASSETS } from '@/shared/brand/assets';
import { apiBlob } from '@/shared/services/api-client';
import {
  CLINICAL_TIME_ZONE,
  formatDateOnly,
  formatInstant,
} from '@/shared/lib/date-time';
import { parseClinicalSections } from './clinical-sections';
import type { MedicalDocument } from '../types/document';

export type ExportSectionBlock =
  | { kind: 'text'; label?: string; content: string }
  | { kind: 'list'; label?: string; items: string[] }
  | { kind: 'table'; label?: string; columns: string[]; rows: string[][] };

export interface ExportSection {
  key?: string;
  title: string;
  content?: string;
  blocks?: ExportSectionBlock[];
}

export type ExportAttachment = RecordExportAttachment;
export type ResolvedExportAttachment = ResolvedAttachment<ExportAttachment>;

export interface ExportItem {
  title: string;
  date: string;
  dateLabel: string;
  status: string;
  origin: string;
  sections: ExportSection[];
  attachments: ExportAttachment[];
}

interface ResolvedExportItem extends Omit<ExportItem, 'attachments'> {
  attachments: ResolvedExportAttachment[];
}

const DOC_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  PROCESSED: 'En corrección',
  FAILED: 'Error OCR',
  VALIDATED: 'Validado',
  REJECTED: 'Rechazado',
};

const RECORD_PRIORITY_LABEL: Record<string, string> = {
  URGENT: 'Urgente',
  PRIORITY: 'Prioritaria',
  NORMAL: 'Normal',
  ELECTIVE: 'Electiva',
};

const SEX_LABEL: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
  OTHER: 'Otro',
};

const PDF_COLORS = {
  ink: '#0B1026',
  primary: '#1E40AF',
  accent: '#00C7FF',
  surface: '#E6F2FF',
} as const;

function formatDate(iso: string): string {
  return formatInstant(iso, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatInstant(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function documentToExportItem(document: MedicalDocument): ExportItem {
  const correctedText = document.correctedText?.trim();
  const text =
    document.status === 'VALIDATED'
      ? (correctedText || document.ocrText?.trim() || '')
      : '';
  const parsed = parseClinicalSections(text);

  const sections: ExportSection[] = [
    {
      title: 'ARCHIVO',
      content: `${document.mimeType} · ${(document.sizeBytes / 1024).toFixed(1)} KB`,
    },
  ];
  if (parsed.isStructured) {
    if (parsed.preamble.trim()) {
      sections.push({ title: 'TEXTO SIN CLASIFICAR', content: parsed.preamble.trim() });
    }
    for (const section of parsed.sections) {
      sections.push({ title: section.title, content: section.content.trim() || '—' });
    }
  } else if (text.trim()) {
    sections.push({ title: 'TEXTO DEL DOCUMENTO', content: text.trim() });
  } else {
    sections.push({
      title: 'TEXTO DEL DOCUMENTO',
      content:
        document.status === 'VALIDATED'
          ? 'El documento validado no contiene texto clínico disponible.'
          : `Contenido clínico omitido: el documento no está validado (estado ${DOC_STATUS_LABEL[document.status] ?? document.status}).`,
    });
  }

  if (document.rejectReason?.trim()) {
    sections.push({ title: 'MOTIVO DE RECHAZO', content: document.rejectReason.trim() });
  }

  if (document.validationChecklist?.items.length) {
    sections.push({
      title: `ATESTACIÓN CLÍNICA · ESQUEMA V${document.validationChecklist.schemaVersion}`,
      content: document.validationChecklist.items
        .map((item) => `Confirmado — ${item.title}: ${item.statement}`)
        .join('\n'),
    });
  }

  const trace = [
    `Subido: ${formatDateTime(document.createdAt) ?? 'No registrado'}`,
    document.processedAt ? `Procesado: ${formatDateTime(document.processedAt)}` : null,
    document.correctedAt ? `Corregido: ${formatDateTime(document.correctedAt)}` : null,
    document.reviewedAt ? `Revisado: ${formatDateTime(document.reviewedAt)}` : null,
    document.createdBy ? `Creador (ID): ${document.createdBy}` : null,
    document.correctedById ? `Corrector (ID): ${document.correctedById}` : null,
    document.reviewedBy ? `Revisor (ID): ${document.reviewedBy}` : null,
  ].filter((line): line is string => Boolean(line));
  if (trace.length > 0) {
    sections.push({ title: 'TRAZABILIDAD', content: trace.join('\n') });
  }

  return {
    title: document.originalName,
    date: document.createdAt,
    dateLabel: 'Fecha de carga',
    status: DOC_STATUS_LABEL[document.status] ?? document.status,
    origin: 'Documento digitalizado',
    sections,
    attachments: [],
  };
}

export function clinicalHistoryDocumentToExportItem(
  document: ClinicalHistoryExportDocument,
): ExportItem {
  const text = document.clinicalText ?? '';
  const parsed = parseClinicalSections(text);
  const sections: ExportSection[] = [
    {
      title: 'ARCHIVO',
      content: `${document.mimeType} · ${(document.sizeBytes / 1024).toFixed(1)} KB`,
    },
  ];

  if (parsed.isStructured) {
    if (parsed.preamble.trim()) {
      sections.push({ title: 'TEXTO SIN CLASIFICAR', content: parsed.preamble.trim() });
    }
    for (const section of parsed.sections) {
      sections.push({ title: section.title, content: section.content.trim() || '—' });
    }
  } else if (text.trim()) {
    sections.push({ title: 'TEXTO DEL DOCUMENTO', content: text.trim() });
  } else {
    sections.push({
      title: 'TEXTO DEL DOCUMENTO',
      content:
        document.status === 'VALIDATED'
          ? 'El documento validado no contiene texto clínico disponible.'
          : `Contenido clínico omitido: el documento no está validado (estado ${DOC_STATUS_LABEL[document.status] ?? document.status}).`,
    });
  }

  if (document.rejectReason?.trim()) {
    sections.push({ title: 'MOTIVO DE RECHAZO', content: document.rejectReason.trim() });
  }

  if (document.validationChecklist?.items.length) {
    sections.push({
      title: `ATESTACIÓN CLÍNICA · ESQUEMA V${document.validationChecklist.schemaVersion}`,
      content: document.validationChecklist.items
        .map((item) => `Confirmado — ${item.title}: ${item.statement}`)
        .join('\n'),
    });
  }

  const trace = [
    `Fuente del texto: ${document.textSource === 'CORRECTED' ? 'Corrección profesional' : document.textSource === 'OCR' ? 'OCR validado' : 'Sin texto exportable'}`,
    `Subido: ${formatDateTime(document.createdAt) ?? 'No registrado'}`,
    document.processedAt ? `Procesado: ${formatDateTime(document.processedAt)}` : null,
    document.correctedAt ? `Corregido: ${formatDateTime(document.correctedAt)}` : null,
    document.reviewedAt ? `Revisado: ${formatDateTime(document.reviewedAt)}` : null,
    document.validationAttestedAt
      ? `Atestación registrada: ${formatDateTime(document.validationAttestedAt)}`
      : null,
    document.createdBy ? `Creador (ID): ${document.createdBy}` : null,
    document.correctedById ? `Corrector (ID): ${document.correctedById}` : null,
    document.reviewedBy ? `Revisor (ID): ${document.reviewedBy}` : null,
    document.updatedBy ? `Última actualización (ID): ${document.updatedBy}` : null,
  ].filter((line): line is string => Boolean(line));
  sections.push({ title: 'TRAZABILIDAD', content: trace.join('\n') });

  return {
    title: document.originalName,
    date: document.createdAt,
    dateLabel: 'Fecha de carga',
    status: DOC_STATUS_LABEL[document.status] ?? document.status,
    origin: 'Documento digitalizado',
    sections,
    attachments: [],
  };
}

export function recordToExportItem(
  record: ClinicalRecord | ClinicalHistoryExportRecord,
): ExportItem {
  const sections: ExportSection[] = [];
  const details = getRecordDetailsPresentation(record.recordType, record.details);
  const definition = getRecordTypeDefinition(record.recordType);
  const attachments = getRecordExportAttachments(
    record.recordType,
    record.attachments ?? [],
  );
  const professionalName = record.professionalNameSnapshot ?? record.doctorName;

  if (professionalName?.trim()) {
    sections.push({
      title: 'PROFESIONAL',
      content: [
        professionalName.trim(),
        record.professionalLicenseSnapshot?.trim()
          ? `Colegiatura / identificador: ${record.professionalLicenseSnapshot.trim()}`
          : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'),
    });
  }
  if (record.service?.trim()) {
    sections.push({ title: 'SERVICIO', content: record.service.trim() });
  }
  sections.push({
    title: 'PRIORIDAD',
    content: RECORD_PRIORITY_LABEL[record.priority] ?? record.priority,
  });
  sections.push({ title: 'RESUMEN', content: record.summary });

  const detailsBySection = new Map(details.map((section) => [section.id, section]));
  const attachmentSectionIds = new Set(
    attachments.flatMap((attachment) =>
      attachment.sectionId ? [attachment.sectionId] : [],
    ),
  );

  for (const definitionSection of definition.sections) {
    const detailSection = detailsBySection.get(definitionSection.id);
    if (!detailSection && !attachmentSectionIds.has(definitionSection.id)) continue;

    const blocks: ExportSectionBlock[] = [];
    for (const block of detailSection?.blocks ?? []) {
      if (block.kind === 'fields') {
        blocks.push(
          ...block.fields.map((field) => ({
            kind: 'text' as const,
            label: field.label,
            content: field.value,
          })),
        );
      } else if (block.kind === 'list') {
        blocks.push({ kind: 'list', label: block.label, items: block.items });
      } else {
        blocks.push({
          kind: 'table',
          label: block.label,
          columns: block.columns.map((column) => column.label),
          rows: block.rows,
        });
      }
    }

    sections.push({
      key: definitionSection.id,
      title: definitionSection.title.toLocaleUpperCase('es-PE'),
      ...(blocks.length > 0 && { blocks }),
    });
  }

  if (
    record.preliminaryDiagnosis?.trim() &&
    !recordDetailsIncludeValue(details, record.preliminaryDiagnosis)
  ) {
    sections.push({
      title: 'DIAGNÓSTICO PRELIMINAR',
      content: record.preliminaryDiagnosis.trim(),
    });
  }
  if (record.plan?.trim() && !recordDetailsIncludeValue(details, record.plan)) {
    sections.push({ title: 'PLAN', content: record.plan.trim() });
  }
  if (record.notes?.trim() && !recordDetailsIncludeValue(details, record.notes)) {
    sections.push({ title: 'NOTAS', content: record.notes.trim() });
  }
  if (record.voidReason?.trim()) {
    sections.push({ title: 'MOTIVO DE ANULACIÓN', content: record.voidReason.trim() });
  }
  const trace = [
    record.parentRecordId
      ? `Corrige al registro: ${record.parentRecordId}`
      : 'Registro raíz de la cadena clínica',
    record.createdBy ? `Creador (ID): ${record.createdBy}` : null,
    'updatedBy' in record && record.updatedBy
      ? `Última actualización (ID): ${record.updatedBy}`
      : null,
    details.length > 0 && record.schemaVersion
      ? `Esquema clínico: versión ${record.schemaVersion}`
      : null,
    Number.isInteger(record.version) ? `Versión del registro: ${record.version}` : null,
    `Creado: ${formatDateTime(record.createdAt) ?? 'No registrado'}`,
    `Actualizado: ${formatDateTime(record.updatedAt) ?? 'No registrado'}`,
  ].filter((line): line is string => Boolean(line));
  sections.push({ title: 'TRAZABILIDAD', content: trace.join('\n') });
  return {
    title: definition.label,
    date: record.attendedAt,
    dateLabel: 'Fecha de atención',
    status: record.status === 'ACTIVE' ? 'Activo' : record.status === 'CORRECTED' ? 'Corregido' : 'Anulado',
    origin: record.origin === 'DIGITIZED' ? 'Origen digitalizado' : 'Registro manual',
    sections,
    attachments,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo preparar la imagen para el PDF.'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen para el PDF.'));
    reader.readAsDataURL(blob);
  });
}

export async function resolveExportItemAttachments(
  items: readonly ExportItem[],
  loadBlob: AttachmentBlobLoader = apiBlob,
  encodeDataUrl: AttachmentDataUrlEncoder = blobToDataUrl,
): Promise<ResolvedExportItem[]> {
  const resolved: ResolvedExportItem[] = [];

  for (const item of items) {
    resolved.push({
      ...item,
      attachments: await resolveRequiredAttachmentData(
        item.attachments,
        loadBlob,
        encodeDataUrl,
      ),
    });
  }

  return resolved;
}

export async function exportPatientPdf(options: {
  patient: Pick<
    Patient,
    | 'documentType'
    | 'documentNumber'
    | 'firstName'
    | 'lastName'
    | 'dateOfBirth'
    | 'sex'
    | 'phone'
    | 'email'
    | 'address'
  >;
  items: ExportItem[];
  subtitle: string;
  fileName: string;
  generatedAt?: string;
  orderDescription?: string;
}): Promise<void> {
  const { patient, items, subtitle, fileName, generatedAt, orderDescription } = options;
  const resolvedItems = await resolveExportItemAttachments(items);
  const { pdf, Document, Image: PdfImage, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer');
  const brandLogoUrl = new URL(CLINICVIEW_BRAND_ASSETS.horizontal.src, window.location.origin).toString();

  const styles = StyleSheet.create({
    page: {
      paddingTop: 96,
      paddingBottom: 64,
      paddingHorizontal: 48,
      fontSize: 10,
      fontFamily: 'Helvetica',
      color: PDF_COLORS.ink,
    },
    header: {
      position: 'absolute',
      top: 32,
      left: 48,
      right: 48,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: PDF_COLORS.accent,
      paddingBottom: 10,
    },
    brandLogo: {
      width: 132,
      height: 33,
    },
    headerRight: { alignItems: 'flex-end' },
    headerPatient: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
    headerMeta: { fontSize: 8, color: PDF_COLORS.primary, marginTop: 2 },
    coverTitle: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: PDF_COLORS.ink, marginBottom: 4 },
    coverSubtitle: { fontSize: 10, color: PDF_COLORS.primary, marginBottom: 18 },
    patientDetails: {
      fontSize: 8.5,
      lineHeight: 1.45,
      color: PDF_COLORS.ink,
      marginTop: -10,
      marginBottom: 18,
    },
    item: { marginBottom: 22 },
    itemHeader: {
      backgroundColor: PDF_COLORS.surface,
      borderLeftWidth: 3,
      borderLeftColor: PDF_COLORS.primary,
      padding: 8,
      marginBottom: 10,
    },
    itemTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: PDF_COLORS.ink },
    itemMeta: { fontSize: 8.5, color: PDF_COLORS.primary, marginTop: 3 },
    sectionTitle: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: PDF_COLORS.primary,
      letterSpacing: 0.8,
      marginTop: 10,
      marginBottom: 4,
    },
    sectionContent: { fontSize: 9.5, lineHeight: 1.55, color: PDF_COLORS.ink },
    structuredBlock: { marginBottom: 7 },
    blockLabel: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: PDF_COLORS.ink,
      marginBottom: 2,
    },
    listRow: { flexDirection: 'row', marginBottom: 2 },
    listBullet: { width: 12, fontSize: 9.5, color: PDF_COLORS.primary },
    listContent: { flexGrow: 1, flexBasis: 0, fontSize: 9.5, lineHeight: 1.45 },
    dataTable: {
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderColor: '#CBD5E1',
    },
    dataTableRow: { flexDirection: 'row' },
    dataTableHeader: { backgroundColor: PDF_COLORS.surface },
    dataTableCell: {
      flexGrow: 1,
      flexBasis: 0,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#CBD5E1',
      paddingVertical: 4,
      paddingHorizontal: 3,
      fontSize: 7.5,
      lineHeight: 1.3,
    },
    dataTableHeading: {
      fontFamily: 'Helvetica-Bold',
      color: PDF_COLORS.primary,
    },
    dataCards: { gap: 5 },
    dataCard: {
      borderWidth: 1,
      borderColor: '#CBD5E1',
      borderRadius: 3,
      paddingVertical: 4,
      paddingHorizontal: 5,
    },
    dataCardTitle: {
      marginBottom: 3,
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: PDF_COLORS.primary,
    },
    dataCardField: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderColor: '#E2E8F0',
      paddingVertical: 3,
    },
    dataCardLabel: {
      width: '34%',
      paddingRight: 4,
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      color: PDF_COLORS.ink,
    },
    dataCardValue: {
      width: '66%',
      fontSize: 8,
      lineHeight: 1.35,
      color: PDF_COLORS.ink,
    },
    attachmentBlock: {
      marginTop: 7,
      marginBottom: 9,
      borderWidth: 1,
      borderColor: '#CBD5E1',
      borderRadius: 3,
      backgroundColor: '#F8FAFC',
      padding: 7,
    },
    attachmentLabel: {
      marginBottom: 5,
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      letterSpacing: 0.6,
      color: PDF_COLORS.primary,
    },
    attachmentImage: {
      alignSelf: 'center',
      objectFit: 'contain',
      marginBottom: 6,
    },
    attachmentCaption: {
      marginBottom: 2,
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      lineHeight: 1.4,
      color: PDF_COLORS.ink,
    },
    attachmentDescription: {
      marginBottom: 2,
      fontSize: 8.5,
      lineHeight: 1.4,
      color: PDF_COLORS.ink,
    },
    attachmentMeta: {
      fontSize: 7.5,
      lineHeight: 1.35,
      color: '#475569',
    },
    footer: {
      position: 'absolute',
      bottom: 28,
      left: 48,
      right: 48,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: PDF_COLORS.accent,
      paddingTop: 8,
    },
    footerText: { fontSize: 7.5, color: PDF_COLORS.primary },
  });

  const exportedAt = new Date(generatedAt ?? Date.now()).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CLINICAL_TIME_ZONE,
  });

  const renderAttachment = (attachment: ResolvedExportAttachment) => {
    const fitted = fitRecordAttachmentDimensions(
      attachment.width,
      attachment.height,
      480,
      280,
    );

    return (
      <View key={attachment.id} style={styles.attachmentBlock} wrap={false}>
        <Text style={styles.attachmentLabel}>IMAGEN CLÍNICA ADJUNTA</Text>
        <PdfImage
          src={attachment.dataUrl}
          style={[
            styles.attachmentImage,
            { width: fitted.width, height: fitted.height },
          ]}
        />
        {attachment.caption && (
          <Text style={styles.attachmentCaption}>{attachment.caption}</Text>
        )}
        <Text style={styles.attachmentDescription}>
          Descripción: {attachment.description}
        </Text>
        <Text style={styles.attachmentMeta}>
          Archivo: {attachment.originalName} · {attachment.width} × {attachment.height} px ·{' '}
          {formatRecordAttachmentSize(attachment.sizeBytes)}
        </Text>
      </View>
    );
  };

  const doc = (
    <Document
      title={`${subtitle} — ${patient.lastName}, ${patient.firstName}`}
      author="ClinicView"
      language="es-PE"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <PdfImage src={brandLogoUrl} style={styles.brandLogo} />
          <View style={styles.headerRight}>
            <Text style={styles.headerPatient}>
              {patient.lastName}, {patient.firstName}
            </Text>
            <Text style={styles.headerMeta}>
              {patient.documentType} {patient.documentNumber} · Exportado: {exportedAt}
            </Text>
          </View>
        </View>

        <Text style={styles.coverTitle}>{subtitle}</Text>
        <Text style={styles.coverSubtitle}>
          {resolvedItems.length}{' '}
          {resolvedItems.length === 1 ? 'entrada clínica' : 'entradas clínicas'}
          {orderDescription ? ` · ${orderDescription}` : ''}
        </Text>
        <Text style={styles.patientDetails}>
          Fecha de nacimiento:{' '}
          {formatDateOnly(patient.dateOfBirth, {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}{' '}
          · Sexo:{' '}
          {SEX_LABEL[patient.sex] ?? patient.sex}
          {'\n'}Contacto:{' '}
          {[patient.phone, patient.email].filter(Boolean).join(' · ') || 'No registrado'}
          {'\n'}Dirección: {patient.address || 'No registrada'}
        </Text>

        {resolvedItems.map((item, index) => (
          <View key={index} style={styles.item} wrap>
            <View style={styles.itemHeader} minPresenceAhead={80}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>
                {item.dateLabel}: {formatDate(item.date)} · {item.origin} · Estado: {item.status}
              </Text>
            </View>
            {item.sections.map((section, sectionIndex) => (
              <View key={sectionIndex}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.content !== undefined && (
                  <Text style={styles.sectionContent}>{section.content}</Text>
                )}
                {section.blocks?.map((block, blockIndex) => {
                  if (block.kind === 'text') {
                    return (
                      <View key={blockIndex} style={styles.structuredBlock}>
                        {block.label && <Text style={styles.blockLabel}>{block.label}</Text>}
                        <Text style={styles.sectionContent}>{block.content}</Text>
                      </View>
                    );
                  }

                  if (block.kind === 'list') {
                    return (
                      <View key={blockIndex} style={styles.structuredBlock}>
                        {block.label && <Text style={styles.blockLabel}>{block.label}</Text>}
                        {block.items.map((listItem, listIndex) => (
                          <View key={listIndex} style={styles.listRow} wrap={false}>
                            <Text style={styles.listBullet}>•</Text>
                            <Text style={styles.listContent}>{listItem}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  }

                  if (block.columns.length > 5) {
                    return (
                      <View key={blockIndex} style={styles.structuredBlock}>
                        {block.label && <Text style={styles.blockLabel}>{block.label}</Text>}
                        <View style={styles.dataCards}>
                          {block.rows.map((row, rowIndex) => (
                            <View key={rowIndex} style={styles.dataCard} wrap={false}>
                              <Text style={styles.dataCardTitle}>Elemento {rowIndex + 1}</Text>
                              {row.map((cell, cellIndex) => (
                                <View key={cellIndex} style={styles.dataCardField}>
                                  <Text style={styles.dataCardLabel}>
                                    {block.columns[cellIndex]}
                                  </Text>
                                  <Text style={styles.dataCardValue}>{cell}</Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={blockIndex} style={styles.structuredBlock}>
                      {block.label && <Text style={styles.blockLabel}>{block.label}</Text>}
                      <View style={styles.dataTable}>
                        <View
                          style={[styles.dataTableRow, styles.dataTableHeader]}
                          wrap={false}
                        >
                          {block.columns.map((column, columnIndex) => (
                            <Text
                              key={columnIndex}
                              style={[styles.dataTableCell, styles.dataTableHeading]}
                            >
                              {column}
                            </Text>
                          ))}
                        </View>
                        {block.rows.map((row, rowIndex) => (
                          <View key={rowIndex} style={styles.dataTableRow} wrap={false}>
                            {row.map((cell, cellIndex) => (
                              <Text key={cellIndex} style={styles.dataTableCell}>
                                {cell}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
                {section.key &&
                  item.attachments
                    .filter((attachment) => attachment.sectionId === section.key)
                    .map(renderAttachment)}
              </View>
            ))}
            {item.attachments.some((attachment) => attachment.sectionId === null) && (
              <View>
                <Text style={styles.sectionTitle}>IMÁGENES ADJUNTAS</Text>
                {item.attachments
                  .filter((attachment) => attachment.sectionId === null)
                  .map(renderAttachment)}
              </View>
            )}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Documento generado por ClinicView — uso clínico interno. Contiene información sensible.
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
