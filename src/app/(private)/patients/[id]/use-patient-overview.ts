'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClinicalRecord } from '@/features/clinical-records';
import { listRecords } from '@/features/clinical-records';
import type { MedicalDocument } from '@/features/medical-documents';
import { listDocuments } from '@/features/medical-documents';
import { ApiError } from '@/shared/services/api-client';

// Máximo que acepta la validación del backend (FindDocumentsQueryDto).
const OVERVIEW_LIMIT = 50;

interface PatientOverviewAccess {
  documents: boolean;
  records: boolean;
}

function resourceError(cause: unknown, resource: 'documentos' | 'registros'): string {
  if (cause instanceof ApiError && cause.status === 403) {
    return `Tu rol ya no permite consultar ${resource} clínicos.`;
  }
  return `No se pudieron cargar los ${resource} clínicos.`;
}

/**
 * Carga cada fuente autorizada de forma independiente. Una denegación o
 * fallo en documentos nunca oculta los registros que sí pudieron cargarse,
 * y viceversa.
 */
export function usePatientOverview(patientId: string, access: PatientOverviewAccess) {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(access.documents);
  const [isLoadingRecords, setIsLoadingRecords] = useState(access.records);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setDocuments([]);
    setRecords([]);
    setDocumentsError(null);
    setRecordsError(null);
    setIsLoadingDocuments(access.documents);
    setIsLoadingRecords(access.records);

    const [documentsResult, recordsResult] = await Promise.allSettled([
      access.documents
        ? listDocuments(patientId, { page: 1, limit: OVERVIEW_LIMIT })
        : Promise.resolve(null),
      access.records
        ? listRecords(patientId, { page: 1, limit: OVERVIEW_LIMIT })
        : Promise.resolve(null),
    ]);

    if (requestId !== requestIdRef.current) return;

    if (access.documents) {
      if (documentsResult.status === 'fulfilled' && documentsResult.value) {
        setDocuments(documentsResult.value.data);
      } else if (documentsResult.status === 'rejected') {
        setDocumentsError(resourceError(documentsResult.reason, 'documentos'));
      }
    }

    if (access.records) {
      if (recordsResult.status === 'fulfilled' && recordsResult.value) {
        setRecords(recordsResult.value.data);
      } else if (recordsResult.status === 'rejected') {
        setRecordsError(resourceError(recordsResult.reason, 'registros'));
      }
    }

    setIsLoadingDocuments(false);
    setIsLoadingRecords(false);
  }, [access.documents, access.records, patientId]);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  return {
    documents,
    records,
    documentsError,
    recordsError,
    isLoadingDocuments,
    isLoadingRecords,
    isLoading: isLoadingDocuments || isLoadingRecords,
    hasAnyAccess: access.documents || access.records,
    canReadDocuments: access.documents,
    canReadRecords: access.records,
    reload: load,
  };
}
