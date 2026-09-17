'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/services/api-client';
import type { DocumentCorrectionInput, FinalizeDocumentReviewInput, MedicalDocument } from '../types/document';
import { getDocument, processDocument, rejectDocument, saveDocumentCorrection, validateDocument } from '../services/documents.service';
import { claimReviewDocument, releaseReviewDocument } from '@/features/review/services/review.service';
import { DocumentRequestGate } from '../lib/document-request-gate';
import { acceptsProcessingSnapshot, canRequestProcessing } from '../lib/document-processing';
import { pollDocument } from '../lib/document-polling';

export function useDocument(patientId: string, docId: string) {
  const [document, setDocument] = useState<MedicalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorStatus, setActionErrorStatus] = useState<number | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingConnectionLost, setProcessingConnectionLost] = useState(false);
  const [processSubmissionUncertain, setProcessSubmissionUncertain] = useState(false);
  const gate = useRef(new DocumentRequestGate());
  gate.current.setScope(patientId, docId);
  const currentDocument = useRef(document);
  currentDocument.current = document;
  const writing = useRef(false);
  const loadingRead = useRef(false);
  const mounted = useRef(true);
  const readController = useRef<AbortController | null>(null);
  const scope = useRef(`${patientId}/${docId}`);
  if (scope.current !== `${patientId}/${docId}`) {
    scope.current = `${patientId}/${docId}`;
    writing.current = false;
    loadingRead.current = false;
  }

  const load = useCallback(async (silent = false): Promise<boolean> => {
    if (!mounted.current || writing.current || scope.current !== `${patientId}/${docId}`) return false;
    const ticket = gate.current.begin();
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    loadingRead.current = true;
    if (!silent) setIsLoading(true);
    setIsRefreshing(silent);
    setIsActing(false);
    setError(null); setActionError(null); setActionErrorStatus(null);
    try {
      const result = await getDocument(patientId, docId, controller.signal);
      const prior = currentDocument.current;
      const minimum = prior?.id === docId && prior.patientId === patientId ? prior.version : 0;
      if (!gate.current.current(ticket)) return false;
      if (!gate.current.accepts(ticket, result, minimum)) throw new Error('La respuesta no corresponde a la identidad o versión actual del documento. Recarga la página.');
      if (prior?.id === docId && prior.patientId === patientId && !acceptsProcessingSnapshot(prior, result)) return false;
      currentDocument.current = result; setDocument(result);
      setProcessingConnectionLost(false); setProcessSubmissionUncertain(false);
      return true;
    } catch (caught) {
      if (gate.current.current(ticket)) {
        if (!silent) setError(controller.signal.aborted ? 'La consulta tardó demasiado. Reintenta cargar el documento.' : caught instanceof Error ? caught.message : 'Error al cargar el documento.');
        else setProcessingConnectionLost(true);
      }
      return false;
    } finally {
      clearTimeout(timeout);
      if (gate.current.current(ticket)) { loadingRead.current = false; setIsRefreshing(false); if (!silent) setIsLoading(false); }
    }
  }, [patientId, docId]);

  useEffect(() => {
    const activeGate = gate.current;
    mounted.current = true;
    void load();
    return () => { mounted.current = false; activeGate.invalidate(); readController.current?.abort(); };
  }, [load]);

  const shouldPollProcessing = Boolean(document && document.id === docId && document.patientId === patientId && (document.status === 'PROCESSING' || processSubmissionUncertain));
  useEffect(() => {
    if (!shouldPollProcessing) return;
    let cancelled = false;
    const stop = pollDocument({
      read: async (signal) => {
        if (cancelled || writing.current || loadingRead.current) return 'skip';
        const ticket = gate.current.begin();
        try {
          const latest = await getDocument(patientId, docId, signal);
          if (cancelled || !gate.current.current(ticket)) return 'skip';
          if (!gate.current.accepts(ticket, latest, currentDocument.current?.version ?? 0)) throw new Error('La consulta no corresponde al documento actual.');
          if (!acceptsProcessingSnapshot(currentDocument.current, latest)) return 'skip';
          currentDocument.current = latest; setDocument(latest);
          setProcessingConnectionLost(false); setProcessSubmissionUncertain(false);
          return latest.status === 'PROCESSING' ? 'continue' : 'stop';
        } catch (caught) {
          if (cancelled || !gate.current.current(ticket)) return 'skip';
          throw caught;
        }
      },
      onError: () => { if (!cancelled) setProcessingConnectionLost(true); },
    });
    return () => { cancelled = true; stop(); };
  }, [shouldPollProcessing, patientId, docId]);

  async function act(fn: () => Promise<MedicalDocument>): Promise<MedicalDocument | null> {
    if (!mounted.current || writing.current || scope.current !== `${patientId}/${docId}`) return null;
    writing.current = true;
    loadingRead.current = false;
    setIsRefreshing(false);
    readController.current?.abort();
    const ticket = gate.current.begin();
    setIsLoading(false); setIsActing(true); setActionError(null); setActionErrorStatus(null);
    try {
      const updated = await fn();
      if (!gate.current.accepts(ticket, updated, currentDocument.current?.version ?? 0)) return null;
      currentDocument.current = updated; setDocument(updated);
      return updated;
    } catch (caught) {
      if (gate.current.current(ticket)) {
        setActionError(caught instanceof Error ? caught.message : 'Error al ejecutar la acción.');
        setActionErrorStatus(caught instanceof ApiError ? caught.status : null);
      }
      return null;
    } finally {
      if (gate.current.current(ticket)) { writing.current = false; setIsActing(false); }
    }
  }

  const sameDocument = document?.id === docId && document.patientId === patientId;
  async function updateAssignment(fn: (current: MedicalDocument) => Promise<unknown>): Promise<boolean> {
    if (!document || !sameDocument) return false;
    const result = await act(async () => {
      await fn(document);
      return getDocument(patientId, docId);
    });
    return result !== null;
  }
  const reload = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => load(true), [load]);

  async function requestProcessing(): Promise<MedicalDocument | null> {
    if (!document || !sameDocument || processSubmissionUncertain || writing.current || !canRequestProcessing(document.status, document.processing)) return null;
    setProcessSubmissionUncertain(true);
    return act(async () => {
      try {
        const updated = await processDocument(patientId, docId, document.version);
        if (scope.current === `${patientId}/${docId}` && mounted.current) setProcessSubmissionUncertain(false);
        return updated;
      } catch (caught) {
        // A lost response is not evidence that the server rejected the request.
        // Known client errors can be corrected; otherwise consult before resending.
        if (caught instanceof ApiError && caught.status < 500 && scope.current === `${patientId}/${docId}` && mounted.current) setProcessSubmissionUncertain(false);
        throw caught instanceof ApiError ? caught : new Error('No se pudo confirmar la recepción de la solicitud. Consulta el estado antes de volver a enviarla.');
      }
    });
  }

  return {
    document: sameDocument ? document : null,
    isLoading: isLoading || (!sameDocument && !error),
    error, actionError, actionErrorStatus, isActing, isRefreshing,
    processingConnectionLost, processSubmissionUncertain,
    process: requestProcessing,
    saveCorrection: (data: DocumentCorrectionInput) => document && sameDocument ? act(() => saveDocumentCorrection(patientId, docId, { ...data, expectedVersion: document.version })) : Promise.resolve(null),
    validate: (data: FinalizeDocumentReviewInput) => document && sameDocument ? act(() => validateDocument(patientId, docId, { ...data, expectedVersion: document.version })) : Promise.resolve(null),
    reject: (reason: string) => document && sameDocument ? act(() => rejectDocument(patientId, docId, reason, document.version)) : Promise.resolve(null),
    claimAssignment: () => updateAssignment((current) => claimReviewDocument(current.id, current.version)),
    releaseAssignment: () => updateAssignment((current) => releaseReviewDocument(current.id, current.version)),
    reload, refresh,
  };
}
