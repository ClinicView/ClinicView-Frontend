'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClinicalRecord, RecordStatus, RecordsPage } from '../types/record';
import { listRecords } from '../services/records.service';

const LIMIT = 20;

export function useRecords(patientId: string) {
  const [data, setData] = useState<ClinicalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RecordStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, status?: RecordStatus) => {
      setIsLoading(true);
      setError(null);
      try {
        const result: RecordsPage = await listRecords(patientId, {
          status,
          page: p,
          limit: LIMIT,
        });
        setData(result.data);
        setTotal(result.total);
        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar historias clínicas.');
      } finally {
        setIsLoading(false);
      }
    },
    [patientId],
  );

  useEffect(() => {
    void load(1, statusFilter);
  }, [load, statusFilter]);

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / LIMIT),
    statusFilter,
    isLoading,
    error,
    reload: () => load(page, statusFilter),
    onPageChange: (p: number) => load(p, statusFilter),
    onStatusFilterChange: (s: RecordStatus | undefined) => setStatusFilter(s),
  };
}
