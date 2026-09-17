import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { DocumentProcessing } from '../types/processing';
import { acceptsProcessingSnapshot, canRequestProcessing, processingCounter, processingPage, processingStage } from './document-processing';

function job(patch: Partial<DocumentProcessing> = {}): DocumentProcessing {
  return {
    jobId: 'job-a', attempt: 1, status: 'RUNNING',
    progress: { phase: 'RECOGNIZING', currentPage: 1, pagesTotal: 2, pagesCompleted: 0, linesTotal: 80, linesCompleted: 12, batchesTotal: 20, batchesCompleted: 3 },
    createdAt: '2026-09-17T14:00:00Z', updatedAt: '2026-09-17T14:01:00Z',
    startedAt: '2026-09-17T14:00:05Z', completedAt: null, heartbeatAt: '2026-09-17T14:01:00Z',
    error: null, canRetry: false, ...patch,
  };
}

test('recognition progress exposes exact fragment counts, not a global percentage', () => {
  assert.deepEqual(processingCounter(job()), { label: 'Fragmentos transcritos', completed: 12, total: 80 });
  assert.equal(processingPage(job()), 'Página 1 de 2');
  assert.equal(Object.hasOwn(processingCounter(job())!, 'percentage'), false);
});

test('segmentation page counts are explicitly scoped to the phase', () => {
  const sample = job(); sample.progress.phase = 'SEGMENTING'; sample.progress.pagesCompleted = 1;
  assert.deepEqual(processingCounter(sample), { label: 'Páginas segmentadas', completed: 1, total: 2 });
  sample.progress.phase = 'SAVING';
  assert.equal(processingCounter(sample), null);
  assert.match(processingStage(sample), /Guardando/);
});

test('unknown, zero, negative, fractional and inconsistent totals do not invent a bar', () => {
  for (const total of [null, 0, -1, 0.5, NaN, Infinity, 2]) {
    const sample = job(); sample.progress.linesTotal = total;
    assert.equal(processingCounter(sample), null);
  }
  for (const completed of [-1, 1.5, NaN, Infinity, 100]) {
    const sample = job(); sample.progress.linesCompleted = completed;
    assert.equal(processingCounter(sample), null);
  }
  const sample = job(); sample.progress.linesCompleted = 0;
  assert.equal(processingCounter(sample)?.completed, 0);
});

test('queued, disconnected worker, failure and finalization never show misleading completion', () => {
  for (const status of ['QUEUED', 'WAITING_FOR_WORKER', 'FINALIZING', 'FAILED', 'INTERRUPTED', 'SUCCEEDED'] as const) {
    assert.equal(processingCounter(job({ status })), null);
    assert.equal(processingPage(job({ status })), null);
  }
  assert.match(processingStage(job({ status: 'WAITING_FOR_WORKER' })), /Esperando conexión/);
  assert.match(processingStage(job({ status: 'FINALIZING' })), /Incorporando/);
  assert.match(processingStage(job({ status: 'INTERRUPTED' })), /interrumpió/);
  assert.match(processingStage(job({ status: 'SUCCEEDED' })), /completada/);
});

test('legacy and unknown phases/statuses remain explicit without fake progress', () => {
  assert.equal(processingCounter(null), null);
  assert.equal(processingCounter(undefined), null);
  assert.equal(processingStage(null), 'Procesamiento en curso');
  const sample = job(); sample.progress.phase = 'FUTURE_PHASE';
  assert.equal(processingStage(sample), 'Digitalización en curso');
  assert.equal(processingCounter(sample), null);
  assert.equal(processingStage(job({ status: 'FUTURE_STATUS' as DocumentProcessing['status'] })), 'Estado de digitalización pendiente de confirmar');
});

test('page label is omitted until coherent coordinates are known', () => {
  for (const page of [null, 0, -1, 3, 1.2]) {
    const sample = job(); sample.progress.currentPage = page;
    assert.equal(processingPage(sample), null);
  }
  const sample = job(); sample.progress.pagesTotal = null;
  assert.equal(processingPage(sample), null);
});

test('new attempts are restricted to initial or explicitly retryable definitive failures', () => {
  assert.equal(canRequestProcessing('PENDING', null), true);
  assert.equal(canRequestProcessing('FAILED', undefined), true);
  assert.equal(canRequestProcessing('FAILED', job({ status: 'FAILED', canRetry: true })), true);
  assert.equal(canRequestProcessing('FAILED', job({ status: 'INTERRUPTED', canRetry: true })), true);
  assert.equal(canRequestProcessing('FAILED', job({ status: 'FAILED', canRetry: false })), false);
  for (const status of ['PENDING', 'PROCESSING', 'PROCESSED', 'VALIDATED', 'REJECTED']) {
    assert.equal(canRequestProcessing(status, job({ status: 'FAILED', canRetry: true })), false);
  }
  for (const status of ['RUNNING', 'QUEUED', 'WAITING_FOR_WORKER', 'FINALIZING', 'SUCCEEDED'] as const) {
    assert.equal(canRequestProcessing('FAILED', job({ status, canRetry: true })), false);
  }
});

test('same clinical version accepts newer progress but rejects older time and attempt', () => {
  const previous = { version: 4, processing: job() };
  assert.equal(acceptsProcessingSnapshot(previous, { version: 4, processing: job({ updatedAt: '2026-09-17T14:02:00Z' }) }), true);
  assert.equal(acceptsProcessingSnapshot(previous, { version: 4, processing: job({ updatedAt: '2026-09-17T14:00:00Z' }) }), false);
  assert.equal(acceptsProcessingSnapshot(previous, { version: 4, processing: job({ attempt: 0 }) }), false);
  assert.equal(acceptsProcessingSnapshot(previous, { version: 4, processing: job({ jobId: 'other-job' }) }), false);
  assert.equal(acceptsProcessingSnapshot(previous, { version: 4, processing: null }), false);
  assert.equal(acceptsProcessingSnapshot(previous, { version: 4, processing: job({ updatedAt: 'invalid' }) }), false);
});

test('a new accepted version or attempt can begin again without confusing previous counters', () => {
  const previous = { version: 4, processing: job({ status: 'FAILED' }) };
  assert.equal(acceptsProcessingSnapshot(previous, { version: 5, processing: job({ jobId: 'new-job', attempt: 2, status: 'QUEUED' }) }), true);
  assert.equal(acceptsProcessingSnapshot(previous, { version: 3, processing: job({ attempt: 2 }) }), false);
  assert.equal(acceptsProcessingSnapshot(null, { version: 1, processing: null }), true);
  assert.equal(acceptsProcessingSnapshot({ version: 4 }, { version: 4, processing: job() }), true);
  assert.equal(acceptsProcessingSnapshot({ version: 4 }, { version: 3, processing: job() }), false);
});
