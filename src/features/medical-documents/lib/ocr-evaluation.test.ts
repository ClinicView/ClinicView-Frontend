import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { evaluationExportBlock, evaluationSnapshotMatches } from './ocr-evaluation';
import type { OcrLayout } from '../types/ocr-layout';

const layout: OcrLayout = {
  schemaVersion: 1, available: true, runId: 'run-test', documentVersion: 3, pages: [],
  review: { revision: 1, documentVersion: 3, stale: false, recordedAt: '2026-09-17T00:00:00Z',
    recordedBy: { id: 'test', username: 'test', fullName: 'Test' },
    lines: [{ lineId: 'l1', page: 1, bbox: [0, 0, 10, 10], order: 1, text: 'Texto revisado', reviewed: true, sourceLineIds: ['l1'] }],
  },
};

test('evaluation export requires a saved complete review with no pending mutations', () => {
  assert.equal(evaluationExportBlock(layout, false, false), null);
  assert.match(evaluationExportBlock(layout, true, false)!, /pendientes/);
  assert.match(evaluationExportBlock(layout, false, true)!, /operación/);
  assert.match(evaluationExportBlock({ ...layout, review: null }, false, false)!, /guarda/);
  assert.match(evaluationExportBlock({ ...layout, runId: null }, false, false)!, /guarda/);
  assert.match(evaluationExportBlock({ ...layout, review: { ...layout.review!, lines: [] } }, false, false)!, /todos/);
  assert.match(evaluationExportBlock({ ...layout, review: { ...layout.review!, lines: layout.review!.lines.map((line) => ({ ...line, reviewed: false })) } }, false, false)!, /todos/);
});

test('an explicitly saved historical reference is exportable without claiming current clinical validity', () => {
  assert.equal(evaluationExportBlock({ ...layout, review: { ...layout.review!, stale: true } }, false, false), null);
});

const snapshot = {
  schemaVersion: 1, kind: 'clinicview-ocr-evaluation-snapshot', documentId: 'doc-test', runId: 'run-test', revision: 1, sourceSha256: 'a'.repeat(64),
  provenance: { referenceDraft: true, referenceKind: 'ocr_postedited', pageCoverage: 'unassessed', clinicalValidationIsReference: false },
};
test('private snapshot must match the exact run and revision, not a latest-version fallback', () => {
  assert.equal(evaluationSnapshotMatches(snapshot, 'doc-test', 'run-test', 1), true);
  assert.equal(evaluationSnapshotMatches(snapshot, 'doc-other', 'run-test', 1), false);
  assert.equal(evaluationSnapshotMatches(snapshot, 'doc-test', 'run-other', 1), false);
  assert.equal(evaluationSnapshotMatches(snapshot, 'doc-test', 'run-test', 2), false);
  for (const value of [null, {}, { ...snapshot, sourceSha256: 'invalid' }, { ...snapshot, provenance: { ...snapshot.provenance, referenceDraft: false } }, { ...snapshot, provenance: { ...snapshot.provenance, pageCoverage: 'complete' } }]) {
    assert.equal(evaluationSnapshotMatches(value, 'doc-test', 'run-test', 1), false);
  }
});
