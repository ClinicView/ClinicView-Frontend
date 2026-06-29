export type RecordType =
  | 'CONSULTATION'
  | 'LAB_RESULT'
  | 'PRESCRIPTION'
  | 'THERAPY_NOTE'
  | 'EVOLUTION'
  | 'PROCEDURE'
  | 'OTHER';

export type RecordOrigin = 'MANUAL' | 'DIGITIZED';

export type RecordStatus = 'ACTIVE' | 'CORRECTED' | 'VOIDED';

export interface ClinicalRecord {
  id: string;
  patientId: string;
  recordType: RecordType;
  origin: RecordOrigin;
  status: RecordStatus;
  attendedAt: string;
  summary: string;
  notes: string | null;
  parentRecordId: string | null;
  voidReason: string | null;
  correctionsCount: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
}

export interface RecordsPage {
  data: ClinicalRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateRecordData {
  recordType: RecordType;
  origin?: RecordOrigin;
  attendedAt: string;
  summary: string;
  notes?: string;
}

export interface CorrectRecordData {
  attendedAt?: string;
  summary: string;
  notes?: string;
}
