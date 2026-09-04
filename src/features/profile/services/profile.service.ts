import { apiGet, apiPatch } from '@/shared/services/api-client';
import type { ProfileUser } from '../types/profile';

export function getCurrentUserProfile(): Promise<ProfileUser> {
  return apiGet<ProfileUser>('/auth/me');
}

export function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiPatch<void>('/users/me/password', { currentPassword, newPassword });
}
