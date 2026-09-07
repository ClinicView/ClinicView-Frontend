'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { apiGet } from '@/shared/services/api-client';
import { PagedClinicalSource, type ClinicalPage } from '@/shared/lib/paged-clinical-source';

export function useClinicalPage<T extends { id: string }>(path: string, resource: string, enabled = true) {
  const source = useMemo(() => new PagedClinicalSource<T>(enabled, (page) => apiGet<ClinicalPage<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}`), resource), [path, resource, enabled]);
  const state = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getServerSnapshot);
  useEffect(() => { void source.reload(); return source.cancel; }, [source]);
  return { ...state, reload: source.reload, loadMore: source.loadMore };
}
