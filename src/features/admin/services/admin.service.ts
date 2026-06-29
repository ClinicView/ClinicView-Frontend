import { apiGet, apiPatch, apiPost } from '@/shared/services/api-client';
import type { AdminRole, AdminUser, CreateAdminUserData } from '../types/admin';

export function listUsers(): Promise<AdminUser[]> {
  return apiGet<AdminUser[]>('/users');
}

export function createUser(data: CreateAdminUserData): Promise<AdminUser> {
  return apiPost<AdminUser>('/users', data);
}

export function deactivateUser(id: string): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/users/${id}/deactivate`);
}

export function assignRole(userId: string, roleKey: string): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/users/${userId}/role`, { roleKey });
}

export function listRoles(): Promise<AdminRole[]> {
  return apiGet<{ id: string; key: string; name: string }[]>('/roles').then((roles) =>
    roles.map((r) => ({ key: r.key, name: r.name })),
  );
}
