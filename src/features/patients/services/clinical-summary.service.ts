import { apiGet, apiPut } from '@/shared/services/api-client';
import type {
  ClinicalSummary,
  ClinicalSummaryPayload,
  ClinicalSummaryHistory,
} from '../types/clinical-summary';

export function getClinicalSummary(patientId: string) {
  return apiGet<ClinicalSummary>(`/patients/${patientId}/clinical-summary`);
}
export function saveClinicalSummary(
  patientId: string,
  payload: ClinicalSummaryPayload,
  expectedVersion: number,
  reason: string,
) {
  return apiPut<ClinicalSummary>(`/patients/${patientId}/clinical-summary`, {
    ...payload,
    expectedVersion,
    reason,
  });
}
export function getClinicalSummaryHistory(
  patientId: string,
  beforeVersion?: number,
) {
  return apiGet<ClinicalSummaryHistory>(
    `/patients/${patientId}/clinical-summary/history${beforeVersion ? `?beforeVersion=${beforeVersion}` : ''}`,
  );
}
