import { apiGet } from '@/shared/services/api-client';
import type { ProfileUser } from '../types/profile';

export function getCurrentUserProfile(): Promise<ProfileUser> {
  return apiGet<ProfileUser>('/auth/me');
}
