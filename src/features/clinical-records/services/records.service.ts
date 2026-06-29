import { apiGet, apiPatch, apiPost } from '@/shared/services/api-client';
import type {
  ClinicalRecord,
  CorrectRecordData,
  CreateRecordData,
  RecordStatus,
  RecordsPage,
} from '../types/record';

export function listRecords(
  patientId: string,
  params: { status?: RecordStatus; page?: number; limit?: number },
): Promise<RecordsPage> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiGet<RecordsPage>(`/patients/${patientId}/records${query ? `?${query}` : ''}`);
}

export function getRecord(patientId: string, recordId: string): Promise<ClinicalRecord> {
  return apiGet<ClinicalRecord>(`/patients/${patientId}/records/${recordId}`);
}

export function createRecord(
  patientId: string,
  data: CreateRecordData,
): Promise<ClinicalRecord> {
  return apiPost<ClinicalRecord>(`/patients/${patientId}/records`, data);
}

export function correctRecord(
  patientId: string,
  recordId: string,
  data: CorrectRecordData,
): Promise<ClinicalRecord> {
  return apiPost<ClinicalRecord>(`/patients/${patientId}/records/${recordId}/correct`, data);
}

export function voidRecord(
  patientId: string,
  recordId: string,
  reason: string,
): Promise<ClinicalRecord> {
  return apiPatch<ClinicalRecord>(`/patients/${patientId}/records/${recordId}/void`, { reason });
}
