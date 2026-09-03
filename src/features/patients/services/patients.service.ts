import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/shared/services/api-client';
import type {
  ClinicalHistoryExport,
  CreatePatientData,
  Patient,
  PatientRegistrationDraft,
  PatientsPage,
  SavePatientRegistrationDraftData,
  UpdatePatientData,
} from '../types/patient';

export function listPatients(params: {
  search?: string;
  documentType?: string;
  documentNumber?: string;
  page?: number;
  limit?: number;
}): Promise<PatientsPage> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.documentType) qs.set('documentType', params.documentType);
  if (params.documentNumber) qs.set('documentNumber', params.documentNumber);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiGet<PatientsPage>(`/patients${query ? `?${query}` : ''}`);
}

export interface PatientStats {
  total: number;
  active: number;
  newThisMonth: number;
  withPendingDocs: number;
  withRecentDocs: number;
}

export function getPatientStats(): Promise<PatientStats> {
  return apiGet<PatientStats>('/patients/stats');
}

export function getPatient(id: string): Promise<Patient> {
  return apiGet<Patient>(`/patients/${id}`);
}

export function getClinicalHistoryExport(id: string): Promise<ClinicalHistoryExport> {
  return apiGet<ClinicalHistoryExport>(`/patients/${id}/clinical-history/export`);
}

export function createPatient(data: CreatePatientData): Promise<Patient> {
  return apiPost<Patient>('/patients', data);
}

export function getCurrentPatientRegistrationDraft(): Promise<PatientRegistrationDraft | null> {
  return apiGet<PatientRegistrationDraft | undefined>('/patients/draft/current')
    .then((draft) => draft ?? null);
}

export function saveCurrentPatientRegistrationDraft(
  data: SavePatientRegistrationDraftData,
): Promise<PatientRegistrationDraft> {
  return apiPut<PatientRegistrationDraft>('/patients/draft/current', data);
}

export function deleteCurrentPatientRegistrationDraft(
  draftId: string,
  expectedVersion: number,
): Promise<void> {
  const query = new URLSearchParams({
    draftId,
    expectedVersion: String(expectedVersion),
  });
  return apiDelete<void>(`/patients/draft/current?${query}`);
}

export function updatePatient(id: string, data: UpdatePatientData): Promise<Patient> {
  return apiPatch<Patient>(`/patients/${id}`, data);
}

export function deactivatePatient(id: string): Promise<Patient> {
  return apiPatch<Patient>(`/patients/${id}/deactivate`);
}

export function activatePatient(id: string): Promise<Patient> {
  return apiPatch<Patient>(`/patients/${id}/activate`);
}
