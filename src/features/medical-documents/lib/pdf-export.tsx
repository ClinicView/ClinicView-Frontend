'use client';

/**
 * Exportación PDF client-side con @react-pdf/renderer.
 * Genera PDFs con texto real (seleccionable) estructurado por secciones de la
 * historia clínica. La librería se importa dinámicamente para no cargar
 * ~400 KB en el bundle principal.
 */

import type { Patient } from '@/features/patients';
import type { ClinicalRecord } from '@/features/clinical-records';
import { CLINICVIEW_BRAND_ASSETS } from '@/shared/brand/assets';
import { parseClinicalSections } from './clinical-sections';
import type { MedicalDocument } from '../types/document';

export interface ExportSection {
  title: string;
  content: string;
}

export interface ExportItem {
  title: string;
  date: string;
  status: string;
  origin: string;
  sections: ExportSection[];
}

const DOC_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  PROCESSED: 'En corrección',
  FAILED: 'Error OCR',
  VALIDATED: 'Validado',
  REJECTED: 'Rechazado',
};

const RECORD_TYPE_LABEL: Record<string, string> = {
  CONSULTATION: 'Consulta',
  LAB_RESULT: 'Resultado de laboratorio',
  PRESCRIPTION: 'Receta',
  THERAPY_NOTE: 'Nota de terapia',
  EVOLUTION: 'Evolución',
  PROCEDURE: 'Procedimiento',
  OTHER: 'Otro',
};

const PDF_COLORS = {
  ink: '#0B1026',
  primary: '#1E40AF',
  accent: '#00C7FF',
  surface: '#E6F2FF',
} as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function documentToExportItem(document: MedicalDocument): ExportItem {
  const text = document.correctedText ?? document.ocrText ?? '';
  const parsed = parseClinicalSections(text);

  const sections: ExportSection[] = [];
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
    sections.push({ title: 'TEXTO DEL DOCUMENTO', content: 'Sin texto disponible (documento no procesado).' });
  }

  return {
    title: document.originalName,
    date: document.createdAt,
    status: DOC_STATUS_LABEL[document.status] ?? document.status,
    origin: 'Documento digitalizado',
    sections,
  };
}

export function recordToExportItem(record: ClinicalRecord): ExportItem {
  const sections: ExportSection[] = [{ title: 'RESUMEN', content: record.summary }];
  if (record.notes?.trim()) {
    sections.push({ title: 'NOTAS', content: record.notes.trim() });
  }
  return {
    title: RECORD_TYPE_LABEL[record.recordType] ?? record.recordType,
    date: record.attendedAt,
    status: record.status === 'ACTIVE' ? 'Activo' : record.status === 'CORRECTED' ? 'Corregido' : 'Anulado',
    origin: record.origin === 'DIGITIZED' ? 'Origen digitalizado' : 'Registro manual',
    sections,
  };
}

export async function exportPatientPdf(options: {
  patient: Patient;
  items: ExportItem[];
  subtitle: string;
  fileName: string;
}): Promise<void> {
  const { patient, items, subtitle, fileName } = options;
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

  const exportedAt = new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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
          {items.length} {items.length === 1 ? 'documento' : 'documentos'} · ordenados cronológicamente
        </Text>

        {items.map((item, index) => (
          <View key={index} style={styles.item} wrap>
            <View style={styles.itemHeader} minPresenceAhead={80}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>
                {formatDate(item.date)} · {item.origin} · Estado: {item.status}
              </Text>
            </View>
            {item.sections.map((section, sectionIndex) => (
              <View key={sectionIndex}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionContent}>{section.content}</Text>
              </View>
            ))}
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
