import { apiDelete, apiGet, apiPut } from '@/shared/services/api-client';
import type {
  RecordDraftResponse,
  SaveRecordDraftData,
} from '../types/record';

function currentDraftPath(patientId: string): string {
  return `/patients/${patientId}/records/draft/current`;
}

export function getCurrentRecordDraft(patientId: string): Promise<RecordDraftResponse | null> {
  return apiGet<RecordDraftResponse | undefined>(currentDraftPath(patientId))
    .then((draft) => draft ?? null);
}

export function saveCurrentRecordDraft(
  patientId: string,
  data: SaveRecordDraftData,
): Promise<RecordDraftResponse> {
  return apiPut<RecordDraftResponse>(currentDraftPath(patientId), data);
}

export function deleteCurrentRecordDraft(
  patientId: string,
  expectedVersion: number,
): Promise<void> {
  const query = new URLSearchParams({ expectedVersion: String(expectedVersion) });
  return apiDelete<void>(`${currentDraftPath(patientId)}?${query}`);
}
