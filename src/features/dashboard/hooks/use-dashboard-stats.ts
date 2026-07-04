'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats } from '../services/dashboard.service';
import type { DashboardStats } from '../types/dashboard';

/**
 * Estadísticas del dashboard. Si el endpoint todavía no está desplegado
 * (404) se degrada silenciosamente: la vista muestra placeholders.
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDashboardStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        // Endpoint no disponible aún — la vista muestra placeholders.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, isLoading };
}
