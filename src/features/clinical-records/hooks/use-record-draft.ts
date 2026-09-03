'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/services/api-client';
import {
  deleteCurrentRecordDraft,
  getCurrentRecordDraft,
  saveCurrentRecordDraft,
} from '../services/record-drafts.service';
import type { RecordDraftPayload, RecordDraftResponse } from '../types/record';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'El borrador cambió en otra pestaña. Recárgalo antes de continuar para no sobrescribir información.';
  }
  return error instanceof Error ? error.message : fallback;
}

export function useRecordDraft(patientId: string) {
  const [draft, setDraft] = useState<RecordDraftResponse | null>(null);
  const draftRef = useRef<RecordDraftResponse | null>(null);
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingMutationsRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remember = useCallback((next: RecordDraftResponse | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const current = await getCurrentRecordDraft(patientId);
      remember(current);
      return current;
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo recuperar el borrador.'));
      throw cause;
    } finally {
      setIsLoading(false);
    }
  }, [patientId, remember]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getCurrentRecordDraft(patientId)
      .then((current) => {
        if (active) remember(current);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause, 'No se pudo recuperar el borrador.'));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId, remember]);

  const save = useCallback(async (payload: RecordDraftPayload) => {
    pendingMutationsRef.current += 1;
    setIsSaving(true);
    const operation = mutationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        setError(null);
        const current = draftRef.current;
        try {
          const saved = await saveCurrentRecordDraft(patientId, {
            ...(current ? { expectedVersion: current.version } : {}),
            payload,
          });
          remember(saved);
          return saved;
        } catch (cause) {
          setError(errorMessage(cause, 'No se pudo guardar el borrador.'));
          throw cause;
        }
      });
    mutationQueueRef.current = operation;
    try {
      return await operation;
    } finally {
      pendingMutationsRef.current -= 1;
      if (pendingMutationsRef.current === 0) setIsSaving(false);
    }
  }, [patientId, remember]);

  const remove = useCallback(async () => {
    pendingMutationsRef.current += 1;
    setIsSaving(true);
    const operation = mutationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const current = draftRef.current;
        if (!current) return;
        setError(null);
        try {
          await deleteCurrentRecordDraft(patientId, current.version);
          remember(null);
        } catch (cause) {
          setError(errorMessage(cause, 'No se pudo descartar el borrador.'));
          throw cause;
        }
      });
    mutationQueueRef.current = operation;
    try {
      await operation;
    } finally {
      pendingMutationsRef.current -= 1;
      if (pendingMutationsRef.current === 0) setIsSaving(false);
    }
  }, [patientId, remember]);

  return { draft, isLoading, isSaving, error, reload, save, remove };
}
