'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/services/api-client';
import type { DocumentCorrectionInput, FinalizeDocumentReviewInput, MedicalDocument } from '../types/document';
import { getDocument, processDocument, rejectDocument, saveDocumentCorrection, validateDocument } from '../services/documents.service';
import { claimReviewDocument, releaseReviewDocument } from '@/features/review/services/review.service';
import { DocumentRequestGate } from '../lib/document-request-gate';

export function useDocument(patientId: string, docId: string) {
  const [document, setDocument] = useState<MedicalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorStatus, setActionErrorStatus] = useState<number | null>(null);
  const [isActing, setIsActing] = useState(false);
  const gate = useRef(new DocumentRequestGate());
  gate.current.setScope(patientId, docId);
  const currentDocument = useRef(document);
  currentDocument.current = document;
  const writing = useRef(false);
  const loadingRead = useRef(false);
  const mounted = useRef(true);
  const scope = useRef(`${patientId}/${docId}`);
  if (scope.current !== `${patientId}/${docId}`) {
    scope.current = `${patientId}/${docId}`;
    writing.current = false;
    loadingRead.current = false;
  }

  const load = useCallback(async (silent = false): Promise<boolean> => {
    if (!mounted.current || writing.current || scope.current !== `${patientId}/${docId}`) return false;
    const ticket = gate.current.begin();
    loadingRead.current = true;
    if (!silent) setIsLoading(true);
    setIsActing(false);
    setError(null); setActionError(null); setActionErrorStatus(null);
    try {
      const result = await getDocument(patientId, docId);
      const prior = currentDocument.current;
      const minimum = prior?.id === docId && prior.patientId === patientId ? prior.version : 0;
      if (!gate.current.current(ticket)) return false;
      if (!gate.current.accepts(ticket, result, minimum)) throw new Error('La respuesta no corresponde a la identidad o versión actual del documento. Recarga la página.');
      currentDocument.current = result; setDocument(result);
      return true;
    } catch (caught) {
      if (gate.current.current(ticket) && !silent) setError(caught instanceof Error ? caught.message : 'Error al cargar el documento.');
      return false;
    } finally {
      if (gate.current.current(ticket)) { loadingRead.current = false; if (!silent) setIsLoading(false); }
    }
  }, [patientId, docId]);

  useEffect(() => {
    const activeGate = gate.current;
    mounted.current = true;
    void load();
    return () => { mounted.current = false; activeGate.invalidate(); };
  }, [load]);

  useEffect(() => {
    if (document?.status !== 'PROCESSING' || document.id !== docId || document.patientId !== patientId) return;
    let cancelled = false;
    let inFlight = false;
    const interval = setInterval(async () => {
      if (cancelled || inFlight || writing.current || loadingRead.current) return;
      inFlight = true;
      const ticket = gate.current.begin();
      try {
        const latest = await getDocument(patientId, docId);
        if (!cancelled && latest.status !== 'PROCESSING' && gate.current.accepts(ticket, latest, currentDocument.current?.version ?? 0)) {
          currentDocument.current = latest; setDocument(latest);
        }
      } catch {
        // Polling is read-only; a failed attempt does not clear existing content.
      } finally { inFlight = false; }
    }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [document?.id, document?.patientId, document?.status, patientId, docId]);

  async function act(fn: () => Promise<MedicalDocument>): Promise<MedicalDocument | null> {
    if (!mounted.current || writing.current || scope.current !== `${patientId}/${docId}`) return null;
    writing.current = true;
    loadingRead.current = false;
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

  return {
    document: sameDocument ? document : null,
    isLoading: isLoading || (!sameDocument && !error),
    error, actionError, actionErrorStatus, isActing,
    process: () => sameDocument ? act(() => processDocument(patientId, docId)) : Promise.resolve(null),
    saveCorrection: (data: DocumentCorrectionInput) => document && sameDocument ? act(() => saveDocumentCorrection(patientId, docId, { ...data, expectedVersion: document.version })) : Promise.resolve(null),
    validate: (data: FinalizeDocumentReviewInput) => document && sameDocument ? act(() => validateDocument(patientId, docId, { ...data, expectedVersion: document.version })) : Promise.resolve(null),
    reject: (reason: string) => document && sameDocument ? act(() => rejectDocument(patientId, docId, reason, document.version)) : Promise.resolve(null),
    claimAssignment: () => updateAssignment((current) => claimReviewDocument(current.id, current.version)),
    releaseAssignment: () => updateAssignment((current) => releaseReviewDocument(current.id, current.version)),
    reload, refresh,
  };
}
