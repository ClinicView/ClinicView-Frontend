export interface ReviewPatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
}

export type ReviewPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
export type ReviewQueueScope = 'AVAILABLE' | 'MINE' | 'UNASSIGNED' | 'ALL';
export type ReviewAssignmentState = 'UNASSIGNED' | 'MINE' | 'ASSIGNED';

export interface ReviewAssignee {
  id: string;
  username: string;
  fullName: string;
  profession: string | null;
}

export interface ReviewQueueItem {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  processedAt: string | null;
  createdAt: string;
  reviewPriority: ReviewPriority;
  version: number;
  assignmentState: ReviewAssignmentState;
  assignedAt: string | null;
  assignee: ReviewAssignee | null;
  patient: ReviewPatientSummary;
}

export interface ReviewQueuePage {
  data: ReviewQueueItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ReviewAssignmentResponse {
  documentId: string;
  reviewPriority: ReviewPriority;
  version: number;
  assignedAt: string | null;
  assignee: ReviewAssignee | null;
}
