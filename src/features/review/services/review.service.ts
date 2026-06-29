import { apiGet } from '@/shared/services/api-client';
import type { ReviewQueuePage } from '../types/review';

export function getReviewQueue(params: { page?: number; limit?: number }): Promise<ReviewQueuePage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return apiGet<ReviewQueuePage>(`/review/queue${query ? `?${query}` : ''}`);
}
