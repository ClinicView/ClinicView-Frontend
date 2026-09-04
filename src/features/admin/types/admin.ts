export interface AdminRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: AdminPermission[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPermission {
  id: string;
  key: string;
  description: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  documentType: 'DNI' | 'CE' | 'PAS' | 'OTHER' | null;
  documentNumber: string | null;
  profession: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: AdminUserRole[];
}

export interface AdminUserRole {
  key: string;
  name: string;
}

export interface CreateAdminUserData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  documentType?: 'DNI' | 'CE' | 'PAS' | 'OTHER';
  documentNumber?: string;
  profession?: string;
  roleKey?: string;
  password: string;
}

export interface UpdateAdminUserData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  documentType?: 'DNI' | 'CE' | 'PAS' | 'OTHER' | null;
  documentNumber?: string;
  profession?: string;
}

export interface CreateAdminRoleData {
  key: string;
  name: string;
  description?: string;
}

export interface UpdateAdminRoleData {
  name?: string;
  description?: string;
}
