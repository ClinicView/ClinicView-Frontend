import type { OcrLayout } from '../types/ocr-layout';

export function evaluationExportBlock(layout: OcrLayout, dirty: boolean, busy: boolean): string | null {
  if (busy) return 'Espera a que termine la operación en curso.';
  if (dirty) return 'Guarda o descarta los cambios pendientes antes de exportar la revisión guardada.';
  if (!layout.runId || !layout.review || !Number.isSafeInteger(layout.review.revision) || layout.review.revision < 1) return 'Primero guarda una revisión visual de esta ejecución.';
  if (!layout.review.lines.length || layout.review.lines.some((line) => line.reviewed !== true)) return 'Contrasta todos los fragmentos con sus imágenes y guarda la revisión antes de exportar.';
  return null;
}

/** Refuse a mismatched response before a private download is offered. */
export function evaluationSnapshotMatches(value: unknown, documentId: string, runId: string, revision: number): boolean {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  const provenance = snapshot.provenance as Record<string, unknown> | undefined;
  return snapshot.schemaVersion === 1 && snapshot.kind === 'clinicview-ocr-evaluation-snapshot'
    && snapshot.documentId === documentId && snapshot.runId === runId && snapshot.revision === revision
    && typeof snapshot.sourceSha256 === 'string' && /^[a-f0-9]{64}$/.test(snapshot.sourceSha256)
    && provenance?.referenceDraft === true && provenance?.referenceKind === 'ocr_postedited'
    && provenance?.pageCoverage === 'unassessed' && provenance?.clinicalValidationIsReference === false;
}
