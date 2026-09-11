import { apiBlob, apiGet, apiPatch } from '@/shared/services/api-client';
import type { OcrLayout, OcrReviewInput, OcrRevision } from '../types/ocr-layout';

function layoutPath(patientId: string, docId: string) {
  return `/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(docId)}/ocr-layout`;
}

export function getOcrLayout(patientId: string, docId: string) {
  return apiGet<OcrLayout>(layoutPath(patientId, docId));
}

export function saveOcrReview(patientId: string, docId: string, input: OcrReviewInput) {
  return apiPatch<OcrLayout>(`${layoutPath(patientId, docId)}/review`, input);
}

export function getOcrReviewRevision(patientId: string, docId: string, runId: string, revision: number) {
  return apiGet<OcrRevision>(`${layoutPath(patientId, docId)}/reviews/${revision}?${new URLSearchParams({ runId })}`);
}

export function getOcrPageImage(patientId: string, docId: string, page: number, runId: string) {
  // The authenticated client handles JWT refresh; tokens never enter URLs or image markup.
  return apiBlob(`${layoutPath(patientId, docId)}/pages/${page}/image?${new URLSearchParams({ runId })}`);
}
