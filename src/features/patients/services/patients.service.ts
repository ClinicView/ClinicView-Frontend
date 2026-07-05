import { apiGet, apiPatch, apiPost } from '@/shared/services/api-client';
import type { CreatePatientData, Patient, PatientsPage, UpdatePatientData } from '../types/patient';

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

export function createPatient(data: CreatePatientData): Promise<Patient> {
  return apiPost<Patient>('/patients', data);
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
