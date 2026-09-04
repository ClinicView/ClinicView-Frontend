'use client';

import { useEffect, useRef, useState } from 'react';
import { searchGlobally } from '../services/global-search.service';
import type { GlobalSearchResponse } from '../types/global-search';

const SEARCH_DELAY_MS = 280;

export function useGlobalSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    const normalized = query.trim();
    if (!enabled || normalized.length < 2) {
      requestSequence.current += 1;
      setResults(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await searchGlobally(normalized, {
          limit: 6,
          signal: controller.signal,
        });
        if (sequence === requestSequence.current) setResults(response);
      } catch (caught) {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setResults(null);
        setError(caught instanceof Error ? caught.message : 'No se pudo realizar la busqueda.');
      } finally {
        if (sequence === requestSequence.current) setIsLoading(false);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, query, retryVersion]);

  return {
    results,
    isLoading,
    error,
    retry: () => setRetryVersion((version) => version + 1),
  };
}
