import { apiGet } from '@/shared/services/api-client';
import type { DashboardStats } from '../types/dashboard';

export function getDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/dashboard/stats');
}
