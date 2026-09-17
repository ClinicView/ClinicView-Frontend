import type { DocumentProcessing } from '../types/processing';

const PHASE_LABEL: Record<string, string> = {
  QUEUED: 'En cola de digitalización',
  PREPARING: 'Preparando las páginas',
  SEGMENTING: 'Detectando y ordenando los recortes',
  LOADING_MODEL: 'Preparando el modelo de reconocimiento',
  RECOGNIZING: 'Transcribiendo los fragmentos',
  EXTRACTING: 'Organizando la información detectada',
  SAVING: 'Guardando el resultado de la digitalización',
  COMPLETE: 'Resultado pendiente de incorporación',
};

export function processingStage(job: DocumentProcessing | null | undefined): string {
  if (!job) return 'Procesamiento en curso';
  switch (job.status) {
    case 'QUEUED': return PHASE_LABEL.QUEUED;
    case 'WAITING_FOR_WORKER': return 'Esperando conexión con el servicio de digitalización';
    case 'FINALIZING': return 'Incorporando el resultado al documento';
    case 'SUCCEEDED': return 'Digitalización completada';
    case 'FAILED': return 'La digitalización no pudo completarse';
    case 'INTERRUPTED': return 'La digitalización se interrumpió';
    case 'RUNNING': return PHASE_LABEL[job.progress.phase] ?? 'Digitalización en curso';
    default: return 'Estado de digitalización pendiente de confirmar';
  }
}

function validCount(value: number | null | undefined): value is number {
  return Number.isSafeInteger(value) && value !== null && value !== undefined && value >= 0;
}

export interface ProcessingCounter { label: string; completed: number; total: number }

/** No global percentage: totals may be discovered only after segmentation. */
export function processingCounter(job: DocumentProcessing | null | undefined): ProcessingCounter | null {
  if (!job || job.status !== 'RUNNING') return null;
  const progress = job.progress;
  const count = progress.phase === 'RECOGNIZING'
    ? { label: 'Fragmentos transcritos', completed: progress.linesCompleted, total: progress.linesTotal }
    : progress.phase === 'SEGMENTING'
      ? { label: 'Páginas segmentadas', completed: progress.pagesCompleted, total: progress.pagesTotal }
      : null;
  if (!count || !validCount(count.completed) || !validCount(count.total) || count.total === 0 || count.completed > count.total) return null;
  return { ...count, total: count.total };
}

export function processingPage(job: DocumentProcessing | null | undefined): string | null {
  const progress = job?.progress;
  if (!progress || job?.status !== 'RUNNING' || !validCount(progress.currentPage) || progress.currentPage < 1) return null;
  if (validCount(progress.pagesTotal) && progress.pagesTotal > 0 && progress.currentPage <= progress.pagesTotal) {
    return `Página ${progress.currentPage} de ${progress.pagesTotal}`;
  }
  return null;
}

export function canRequestProcessing(status: string, job: DocumentProcessing | null | undefined): boolean {
  if (status === 'PENDING') return !job;
  if (status !== 'FAILED') return false;
  // Legacy failures retain the existing recovery action, protected by expectedVersion.
  return !job || (job.canRetry === true && ['FAILED', 'INTERRUPTED'].includes(job.status));
}

/** Same-version progress is legal; older attempts/updates must never rewind the UI. */
export function acceptsProcessingSnapshot(
  previous: { version: number; processing?: DocumentProcessing | null } | null,
  next: { version: number; processing?: DocumentProcessing | null },
): boolean {
  if (!previous) return true;
  if (next.version < previous.version) return false;
  if (next.version > previous.version || !previous.processing) return true;
  if (!next.processing) return false;
  const before = previous.processing; const after = next.processing;
  if (after.attempt !== before.attempt) return after.attempt > before.attempt;
  if (after.jobId !== before.jobId) return false;
  const beforeTime = Date.parse(before.updatedAt); const afterTime = Date.parse(after.updatedAt);
  return Number.isFinite(beforeTime) && Number.isFinite(afterTime) && afterTime >= beforeTime;
}
