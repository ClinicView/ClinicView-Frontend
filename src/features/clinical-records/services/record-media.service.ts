import { apiBlob, apiDelete, apiGet, apiUpload } from '@/shared/services/api-client';
import type { ClinicalMediaAsset } from '../types/record';

function mediaPath(patientId: string, assetId?: string): string {
  const root = `/patients/${patientId}/record-media`;
  return assetId ? `${root}/${assetId}` : root;
}

export function uploadRecordMedia(patientId: string, file: File): Promise<ClinicalMediaAsset> {
  const formData = new FormData();
  formData.set('file', file, file.name);
  return apiUpload<ClinicalMediaAsset>(mediaPath(patientId), formData);
}

export function getRecordMediaMetadata(
  patientId: string,
  assetId: string,
): Promise<ClinicalMediaAsset> {
  return apiGet<ClinicalMediaAsset>(mediaPath(patientId, assetId));
}

export function getRecordMediaContent(patientId: string, assetId: string): Promise<Blob> {
  return apiBlob(`${mediaPath(patientId, assetId)}/content`);
}

export function deleteTemporaryRecordMedia(
  patientId: string,
  assetId: string,
  expectedVersion: number,
): Promise<void> {
  const query = new URLSearchParams({ expectedVersion: String(expectedVersion) });
  return apiDelete<void>(`${mediaPath(patientId, assetId)}?${query}`);
}
