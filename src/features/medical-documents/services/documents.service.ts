import { apiBlob, apiGet, apiPatch, apiPost, apiUpload } from '@/shared/services/api-client';
import type { CorrectedEntity, DocumentStatus, DocumentsPage, MedicalDocument } from '../types/document';

export function listDocuments(
  patientId: string,
  params: { status?: DocumentStatus; page?: number; limit?: number },
): Promise<DocumentsPage> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiGet<DocumentsPage>(`/patients/${patientId}/documents${query ? `?${query}` : ''}`);
}

export function getDocument(patientId: string, docId: string): Promise<MedicalDocument> {
  return apiGet<MedicalDocument>(`/patients/${patientId}/documents/${docId}`);
}

export function uploadDocument(patientId: string, file: File): Promise<MedicalDocument> {
  const form = new FormData();
  form.append('file', file);
  return apiUpload<MedicalDocument>(`/patients/${patientId}/documents`, form);
}

export function processDocument(patientId: string, docId: string): Promise<MedicalDocument> {
  return apiPost<MedicalDocument>(`/patients/${patientId}/documents/${docId}/process`);
}

export function validateDocument(patientId: string, docId: string): Promise<MedicalDocument> {
  return apiPatch<MedicalDocument>(`/patients/${patientId}/documents/${docId}/validate`);
}

export function saveDocumentCorrection(
  patientId: string,
  docId: string,
  data: { correctedText?: string; correctedEntities?: CorrectedEntity[] },
): Promise<MedicalDocument> {
  return apiPatch<MedicalDocument>(`/patients/${patientId}/documents/${docId}/correction`, data);
}

export function rejectDocument(
  patientId: string,
  docId: string,
  reason: string,
): Promise<MedicalDocument> {
  return apiPatch<MedicalDocument>(`/patients/${patientId}/documents/${docId}/reject`, { reason });
}

export function getDocumentDownloadUrl(patientId: string, docId: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  return `${base}/patients/${patientId}/documents/${docId}/file`;
}

export function getDocumentFile(patientId: string, docId: string): Promise<Blob> {
  return apiBlob(`/patients/${patientId}/documents/${docId}/file`);
}
