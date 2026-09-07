import { apiBlob, apiGet, apiPatch, apiPost, apiUpload } from '@/shared/services/api-client';
import type {
  DocumentCorrectionInput,
  DocumentStatus,
  DocumentsPage,
  FinalizeDocumentReviewInput,
  MedicalDocument,
} from '../types/document';
import { cleanDocumentMetadata, type DocumentClinicalMetadata, type DocumentMetadataRevision } from '../lib/document-metadata';

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

export function uploadDocument(patientId: string, file: File, metadata: DocumentClinicalMetadata = {}): Promise<MedicalDocument> {
  const form = new FormData();
  form.append('file', file);
  for (const [key, value] of Object.entries(cleanDocumentMetadata(metadata))) form.append(key, String(value));
  return apiUpload<MedicalDocument>(`/patients/${patientId}/documents`, form);
}

export function processDocument(patientId: string, docId: string): Promise<MedicalDocument> {
  return apiPost<MedicalDocument>(`/patients/${patientId}/documents/${docId}/process`);
}

export function validateDocument(
  patientId: string,
  docId: string,
  data: FinalizeDocumentReviewInput & { expectedVersion: number },
): Promise<MedicalDocument> {
  return apiPatch<MedicalDocument>(`/patients/${patientId}/documents/${docId}/validate`, data);
}

export function updateDocumentMetadata(patientId: string, docId: string, metadata: DocumentClinicalMetadata, expectedVersion: number, reason: string) {
  return apiPatch<{ id: string; version: number; clinicalMetadata: DocumentClinicalMetadata }>(`/patients/${patientId}/documents/${docId}/metadata`, { metadata: cleanDocumentMetadata(metadata), expectedVersion, reason });
}
export function getDocumentMetadataHistory(patientId: string, docId: string, beforeVersion?: number) {
  return apiGet<{ data: DocumentMetadataRevision[]; nextBeforeVersion: number | null }>(`/patients/${patientId}/documents/${docId}/metadata/history${beforeVersion !== undefined ? `?beforeVersion=${beforeVersion}` : ''}`);
}

export function saveDocumentCorrection(
  patientId: string,
  docId: string,
  data: DocumentCorrectionInput & { expectedVersion: number },
): Promise<MedicalDocument> {
  return apiPatch<MedicalDocument>(`/patients/${patientId}/documents/${docId}/correction`, data);
}

export function rejectDocument(
  patientId: string,
  docId: string,
  reason: string,
  expectedVersion: number,
): Promise<MedicalDocument> {
  return apiPatch<MedicalDocument>(`/patients/${patientId}/documents/${docId}/reject`, {
    reason,
    expectedVersion,
  });
}

export function getDocumentDownloadUrl(patientId: string, docId: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  return `${base}/patients/${patientId}/documents/${docId}/file`;
}

export function getDocumentFile(patientId: string, docId: string): Promise<Blob> {
  return apiBlob(`/patients/${patientId}/documents/${docId}/file`);
}
