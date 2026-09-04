import type {
  AuditFilterDraft,
  AuditFilterErrors,
  AuditFilters,
} from "../types/audit";

export const DEFAULT_AUDIT_LIMIT = 25;

export const EMPTY_AUDIT_FILTER_DRAFT: AuditFilterDraft = {
  action: "",
  outcome: "",
  actorUsername: "",
  actorId: "",
  patientId: "",
  resourceType: "",
  resourceId: "",
  requestId: "",
  fromDate: "",
  toDate: "",
  limit: String(DEFAULT_AUDIT_LIMIT),
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_PATTERN = /^[A-Z0-9_]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;

export interface ParsedAuditFilters {
  filters: AuditFilters | null;
  errors: AuditFilterErrors;
}

function limaDayBoundary(date: string, edge: "start" | "end"): string {
  return edge === "start"
    ? `${date}T00:00:00.000-05:00`
    : `${date}T23:59:59.999-05:00`;
}

export function parseAuditFilterDraft(
  draft: AuditFilterDraft,
): ParsedAuditFilters {
  const errors: AuditFilterErrors = {};
  const action = draft.action.trim().toUpperCase();
  const resourceType = draft.resourceType.trim().toUpperCase();
  const rawActorUsername = draft.actorUsername.trim();
  const actorUsername = rawActorUsername.startsWith("@")
    ? rawActorUsername.slice(1)
    : rawActorUsername;
  const limit = Number(draft.limit);

  if (action && (!ACTION_PATTERN.test(action) || action.length > 64)) {
    errors.action =
      "Usa solo letras, números y guiones bajos (máximo 64 caracteres).";
  }

  if (
    resourceType &&
    (!ACTION_PATTERN.test(resourceType) || resourceType.length > 32)
  ) {
    errors.resourceType =
      "Usa solo letras, números y guiones bajos (máximo 32 caracteres).";
  }

  if (rawActorUsername && !USERNAME_PATTERN.test(actorUsername)) {
    errors.actorUsername =
      "Usa entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.";
  }

  const uuidFields = [
    ["actorId", draft.actorId],
    ["patientId", draft.patientId],
    ["resourceId", draft.resourceId],
    ["requestId", draft.requestId],
  ] as const;

  for (const [field, rawValue] of uuidFields) {
    if (rawValue.trim() && !UUID_PATTERN.test(rawValue.trim())) {
      errors[field] = "Ingresa un UUID válido.";
    }
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.limit = "Selecciona entre 1 y 100 resultados por página.";
  }

  const from = draft.fromDate
    ? limaDayBoundary(draft.fromDate, "start")
    : undefined;
  const to = draft.toDate ? limaDayBoundary(draft.toDate, "end") : undefined;
  if (from && to && Date.parse(from) > Date.parse(to)) {
    errors.dateRange =
      "La fecha inicial no puede ser posterior a la fecha final.";
  }

  if (Object.keys(errors).length > 0) return { filters: null, errors };

  return {
    filters: {
      limit,
      ...(action ? { action } : {}),
      ...(draft.outcome ? { outcome: draft.outcome } : {}),
      ...(actorUsername ? { actorUsername } : {}),
      ...(draft.actorId.trim() ? { actorId: draft.actorId.trim() } : {}),
      ...(draft.patientId.trim() ? { patientId: draft.patientId.trim() } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(draft.resourceId.trim()
        ? { resourceId: draft.resourceId.trim() }
        : {}),
      ...(draft.requestId.trim() ? { requestId: draft.requestId.trim() } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
    errors,
  };
}

export function buildAuditEventsQuery(
  filters: AuditFilters,
  cursor?: string | null,
): string {
  const params = new URLSearchParams();

  if (cursor) params.set("cursor", cursor);
  const entries = Object.entries(filters) as Array<
    [keyof AuditFilters, AuditFilters[keyof AuditFilters]]
  >;
  for (const [key, value] of entries) {
    if (value === undefined || value === "") continue;
    params.set(String(key), String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function countActiveAuditFilters(filters: AuditFilters): number {
  return Object.entries(filters).filter(
    ([key, value]) => key !== "limit" && value !== undefined && value !== "",
  ).length;
}

export interface AuditCursorState {
  cursors: Array<string | null>;
  pageIndex: number;
}

export const INITIAL_AUDIT_CURSOR_STATE: AuditCursorState = {
  cursors: [null],
  pageIndex: 0,
};

export function advanceAuditCursor(
  state: AuditCursorState,
  nextCursor: string | null | undefined,
): AuditCursorState {
  if (!nextCursor) return state;
  const cursors = state.cursors.slice(0, state.pageIndex + 1);
  cursors.push(nextCursor);
  return { cursors, pageIndex: state.pageIndex + 1 };
}

export function retreatAuditCursor(state: AuditCursorState): AuditCursorState {
  if (state.pageIndex === 0) return state;
  return { ...state, pageIndex: state.pageIndex - 1 };
}
