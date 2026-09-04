import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/shared/services/api-client';
import type {
  AdminPermission,
  AdminRole,
  AdminUser,
  CreateAdminRoleData,
  CreateAdminUserData,
  UpdateAdminRoleData,
  UpdateAdminUserData,
} from '../types/admin';

export function listUsers(): Promise<AdminUser[]> {
  return apiGet<AdminUser[]>('/users');
}

export function getUser(id: string): Promise<AdminUser> {
  return apiGet<AdminUser>(`/users/${id}`);
}

export function createUser(data: CreateAdminUserData): Promise<AdminUser> {
  return apiPost<AdminUser>('/users', data);
}

export function deactivateUser(id: string): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/users/${id}/deactivate`);
}

export function reactivateUser(id: string): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/users/${id}/reactivate`);
}

export function updateUser(id: string, data: UpdateAdminUserData): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/users/${id}`, data);
}

export function resetUserPassword(id: string, newPassword: string): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/users/${id}/password`, { newPassword });
}

export function assignRole(userId: string, roleKey: string): Promise<AdminUser> {
  return apiPatch<AdminUser>(`/users/${userId}/role`, { roleKey });
}

export function listRoles(): Promise<AdminRole[]> {
  return apiGet<AdminRole[]>('/roles');
}

export function listPermissions(): Promise<AdminPermission[]> {
  return apiGet<AdminPermission[]>('/roles/permissions');
}

export function createRole(data: CreateAdminRoleData): Promise<AdminRole> {
  return apiPost<AdminRole>('/roles', data);
}

export function updateRole(
  id: string,
  data: UpdateAdminRoleData,
  expectedUpdatedAt: string,
): Promise<AdminRole> {
  return apiPatch<AdminRole>(`/roles/${id}`, { ...data, expectedUpdatedAt });
}

export function replaceRolePermissions(
  id: string,
  permissionKeys: string[],
  expectedUpdatedAt: string,
): Promise<AdminRole> {
  return apiPut<AdminRole>(`/roles/${id}/permissions`, {
    permissionKeys,
    expectedUpdatedAt,
  });
}

export function deleteRole(id: string, expectedUpdatedAt: string): Promise<void> {
  return apiDelete<void>(
    `/roles/${id}?expectedUpdatedAt=${encodeURIComponent(expectedUpdatedAt)}`,
  );
}
