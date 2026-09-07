import { apiGet, apiPatch, apiPost } from '@/shared/services/api-client';
import type {
  ClinicalRecord,
  CorrectRecordData,
  CreateRecordData,
  RecordStatusFilter,
  RecordsPage,
} from '../types/record';

export function listRecords(
  patientId: string,
  params: { status?: RecordStatusFilter; page?: number; limit?: number; sourceDocumentId?: string },
): Promise<RecordsPage> {
  const qs = new URLSearchParams();
  if (params.sourceDocumentId) qs.set('sourceDocumentId', params.sourceDocumentId);
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
  expectedVersion: number,
): Promise<ClinicalRecord> {
  return apiPatch<ClinicalRecord>(`/patients/${patientId}/records/${recordId}/void`, {
    reason,
    expectedVersion,
  });
}

export function publishRecord(patientId: string, data: CreateRecordData, source: import('../types/record').PublicationSource): Promise<ClinicalRecord> {
  return apiPost<ClinicalRecord>(`/patients/${patientId}/records/from-document`, { ...data, ...source });
}
