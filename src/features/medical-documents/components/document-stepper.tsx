'use client';

import { formatInstant } from '@/shared/lib/date-time';
import { Icon } from '@/shared/ui';
import type { MedicalDocument } from '../types/document';
import styles from './correction-view.module.css';

type StepState = 'done' | 'active' | 'pending' | 'error';

interface Step {
  label: string;
  meta: string;
  state: StepState;
}

function formatShort(iso: string | null): string {
  if (!iso) return '';
  return formatInstant(iso, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildSteps(document: MedicalDocument): Step[] {
  const processedDone = Boolean(document.processedAt) || ['PROCESSED', 'VALIDATED'].includes(document.status);
  const correctedDone = Boolean(document.correctedAt) || document.status === 'VALIDATED';
  const validated = document.status === 'VALIDATED';
  const rejected = document.status === 'REJECTED';

  return [
    {
      label: 'Subido',
      meta: formatShort(document.createdAt),
      state: 'done',
    },
    {
      label: 'Procesado',
      meta: document.status === 'FAILED'
        ? 'Error'
        : document.status === 'PROCESSING'
          ? 'En curso'
          : formatShort(document.processedAt),
      state: document.status === 'FAILED'
        ? 'error'
        : document.status === 'PROCESSING'
          ? 'active'
          : processedDone
            ? 'done'
            : 'pending',
    },
    {
      label: 'OCR corregido',
      meta: correctedDone
        ? formatShort(document.correctedAt)
        : document.status === 'PROCESSED'
          ? 'En progreso'
          : 'Pendiente',
      state: correctedDone ? 'done' : document.status === 'PROCESSED' ? 'active' : 'pending',
    },
    {
      label: 'Validación final',
      meta: validated
        ? formatShort(document.reviewedAt)
        : rejected
          ? 'Rechazado'
          : 'Pendiente',
      state: validated ? 'done' : rejected ? 'error' : 'pending',
    },
  ];
}

const STATE_CLASS: Record<StepState, string> = {
  done: styles.stepDone,
  active: styles.stepActive,
  pending: '',
  error: styles.stepError,
};

interface DocumentStepperProps {
  document: MedicalDocument;
}

export function DocumentStepper({ document }: DocumentStepperProps) {
  const steps = buildSteps(document);

  return (
    <ol className={styles.stepper} aria-label="Progreso del documento">
      {steps.map((step, index) => (
        <li key={step.label} style={{ display: 'contents' }}>
          <div className={`${styles.step} ${STATE_CLASS[step.state]}`}>
            <span className={styles.stepCircle} aria-hidden="true">
              {step.state === 'done' ? (
                <Icon name="check" size={16} />
              ) : step.state === 'error' ? (
                <Icon name="close" size={14} />
              ) : (
                index + 1
              )}
            </span>
            <span className={styles.stepLabel}>{step.label}</span>
            {step.meta && <span className={styles.stepMeta}>{step.meta}</span>}
          </div>
          {index < steps.length - 1 && (
            <span
              className={`${styles.stepConnector} ${step.state === 'done' ? styles.stepConnectorDone : ''}`}
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  );
}
