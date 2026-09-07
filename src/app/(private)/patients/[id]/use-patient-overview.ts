'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { listRecords } from '@/features/clinical-records';
import { listDocuments } from '@/features/medical-documents';
import { PagedClinicalSource } from '@/shared/lib/paged-clinical-source';

const OVERVIEW_LIMIT = 50;

export function usePatientOverview(patientId: string, access: { documents: boolean; records: boolean }) {
  const documentSource = useMemo(() => new PagedClinicalSource(access.documents,
    (page) => listDocuments(patientId, { page, limit: OVERVIEW_LIMIT }), 'los documentos clínicos'),
  [patientId, access.documents]);
  const recordSource = useMemo(() => new PagedClinicalSource(access.records,
    (page) => listRecords(patientId, { status: 'ALL', page, limit: OVERVIEW_LIMIT }), 'los registros clínicos'),
  [patientId, access.records]);
  const documentsPage = useSyncExternalStore(documentSource.subscribe, documentSource.getSnapshot, documentSource.getServerSnapshot);
  const recordsPage = useSyncExternalStore(recordSource.subscribe, recordSource.getSnapshot, recordSource.getServerSnapshot);

  useEffect(() => {
    void documentSource.reload();
    return documentSource.cancel;
  }, [documentSource]);
  useEffect(() => {
    void recordSource.reload();
    return recordSource.cancel;
  }, [recordSource]);

  return {
    documents: documentsPage.items,
    records: recordsPage.items,
    documentsPage,
    recordsPage,
    documentsError: documentsPage.error,
    recordsError: recordsPage.error,
    isLoadingDocuments: documentsPage.loading && documentsPage.page === 0,
    isLoadingRecords: recordsPage.loading && recordsPage.page === 0,
    isLoading: (documentsPage.loading && documentsPage.page === 0) || (recordsPage.loading && recordsPage.page === 0),
    hasAnyAccess: access.documents || access.records,
    canReadDocuments: access.documents,
    canReadRecords: access.records,
    loadMoreDocuments: documentSource.loadMore,
    loadMoreRecords: recordSource.loadMore,
    reloadDocuments: documentSource.reload,
    reloadRecords: recordSource.reload,
    reload: () => Promise.all([documentSource.reload(), recordSource.reload()]),
  };
}
