'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClinicalRecord } from '@/features/clinical-records';
import { listRecords } from '@/features/clinical-records';
import type { MedicalDocument } from '@/features/medical-documents';
import { listDocuments } from '@/features/medical-documents';

// Máximo que acepta la validación del backend (FindDocumentsQueryDto).
const OVERVIEW_LIMIT = 50;

/**
 * Carga documentos digitalizados y registros clínicos del paciente para el
 * perfil (timeline, documentos, métricas). Trae hasta 50 de cada uno —
 * suficiente para la vista; la exportación completa usa esta misma data.
 */
export function usePatientOverview(patientId: string) {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [docsResult, recordsResult] = await Promise.all([
        listDocuments(patientId, { page: 1, limit: OVERVIEW_LIMIT }),
        listRecords(patientId, { page: 1, limit: OVERVIEW_LIMIT }),
      ]);
      setDocuments(docsResult.data);
      setRecords(recordsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la información del paciente.');
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { documents, records, isLoading, error, reload: load };
}
