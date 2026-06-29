'use client';

import { useEffect, useState } from 'react';
import type { Patient } from '../types/patient';
import { getPatient } from '../services/patients.service';

export function usePatient(id: string) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    getPatient(id)
      .then(setPatient)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Error al cargar paciente.'),
      )
      .finally(() => setIsLoading(false));
  }, [id]);

  return { patient, isLoading, error };
}
