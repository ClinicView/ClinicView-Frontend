'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DocumentStatus, DocumentsPage, MedicalDocument } from '../types/document';
import { listDocuments, uploadDocument } from '../services/documents.service';

const LIMIT = 20;

export function useDocuments(patientId: string) {
  const [data, setData] = useState<MedicalDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, status?: DocumentStatus) => {
      setIsLoading(true);
      setError(null);
      try {
        const result: DocumentsPage = await listDocuments(patientId, {
          status,
          page: p,
          limit: LIMIT,
        });
        setData(result.data);
        setTotal(result.total);
        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar documentos.');
      } finally {
        setIsLoading(false);
      }
    },
    [patientId],
  );

  useEffect(() => {
    void load(1, statusFilter);
  }, [load, statusFilter]);

  async function upload(file: File): Promise<void> {
    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(patientId, file);
      await load(1, undefined);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir el archivo.');
    } finally {
      setIsUploading(false);
    }
  }

  function onPageChange(p: number) {
    void load(p, statusFilter);
  }

  function onStatusFilterChange(s: DocumentStatus | undefined) {
    setStatusFilter(s);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return {
    data,
    total,
    page,
    totalPages,
    statusFilter,
    isLoading,
    error,
    isUploading,
    uploadError,
    upload,
    reload: () => load(page, statusFilter),
    onPageChange,
    onStatusFilterChange,
  };
}
