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

export type RecordPriority = 'URGENT' | 'PRIORITY' | 'NORMAL' | 'ELECTIVE';

export const RECORD_SCHEMA_VERSION = 1 as const;
export type RecordSchemaVersion = typeof RECORD_SCHEMA_VERSION;

export interface VitalSignsDetails {
  systolicBloodPressure?: number;
  diastolicBloodPressure?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperatureCelsius?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
}

export interface DiagnosisDetails {
  description: string;
  code?: string;
  codeSystem?: string;
  type?: 'PRELIMINARY' | 'CONFIRMED' | 'RULED_OUT';
}

export interface ConsultationDetails {
  chiefComplaint: string;
  presentIllness?: string;
  relevantHistory?: string;
  vitalSigns?: VitalSignsDetails;
  physicalExam?: string;
  diagnoses?: DiagnosisDetails[];
  followUp?: string;
}

export interface EvolutionDetails {
  evolution: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  treatmentResponse?: string;
  incidents?: string;
  followUp?: string;
}

export interface LabResultItem {
  analyte: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL' | 'ABNORMAL';
}

export interface LabResultDetails {
  studyName: string;
  laboratoryName?: string;
  specimen?: string;
  collectedAt?: string;
  issuedAt?: string;
  results: LabResultItem[];
  interpretation?: string;
}

export interface MedicationDetails {
  name: string;
  presentation?: string;
  concentration?: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity?: string;
  instructions?: string;
}

export interface PrescriptionDetails {
  indication?: string;
  medications: MedicationDetails[];
  validFrom?: string;
  validUntil?: string;
  nonPharmacologicalInstructions?: string;
}

export interface ProcedureDetails {
  procedureName: string;
  indication?: string;
  bodySite?: string;
  laterality?: 'LEFT' | 'RIGHT' | 'BILATERAL' | 'NOT_APPLICABLE';
  consentStatus?: 'DOCUMENTED' | 'NOT_REQUIRED' | 'UNKNOWN';
  technique: string;
  anesthesia?: string;
  findings?: string;
  complications: string;
  outcome?: string;
  postProcedureCare?: string;
}

export interface TherapyMeasurementDetails {
  name: string;
  value: string;
  unit?: string;
}

export interface TherapyNoteDetails {
  discipline: string;
  sessionNumber?: number;
  goals?: string;
  baselineStatus?: string;
  interventions: string;
  response: string;
  measurements?: TherapyMeasurementDetails[];
  homeInstructions?: string;
  nextSessionAt?: string;
}

export interface OtherRecordDetails {
  title: string;
  category: string;
  context?: string;
  content: string;
}

/** Fuente tipada única para el payload clínico v1. */
export interface RecordDetailsByType {
  CONSULTATION: ConsultationDetails;
  EVOLUTION: EvolutionDetails;
  LAB_RESULT: LabResultDetails;
  PRESCRIPTION: PrescriptionDetails;
  PROCEDURE: ProcedureDetails;
  THERAPY_NOTE: TherapyNoteDetails;
  OTHER: OtherRecordDetails;
}

export type RecordDetails = RecordDetailsByType[RecordType];

/** Unión discriminada para impedir combinar un tipo de registro con otros detalles. */
export type TypedRecordDetailsPayload = {
  [Type in RecordType]: {
    recordType: Type;
    schemaVersion: RecordSchemaVersion;
    details: RecordDetailsByType[Type];
  };
}[RecordType];

export type DeepPartial<T> = T extends Array<infer Item>
  ? Array<DeepPartial<Item>>
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export type PartialRecordDetails = {
  [Type in RecordType]: {
    recordType: Type;
    schemaVersion: RecordSchemaVersion;
    details: DeepPartial<RecordDetailsByType[Type]>;
  };
}[RecordType];

export interface ClinicalRecord {
  id: string;
  patientId: string;
  recordType: RecordType;
  origin: RecordOrigin;
  status: RecordStatus;
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
  priority: RecordPriority;
  schemaVersion: RecordSchemaVersion;
  details: RecordDetails;
  version: number;
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

export interface CreateRecordCommonData {
  attendedAt: string;
  summary: string;
  notes?: string;
  professionalId?: string;
  doctorName?: string;
  professionalLicense?: string;
  service?: string;
  preliminaryDiagnosis?: string;
  plan?: string;
  priority?: RecordPriority;
  draftId?: string;
}

export type TypedCreateRecordData = CreateRecordCommonData & TypedRecordDetailsPayload;

/**
 * Compatible con integraciones antiguas; el formulario adaptativo siempre envía
 * `details` y `schemaVersion`. `origin` no se envía: el backend fija MANUAL.
 */
export interface CreateRecordData extends CreateRecordCommonData {
  recordType: RecordType;
  schemaVersion?: RecordSchemaVersion;
  details?: RecordDetails;
}

export type CorrectRecordData = {
  expectedVersion: number;
  attendedAt: string;
  summary: string;
  notes: string | null;
  professionalId: string | null;
  doctorName: string | null;
  professionalLicense: string | null;
  service: string | null;
  preliminaryDiagnosis: string | null;
  plan: string | null;
  priority: RecordPriority;
} & TypedRecordDetailsPayload;

export interface RecordDraftPayload {
  recordType?: RecordType;
  attendedAt?: string;
  summary?: string;
  notes?: string;
  professionalId?: string;
  doctorName?: string;
  professionalLicense?: string;
  service?: string;
  preliminaryDiagnosis?: string;
  plan?: string;
  priority?: RecordPriority;
  schemaVersion?: RecordSchemaVersion;
  details?: DeepPartial<RecordDetails>;
}

export interface RecordDraftResponse {
  id: string;
  patientId: string;
  payload: RecordDraftPayload;
  version: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveRecordDraftData {
  expectedVersion?: number;
  payload: RecordDraftPayload;
}
