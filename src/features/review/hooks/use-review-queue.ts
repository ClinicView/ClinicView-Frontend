'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReviewQueueItem, ReviewQueuePage } from '../types/review';
import { getReviewQueue } from '../services/review.service';

const LIMIT = 20;

export function useReviewQueue() {
  const [data, setData] = useState<ReviewQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const result: ReviewQueuePage = await getReviewQueue({ page: p, limit: LIMIT });
      setData(result.data);
      setTotal(result.total);
      setPage(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la cola de revisión.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = Math.ceil(total / LIMIT);

  return {
    data,
    total,
    page,
    totalPages,
    isLoading,
    error,
    onPageChange: (p: number) => void load(p),
    reload: () => void load(page),
  };
}
