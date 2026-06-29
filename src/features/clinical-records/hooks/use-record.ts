'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClinicalRecord } from '../types/record';
import { getRecord, voidRecord } from '../services/records.service';

export function useRecord(patientId: string, recordId: string) {
  const [record, setRecord] = useState<ClinicalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await getRecord(patientId, recordId);
      setRecord(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la historia clínica.');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function doVoid(reason: string): Promise<void> {
    setIsActing(true);
    setActionError(null);
    try {
      const updated = await voidRecord(patientId, recordId, reason);
      setRecord(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al anular la historia.');
    } finally {
      setIsActing(false);
    }
  }

  return { record, isLoading, error, actionError, isActing, void: doVoid, reload: load };
}
