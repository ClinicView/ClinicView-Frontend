import type {
  components,
  operations,
} from "../../../shared/types/api.generated";

type GeneratedAuditQuery = NonNullable<
  operations["AuditController_findMany"]["parameters"]["query"]
>;

export type AuditEvent = components["schemas"]["AuditEventResponseDto"];

export type AuditOutcome = AuditEvent["outcome"];

export type AuditEventsPage = components["schemas"]["AuditEventsPageDto"];

export type AuditFilters = Omit<GeneratedAuditQuery, "cursor">;

export interface AuditFilterDraft {
  action: string;
  outcome: "" | AuditOutcome;
  actorUsername: string;
  actorId: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  fromDate: string;
  toDate: string;
  limit: string;
}

export type AuditFilterField = keyof AuditFilterDraft | "dateRange";
export type AuditFilterErrors = Partial<Record<AuditFilterField, string>>;
