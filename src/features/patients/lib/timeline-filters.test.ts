import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { EMPTY_TIMELINE_FILTERS, matchesTimelineFilters, timelineFilterError } from './timeline-filters';

const entry = { kind: 'document' as const, status: 'VALIDATED', title: 'Evolución', service: 'Cardiología', searchText: 'Seguimiento', clinicalFrom: '2026-01-01', clinicalTo: '2026-01-31' };
test('busca sin depender de tildes e incluye título y servicio', () => {
  assert.equal(matchesTimelineFilters(entry, { ...EMPTY_TIMELINE_FILTERS, query: 'evolucion' }), true);
  assert.equal(matchesTimelineFilters(entry, { ...EMPTY_TIMELINE_FILTERS, query: 'cardiologia' }), true);
});
test('combina estado y tipo sin tratar un registro anulado como vigente', () => {
  assert.equal(matchesTimelineFilters(entry, { ...EMPTY_TIMELINE_FILTERS, kind: 'record' }), false);
  assert.equal(matchesTimelineFilters({ ...entry, kind: 'record', status: 'VOIDED' }, { ...EMPTY_TIMELINE_FILTERS, status: 'ACTIVE' }), false);
});
test('incluye períodos que se solapan y no utiliza la fecha de carga como fecha clínica', () => {
  assert.equal(matchesTimelineFilters(entry, { ...EMPTY_TIMELINE_FILTERS, from: '2026-01-15', to: '2026-01-20' }), true);
  assert.equal(matchesTimelineFilters(entry, { ...EMPTY_TIMELINE_FILTERS, from: '2026-02-01' }), false);
  assert.equal(matchesTimelineFilters({ ...entry, clinicalFrom: null, clinicalTo: null }, { ...EMPTY_TIMELINE_FILTERS, to: '2026-02-01' }), false);
  assert.equal(matchesTimelineFilters({ ...entry, clinicalFrom: null, clinicalTo: null }, EMPTY_TIMELINE_FILTERS), true);
});
test('rechaza rangos invertidos y fechas civiles inexistentes', () => {
  assert.ok(timelineFilterError({ ...EMPTY_TIMELINE_FILTERS, from: '2026-02-30' }));
  assert.ok(timelineFilterError({ ...EMPTY_TIMELINE_FILTERS, from: '2026-02-01', to: '2026-01-01' }));
});
