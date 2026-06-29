'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CorrectedEntity, MedicalDocument } from '../types/document';
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
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
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

  async function act(fn: () => Promise<MedicalDocument>): Promise<void> {
    setIsActing(true);
    setActionError(null);
    try {
      const updated = await fn();
      setDocument(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al ejecutar la acción.');
    } finally {
      setIsActing(false);
    }
  }

  return {
    document,
    isLoading,
    error,
    actionError,
    isActing,
    process: () => act(() => processDocument(patientId, docId)),
    saveCorrection: (data: { correctedText?: string; correctedEntities?: CorrectedEntity[] }) =>
      act(() => saveDocumentCorrection(patientId, docId, data)),
    validate: () => act(() => validateDocument(patientId, docId)),
    reject: (reason: string) => act(() => rejectDocument(patientId, docId, reason)),
    reload: load,
  };
}
