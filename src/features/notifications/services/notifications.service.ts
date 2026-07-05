import { apiGet, apiPatch } from '@/shared/services/api-client';
import type { AppNotification, NotificationsResponse } from '../types/notification';

export function listNotifications(): Promise<NotificationsResponse> {
  return apiGet<NotificationsResponse>('/notifications');
}

export function markNotificationRead(id: string): Promise<AppNotification> {
  return apiPatch<AppNotification>(`/notifications/${id}/read`);
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiPatch<{ updated: number }>('/notifications/read-all');
}
