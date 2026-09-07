'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClinicalRecord, RecordStatusFilter, RecordsPage } from '../types/record';
import { listRecords } from '../services/records.service';

const LIMIT = 20;

export function useRecords(patientId: string) {
  const [data, setData] = useState<ClinicalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RecordStatusFilter>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const requestIdRef = useRef(0);
  const currentKey = `${patientId}:${statusFilter}`;

  const load = useCallback(
    async (p: number, status: RecordStatusFilter) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const result: RecordsPage = await listRecords(patientId, {
          status,
          page: p,
          limit: LIMIT,
        });
        if (requestId !== requestIdRef.current) return;
        setData(result.data);
        setLoadedKey(`${patientId}:${status}`);
        setTotal(result.total);
        setPage(p);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setData([]);
        setTotal(0);
        setLoadedKey(`${patientId}:${status}`);
        setError(err instanceof Error ? err.message : 'Error al cargar historias clínicas.');
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [patientId],
  );

  useEffect(() => {
    void load(1, statusFilter);
    return () => { requestIdRef.current += 1; };
  }, [load, statusFilter]);

  return {
    data: loadedKey === currentKey ? data : [],
    total: loadedKey === currentKey ? total : 0,
    page: loadedKey === currentKey ? page : 1,
    totalPages: loadedKey === currentKey ? Math.ceil(total / LIMIT) : 0,
    statusFilter,
    isLoading: isLoading || loadedKey !== currentKey,
    error: loadedKey === currentKey ? error : null,
    reload: () => load(page, statusFilter),
    onPageChange: (p: number) => load(p, statusFilter),
    onStatusFilterChange: (s: RecordStatusFilter) => setStatusFilter(s),
  };
}
