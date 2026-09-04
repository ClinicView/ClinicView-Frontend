'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ReviewAssignee,
  ReviewPriority,
  ReviewQueueItem,
  ReviewQueuePage,
  ReviewQueueScope,
} from '../types/review';
import {
  assignReviewDocument,
  claimReviewDocument,
  getReviewQueue,
  listReviewAssignees,
  releaseReviewDocument,
  updateReviewPriority,
} from '../services/review.service';

const LIMIT = 20;

export function useReviewQueue(canAssign: boolean) {
  const [data, setData] = useState<ReviewQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingDocumentId, setActingDocumentId] = useState<string | null>(null);
  const [scope, setScopeState] = useState<ReviewQueueScope>('AVAILABLE');
  const [priority, setPriorityState] = useState<ReviewPriority | ''>('');
  const [assignees, setAssignees] = useState<ReviewAssignee[]>([]);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [assigneesError, setAssigneesError] = useState<string | null>(null);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [assigneeRetryVersion, setAssigneeRetryVersion] = useState(0);
  const requestSequence = useRef(0);
  const assigneeRequestSequence = useRef(0);

  const load = useCallback(async (p: number, nextScope = scope, nextPriority = priority) => {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    setActionError(null);
    try {
      const result: ReviewQueuePage = await getReviewQueue({
        page: p,
        limit: LIMIT,
        scope: nextScope,
        priority: nextPriority,
      });
      if (sequence === requestSequence.current) {
        setData(result.data);
        setTotal(result.total);
        setPage(p);
      }
    } catch (err) {
      if (sequence === requestSequence.current) {
        setError(err instanceof Error ? err.message : 'Error al cargar la cola de revisión.');
      }
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, [priority, scope]);

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    if (!canAssign) {
      setAssignees([]);
      setIsLoadingAssignees(false);
      setAssigneesError(null);
      return;
    }

    const sequence = ++assigneeRequestSequence.current;
    const controller = new AbortController();
    setIsLoadingAssignees(true);
    setAssigneesError(null);
    const timer = window.setTimeout(async () => {
      try {
        const response = await listReviewAssignees(assigneeQuery, controller.signal);
        if (sequence === assigneeRequestSequence.current) setAssignees(response.data);
      } catch (caught) {
        if (controller.signal.aborted || sequence !== assigneeRequestSequence.current) return;
        setAssignees([]);
        setAssigneesError(
          caught instanceof Error ? caught.message : 'No se pudieron cargar los revisores.',
        );
      } finally {
        if (sequence === assigneeRequestSequence.current) setIsLoadingAssignees(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [assigneeQuery, assigneeRetryVersion, canAssign]);

  const mutate = useCallback(async (
    documentId: string,
    operation: () => Promise<unknown>,
  ): Promise<boolean> => {
    setActingDocumentId(documentId);
    setActionError(null);
    try {
      await operation();
      await load(page);
      return true;
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'No se pudo actualizar la asignacion.');
      return false;
    } finally {
      setActingDocumentId(null);
    }
  }, [load, page]);

  const totalPages = Math.ceil(total / LIMIT);

  return {
    data,
    total,
    page,
    totalPages,
    isLoading,
    error,
    actionError,
    actingDocumentId,
    scope,
    priority,
    assignees,
    isLoadingAssignees,
    assigneesError,
    assigneeQuery,
    onPageChange: (p: number) => void load(p),
    reload: () => void load(page),
    retryAssignees: () => setAssigneeRetryVersion((version) => version + 1),
    setAssigneeQuery,
    setScope: (nextScope: ReviewQueueScope) => {
      setScopeState(nextScope);
    },
    setPriority: (nextPriority: ReviewPriority | '') => {
      setPriorityState(nextPriority);
    },
    claim: (item: ReviewQueueItem) => mutate(
      item.id,
      () => claimReviewDocument(item.id, item.version),
    ),
    assign: (item: ReviewQueueItem, assigneeId: string) => mutate(
      item.id,
      () => assignReviewDocument(item.id, assigneeId, item.version),
    ),
    release: (item: ReviewQueueItem) => mutate(
      item.id,
      () => releaseReviewDocument(item.id, item.version),
    ),
    updatePriority: (item: ReviewQueueItem, nextPriority: ReviewPriority) => mutate(
      item.id,
      () => updateReviewPriority(item.id, nextPriority, item.version),
    ),
  };
}
