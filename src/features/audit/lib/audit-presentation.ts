import type { AuditEvent, AuditOutcome } from "../types/audit";

export const AUDIT_ACTION_OPTIONS = [
  "AUTH_LOGIN",
  "AUTH_REFRESH",
  "AUTH_LOGOUT",
  "CURRENT_USER_VIEWED",
  "PATIENT_CREATED",
  "PATIENT_VIEWED",
  "PATIENT_UPDATED",
  "PATIENT_DEACTIVATED",
  "PATIENT_ACTIVATED",
  "CLINICAL_HISTORY_EXPORTED",
  "CLINICAL_RECORD_CREATED",
  "CLINICAL_RECORD_VIEWED",
  "CLINICAL_RECORD_CORRECTED",
  "CLINICAL_RECORD_VOIDED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_VIEWED",
  "DOCUMENT_FILE_DOWNLOADED",
  "DOCUMENT_PROCESS_REQUESTED",
  "DOCUMENT_CORRECTION_SAVED",
  "DOCUMENT_VALIDATED",
  "DOCUMENT_REJECTED",
  "CLINICAL_MEDIA_UPLOADED",
  "CLINICAL_MEDIA_VIEWED",
  "CLINICAL_MEDIA_DOWNLOADED",
  "CLINICAL_MEDIA_DELETED",
  "USER_CREATED",
  "USER_VIEWED",
  "USER_UPDATED",
  "USER_DEACTIVATED",
  "USER_ROLE_ASSIGNED",
  "DASHBOARD_VIEWED",
  "AUDIT_EVENTS_VIEWED",
] as const;

const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: "Inicio de sesión",
  AUTH_REFRESH: "Renovación de sesión",
  AUTH_LOGOUT: "Cierre de sesión",
  CURRENT_USER_VIEWED: "Consulta del perfil autenticado",
  PATIENT_CREATED: "Paciente registrado",
  PATIENT_VIEWED: "Paciente consultado",
  PATIENT_UPDATED: "Paciente actualizado",
  PATIENT_DEACTIVATED: "Paciente desactivado",
  PATIENT_ACTIVATED: "Paciente reactivado",
  CLINICAL_HISTORY_EXPORTED: "Historia clínica exportada",
  CLINICAL_RECORD_CREATED: "Registro clínico creado",
  CLINICAL_RECORD_VIEWED: "Registro clínico consultado",
  CLINICAL_RECORD_CORRECTED: "Registro clínico corregido",
  CLINICAL_RECORD_VOIDED: "Registro clínico anulado",
  DOCUMENT_UPLOADED: "Documento cargado",
  DOCUMENT_VIEWED: "Documento consultado",
  DOCUMENT_FILE_DOWNLOADED: "Archivo de documento descargado",
  DOCUMENT_PROCESS_REQUESTED: "Procesamiento de documento solicitado",
  DOCUMENT_CORRECTION_SAVED: "Corrección documental guardada",
  DOCUMENT_VALIDATED: "Documento validado",
  DOCUMENT_REJECTED: "Documento rechazado",
  CLINICAL_MEDIA_UPLOADED: "Imagen clínica cargada",
  CLINICAL_MEDIA_VIEWED: "Imagen clínica consultada",
  CLINICAL_MEDIA_DOWNLOADED: "Imagen clínica descargada",
  CLINICAL_MEDIA_DELETED: "Imagen clínica eliminada",
  USER_CREATED: "Usuario creado",
  USER_VIEWED: "Usuario consultado",
  USER_UPDATED: "Usuario actualizado",
  USER_DEACTIVATED: "Usuario desactivado",
  USER_ROLE_ASSIGNED: "Rol de usuario asignado",
  DASHBOARD_VIEWED: "Panel operativo consultado",
  AUDIT_EVENTS_VIEWED: "Auditoría consultada",
};

const RESOURCE_LABELS: Record<string, string> = {
  USER: "Usuario",
  PATIENT: "Paciente",
  CLINICAL_RECORD: "Registro clínico",
  MEDICAL_DOCUMENT: "Documento médico",
  DOCUMENT: "Documento",
  CLINICAL_MEDIA: "Imagen clínica",
  ROLE: "Rol",
  DASHBOARD: "Panel operativo",
  AUDIT_EVENT: "Auditoría",
};

export const AUDIT_OUTCOME_PRESENTATION: Record<
  AuditOutcome,
  {
    label: string;
    description: string;
  }
> = {
  SUCCESS: {
    label: "Correcto",
    description: "La operación terminó correctamente.",
  },
  DENIED: {
    label: "Denegado",
    description: "El sistema rechazó el acceso solicitado.",
  },
  FAILED: {
    label: "Fallido",
    description: "La operación terminó con un error.",
  },
};

const limaDateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function getAuditActionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith("HTTP_")) {
    return `Solicitud ${action.slice(5).replaceAll("_", " ")}`;
  }
  return action
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function getAuditResourceLabel(resourceType?: string | null): string {
  if (!resourceType) return "Recurso no especificado";
  return (
    RESOURCE_LABELS[resourceType] ??
    resourceType.replaceAll("_", " ").toLowerCase()
  );
}

export function formatAuditDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : limaDateTimeFormatter.format(date);
}

export function formatAuditDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toLocaleString("es-PE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} s`;
}

export function compactAuditId(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export interface AuditActorPresentation {
  kind: "KNOWN" | "LEGACY" | "UNAVAILABLE" | "ANONYMOUS" | "SYSTEM";
  displayName: string;
  usernameAtEvent: string | null;
  currentUsername: string | null;
  identityChanged: boolean;
  isInactive: boolean;
}

/**
 * Separa deliberadamente la identidad histórica de la proyección actual.
 * No infiere ni inventa nombres para eventos antiguos o no autenticados.
 */
export function getAuditActorPresentation(
  event: AuditEvent,
): AuditActorPresentation {
  const usernameAtEvent = event.actorUsernameAtEvent?.trim() || null;
  const currentUsername = event.actor?.username.trim() || null;

  if (!event.actorId) {
    const anonymous =
      event.outcome === "DENIED" || event.action.startsWith("AUTH_");
    return {
      kind: anonymous ? "ANONYMOUS" : "SYSTEM",
      displayName: anonymous ? "No autenticado" : "Sistema",
      usernameAtEvent: null,
      currentUsername: null,
      identityChanged: false,
      isInactive: false,
    };
  }

  const displayName =
    event.actor?.fullName.trim() ||
    (usernameAtEvent
      ? `@${usernameAtEvent}`
      : currentUsername
        ? `@${currentUsername}`
        : "Usuario no disponible");
  const identityChanged = Boolean(
    usernameAtEvent && currentUsername && usernameAtEvent !== currentUsername,
  );

  return {
    kind: usernameAtEvent ? "KNOWN" : event.actor ? "LEGACY" : "UNAVAILABLE",
    displayName,
    usernameAtEvent,
    currentUsername,
    identityChanged,
    isInactive: event.actor?.isActive === false,
  };
}

export function getAuditPageSummary(events: AuditEvent[]): {
  total: number;
  success: number;
  denied: number;
  failed: number;
} {
  return events.reduce<{
    total: number;
    success: number;
    denied: number;
    failed: number;
  }>(
    (summary, event) => {
      summary.total += 1;
      if (event.outcome === "SUCCESS") summary.success += 1;
      if (event.outcome === "DENIED") summary.denied += 1;
      if (event.outcome === "FAILED") summary.failed += 1;
      return summary;
    },
    { total: 0, success: 0, denied: 0, failed: 0 },
  );
}
