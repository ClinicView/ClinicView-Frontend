import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  compactAuditId,
  formatAuditDate,
  formatAuditDuration,
  getAuditActionLabel,
  getAuditActorPresentation,
  getAuditPageSummary,
  getAuditResourceLabel,
} from "./audit-presentation";
import type { AuditEvent } from "../types/audit";

function event(outcome: AuditEvent["outcome"]): AuditEvent {
  return {
    id: "9f236a49-e60f-44d2-89fd-455f08ad3a0d",
    occurredAt: "2026-09-03T15:15:30.000Z",
    action: "PATIENT_VIEWED",
    outcome,
    actorId: null,
    patientId: null,
    resourceType: "PATIENT",
    resourceId: null,
    requestId: "a352009f-0419-4690-9d64-af0f36fa69d9",
    method: "GET",
    route: "/api/patients/:id",
    statusCode: 200,
    durationMs: 25,
    ipHash: null,
    userAgentHash: null,
  };
}

test("presenta acciones conocidas y conserva una alternativa legible para acciones nuevas", () => {
  assert.equal(getAuditActionLabel("PATIENT_VIEWED"), "Paciente consultado");
  assert.equal(getAuditActionLabel("HTTP_GET"), "Solicitud GET");
  assert.equal(
    getAuditActionLabel("CUSTOM_EVENT_CREATED"),
    "Custom Event Created",
  );
});

test("presenta fecha en Lima y duraciones con unidades explícitas", () => {
  const formatted = formatAuditDate("2026-09-03T15:15:30.000Z");
  assert.match(formatted, /2026/);
  assert.match(formatted, /10:15:30/);
  assert.equal(formatAuditDuration(850), "850 ms");
  assert.match(formatAuditDuration(1_500), /^1[,.]5 s$/);
});

test("presenta recursos e identificadores extensos sin perder el valor original", () => {
  const id = "9f236a49-e60f-44d2-89fd-455f08ad3a0d";
  assert.equal(getAuditResourceLabel("CLINICAL_RECORD"), "Registro clínico");
  assert.equal(getAuditResourceLabel("MEDICAL_DOCUMENT"), "Documento médico");
  assert.equal(getAuditResourceLabel(null), "Recurso no especificado");
  assert.equal(compactAuditId(id), "9f236a49…3a0d");
  assert.equal(compactAuditId("corto"), "corto");
});

test("resume la página sin depender únicamente del color de cada resultado", () => {
  assert.deepEqual(
    getAuditPageSummary([
      event("SUCCESS"),
      event("DENIED"),
      event("FAILED"),
      event("SUCCESS"),
    ]),
    { total: 4, success: 2, denied: 1, failed: 1 },
  );
});

test("presenta nombre actual y username histórico sin perder un cambio de identidad", () => {
  const presentation = getAuditActorPresentation({
    ...event("SUCCESS"),
    actorId: "f601b10d-68ee-4f87-9e2a-b6fc1a81e0d2",
    actorUsernameAtEvent: "mlopez",
    actor: {
      username: "mlopez.admin",
      fullName: "María López",
      isActive: false,
    },
  });

  assert.deepEqual(presentation, {
    kind: "KNOWN",
    displayName: "María López",
    usernameAtEvent: "mlopez",
    currentUsername: "mlopez.admin",
    identityChanged: true,
    isInactive: true,
  });
});

test("marca eventos antiguos y usa la identidad actual como fallback explícito", () => {
  const presentation = getAuditActorPresentation({
    ...event("SUCCESS"),
    actorId: "f601b10d-68ee-4f87-9e2a-b6fc1a81e0d2",
    actorUsernameAtEvent: null,
    actor: { username: "mlopez", fullName: "María López", isActive: true },
  });

  assert.equal(presentation.kind, "LEGACY");
  assert.equal(presentation.displayName, "María López");
  assert.equal(presentation.currentUsername, "mlopez");
});

test("distingue un acceso sin autenticar de una operación del sistema", () => {
  assert.equal(
    getAuditActorPresentation({
      ...event("DENIED"),
      actorId: null,
      action: "PATIENT_VIEWED",
    }).kind,
    "ANONYMOUS",
  );
  assert.equal(
    getAuditActorPresentation({
      ...event("SUCCESS"),
      actorId: null,
      action: "HTTP_GET",
    }).kind,
    "SYSTEM",
  );
});
