import type { components } from '../../../shared/types/api.generated';

export type AllergyEntry = components['schemas']['AllergyEntryDto'];
export type ProblemEntry = components['schemas']['ProblemEntryDto'];
export type MedicationEntry = components['schemas']['MedicationEntryDto'];
export type SummaryEntry = Pick<AllergyEntry, 'id' | 'name' | 'notes'>;
export type ClinicalSummaryPayload = components['schemas']['ClinicalSummaryPayloadDto'];
export type ReconciliationStatus = ClinicalSummaryPayload['allergyStatus'];
export type ClinicalSummary = components['schemas']['ClinicalSummaryResponseDto'];
export type ClinicalSummaryHistory = components['schemas']['ClinicalSummaryHistoryResponseDto'];
