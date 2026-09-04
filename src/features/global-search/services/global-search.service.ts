import { apiGet } from '@/shared/services/api-client';
import type { GlobalSearchResponse } from '../types/global-search';

export function searchGlobally(
  query: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (options.limit) params.set('limit', String(options.limit));
  return apiGet<GlobalSearchResponse>(`/search?${params.toString()}`, {
    signal: options.signal,
  });
}
