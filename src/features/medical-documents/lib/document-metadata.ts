import {
  formatDateOnly,
  isFutureDateOnly,
  isValidDateOnly,
} from '../../../shared/lib/date-time';
import type { components } from '../../../shared/types/api.generated';

export const DOCUMENT_KIND_LABELS = {
  CLINICAL_HISTORY: 'Historia clínica / expediente',
  CONSULTATION: 'Consulta externa',
  EVOLUTION: 'Evolución',
  LAB_RESULT: 'Resultado de laboratorio',
  PRESCRIPTION: 'Receta / prescripción',
  PROCEDURE: 'Procedimiento',
  THERAPY_NOTE: 'Nota de terapia',
  IMAGING: 'Informe de imágenes',
  DISCHARGE: 'Epicrisis / alta',
  REFERRAL: 'Referencia / contrarreferencia',
  OTHER: 'Otro documento',
} as const;
export type DocumentClinicalMetadata = components['schemas']['DocumentClinicalMetadataDto'];
export type DocumentMetadataRevision = components['schemas']['DocumentMetadataRevisionDto'];
export function cleanDocumentMetadata(
  value: DocumentClinicalMetadata,
): DocumentClinicalMetadata {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, v]) => [key, typeof v === 'string' ? v.trim() : v])
      .filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}
export function documentMetadataError(
  value: DocumentClinicalMetadata,
): string | null {
  for (const date of [value.clinicalDate, value.clinicalEndDate]) {
    if (date && (!isValidDateOnly(date) || isFutureDateOnly(date)))
      return 'La fecha clínica debe ser una fecha válida y no futura.';
  }
  if (
    value.clinicalEndDate &&
    (!value.clinicalDate || value.clinicalEndDate < value.clinicalDate)
  )
    return 'La fecha final necesita una fecha inicial y no puede ser anterior.';
  if (
    value.pageCount !== undefined &&
    (!Number.isInteger(value.pageCount) ||
      value.pageCount < 1 ||
      value.pageCount > 5000)
  )
    return 'El número de páginas debe estar entre 1 y 5000.';
  return null;
}
/** A civil day has no clinical hour: noon only places it on its Lima calendar day. */
export function documentSortDate(doc: {
  createdAt: string;
  clinicalMetadata?: DocumentClinicalMetadata;
}): string {
  const day = doc.clinicalMetadata?.clinicalDate;
  return day && isValidDateOnly(day) ? `${day}T12:00:00-05:00` : doc.createdAt;
}
export function documentDateLabel(metadata?: DocumentClinicalMetadata): string {
  if (!metadata?.clinicalDate) return 'Fecha clínica no registrada';
  return `${formatDateOnly(metadata.clinicalDate)}${metadata.clinicalEndDate ? ` al ${formatDateOnly(metadata.clinicalEndDate)}` : ''}`;
}
export function documentMetadataSections(
  metadata: DocumentClinicalMetadata = {},
) {
  return [
    {
      title: 'IDENTIFICACIÓN CLÍNICA Y PROCEDENCIA',
      content: [
        `Tipo: ${metadata.documentKind ? DOCUMENT_KIND_LABELS[metadata.documentKind] : 'Sin clasificar'}`,
        `Fecha / período clínico: ${documentDateLabel(metadata)}`,
        `Institución de origen: ${metadata.sourceInstitution || 'No registrada'}`,
        `Servicio: ${metadata.sourceService || 'No registrado'}`,
        `Profesional del documento original: ${metadata.originalProfessional || 'No identificado'}`,
        `Páginas declaradas: ${metadata.pageCount ?? 'No registradas'}`,
        ...(metadata.sourceNotes
          ? [`Observaciones de procedencia: ${metadata.sourceNotes}`]
          : []),
      ].join('\n'),
    },
  ];
}
