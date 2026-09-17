'use client';

import { formatInstant } from '@/shared/lib/date-time';
import { Icon } from '@/shared/ui';
import type { MedicalDocument } from '../types/document';
import { canRequestProcessing, processingCounter, processingPage, processingStage } from '../lib/document-processing';
import styles from './document-processing-panel.module.css';

interface DocumentProcessingPanelProps {
  document: MedicalDocument;
  canProcess: boolean;
  busy: boolean;
  checking: boolean;
  blocked: boolean;
  connectionLost: boolean;
  submissionUncertain: boolean;
  onProcess: () => void;
  onRefresh: () => void;
}

export function DocumentProcessingPanel({ document, canProcess, busy, checking, blocked, connectionLost, submissionUncertain, onProcess, onRefresh }: DocumentProcessingPanelProps) {
  const job = document.processing;
  const active = document.status === 'PROCESSING';
  const failed = document.status === 'FAILED';
  if (!active && !failed && document.status !== 'PENDING' && !submissionUncertain) return null;
  const counter = active ? processingCounter(job) : null;
  const currentPage = active ? processingPage(job) : null;
  const stage = document.status === 'PENDING' && !job
    ? 'Documento listo para digitalizar'
    : failed && !job ? 'La digitalización no pudo completarse' : processingStage(job);
  const requestAllowed = canProcess && canRequestProcessing(document.status, job);
  const stateNeedsCheck = connectionLost || submissionUncertain;
  const statusText = submissionUncertain
    ? 'Comprobando si el servidor recibió la solicitud. No se enviará otro intento hasta consultar su estado.'
    : connectionLost
      ? 'No pudimos actualizar el estado. El trabajo puede seguir en el servidor; volveremos a consultar automáticamente.'
      : `${stage}.${counter ? ` ${counter.label}: ${counter.completed} de ${counter.total}.` : ''}${currentPage ? ` ${currentPage}.` : ''}`;

  return (
    <section className={`${styles.panel} ${failed ? styles.failed : ''}`} aria-labelledby="processing-title">
      <div className={styles.heading}>
        <span className={styles.icon} aria-hidden="true"><Icon name={failed ? 'warning' : active ? 'scan' : 'document'} size={22} /></span>
        <div className={styles.headingCopy}>
          <p className={styles.eyebrow}>Digitalización del documento</p>
          <h2 id="processing-title">{stage}</h2>
        </div>
        {job && <span className={styles.attempt}>Intento {job.attempt}</span>}
      </div>

      <p className={styles.srOnly} role="status" aria-atomic="true">{statusText}</p>

      {counter && <div className={styles.progressBlock}>
        <div className={styles.progressLabel}><span>{counter.label}</span><strong>{counter.completed} / {counter.total}</strong></div>
        <progress aria-label={counter.label} value={counter.completed} max={counter.total} />
        <p>Avance de esta etapa; no representa la precisión del texto ni el tiempo restante.</p>
      </div>}

      {active && <p className={styles.description}>
        {job?.status === 'WAITING_FOR_WORKER'
          ? 'El trabajo está guardado. El servidor intentará contactar al servicio con el mismo identificador, sin crear otra digitalización.'
          : job?.status === 'FINALIZING' || job?.progress.phase === 'SAVING' || job?.progress.phase === 'COMPLETE'
            ? 'La transcripción aún no está lista para revisión: falta guardar e incorporar el resultado completo.'
            : job?.status === 'QUEUED'
              ? 'La solicitud está guardada y espera su turno. No es necesario mantener esta página abierta.'
              : 'Puedes seguir navegando y volver a este documento. El estado se actualiza automáticamente; la revisión clínica comienza cuando el resultado está guardado.'}
      </p>}
      {document.status === 'PENDING' && <p className={styles.description}>Ejecuta la digitalización para obtener el texto y los recortes. El archivo original se conserva; después deberás revisar y validar el contenido.</p>}
      {failed && <div className={styles.failureCopy}>
        <p>{job?.error?.message ?? 'No se obtuvo un resultado completo. El archivo original sigue disponible.'}</p>
        <p>{job && !job.canRetry
          ? 'No hay un reintento automático disponible. Revisa el archivo original y comunica el código de referencia al administrador.'
          : 'Puedes iniciar un nuevo intento con el mismo archivo. No se valida ni publica contenido de forma automática.'}</p>
        {job?.error?.code && <p className={styles.reference}>Referencia del error: <code>{job.error.code}</code></p>}
      </div>}

      {(job || currentPage) && <dl className={styles.metadata}>
        {currentPage && <div><dt>En esta etapa</dt><dd>{currentPage}</dd></div>}
        {job?.updatedAt && <div><dt>Última actualización del trabajo</dt><dd><time dateTime={job.updatedAt}>{formatInstant(job.updatedAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time> · Lima</dd></div>}
      </dl>}

      {stateNeedsCheck && <p className={styles.connectionWarning}>{statusText}</p>}

      {(requestAllowed || active || stateNeedsCheck) && <div className={styles.actions}>
        {requestAllowed && <button type="button" className={styles.primaryButton} onClick={onProcess} disabled={busy || checking || blocked || submissionUncertain || connectionLost} aria-busy={busy}>
          <Icon name="scan" size={17} />
          {busy ? 'Registrando solicitud…' : failed ? 'Reintentar digitalización' : 'Procesar digitalización'}
        </button>}
        {(active || stateNeedsCheck) && <button type="button" className={styles.secondaryButton} onClick={onRefresh} disabled={busy || checking || blocked} aria-busy={checking}>
          <Icon name="rotate" size={17} />{checking ? 'Consultando estado…' : 'Consultar estado'}
        </button>}
      </div>}
      {blocked && <p className={styles.description}>Guarda o descarta los cambios locales antes de iniciar otra acción.</p>}
      {job && <details className={styles.technical}><summary>Referencia de seguimiento</summary><p>Trabajo <code>{job.jobId}</code>. Esta referencia identifica el procesamiento, no al paciente.</p></details>}
    </section>
  );
}
