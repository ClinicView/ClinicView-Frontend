import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { historyExportOrder } from './history-export-order';
import type { ClinicalHistoryExport } from '../types/patient';
const history = {
  records: [
    {
      id: 'b',
      attendedAt: '2023-01-02T05:00:00Z',
      createdAt: '2024-01-01T05:00:00Z',
      episode: { id: 'ep' },
    },
    {
      id: 'a',
      attendedAt: '2023-01-01T05:00:00Z',
      createdAt: '2024-01-01T05:00:00Z',
      episode: { id: 'ep' },
    },
    { id: 'c', attendedAt: '2020-01-01T05:00:00Z', createdAt: '2024-01-01T05:00:00Z' },
  ],
  documents: [
    {
      id: 'doc',
      createdAt: '2025-01-01T05:00:00Z',
      clinicalMetadata: { clinicalDate: '2022-01-01' },
    },
    { id: 'undated', createdAt: '2026-01-01T05:00:00Z', clinicalMetadata: {} },
  ],
  episodes: [{ id: 'ep' }],
} as unknown as ClinicalHistoryExport;
test('ordena por fecha clínica y usa carga solo cuando no consta fecha, sin mutar datos', () => {
  assert.deepEqual(
    historyExportOrder(history, 'DATE').map((row) => row.id),
    ['c', 'doc', 'a', 'b', 'undated'],
  );
  assert.deepEqual(
    history.records.map((row) => row.id),
    ['b', 'a', 'c'],
  );
});
test('agrupa episodios conservando todas las entradas y cada original una sola vez', () => {
  const rows = historyExportOrder(history, 'EPISODE');
  assert.deepEqual(
    rows.map((row) => row.id),
    ['a', 'b', 'c', 'doc', 'undated'],
  );
  assert.equal(new Set(rows.map((row) => `${row.kind}:${row.id}`)).size, 5);
});
