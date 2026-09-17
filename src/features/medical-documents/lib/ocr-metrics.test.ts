import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatErrorRate, modelConfidence, referenceErrorRates } from './ocr-metrics';
import type { OcrMetrics } from '../types/document';

const metrics = (values: Partial<OcrMetrics> = {}): OcrMetrics => ({ cer: .1, wer: .2, charAccuracy: .9, nerPrecision: .8, nerRecall: .9, nerF1: .85, estimated: false, ...values });

test('confidence-derived and provenance-ambiguous legacy metrics are never measured CER/WER', () => {
  assert.equal(referenceErrorRates(metrics({ estimated: true })), null);
  assert.equal(referenceErrorRates({ ...metrics(), estimated: undefined } as unknown as OcrMetrics), null);
  assert.equal(referenceErrorRates(null), null);
  assert.equal(referenceErrorRates(undefined), null);
});

test('explicit reference comparison preserves zero and error rates exceeding one', () => {
  assert.deepEqual(referenceErrorRates(metrics({ cer: 0, wer: 2.5 })), { cer: 0, wer: 2.5 });
  assert.equal(formatErrorRate(2.5), '250.0%');
  assert.equal(formatErrorRate(0), '0.0%');
  assert.equal(formatErrorRate(null), '—');
});

test('nonfinite, negative, or absent reference rates do not become zero', () => {
  assert.equal(referenceErrorRates(metrics({ cer: NaN, wer: Infinity })), null);
  assert.equal(referenceErrorRates(metrics({ cer: -1, wer: null })), null);
  assert.deepEqual(referenceErrorRates(metrics({ cer: null, wer: .4 })), { cer: null, wer: .4 });
});

test('confidence stays a separate bounded model signal, not a calculated error rate', () => {
  assert.equal(modelConfidence(.83), .83);
  assert.equal(modelConfidence(0), 0);
  for (const value of [null, undefined, NaN, Infinity, -.1, 1.01, '0.9']) assert.equal(modelConfidence(value), null);
});
