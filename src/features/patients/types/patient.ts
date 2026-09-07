import type {
  ClinicalRecordAttachment,
  RecordDetails,
  RecordSchemaVersion,
} from '../../clinical-records/types/record';
import type { ClinicalSummary } from './clinical-summary';
import type { DocumentClinicalMetadata, DocumentMetadataRevision } from '../../medical-documents/lib/document-metadata';

export type DocumentType = 'DNI' | 'CE' | 'PAS' | 'OTHER';
export type Sex = 'M' | 'F' | 'OTHER';

export interface PatientContext {
  medicalRecordNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  representativeName?: string | null;
  insuranceName?: string | null;
  insuranceNumber?: string | null;
}

export interface Patient extends PatientContext {
  version: number;
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

export interface CreatePatientData extends PatientContext {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  phone?: string;
  email?: string;
  address?: string;
  draftId?: string;
  expectedDraftVersion?: number;
}

export interface PatientRegistrationDraftPayload {
  documentType?: DocumentType;
  documentNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Sex;
  phone?: string;
  email?: string;
  address?: string;
}

export interface PatientRegistrationDraft {
  id: string;
  payload: PatientRegistrationDraftPayload;
  version: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavePatientRegistrationDraftData {
  expectedId?: string;
  expectedVersion?: number;
  payload: PatientRegistrationDraftPayload;
}

export interface UpdatePatientData extends PatientContext {
  expectedVersion: number;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Sex;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
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
  attendancePrecision?: 'INSTANT' | 'DAY';
  createdByNameSnapshot?: string | null;
  source?: import('../../../shared/types/api.generated').components['schemas']['RecordSourceDto'] | null;
  id: string;
  recordType: ClinicalHistoryRecordType;
  origin: 'MANUAL' | 'DIGITIZED';
  status: 'ACTIVE' | 'CORRECTED' | 'VOIDED';
  attendedAt: string;
  summary: string;
  notes: string | null;
  doctorName: string | null;
  professionalId: string | null;
  professionalNameSnapshot: string | null;
  professionalLicenseSnapshot: string | null;
  service: string | null;
  preliminaryDiagnosis: string | null;
  plan: string | null;
  priority: 'URGENT' | 'PRIORITY' | 'NORMAL' | 'ELECTIVE';
  schemaVersion: RecordSchemaVersion;
  details: RecordDetails;
  version: number;
  parentRecordId: string | null;
  voidReason: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  attachments: ClinicalRecordAttachment[];
}

export interface ClinicalHistoryExportDocument {
  clinicalMetadata?: DocumentClinicalMetadata;
  metadataRevisions?: DocumentMetadataRevision[];
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
  correctedById: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  validationChecklist: {
    schemaVersion: number;
    locale: 'es-PE';
    items: Array<{ id: string; title: string; statement: string }>;
  } | null;
  validationAttestedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ClinicalHistoryExport {
  clinicalSummaryRevisions: ClinicalSummary[];
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
    | 'medicalRecordNumber'
    | 'emergencyContactName'
    | 'emergencyContactPhone'
    | 'emergencyContactRelationship'
    | 'representativeName'
    | 'insuranceName'
    | 'insuranceNumber'
  >;
  records: ClinicalHistoryExportRecord[];
  documents: ClinicalHistoryExportDocument[];
  generatedAt: string;
}
