import { apiGet } from '@/shared/services/api-client';

export interface Professional {
  id: string;
  fullName: string;
  profession: string | null;
}

/** Busca profesionales activos registrados en el sistema (para selectores clínicos). */
export function searchProfessionals(query: string): Promise<Professional[]> {
  const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  return apiGet<Professional[]>(`/users/professionals${qs}`);
}
