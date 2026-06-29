export interface ReviewPatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
}

export interface ReviewQueueItem {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  processedAt: string | null;
  createdAt: string;
  patient: ReviewPatientSummary;
}

export interface ReviewQueuePage {
  data: ReviewQueueItem[];
  total: number;
  page: number;
  limit: number;
}
