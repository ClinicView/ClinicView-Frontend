export type NotificationType =
  | 'DOCUMENT_PROCESSED'
  | 'DOCUMENT_FAILED'
  | 'DOCUMENT_VALIDATED'
  | 'DOCUMENT_REVIEW_ASSIGNED'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  patientId: string | null;
  documentId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: AppNotification[];
  unreadCount: number;
}
