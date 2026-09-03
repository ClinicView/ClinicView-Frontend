'use client';

import { useEffect, useState } from 'react';
import type { Patient } from '../types/patient';
import { getPatient } from '../services/patients.service';

export function usePatient(id: string, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPatient(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getPatient(id)
      .then((result) => {
        if (!cancelled) setPatient(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPatient(null);
          setError(err instanceof Error ? err.message : 'Error al cargar paciente.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, id]);

  return { patient, isLoading, error };
}
