'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/shared/services/api-client';
import type { components } from '@/shared/types/api.generated';
export function useHistoryOverview(patientId: string, permissionKey: string) {
  const [data, setData] = useState<components['schemas']['HistoryOverviewDto'] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setData(null);
    setError('');
    setLoading(false);
    const permissions = permissionKey.split('|');
    if (
      !permissions.includes('patients.read') ||
      !permissions.some((p) => ['records.read', 'documents.read'].includes(p))
    )
      return;
    setLoading(true);
    apiGet<components['schemas']['HistoryOverviewDto']>(
      `/patients/${patientId}/clinical-history/overview`,
    )
      .then((value) => {
        if (current) setData(value);
      })
      .catch(() => {
        if (current) setError('No se pudieron consultar los indicadores completos.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [patientId, permissionKey, revision]);
  return { data, error, loading, refresh: () => setRevision((value) => value + 1) };
}
