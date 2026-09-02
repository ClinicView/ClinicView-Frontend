'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/shared/services/api-client';
import type {
  DocumentCorrectionInput,
  FinalizeDocumentReviewInput,
  MedicalDocument,
} from '../types/document';
import {
  getDocument,
  processDocument,
  rejectDocument,
  saveDocumentCorrection,
  validateDocument,
} from '../services/documents.service';

export function useDocument(patientId: string, docId: string) {
  const [document, setDocument] = useState<MedicalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorStatus, setActionErrorStatus] = useState<number | null>(null);
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setActionError(null);
    setActionErrorStatus(null);
    try {
      const doc = await getDocument(patientId, docId);
      setDocument(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el documento.');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, docId]);

  useEffect(() => {
    void load();
  }, [load]);

  // El OCR corre en segundo plano en el backend. Mientras el documento esté
  // PROCESSING se consulta en silencio (sin spinner ni re-render) y la vista
  // se actualiza UNA sola vez, cuando el estado realmente cambia.
  useEffect(() => {
    if (document?.status !== 'PROCESSING') return;
    const interval = setInterval(async () => {
      try {
        const latest = await getDocument(patientId, docId);
        if (latest.status !== 'PROCESSING') {
          setDocument(latest);
        }
      } catch {
        // Chequeo silencioso: si falla, se reintenta en el próximo ciclo.
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [document?.status, patientId, docId]);

  async function act(fn: () => Promise<MedicalDocument>): Promise<MedicalDocument | null> {
    setIsActing(true);
    setActionError(null);
    setActionErrorStatus(null);
    try {
      const updated = await fn();
      setDocument(updated);
      return updated;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al ejecutar la acción.');
      setActionErrorStatus(err instanceof ApiError ? err.status : null);
      return null;
    } finally {
      setIsActing(false);
    }
  }

  return {
    document,
    isLoading,
    error,
    actionError,
    actionErrorStatus,
    isActing,
    process: () => act(() => processDocument(patientId, docId)),
    saveCorrection: (data: DocumentCorrectionInput) =>
      document
        ? act(() => saveDocumentCorrection(patientId, docId, {
            ...data,
            expectedVersion: document.version,
          }))
        : Promise.resolve(null),
    validate: (data: FinalizeDocumentReviewInput) =>
      document
        ? act(() => validateDocument(patientId, docId, {
            ...data,
            expectedVersion: document.version,
          }))
        : Promise.resolve(null),
    reject: (reason: string) =>
      document
        ? act(() => rejectDocument(patientId, docId, reason, document.version))
        : Promise.resolve(null),
    reload: load,
  };
}
