import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  advanceAuditCursor,
  buildAuditEventsQuery,
  countActiveAuditFilters,
  EMPTY_AUDIT_FILTER_DRAFT,
  INITIAL_AUDIT_CURSOR_STATE,
  parseAuditFilterDraft,
  retreatAuditCursor,
} from './audit-query';

const ACTOR_ID = 'f601b10d-68ee-4f87-9e2a-b6fc1a81e0d2';

test('normaliza filtros y convierte días completos a la zona horaria de Lima', () => {
  const parsed = parseAuditFilterDraft({
    ...EMPTY_AUDIT_FILTER_DRAFT,
    action: ' patient_viewed ',
    resourceType: ' patient ',
    actorId: ` ${ACTOR_ID} `,
    fromDate: '2026-09-01',
    toDate: '2026-09-03',
    limit: '50',
  });

  assert.deepEqual(parsed.errors, {});
  assert.deepEqual(parsed.filters, {
    limit: 50,
    action: 'PATIENT_VIEWED',
    actorId: ACTOR_ID,
    resourceType: 'PATIENT',
    from: '2026-09-01T00:00:00.000-05:00',
    to: '2026-09-03T23:59:59.999-05:00',
  });
});

test('rechaza UUID, nombres técnicos, límites y rangos inválidos antes de consultar', () => {
  const parsed = parseAuditFilterDraft({
    ...EMPTY_AUDIT_FILTER_DRAFT,
    action: 'evento con espacios',
    resourceType: 'patient-data',
    requestId: 'no-es-uuid',
    fromDate: '2026-09-04',
    toDate: '2026-09-03',
    limit: '101',
  });

  assert.equal(parsed.filters, null);
  assert.ok(parsed.errors.action);
  assert.ok(parsed.errors.resourceType);
  assert.ok(parsed.errors.requestId);
  assert.ok(parsed.errors.dateRange);
  assert.ok(parsed.errors.limit);
});

test('construye la consulta sin valores vacíos y codifica el cursor', () => {
  const query = buildAuditEventsQuery(
    { limit: 25, outcome: 'DENIED', action: 'AUTH_LOGIN' },
    ACTOR_ID,
  );
  const params = new URLSearchParams(query.slice(1));

  assert.equal(params.get('cursor'), ACTOR_ID);
  assert.equal(params.get('limit'), '25');
  assert.equal(params.get('outcome'), 'DENIED');
  assert.equal(params.get('action'), 'AUTH_LOGIN');
  assert.equal(params.size, 4);
});

test('cuenta filtros activos sin tratar el tamaño de página como filtro', () => {
  assert.equal(countActiveAuditFilters({ limit: 25 }), 0);
  assert.equal(countActiveAuditFilters({ limit: 25, outcome: 'FAILED', actorId: ACTOR_ID }), 2);
});

test('avanza y retrocede conservando el historial de cursores', () => {
  const secondPage = advanceAuditCursor(INITIAL_AUDIT_CURSOR_STATE, ACTOR_ID);
  assert.deepEqual(secondPage, { cursors: [null, ACTOR_ID], pageIndex: 1 });
  assert.deepEqual(retreatAuditCursor(secondPage), { cursors: [null, ACTOR_ID], pageIndex: 0 });
  assert.equal(advanceAuditCursor(secondPage, null), secondPage);
  assert.equal(retreatAuditCursor(INITIAL_AUDIT_CURSOR_STATE), INITIAL_AUDIT_CURSOR_STATE);
});

