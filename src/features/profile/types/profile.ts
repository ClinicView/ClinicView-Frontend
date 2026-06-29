export interface ProfileRole {
  key: string;
  name: string;
}

export interface ProfileUser {
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
  roles: ProfileRole[];
}
