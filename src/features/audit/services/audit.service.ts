import { apiGet } from '@/shared/services/api-client';
import { buildAuditEventsQuery } from '../lib/audit-query';
import type { AuditEventsPage, AuditFilters } from '../types/audit';

export function listAuditEvents(
  filters: AuditFilters,
  cursor?: string | null,
): Promise<AuditEventsPage> {
  return apiGet<AuditEventsPage>(`/audit/events${buildAuditEventsQuery(filters, cursor)}`);
}

