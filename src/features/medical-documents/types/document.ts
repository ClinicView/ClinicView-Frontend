export type DocumentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'VALIDATED'
  | 'REJECTED';

export interface NerEntity {
  type: 'DIAGNOSIS' | 'SYMPTOM' | 'MEDICATION' | 'PROCEDURE' | 'CLINICAL_DATE' | 'OBSERVATION';
  value: string;
  normalizedValue?: string | null;
  sourceSpan?: { page: number; start: number; end: number } | null;
  confidence: number;
}

export interface CorrectedEntity {
  type: NerEntity['type'];
  value: string;
  normalizedValue?: string | null;
}

export type ValidationChecklistId = 'text' | 'entities' | 'sections' | 'phi';

export interface ValidationChecklistSnapshot {
  schemaVersion: number;
  locale: 'es-PE';
  items: Array<{
    id: ValidationChecklistId;
    title: string;
    statement: string;
  }>;
}

export interface DocumentCorrectionInput {
  correctedText?: string;
  correctedEntities?: CorrectedEntity[];
}

export interface FinalizeDocumentReviewInput {
  correctedText: string;
  correctedEntities: CorrectedEntity[];
  checklistItems: ValidationChecklistId[];
  attested: true;
}

/**
 * Métricas de calidad OCR/NER calculadas por el servicio IA v2.
 * cer/wer/charAccuracy en [0,1]. estimated=true cuando no hubo texto de
 * referencia y los valores derivan de la confianza del modelo.
 */
export interface OcrMetrics {
  cer: number | null;
  wer: number | null;
  charAccuracy: number | null;
  nerPrecision: number | null;
  nerRecall: number | null;
  nerF1: number | null;
  estimated: boolean;
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface MedicalDocument {
  id: string;
  patientId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  ocrText: string | null;
  nerEntities: NerEntity[] | null;
  correctedText: string | null;
  correctedEntities: CorrectedEntity[] | null;
  correctedAt: string | null;
  correctedById: string | null;
  rejectReason: string | null;
  createdAt: string;
  createdBy: string | null;
  processedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  validationChecklist: ValidationChecklistSnapshot | null;
  validationAttested: boolean;
  validationAttestedAt: string | null;
  updatedAt: string;
  version: number;
  /** Opcionales — los expone el backend cuando el servicio IA v2 los devuelve. */
  metrics?: OcrMetrics | null;
  ocrConfidence?: number | null;
  confidenceLevel?: ConfidenceLevel | null;
}

export interface DocumentsPage {
  data: MedicalDocument[];
  total: number;
  page: number;
  limit: number;
}
