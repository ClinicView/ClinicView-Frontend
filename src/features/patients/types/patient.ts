export type DocumentType = 'DNI' | 'CE' | 'PAS' | 'OTHER';
export type Sex = 'M' | 'F' | 'OTHER';

export interface Patient {
  id: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientsPage {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
}

export interface CreatePatientData {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  phone?: string;
  email?: string;
  address?: string;
}

export interface UpdatePatientData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Sex;
  phone?: string;
  email?: string;
  address?: string;
}

export type ClinicalHistoryRecordType =
  | 'CONSULTATION'
  | 'LAB_RESULT'
  | 'PRESCRIPTION'
  | 'THERAPY_NOTE'
  | 'EVOLUTION'
  | 'PROCEDURE'
  | 'OTHER';

export interface ClinicalHistoryExportRecord {
  id: string;
  recordType: ClinicalHistoryRecordType;
  origin: 'MANUAL' | 'DIGITIZED';
  status: 'ACTIVE' | 'CORRECTED' | 'VOIDED';
  attendedAt: string;
  summary: string;
  notes: string | null;
  doctorName: string | null;
  service: string | null;
  preliminaryDiagnosis: string | null;
  plan: string | null;
  priority: 'URGENT' | 'PRIORITY' | 'NORMAL' | 'ELECTIVE';
  parentRecordId: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalHistoryExportDocument {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'VALIDATED' | 'REJECTED';
  clinicalText: string | null;
  textSource: 'CORRECTED' | 'OCR' | 'NONE';
  rejectReason: string | null;
  createdAt: string;
  processedAt: string | null;
  correctedAt: string | null;
  reviewedAt: string | null;
}

export interface ClinicalHistoryExport {
  patient: Pick<
    Patient,
    | 'id'
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
  records: ClinicalHistoryExportRecord[];
  documents: ClinicalHistoryExportDocument[];
  generatedAt: string;
}
