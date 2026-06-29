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
  updatedAt: string;
}

export interface DocumentsPage {
  data: MedicalDocument[];
  total: number;
  page: number;
  limit: number;
}
