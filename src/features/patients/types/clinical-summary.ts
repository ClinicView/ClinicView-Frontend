export type ReconciliationStatus = 'UNKNOWN' | 'NONE_KNOWN' | 'RECORDED';
export interface SummaryEntry {
  id: string;
  name: string;
  notes?: string;
}
export interface AllergyEntry extends SummaryEntry {
  reaction: string;
  severity: 'UNKNOWN' | 'MILD' | 'MODERATE' | 'SEVERE';
}
export interface ProblemEntry extends SummaryEntry {
  status: 'ACTIVE' | 'RESOLVED';
  code?: string;
  onsetDate?: string;
}
export interface MedicationEntry extends SummaryEntry {
  status: 'ACTIVE' | 'STOPPED';
  regimen: string;
  indication?: string;
}
export interface ClinicalSummaryPayload {
  allergyStatus: ReconciliationStatus;
  allergies: AllergyEntry[];
  problemStatus: ReconciliationStatus;
  problems: ProblemEntry[];
  medicationStatus: ReconciliationStatus;
  medications: MedicationEntry[];
}
export interface ClinicalSummary {
  version: number;
  payload: ClinicalSummaryPayload;
  recordedByName: string | null;
  recordedBy: string | null;
  reason: string | null;
  createdAt: string | null;
}
export interface ClinicalSummaryHistory {
  data: ClinicalSummary[];
  nextBeforeVersion: number | null;
}
