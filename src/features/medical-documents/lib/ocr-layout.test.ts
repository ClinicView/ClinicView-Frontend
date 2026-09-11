import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { boxError, mergeWithNext, moveLine, orderedLines, reviewError, reviewLines, reviewSelection, reviewText, splitLine, warningLabel } from './ocr-layout';
import type { OcrLayout, OcrLayoutPage, OcrReviewLine } from '../types/ocr-layout';

const pages: OcrLayoutPage[] = [{
  page: 1, width: 1000, height: 1400, coordinateSpace: 'preprocessed_page', warnings: [], imageAvailable: true,
  lines: [
    { lineId: 'p1_l1', bbox: [10, 20, 800, 60], order: 1, text: 'Línea primera', confidence: .82 },
    { lineId: 'p1_l2', bbox: [20, 80, 900, 120], order: 2, text: 'Línea segunda', confidence: null },
  ],
}, {
  page: 2, width: 1000, height: 1400, coordinateSpace: 'preprocessed_page', warnings: [], imageAvailable: true,
  lines: [{ lineId: 'p2_l1', bbox: [10, 20, 800, 80], order: 1, text: 'Otra página', confidence: .8 }],
}];
const layout: OcrLayout = { schemaVersion: 1, available: true, runId: 'run_test', documentVersion: 3, pages, review: null };
const fresh = () => reviewLines(layout);

test('undoing a new fragment on page two keeps restored selection on its own image', () => {
  assert.deepEqual(reviewSelection(fresh(), pages, { lineId: 'manual_undone', page: 2 }), {
    lineId: 'p2_l1', page: 2,
  });
  const firstPageOnly = fresh().filter((line) => line.page === 1);
  assert.deepEqual(reviewSelection(firstPageOnly, pages, { lineId: 'manual_undone', page: 2 }), {
    lineId: 'p1_l1', page: 1,
  });
});

test('initial review clones machine geometry, preserves empty/null recognition and marks no human review', () => {
  const lines = fresh();
  assert.equal(lines.length, 3);
  assert.deepEqual(lines.map((line) => line.reviewed), [false, false, false]);
  assert.deepEqual(lines[0].sourceLineIds, ['p1_l1']);
  lines[0].bbox[0] = 99;
  assert.equal(layout.pages[0].lines[0].bbox[0], 10);
});

test('existing review is preferred over raw OCR and is cloned for safe undo', () => {
  const prior = fresh();
  prior[0].text = 'Corrección conservada';
  prior[0].reviewed = true;
  const next = reviewLines({ ...layout, review: { revision: 1, documentVersion: 4, stale: false, lines: prior, recordedAt: '2026-09-11T12:00:00Z', recordedBy: { id: 'r', username: 'demo', fullName: 'Revisor demo' } } });
  assert.equal(next[0].text, 'Corrección conservada');
  assert.equal(next[0].reviewed, true);
  next[0].sourceLineIds.push('another');
  assert.deepEqual(prior[0].sourceLineIds, ['p1_l1']);
});

test('box boundaries accept the exact page edges', () => {
  assert.equal(boxError([0, 0, 1000, 1400], pages[0]), null);
});

test('box validation rejects fractional, NaN, negative, inverted, zero and outside dimensions', () => {
  for (const box of [[0.5, 0, 20, 30], [NaN, 0, 20, 30], [-1, 0, 20, 30], [10, 0, 10, 30], [20, 0, 10, 30], [0, 0, 1001, 30], [0, 0, 20, 1401], [0, 20, 10, 10], [0, 0, Infinity, 10]]) {
    assert.ok(boxError(box, pages[0]), String(box));
  }
});

test('moving keeps page order contiguous and never mutates prior snapshots', () => {
  const prior = fresh().map((line) => ({ ...line, reviewed: true }));
  const result = moveLine(prior, 'p1_l2', -1);
  assert.deepEqual(result.map((line) => line.lineId), ['p1_l2', 'p1_l1', 'p2_l1']);
  assert.deepEqual(result.map((line) => line.order), [1, 2, 1]);
  assert.deepEqual(result.map((line) => line.reviewed), [false, false, true]);
  assert.equal(prior[0].lineId, 'p1_l1');
  assert.equal(prior[0].reviewed, true);
  assert.equal(reviewError(result, pages), null);
});

test('moving cannot cross page boundaries or nonexistent IDs', () => {
  const lines = fresh();
  assert.equal(moveLine(lines, 'p1_l1', -1), lines);
  assert.equal(moveLine(lines, 'p1_l2', 1), lines);
  assert.equal(moveLine(lines, 'not-found', 1), lines);
});

test('merging joins text, unions bounding geometry and preserves all origins', () => {
  const before = fresh();
  const result = mergeWithNext(before, 'p1_l1', 'merged_test');
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].bbox, [10, 20, 900, 120]);
  assert.deepEqual(result[0].sourceLineIds, ['p1_l1', 'p1_l2']);
  assert.equal(result[0].text, 'Línea primera\nLínea segunda');
  assert.equal(result[0].reviewed, false);
  assert.equal(before.length, 3);
  assert.equal(reviewError(result, pages), null);
});

test('merge rejects cross-page, duplicate identity and excessive text', () => {
  assert.throws(() => mergeWithNext(fresh(), 'p1_l2', 'merged'), /misma página/);
  assert.throws(() => mergeWithNext(fresh(), 'p1_l1', 'p2_l1'), /identificador/);
  const oversized = fresh(); oversized[0].text = 'x'.repeat(4000);
  assert.throws(() => mergeWithNext(oversized, 'p1_l1', 'merged'), /4000/);
});

test('horizontal split exactly partitions geometry and duplicates provenance, not inferred text', () => {
  const result = splitLine(fresh(), 'p1_l1', { axis: 'horizontal', position: 40, texts: ['Primera parte', 'Segunda parte'], ids: ['a', 'b'] });
  assert.deepEqual(result[0].bbox, [10, 20, 800, 40]);
  assert.deepEqual(result[1].bbox, [10, 40, 800, 60]);
  assert.deepEqual(result[0].sourceLineIds, ['p1_l1']);
  assert.deepEqual(result[1].sourceLineIds, ['p1_l1']);
  assert.equal(result[1].text, 'Segunda parte');
  assert.deepEqual(result.map((line) => line.order), [1, 2, 3, 1]);
  assert.equal(reviewError(result, pages), null);
});

test('vertical split partitions left/right without overlap or missing pixels', () => {
  const result = splitLine(fresh(), 'p1_l1', { axis: 'vertical', position: 300, texts: ['Izquierda', 'Derecha'], ids: ['a', 'b'] });
  assert.deepEqual(result[0].bbox, [10, 20, 300, 60]);
  assert.deepEqual(result[1].bbox, [300, 20, 800, 60]);
  assert.equal(reviewError(result, pages), null);
});

test('split disallows cuts outside/at edges, fractions, duplicate IDs and huge text', () => {
  for (const position of [20, 60, -5, 61, 30.5, NaN]) assert.throws(() => splitLine(fresh(), 'p1_l1', { axis: 'horizontal', position, texts: ['', ''], ids: ['a', 'b'] }), /dentro/);
  assert.throws(() => splitLine(fresh(), 'p1_l1', { axis: 'horizontal', position: 40, texts: ['', ''], ids: ['a', 'a'] }), /identificadores/);
  assert.throws(() => splitLine(fresh(), 'p1_l1', { axis: 'horizontal', position: 40, texts: ['x'.repeat(4001), ''], ids: ['a', 'b'] }), /4000/);
});

test('save validation refuses dropped original content, invented origin and wrong-page lineage', () => {
  assert.match(reviewError(fresh().slice(1), pages) ?? '', /Faltan fragmentos/);
  const forged = fresh(); forged[0].sourceLineIds = ['fake'];
  assert.match(reviewError(forged, pages) ?? '', /procedencia/);
  const wrong = fresh(); wrong[0].sourceLineIds = ['p2_l1'];
  assert.match(reviewError(wrong, pages) ?? '', /procedencia/);
});

test('manual missed region needs a reason and a valid page; all original lines stay present', () => {
  const manual: OcrReviewLine = { lineId: 'manual', page: 1, bbox: [10, 130, 800, 170], order: 3, text: 'Transcripción manual', reviewed: false, sourceLineIds: [] };
  assert.match(reviewError([...fresh(), manual], pages) ?? '', /motivo/);
  manual.reason = 'Renglón omitido por el detector.';
  assert.equal(reviewError([...fresh(), manual], pages), null);
  assert.match(reviewError([...fresh(), { ...manual, page: 99 }], pages) ?? '', /inexistente/);
});

test('save validation detects duplicate IDs and duplicate/invalid within-page reading order', () => {
  const ids = fresh(); ids[1].lineId = ids[0].lineId;
  assert.match(reviewError(ids, pages) ?? '', /identificadores/);
  const order = fresh(); order[1].order = order[0].order;
  assert.match(reviewError(order, pages) ?? '', /orden/);
  order[1].order = 0;
  assert.match(reviewError(order, pages) ?? '', /orden/);
});

test('canonical text matches the backend single-newline and trim replacement contract', () => {
  const lines = fresh().reverse();
  assert.equal(reviewText(lines), 'Línea primera\nLínea segunda\nOtra página');
  assert.equal(orderedLines(lines)[0].lineId, 'p1_l1');
  assert.equal(lines[0].lineId, 'p2_l1');
});

test('warning labels do not claim detection confidence is measured accuracy', () => {
  assert.match(warningLabel('low_confidence'), /confianza/);
  assert.match(warningLabel('unknown_warning'), /Observación técnica/);
  assert.doesNotMatch(warningLabel('low_confidence'), /exactitud/);
});

test('reload never displays a selected crop over the image of a different page', () => {
  assert.deepEqual(reviewSelection(fresh(), pages, { lineId: 'removed', page: 2 }), { lineId: 'p2_l1', page: 2 });
  assert.deepEqual(reviewSelection(fresh(), pages, { lineId: 'p1_l1', page: 2 }), { lineId: 'p1_l1', page: 1 });
  assert.deepEqual(reviewSelection([], pages, { lineId: 'removed', page: 2 }), { lineId: '', page: 2 });
});
