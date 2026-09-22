'use client';

import { Fragment } from 'react';

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
import { parseClinicalSections, tryParseFields } from './clinical-sections';
import type { MedicalDocument } from '../types/document';
import { documentSortDate, documentMetadataSections, type DocumentClinicalMetadata } from './document-metadata';
import type { ClinicalSummary } from '@/features/patients/types/clinical-summary';
import { clinicalSummarySections } from '@/features/patients/lib/clinical-summary-presentation';
import { PDF_FONT_FILES, PdfTypographyError, preparePdfFonts, unsupportedPdfCharacters, type PdfFontSources } from './pdf-fonts';

export type ExportSectionBlock =
  | { kind: 'text'; label?: string; content: string }
  | { kind: 'fields'; label?: string; fields: { label: string; value: string; wide?: boolean }[] }
  | { kind: 'list'; label?: string; items: string[] }
  | { kind: 'table'; label?: string; columns: string[]; rows: string[][] };

export interface ExportSection {
  key?: string;
  title: string;
  content?: string;
  blocks?: ExportSectionBlock[];
  placement?: 'header' | 'body' | 'appendix';
  layout?: 'fields' | 'narrative';
}

export type ExportAttachment = RecordExportAttachment;
export type ResolvedExportAttachment = ResolvedAttachment<ExportAttachment>;

export interface ExportItem {
  title: string;
  date: string;
  dateLabel: string;
  datePrecision?: 'DAY' | 'INSTANT';
  status: string;
  origin: string;
  reviewSummary?: string;
  sourceSummary?: string;
  sections: ExportSection[];
  attachments: ExportAttachment[];
}

export function clinicalSummaryToExportItem(revision: ClinicalSummary, current: boolean): ExportItem {
  return {
    title: `Información longitudinal · Revisión ${revision.version}`,
    date: revision.createdAt ?? '', dateLabel: 'Fecha de revisión (no es una atención)',
    datePrecision: 'INSTANT',
    origin: 'Revisión humana', status: current ? 'Vigente al exportar' : 'Revisión anterior; no vigente',
    reviewSummary: `${current ? 'Información longitudinal vigente' : 'Información longitudinal anterior; no vigente'} · Registrado por ${revision.recordedByName ?? 'No registrado'} · ${formatDateTime(revision.createdAt ?? null) ?? 'Fecha no registrada'}. No es firma digital certificada.`,
    attachments: [], sections: [
      { title: 'Trazabilidad de la revisión', content: `Registrado por: ${revision.recordedByName ?? 'No registrado'}\nMotivo / fuente: ${revision.reason ?? 'No registrado'}`, layout: 'narrative' },
      ...clinicalSummarySections(revision.payload),
    ],
  };
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

const PDF_BODY_TEXT = { fontSize: 9.5, lineHeight: 1.55, orphans: 2, widows: 2 } as const;
// React-PDF moves a Text shorter than orphans + widows lines as one unit,
// including blank paragraph lines. Reserve that largest unsplittable prefix
// after the heading; a fixed 36pt hint was too short for a three-line body.
const SECTION_TEXT_KEEP_WITH_NEXT = PDF_BODY_TEXT.fontSize * PDF_BODY_TEXT.lineHeight
  * (PDF_BODY_TEXT.orphans + PDF_BODY_TEXT.widows - 1);

function formatDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatDateOnly(iso, { day: '2-digit', month: 'long', year: 'numeric' });
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

function documentActorLine(
  role: string,
  id: string | null,
  actor?: ClinicalHistoryExportDocument['createdByActor'],
): string | null {
  if (!id && !actor?.id) return null;
  const name = actor?.fullName?.trim() || actor?.displayName?.trim() || 'Autor histórico no registrado';
  const username = actor?.username?.trim();
  return `${role}: ${name}${username && name !== `@${username}` ? ` · @${username}` : ''}${actor?.isActive === false ? ' · Cuenta inactiva' : ''} · ID: ${id || actor?.id}`;
}

/** Presentation only: no field is inferred from its clinical meaning. */
function clinicalTextSection(title: string, content: string): ExportSection {
  return {
    title,
    content,
    layout: tryParseFields(content) ? 'fields' : 'narrative',
  };
}

function documentPresentationMetadata(metadata: DocumentClinicalMetadata = {}): ExportSection[] {
  // Source uncertainty is clinical context, not an administrative appendix.
  const { sourceNotes, ...briefMetadata } = metadata;
  return [
    ...documentMetadataSections(briefMetadata).map((section): ExportSection => ({
      ...section,
      placement: 'header',
      layout: tryParseFields(section.content) ? 'fields' : 'narrative',
    })),
    ...(sourceNotes ? [{
      title: 'OBSERVACIONES DE PROCEDENCIA',
      content: sourceNotes,
      placement: 'body' as const,
      layout: 'narrative' as const,
    }] : []),
  ];
}

function documentReviewSummary(
  document: Pick<MedicalDocument, 'status' | 'reviewedBy' | 'reviewedAt'>,
  actor?: { fullName?: string | null; displayName?: string | null; username?: string | null },
): string {
  const name = actor?.fullName?.trim() || actor?.displayName?.trim();
  const username = actor?.username?.trim();
  const identity = name
    ? `${name}${username && name !== `@${username}` ? ` · @${username}` : ''}`
    : username ? `@${username}` : 'Nombre no disponible; identificación en anexo';
  return [
    DOC_STATUS_LABEL[document.status] ?? document.status,
    document.status === 'VALIDATED'
      ? 'Validación de la transcripción registrada'
      : 'Sin validación de transcripción vigente',
    document.reviewedBy || document.reviewedAt
      ? `Revisor: ${identity} · ${formatDateTime(document.reviewedAt) ?? 'Fecha de revisión no registrada'}`
      : document.status === 'VALIDATED'
        ? 'Revisor y fecha de revisión no disponibles en este exportado'
        : 'Sin revisión final registrada',
    'Revisión interna; no es firma digital certificada.',
  ].join(' · ');
}

function documentSourceSummary(
  document: Pick<MedicalDocument, 'originalName' | 'clinicalMetadata'> & { version?: number },
): string {
  return [
    `Archivo: ${document.originalName}`,
    document.clinicalMetadata?.pageCount !== undefined
      ? `Páginas declaradas: ${document.clinicalMetadata.pageCount}`
      : 'Número de páginas no registrado',
    Number.isInteger(document.version) ? `Versión del documento: ${document.version}` : null,
    'Detalle de procedencia y revisión en el anexo.',
  ].filter(Boolean).join(' · ');
}

export function documentToExportItem(document: MedicalDocument): ExportItem {
  const correctedText = document.correctedText?.trim();
  const text =
    document.status === 'VALIDATED'
      ? (correctedText || document.ocrText?.trim() || '')
      : '';
  const parsed = parseClinicalSections(text);

  const sections: ExportSection[] = [
    ...documentPresentationMetadata(document.clinicalMetadata),
    {
      title: 'ARCHIVO',
      content: `${document.mimeType} · ${(document.sizeBytes / 1024).toFixed(1)} KB`,
      placement: 'appendix',
    },
  ];
  if (parsed.isStructured) {
    if (parsed.preamble.trim()) {
      sections.push(clinicalTextSection('Encabezado del documento', parsed.preamble.trim()));
    }
    for (const section of parsed.sections) {
      sections.push(clinicalTextSection(section.title, section.content.trim() || '—'));
    }
  } else if (text.trim()) {
    sections.push(clinicalTextSection('TEXTO DEL DOCUMENTO', text.trim()));
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
      title: `CONFIRMACIONES DE REVISIÓN · ESQUEMA V${document.validationChecklist.schemaVersion}`,
      placement: 'appendix',
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
    sections.push({ title: 'TRAZABILIDAD', content: trace.join('\n'), placement: 'appendix' });
  }

  return {
    title: document.originalName,
    date: documentSortDate(document),
    dateLabel: document.clinicalMetadata?.clinicalDate ? 'Fecha clínica registrada' : 'Carga (fecha clínica desconocida)',
    datePrecision: document.clinicalMetadata?.clinicalDate ? 'DAY' : 'INSTANT',
    status: DOC_STATUS_LABEL[document.status] ?? document.status,
    origin: 'Documento digitalizado',
    reviewSummary: documentReviewSummary(document, document.assignedReviewer && document.assignedReviewer.id === document.reviewedBy ? document.assignedReviewer : undefined),
    sourceSummary: documentSourceSummary(document),
    sections,
    attachments: [],
  };
}

export function clinicalHistoryDocumentToExportItem(
  document: ClinicalHistoryExportDocument,
): ExportItem {
  const text = document.status === 'VALIDATED' ? (document.clinicalText ?? '') : '';
  const parsed = parseClinicalSections(text);
  const sections: ExportSection[] = [
    ...documentPresentationMetadata(document.clinicalMetadata),
    {
      title: 'ARCHIVO',
      content: `${document.mimeType} · ${(document.sizeBytes / 1024).toFixed(1)} KB`,
      placement: 'appendix',
    },
  ];

  if (parsed.isStructured) {
    if (parsed.preamble.trim()) {
      sections.push(clinicalTextSection('Encabezado del documento', parsed.preamble.trim()));
    }
    for (const section of parsed.sections) {
      sections.push(clinicalTextSection(section.title, section.content.trim() || '—'));
    }
  } else if (text.trim()) {
    sections.push(clinicalTextSection('TEXTO DEL DOCUMENTO', text.trim()));
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
      title: `CONFIRMACIONES DE REVISIÓN · ESQUEMA V${document.validationChecklist.schemaVersion}`,
      placement: 'appendix',
      content: document.validationChecklist.items
        .map((item) => `Confirmado — ${item.title}: ${item.statement}`)
        .join('\n'),
    });
  }

  for (const [index, revision] of (document.metadataRevisions ?? []).entries()) {
    sections.push({ title: `HISTORIAL DE PROCEDENCIA · V${revision.version}${index === 0 ? ' · Última revisión' : ' · Anterior'}`, placement: 'appendix', content: [
      `Registrado: ${formatDateTime(revision.createdAt)} · Por: ${revision.recordedByName || 'Identidad histórica no registrada'}`,
      `Motivo: ${revision.reason}`, documentMetadataSections(revision.metadata)[0].content,
    ].join('\n') });
  }
  const trace = [
    `Fuente del texto: ${document.status !== 'VALIDATED' ? 'Sin texto exportable' : document.textSource === 'CORRECTED' ? 'Texto corregido y validado' : document.textSource === 'OCR' ? 'OCR validado' : 'Sin texto exportable'}`,
    `ID del documento: ${document.id}`,
    `Subido: ${formatDateTime(document.createdAt) ?? 'No registrado'}`,
    document.processedAt ? `Procesado: ${formatDateTime(document.processedAt)}` : null,
    document.correctedAt ? `Corregido: ${formatDateTime(document.correctedAt)}` : null,
    document.reviewedAt ? `Revisado: ${formatDateTime(document.reviewedAt)}` : null,
    document.validationAttestedAt
      ? `Atestación registrada: ${formatDateTime(document.validationAttestedAt)}`
      : null,
    documentActorLine('Creador', document.createdBy, document.createdByActor),
    documentActorLine('Corrector', document.correctedById, document.correctedByActor),
    documentActorLine('Revisor', document.reviewedBy, document.reviewedByActor),
    documentActorLine('Última actualización', document.updatedBy, document.updatedByActor),
    'Identidades consultadas en el directorio al exportar; no son nombres históricos certificados ni acreditan una profesión. La revisión interna no equivale a una firma digital certificada.',
  ].filter((line): line is string => Boolean(line));
  sections.push({ title: 'TRAZABILIDAD', content: trace.join('\n'), placement: 'appendix' });

  return {
    title: document.originalName,
    date: documentSortDate(document),
    dateLabel: document.clinicalMetadata?.clinicalDate ? 'Fecha clínica registrada' : 'Carga (fecha clínica desconocida)',
    datePrecision: document.clinicalMetadata?.clinicalDate ? 'DAY' : 'INSTANT',
    status: DOC_STATUS_LABEL[document.status] ?? document.status,
    origin: 'Documento digitalizado',
    reviewSummary: documentReviewSummary(document, document.reviewedByActor),
    sourceSummary: documentSourceSummary(document),
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
  const statusLabel = record.status === 'ACTIVE' ? 'Activo' : record.status === 'CORRECTED' ? 'Corregido' : 'Anulado';
  const reviewSummary = [
    statusLabel,
    record.confirmation
      ? [
        record.status === 'ACTIVE' ? 'Versión confirmada' : 'Confirmación histórica; esta versión no está vigente',
        `${record.confirmation.actorName} · @${record.confirmation.actorUsername}`,
        record.confirmation.capacity === 'ORIGINAL_PROFESSIONAL' ? 'Cuenta del profesional original' : 'Revisor autorizado',
        formatDateTime(record.confirmation.confirmedAt) ?? 'Fecha de confirmación no registrada',
      ].join(' · ')
      : `Sin confirmación clínica explícita registrada · Ingresado por ${record.createdByNameSnapshot ?? 'Nombre histórico no registrado'} · ${formatDateTime(record.createdAt) ?? 'Fecha de ingreso no registrada'}`,
    'No es firma digital certificada.',
  ].join(' · ');
  if (record.episode) sections.push({ title: 'EPISODIO CLÍNICO', content: [record.episode.title, record.episode.status === 'OPEN' ? 'Abierto' : 'Cerrado', `Desde ${record.episode.startedOn}${record.episode.endedOn ? ` hasta ${record.episode.endedOn}` : ''}`, record.episode.description].filter(Boolean).join('\n') });
  sections.push({ title: 'CONFIRMACIÓN CLÍNICA DE ESTA VERSIÓN', placement: 'appendix', content: record.confirmation ? [
    record.status === 'ACTIVE' ? 'Versión confirmada.' : 'Confirmación histórica de una versión que ya no está vigente.',
    `${record.confirmation.actorName} · @${record.confirmation.actorUsername} · ${record.confirmation.capacity === 'ORIGINAL_PROFESSIONAL' ? 'Cuenta del profesional original' : 'Revisor autorizado'}`,
    `${formatDateTime(record.confirmation.confirmedAt) ?? 'Fecha no registrada'} · Versión revisada ${record.confirmation.recordVersion}`,
    record.confirmation.note,
    `Huella SHA-256: ${record.confirmation.contentHash}`,
    'Cierre interno; no es firma digital certificada.',
  ].filter(Boolean).join('\n') : 'Sin confirmación clínica explícita registrada. No es firma digital certificada.' });
  if (record.source) sections.push({ title: 'DOCUMENTO ORIGINAL DE ESTA ATENCIÓN', placement: 'appendix', content: [
    `${record.source.documentName} · ID ${record.source.documentId}`,
    `Páginas ${record.source.pageFrom}–${record.source.pageTo} · Versión del original ${record.source.documentVersion}`,
    record.source.sourceNote,
    `Transcripción cotejada por ${record.source.publishedByName} el ${formatDateTime(record.source.publishedAt) ?? 'No registrado'}. No equivale a cierre profesional.`,
  ].join('\n') });
  if (record.source?.sourceNote) sections.push({
    title: 'OBSERVACIONES DE PROCEDENCIA',
    content: record.source.sourceNote,
    placement: 'body',
    layout: 'narrative',
  });

  if (professionalName?.trim()) {
    sections.push({
      title: 'PROFESIONAL ORIGINAL DE LA ATENCIÓN',
      placement: 'header',
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
    sections.push({ title: 'SERVICIO', content: record.service.trim(), placement: 'header' });
  }
  if (record.specialty?.trim()) sections.push({ title: 'ESPECIALIDAD', content: record.specialty.trim(), placement: 'header' });
  sections.push({
    title: 'PRIORIDAD',
    content: RECORD_PRIORITY_LABEL[record.priority] ?? record.priority,
    placement: 'header',
  });
  sections.push({ title: 'RESUMEN', content: record.summary, layout: 'narrative' });

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
        blocks.push({
          kind: 'fields',
          fields: block.fields.map((field) => ({
            label: field.label,
            value: field.value,
            wide: field.wide,
          })),
        });
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
    `Ingresado por: ${record.createdByNameSnapshot ?? 'Nombre histórico no registrado'}`,
    `ID de atención: ${record.id}`,
    record.episode ? `ID de episodio: ${record.episode.id}` : null,
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
  sections.push({ title: 'TRAZABILIDAD', content: trace.join('\n'), placement: 'appendix' });
  return {
    title: definition.label,
    date: record.attendedAt,
    dateLabel: record.attendancePrecision === 'DAY' ? 'Fecha de atención (hora no consignada)' : 'Fecha de atención',
    datePrecision: record.attendancePrecision === 'DAY' ? 'DAY' : 'INSTANT',
    status: statusLabel,
    origin: record.origin === 'DIGITIZED' ? 'Origen digitalizado' : 'Registro manual',
    reviewSummary,
    sourceSummary: record.source
      ? `${record.source.documentName} · Páginas ${record.source.pageFrom}–${record.source.pageTo} · Versión del original ${record.source.documentVersion} · Transcripción cotejada por ${record.source.publishedByName} el ${formatDateTime(record.source.publishedAt) ?? 'Fecha no registrada'}. Referencia completa en el anexo.`
      : record.origin === 'DIGITIZED'
        ? 'Origen digitalizado; referencia al documento original no disponible.'
        : undefined,
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

export interface PatientPdfOptions {
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
    | 'medicalRecordNumber'
    | 'emergencyContactName'
    | 'emergencyContactPhone'
    | 'emergencyContactRelationship'
    | 'representativeName'
    | 'insuranceName'
    | 'insuranceNumber'
  >;
  items: ExportItem[];
  subtitle: string;
  fileName: string;
  generatedAt?: string;
  orderDescription?: string;
  /** Short human-readable scope; detailed policy remains in the appendix. */
  scopeSummary?: string;
  /** Required visible restrictions when an export is filtered. Never truncate. */
  scopeDetails?: string;
  brandLogoSource?: string;
  /** Absolute local paths for server/tests; browser exports use same-origin assets. */
  fontSources?: PdfFontSources;
}

export async function createPatientPdf(options: PatientPdfOptions, resources?: { loadBlob: AttachmentBlobLoader; encodeDataUrl: AttachmentDataUrlEncoder }): Promise<Blob> {
  const { patient, items, subtitle, generatedAt, orderDescription } = options;
  const resolvedItems = await resolveExportItemAttachments(items, resources?.loadBlob, resources?.encodeDataUrl);
  const { pdf, Document, Image: PdfImage, Link: PdfLink, Page, Text, View, StyleSheet, Font } = await import('@react-pdf/renderer');
  // Never introduce discretionary hyphens into clinical terms or audit IDs.
  Font.registerHyphenationCallback(word => [word]);
  const sources = options.fontSources ?? Object.fromEntries(
    Object.entries(PDF_FONT_FILES).map(([key, file]) => [key, new URL(file, window.location.origin).toString()]),
  ) as PdfFontSources;
  let fonts: Awaited<ReturnType<typeof preparePdfFonts>>;
  try { fonts = await preparePdfFonts(Font, sources); }
  catch { throw new PdfTypographyError('No se pudieron cargar las fuentes del PDF. Comprueba tu conexión y vuelve a exportar; no se descargó un documento incompleto.'); }
  const textValues = [
    subtitle, orderDescription ?? '', options.scopeSummary ?? '', options.scopeDetails ?? '', ...Object.values(patient).filter((value): value is string => typeof value === 'string'),
    ...items.flatMap(item => [item.title, item.dateLabel, item.status, item.origin, item.reviewSummary ?? '', item.sourceSummary ?? '',
      ...item.sections.flatMap(section => [section.title, section.content ?? '',
        ...(section.blocks ?? []).flatMap(block => [block.label ?? '', ...(
          block.kind === 'text' ? [block.content] : block.kind === 'list' ? block.items : block.kind === 'fields' ? block.fields.flatMap(field => [field.label, field.value]) : [...block.columns, ...block.rows.flat()]
        )]),
      ]),
      ...item.attachments.flatMap(attachment => [attachment.originalName, attachment.caption ?? '', attachment.description ?? '', attachment.sectionTitle ?? '']),
    ]),
  ];
  const unsupported = unsupportedPdfCharacters(textValues, fonts.regular, fonts.bold);
  if (unsupported.length) {
    const codes = unsupported.slice(0, 6).map(character => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(', ');
    throw new PdfTypographyError(`No se exportó el PDF: hay caracteres sin soporte tipográfico (${codes}). El texto guardado no cambió. Solicita ampliar la tipografía para conservar esos símbolos.`);
  }
  const brandLogoUrl = options.brandLogoSource ?? new URL(CLINICVIEW_BRAND_ASSETS.horizontal.src, window.location.origin).toString();

  const styles = StyleSheet.create({
    page: {
      paddingTop: 96,
      paddingBottom: 64,
      paddingHorizontal: 48,
      fontSize: 10,
      fontFamily: fonts.families,
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
    headerRight: { alignItems: 'flex-end', maxWidth: 300 },
    headerPatient: { fontSize: 9, fontWeight: 700, textAlign: 'right', lineHeight: 1.2 },
    headerMeta: { fontSize: 8, color: PDF_COLORS.primary, marginTop: 2 },
    coverTitle: { fontSize: 19, fontWeight: 700, color: PDF_COLORS.ink, marginBottom: 5 },
    coverSubtitle: { fontSize: 8.5, lineHeight: 1.45, color: '#475569', marginBottom: 12 },
    patientDetails: {
      fontSize: 8.5,
      lineHeight: 1.45,
      color: PDF_COLORS.ink,
      marginTop: -10,
      marginBottom: 18,
    },
    itemHeader: {
      backgroundColor: PDF_COLORS.surface,
      borderLeftWidth: 3,
      borderLeftColor: PDF_COLORS.primary,
      padding: 10,
      marginBottom: 8,
    },
    itemTitle: { fontSize: 11, fontWeight: 700, color: PDF_COLORS.ink },
    itemMeta: { fontSize: 8.5, color: PDF_COLORS.primary, marginTop: 3 },
    sectionTitle: {
      fontSize: 9,
      fontWeight: 700,
      color: PDF_COLORS.primary,
      letterSpacing: 0,
      marginTop: 10,
      marginBottom: 0,
      backgroundColor: '#F4F7FB',
      borderLeftWidth: 2,
      borderLeftColor: PDF_COLORS.primary,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    sectionContent: { fontSize: PDF_BODY_TEXT.fontSize, lineHeight: PDF_BODY_TEXT.lineHeight, color: PDF_COLORS.ink },
    structuredBlock: { marginBottom: 7 },
    narrativeFrame: { borderWidth: 0.6, borderColor: '#CCD8E6', padding: 8, marginBottom: 7 },
    narrativeLabel: { fontSize: 8, fontWeight: 700, color: '#334155', marginTop: 7, marginBottom: 3 },
    fieldRow: { flexDirection: 'row', marginBottom: 0 },
    fieldCell: { flexGrow: 1, flexBasis: 0, borderWidth: 0.5, borderColor: '#CCD8E6', paddingVertical: 6, paddingHorizontal: 8 },
    fieldLabel: { fontSize: 7.5, fontWeight: 700, color: '#475569', lineHeight: 1.3, marginBottom: 3 },
    fieldValue: { fontSize: 9, color: PDF_COLORS.ink, lineHeight: 1.4 },
    factsGroup: { marginBottom: 7 },
    entryReference: { fontSize: 7.5, fontWeight: 700, color: PDF_COLORS.primary, marginBottom: 4, letterSpacing: 0.6 },
    contextNote: { fontSize: 8, lineHeight: 1.4, color: '#334155', paddingHorizontal: 8, paddingVertical: 5, borderLeftWidth: 1, borderLeftColor: '#CBD5E1' },
    indexTitle: { fontSize: 8, fontWeight: 700, color: '#475569', marginTop: 10, marginBottom: 5 },
    indexLink: { fontSize: 8, lineHeight: 1.4, color: PDF_COLORS.primary, marginBottom: 4 },
    appendixIntro: { fontSize: 8.5, lineHeight: 1.5, color: '#475569', marginBottom: 10 },
    appendixText: { fontSize: 8.5, lineHeight: 1.45 },
    blockLabel: {
      fontSize: 8,
      fontWeight: 700,
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
      fontSize: 8,
      lineHeight: 1.3,
    },
    dataTableHeading: {
      fontWeight: 700,
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
      fontWeight: 700,
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
      fontWeight: 700,
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
      fontWeight: 700,
      letterSpacing: 0,
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
      fontWeight: 700,
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

  type PdfField = { label: string; value: string; wide?: boolean };
  // Short facts are row-sized, never fixed-height. Long/multiline values become
  // full-width flowing text instead of an unbreakable cell taller than a page.
  const renderFields = (fields: readonly PdfField[], key: string, columns = 2) => {
    const rows: PdfField[][] = [];
    let row: PdfField[] = [];
    const flush = () => { if (row.length) rows.push(row); row = []; };
    for (const field of fields) {
      if (field.wide || field.value.length > 140 || field.value.includes('\n')) {
        flush(); rows.push([field]);
      } else {
        row.push(field);
        if (row.length === columns) flush();
      }
    }
    flush();
    return (
      <Fragment key={key}>
        {rows.map((cells, rowIndex) => {
          const first = cells[0];
          if (cells.length === 1 && (first.value.length > 450 || first.value.split('\n').length > 5)) {
            return <Fragment key={rowIndex}>
              <Text style={styles.narrativeLabel} minPresenceAhead={SECTION_TEXT_KEEP_WITH_NEXT + 26}>{first.label}</Text>
              <Text style={[styles.sectionContent, styles.narrativeFrame]} orphans={2} widows={2}>{first.value}</Text>
            </Fragment>;
          }
          return <View key={rowIndex} style={styles.fieldRow} wrap={false}>
            {cells.map((field, fieldIndex) => <View key={fieldIndex} style={styles.fieldCell}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldValue}>{field.value}</Text>
            </View>)}
          </View>;
        })}
      </Fragment>
    );
  };

  const renderTable = (block: Extract<ExportSectionBlock, { kind: 'table' }>, key: string, sectionTitle?: string) => {
    const charsPerLine = Math.max(12, Math.floor((499 / Math.max(1, block.columns.length) - 8) / 4.4));
    const rowHeight = (row: readonly string[]) => 10 + Math.max(1, ...row.map(cell =>
      cell.split('\n').reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / charsPerLine)), 0),
    )) * 10.4;
    // Many columns or exceptionally tall rows need labelled, flowing records.
    // Do not shrink clinical text until unreadable or clip it to a fixed box.
    if (block.columns.length > 5 || block.rows.some(row => rowHeight(row) > 230)) {
      return <Fragment key={key}>
        {sectionTitle && <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={170}>{sectionTitle}</Text>}
        {block.label && <Text style={styles.narrativeLabel} minPresenceAhead={70}>{block.label}</Text>}
        {block.rows.map((row, index) => <Fragment key={index}>
          <Text style={styles.narrativeLabel} minPresenceAhead={70}>Elemento {index + 1}</Text>
          {renderFields(row.map((value, column) => ({ label: block.columns[column] ?? '', value })), `${key}-card-${index}`)}
        </Fragment>)}
      </Fragment>;
    }
    const chunks: string[][][] = [];
    let chunk: string[][] = [];
    let height = rowHeight(block.columns);
    for (const row of block.rows) {
      if (chunk.length && height + rowHeight(row) > 210) {
        chunks.push(chunk); chunk = []; height = rowHeight(block.columns);
      }
      chunk.push(row); height += rowHeight(row);
    }
    if (chunk.length || !chunks.length) chunks.push(chunk);
    return <Fragment key={key}>
      {chunks.map((rows, chunkIndex) => (
        <View key={chunkIndex} wrap={false}>
          {chunkIndex === 0 && sectionTitle && <Text style={styles.sectionTitle} wrap={false}>{sectionTitle}</Text>}
          {chunkIndex === 0 && block.label && <Text style={styles.narrativeLabel}>{block.label}</Text>}
          <View style={[styles.dataTable, { marginBottom: 7 }]} wrap={false}>
          <View style={[styles.dataTableRow, styles.dataTableHeader]} wrap={false}>
            {block.columns.map((column, index) => <Text key={index} style={[styles.dataTableCell, styles.dataTableHeading]}>{column}</Text>)}
          </View>
          {rows.map((row, rowIndex) => <View key={rowIndex} style={styles.dataTableRow} wrap={false}>
            {row.map((cell, index) => <Text key={index} style={styles.dataTableCell}>{cell}</Text>)}
          </View>)}
          </View>
        </View>
      ))}
    </Fragment>;
  };

  const renderBlock = (block: ExportSectionBlock, key: string) => {
    if (block.kind === 'fields') return <Fragment key={key}>
      {block.label && <Text style={styles.narrativeLabel} minPresenceAhead={70}>{block.label}</Text>}
      {renderFields(block.fields, key, block.fields.length >= 6 ? 3 : 2)}
    </Fragment>;
    if (block.kind === 'text') return <Fragment key={key}>
      {block.label && <Text style={styles.narrativeLabel} minPresenceAhead={SECTION_TEXT_KEEP_WITH_NEXT + 26}>{block.label}</Text>}
      <Text style={[styles.sectionContent, styles.narrativeFrame]} orphans={2} widows={2}>{block.content}</Text>
    </Fragment>;
    if (block.kind === 'list') return <Fragment key={key}>
      {block.label && <Text style={styles.narrativeLabel} minPresenceAhead={SECTION_TEXT_KEEP_WITH_NEXT + 26}>{block.label}</Text>}
      {block.items.map((value, index) => <Text key={index} style={[styles.sectionContent, styles.narrativeFrame]} orphans={2} widows={2}>• {value}</Text>)}
    </Fragment>;
    return renderTable(block, key);
  };

  const renderSection = (section: ExportSection, key: string, appendix = false) => {
    const fields = section.layout === 'fields' && section.content ? tryParseFields(section.content) : null;
    // An unbreakable table chunk can move farther than minPresenceAhead.
    // Keep its section title inside the first chunk, not stranded on the prior page.
    const startsWithTable = section.content === undefined && section.blocks?.[0]?.kind === 'table';
    return <Fragment key={key}>
      {!startsWithTable && <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={section.blocks?.length ? 85 : SECTION_TEXT_KEEP_WITH_NEXT + 26}>{section.title}</Text>}
      {fields ? renderFields(fields.map(field => ({ label: field.label + ':', value: field.value })), key, fields.length >= 6 ? 3 : 2)
        : section.content !== undefined && <Text
          style={[styles.sectionContent, styles.narrativeFrame, ...(appendix ? [styles.appendixText] : [])]}
          orphans={PDF_BODY_TEXT.orphans} widows={PDF_BODY_TEXT.widows}
        >{section.content}</Text>}
      {section.blocks?.map((block, index) => startsWithTable && index === 0 && block.kind === 'table'
        ? renderTable(block, `${key}-${index}`, section.title)
        : renderBlock(block, `${key}-${index}`))}
    </Fragment>;
  };

  const itemDate = (item: ExportItem) => item.datePrecision === 'INSTANT'
    ? formatInstant(item.date, { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : formatDate(item.date);
  const entryNumber = (index: number) => String(index + 1).padStart(2, '0');
  const hasAppendix = Boolean(orderDescription || resolvedItems.some(item => item.sections.some(section => section.placement === 'appendix')));
  const patientFields: PdfField[] = [
    { label: 'Documento de identidad', value: `${patient.documentType} ${patient.documentNumber}` },
    { label: 'N.º de historia clínica', value: patient.medicalRecordNumber || 'No asignada' },
    { label: 'Fecha de nacimiento', value: formatDateOnly(patient.dateOfBirth, { day: '2-digit', month: 'long', year: 'numeric' }) },
    { label: 'Sexo registrado en ficha', value: SEX_LABEL[patient.sex] ?? patient.sex },
    { label: 'Contacto', value: [patient.phone, patient.email].filter(Boolean).join(' · ') || 'No registrado' },
    { label: 'Seguro', value: [patient.insuranceName, patient.insuranceNumber].filter(Boolean).join(' · ') || 'No registrado' },
    { label: 'Dirección', value: patient.address || 'No registrada', wide: true },
    { label: 'Contacto de emergencia', value: [patient.emergencyContactName, patient.emergencyContactPhone, patient.emergencyContactRelationship].filter(Boolean).join(' · ') || 'No registrado' },
    { label: 'Representante', value: patient.representativeName || 'No registrado' },
  ];

  const renderHeaderSections = (item: ExportItem, key: string) => {
    const fields: PdfField[] = [];
    const blocks: ExportSectionBlock[] = [];
    for (const section of item.sections.filter(section => section.placement === 'header')) {
      const parsed = section.layout === 'fields' && section.content ? tryParseFields(section.content) : null;
      if (parsed) fields.push(...parsed.map(field => ({ label: field.label + ':', value: field.value })));
      else if (section.content !== undefined) fields.push({ label: section.title, value: section.content });
      for (const block of section.blocks ?? []) {
        if (block.kind === 'fields') fields.push(...block.fields);
        else blocks.push(block);
      }
    }
    return <Fragment>
      {fields.length > 0 && renderFields(fields, key)}
      {blocks.map((block, index) => renderBlock(block, `${key}-block-${index}`))}
    </Fragment>;
  };

  const doc = (
    <Document title={`${subtitle} — ${patient.lastName}, ${patient.firstName}`} author="ClinicView" language="es-PE">
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <PdfImage src={brandLogoUrl} style={styles.brandLogo} />
          <View style={styles.headerRight}>
            <Text style={styles.headerPatient}>{patient.lastName}, {patient.firstName}</Text>
            <Text style={styles.headerMeta}>{patient.documentType} {patient.documentNumber}</Text>
            <Text style={styles.headerMeta}>Emitido: {exportedAt}</Text>
          </View>
        </View>

        <Text style={styles.coverTitle}>{subtitle}</Text>
        <Text style={styles.coverSubtitle}>
          {options.scopeSummary ?? `${resolvedItems.length} ${resolvedItems.length === 1 ? 'documento incluido' : 'documentos incluidos'} · Información clínica y respaldo documental`}
        </Text>
        {options.scopeDetails && <Text style={[styles.contextNote, { marginBottom: 10 }]}>{options.scopeDetails}</Text>}
        <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={80}>Identificación del paciente</Text>
        {renderFields(patientFields, 'patient', 3)}

        <Text style={styles.indexTitle} minPresenceAhead={35}>Contenido del expediente · enlaces internos</Text>
        {resolvedItems.map((item, index) => <PdfLink key={index} src={`#entry-${index}`} style={styles.indexLink}>
          {entryNumber(index)}. {item.title} · {itemDate(item)} · {item.status}
        </PdfLink>)}
        {hasAppendix && <PdfLink src="#technical-appendix" style={styles.indexLink}>Anexo de trazabilidad</PdfLink>}

        {resolvedItems.map((item, index) => (
          <Fragment key={index}>
            {/* Page-level cards and headings keep minPresenceAhead effective. */}
            <View id={`entry-${index}`} style={[styles.itemHeader, { marginTop: 16 }]} wrap={false} minPresenceAhead={120}>
              <Text style={styles.entryReference}>ENTRADA {entryNumber(index)}</Text>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.dateLabel}: {itemDate(item)} · {item.origin} · Estado: {item.status}</Text>
            </View>
            {renderHeaderSections(item, `entry-facts-${index}`)}
            {item.reviewSummary && <Text style={styles.contextNote} orphans={2} widows={2}>{item.reviewSummary}</Text>}
            {item.sourceSummary && <Text style={styles.contextNote} orphans={2} widows={2}>{item.sourceSummary}</Text>}
            {item.sections.filter(section => !section.placement || section.placement === 'body').map((section, sectionIndex) => (
              <Fragment key={sectionIndex}>
                {renderSection(section, `body-${index}-${sectionIndex}`)}
                {section.key && item.attachments.filter(attachment => attachment.sectionId === section.key).map(renderAttachment)}
              </Fragment>
            ))}
            {item.attachments.some(attachment => attachment.sectionId === null) && <Fragment>
              <Text style={styles.sectionTitle} wrap={false} minPresenceAhead={340}>IMÁGENES ADJUNTAS</Text>
              {item.attachments.filter(attachment => attachment.sectionId === null).map(renderAttachment)}
            </Fragment>}
          </Fragment>
        ))}

        {hasAppendix && <Fragment>
          <Text id="technical-appendix" style={styles.coverTitle} break minPresenceAhead={80}>Anexo de trazabilidad</Text>
          <Text style={styles.appendixIntro}>
            Procedencia, revisiones y control de versiones. La referencia de cada entrada permite localizar su contenido clínico.
            Las constancias internas no equivalen a una firma digital certificada.
          </Text>
          {orderDescription && renderSection({ title: 'Alcance de la exportación', content: orderDescription }, 'export-scope', true)}
          {resolvedItems.map((item, index) => {
            const appendixSections = item.sections.filter(section => section.placement === 'appendix');
            if (!appendixSections.length) return null;
            return <Fragment key={index}>
              <View style={[styles.itemHeader, { marginTop: 14 }]} wrap={false} minPresenceAhead={110}>
                <PdfLink src={`#entry-${index}`} style={styles.entryReference}>ENTRADA {entryNumber(index)} · VOLVER AL CONTENIDO</PdfLink>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMeta}>{item.dateLabel}: {itemDate(item)} · {item.origin} · Estado: {item.status}</Text>
              </View>
              {appendixSections.map((section, sectionIndex) => renderSection(section, `appendix-${index}-${sectionIndex}`, true))}
            </Fragment>;
          })}
        </Fragment>}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ClinicView · Documento clínico · Información confidencial</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  return pdf(doc).toBlob();
}

export async function exportPatientPdf(options: PatientPdfOptions): Promise<void> {
  const blob = await createPatientPdf(options);
  const { fileName } = options;
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
