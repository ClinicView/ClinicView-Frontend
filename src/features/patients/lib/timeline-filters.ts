import { isValidDateOnly } from '../../../shared/lib/date-time';

export interface TimelineFilters {
  query: string;
  kind: 'all' | 'document' | 'record';
  status: string;
  from: string;
  to: string;
}

export const EMPTY_TIMELINE_FILTERS: TimelineFilters = { query: '', kind: 'all', status: '', from: '', to: '' };

export function timelineFilterError(filters: TimelineFilters): string | null {
  if ((filters.from && !isValidDateOnly(filters.from)) || (filters.to && !isValidDateOnly(filters.to))) return 'Introduce fechas válidas.';
  if (filters.from && filters.to && filters.from > filters.to) return 'La fecha inicial no puede ser posterior a la final.';
  return null;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-PE');
}

export function matchesTimelineFilters(entry: {
  kind: 'document' | 'record'; status: string; title: string; service: string; searchText: string;
  clinicalFrom: string | null; clinicalTo: string | null;
}, filters: TimelineFilters): boolean {
  if (timelineFilterError(filters)) return false;
  if (filters.kind !== 'all' && filters.kind !== entry.kind) return false;
  if (filters.status && filters.status !== entry.status) return false;
  if ((filters.from || filters.to) && !entry.clinicalFrom) return false;
  if (filters.from && (entry.clinicalTo ?? entry.clinicalFrom!) < filters.from) return false;
  if (filters.to && entry.clinicalFrom! > filters.to) return false;
  const query = normalize(filters.query.trim());
  return !query || normalize([entry.title, entry.service, entry.searchText].join('\n')).includes(query);
}
