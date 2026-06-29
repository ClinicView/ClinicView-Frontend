'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Patient } from '../types/patient';
import { listPatients } from '../services/patients.service';

const LIMIT = 20;

export function usePatients() {
  const [data, setData] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p: number, s: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listPatients({ search: s || undefined, page: p, limit: LIMIT });
      setData(result.data);
      setTotal(result.total);
      setPage(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pacientes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, '');
  }, [load]);

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(1, value), 400);
  }

  function onPageChange(p: number) {
    void load(p, search);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return { data, total, page, totalPages, search, isLoading, error, onSearchChange, onPageChange, limit: LIMIT };
}
