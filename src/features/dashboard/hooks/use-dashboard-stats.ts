'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/services/api-client';
import { getDashboardStats } from '../services/dashboard.service';
import type { DashboardStats } from '../types/dashboard';

function dashboardErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 403) {
    return 'Tu acceso a los indicadores cambió. Pide a un administrador que revise tu rol.';
  }
  if (cause instanceof ApiError && cause.status >= 500) {
    return 'El servicio de indicadores no está disponible temporalmente.';
  }
  return 'No pudimos actualizar los indicadores ni la actividad reciente.';
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDashboardStats();
      if (requestId === requestIdRef.current) setStats(result);
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setStats(null);
        setError(dashboardErrorMessage(cause));
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  return { stats, isLoading, error, reload: load };
}
