import type { OcrMetrics } from '../types/document';

/** Never turn model confidence (or ambiguous historical values) into measured error. */
export function referenceErrorRates(metrics: OcrMetrics | null | undefined): { cer: number | null; wer: number | null } | null {
  if (metrics?.estimated !== false) return null;
  const errorRate = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const cer = errorRate(metrics.cer);
  const wer = errorRate(metrics.wer);
  return cer === null && wer === null ? null : { cer, wer };
}

export function formatErrorRate(value: number | null): string {
  // Insertions can produce more errors than reference units: CER/WER may exceed 100%.
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

export function modelConfidence(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
