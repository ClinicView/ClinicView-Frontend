import { apiGet, apiPatch, apiPost } from '@/shared/services/api-client';
import type {
  ReviewAssignee,
  ReviewAssignmentResponse,
  ReviewPriority,
  ReviewQueuePage,
  ReviewQueueScope,
} from '../types/review';

export function getReviewQueue(params: {
  page?: number;
  limit?: number;
  scope?: ReviewQueueScope;
  priority?: ReviewPriority | '';
}): Promise<ReviewQueuePage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.scope) qs.set('scope', params.scope);
  if (params.priority) qs.set('priority', params.priority);
  const query = qs.toString();
  return apiGet<ReviewQueuePage>(`/review/queue${query ? `?${query}` : ''}`);
}

export function listReviewAssignees(
  query = '',
  signal?: AbortSignal,
): Promise<{ data: ReviewAssignee[] }> {
  const qs = new URLSearchParams();
  if (query.trim()) qs.set('q', query.trim());
  const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
  return apiGet<{ data: ReviewAssignee[] }>(`/review/assignees${suffix}`, { signal });
}

export function claimReviewDocument(
  documentId: string,
  expectedVersion: number,
): Promise<ReviewAssignmentResponse> {
  return apiPost<ReviewAssignmentResponse>(`/review/documents/${documentId}/claim`, {
    expectedVersion,
  });
}

export function assignReviewDocument(
  documentId: string,
  assigneeId: string,
  expectedVersion: number,
): Promise<ReviewAssignmentResponse> {
  return apiPatch<ReviewAssignmentResponse>(`/review/documents/${documentId}/assignment`, {
    assigneeId,
    expectedVersion,
  });
}

export function releaseReviewDocument(
  documentId: string,
  expectedVersion: number,
): Promise<ReviewAssignmentResponse> {
  return apiPost<ReviewAssignmentResponse>(`/review/documents/${documentId}/release`, {
    expectedVersion,
  });
}

export function updateReviewPriority(
  documentId: string,
  priority: ReviewPriority,
  expectedVersion: number,
): Promise<ReviewAssignmentResponse> {
  return apiPatch<ReviewAssignmentResponse>(`/review/documents/${documentId}/priority`, {
    priority,
    expectedVersion,
  });
}
