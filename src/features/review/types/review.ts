import type { components, operations } from '@/shared/types/api.generated';

type ReviewQueueQuery = NonNullable<
  operations['ReviewController_getQueue']['parameters']['query']
>;

type GeneratedReviewAssignee = components['schemas']['ReviewAssigneeDto'];
type GeneratedReviewQueueItem = components['schemas']['ReviewQueueItemDto'];
type GeneratedReviewAssignmentResponse =
  components['schemas']['ReviewAssignmentResponseDto'];

export type ReviewAssignee = Omit<GeneratedReviewAssignee, 'profession'> &
  Required<Pick<GeneratedReviewAssignee, 'profession'>>;
export type ReviewPatientSummary = components['schemas']['ReviewPatientSummaryDto'];
export type ReviewQueueItem = Omit<
  GeneratedReviewQueueItem,
  'processedAt' | 'assignedAt' | 'assignee'
> &
  Required<Pick<GeneratedReviewQueueItem, 'processedAt' | 'assignedAt' | 'assignee'>>;
export type ReviewQueuePage = Omit<
  components['schemas']['ReviewQueuePageDto'],
  'data'
> & { data: ReviewQueueItem[] };
export type ReviewAssignmentResponse = Omit<
  GeneratedReviewAssignmentResponse,
  'assignedAt' | 'assignee'
> &
  Required<Pick<GeneratedReviewAssignmentResponse, 'assignedAt' | 'assignee'>>;

export type ReviewPriority = GeneratedReviewQueueItem['reviewPriority'];
export type ReviewAssignmentState = GeneratedReviewQueueItem['assignmentState'];
export type ReviewQueueScope = NonNullable<ReviewQueueQuery['scope']>;
