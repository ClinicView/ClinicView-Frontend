export interface AdminRole {
  key: string;
  name: string;
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
  roles: AdminRole[];
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
