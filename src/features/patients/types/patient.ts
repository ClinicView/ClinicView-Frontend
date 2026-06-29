export type DocumentType = 'DNI' | 'CE' | 'PAS' | 'OTHER';
export type Sex = 'M' | 'F' | 'OTHER';

export interface Patient {
  id: string;
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientsPage {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
}

export interface CreatePatientData {
  documentType: DocumentType;
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Sex;
  phone?: string;
  email?: string;
  address?: string;
}

export interface UpdatePatientData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: Sex;
  phone?: string;
  email?: string;
  address?: string;
}
