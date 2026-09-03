'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceAuditCursor,
  INITIAL_AUDIT_CURSOR_STATE,
  retreatAuditCursor,
  type AuditCursorState,
} from '../lib/audit-query';
import { listAuditEvents } from '../services/audit.service';
import type { AuditEvent, AuditFilters } from '../types/audit';

export function useAuditEvents(initialFilters: AuditFilters) {
  const [filters, setFilters] = useState<AuditFilters>(initialFilters);
  const [cursorState, setCursorState] = useState<AuditCursorState>(INITIAL_AUDIT_CURSOR_STATE);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const requestVersionRef = useRef(0);

  const cursor = cursorState.cursors[cursorState.pageIndex] ?? null;

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;
    setIsLoading(true);
    setError(null);

    void listAuditEvents(filters, cursor)
      .then((page) => {
        if (requestVersion !== requestVersionRef.current) return;
        setEvents(page.data);
        setNextCursor(page.nextCursor ?? null);
      })
      .catch((reason: unknown) => {
        if (requestVersion !== requestVersionRef.current) return;
        setEvents([]);
        setNextCursor(null);
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudieron cargar los eventos de auditoría.',
        );
      })
      .finally(() => {
        if (requestVersion === requestVersionRef.current) setIsLoading(false);
      });
  }, [cursor, filters, retryVersion]);

  const applyFilters = useCallback((nextFilters: AuditFilters) => {
    setIsLoading(true);
    setFilters(nextFilters);
    setCursorState(INITIAL_AUDIT_CURSOR_STATE);
  }, []);

  const goNext = useCallback(() => {
    setIsLoading(true);
    setCursorState((current) => advanceAuditCursor(current, nextCursor));
  }, [nextCursor]);

  const goBack = useCallback(() => {
    setIsLoading(true);
    setCursorState((current) => retreatAuditCursor(current));
  }, []);

  const retry = useCallback(() => {
    setIsLoading(true);
    setRetryVersion((version) => version + 1);
  }, []);

  return useMemo(() => ({
    events,
    filters,
    isLoading,
    error,
    page: cursorState.pageIndex + 1,
    canGoBack: cursorState.pageIndex > 0,
    canGoNext: Boolean(nextCursor),
    applyFilters,
    goNext,
    goBack,
    retry,
  }), [
    applyFilters,
    cursorState.pageIndex,
    error,
    events,
    filters,
    goBack,
    goNext,
    isLoading,
    nextCursor,
    retry,
  ]);
}
