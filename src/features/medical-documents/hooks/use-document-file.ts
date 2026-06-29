'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocumentFile } from '../services/documents.service';

export function useDocumentFile(patientId: string, docId: string) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const replaceObjectUrl = useCallback((nextUrl: string | null) => {
    if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
    currentUrlRef.current = nextUrl;
    setObjectUrl(nextUrl);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    replaceObjectUrl(null);

    try {
      const blob = await getDocumentFile(patientId, docId);
      replaceObjectUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el archivo original.');
    } finally {
      setIsLoading(false);
    }
  }, [patientId, docId, replaceObjectUrl]);

  useEffect(() => {
    void load();
    return () => {
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    };
  }, [load]);

  const openInNewTab = useCallback(() => {
    if (!objectUrl) return;
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  }, [objectUrl]);

  return { objectUrl, isLoading, error, openInNewTab, reload: load };
}
