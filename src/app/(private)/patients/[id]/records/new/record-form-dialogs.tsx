'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  getRecordTypeDefinition,
  listRecords,
  type ClinicalRecord,
  type RecordType,
} from '@/features/clinical-records';
import { formatInstant } from '@/shared/lib/date-time';
import { Icon, Spinner } from '@/shared/ui';
import styles from './manual-record.module.css';

interface ModalFrameProps {
  id: string;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

function ModalFrame({ id, eyebrow, title, onClose, children, footer }: ModalFrameProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className={styles.dialog}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom
        ) onClose();
      }}
    >
      <div className={styles.dialogHeader}>
        <div>
          <span className={styles.dialogEyebrow}>{eyebrow}</span>
          <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1}>{title}</h2>
        </div>
        <button className={styles.dialogClose} type="button" onClick={onClose} aria-label={`Cerrar ${title.toLowerCase()}`}>
          <Icon name="close" size={19} />
        </button>
      </div>
      <div className={styles.dialogBody}>{children}</div>
      {footer && <div className={styles.dialogFooter}>{footer}</div>}
    </dialog>
  );
}

interface HelpDialogProps {
  recordType: RecordType | '';
  onClose: () => void;
}

export function HelpDialog({ recordType, onClose }: HelpDialogProps) {
  const definition = recordType ? getRecordTypeDefinition(recordType) : null;
  return (
    <ModalFrame
      id="record-help-dialog"
      eyebrow="Ayuda contextual"
      title={definition ? `Cómo completar: ${definition.shortLabel}` : 'Cómo crear un registro clínico'}
      onClose={onClose}
      footer={<button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={onClose}>Entendido</button>}
    >
      {definition ? (
        <>
          <p className={styles.dialogLead}>{definition.description}</p>
          <ol className={styles.helpList}>
            {definition.help.map((tip) => <li key={tip}>{tip}</li>)}
          </ol>
        </>
      ) : (
        <>
          <p className={styles.dialogLead}>
            Selecciona el tipo que represente la atención. ClinicView mostrará solo los campos de esa plantilla.
          </p>
          <ul className={styles.helpList}>
            <li>Los campos con asterisco son obligatorios.</li>
            <li>Cada plantilla conserva sus datos si cambias temporalmente de tipo.</li>
            <li>El borrador se guarda de forma privada en el servidor y caduca en siete días.</li>
          </ul>
        </>
      )}
      <div className={styles.safetyNote}>
        <Icon name="shield" size={18} />
        <p>Verifica la información clínica antes de registrar. El envío crea parte de la historia del paciente.</p>
      </div>
    </ModalFrame>
  );
}

const STATUS_LABEL: Record<ClinicalRecord['status'], string> = {
  ACTIVE: 'Activo',
  CORRECTED: 'Corregido',
  VOIDED: 'Anulado',
};

interface HistoryDialogProps {
  patientId: string;
  onClose: () => void;
}

export function HistoryDialog({ patientId, onClose }: HistoryDialogProps) {
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await listRecords(patientId, { page: 1, limit: 5 });
      setRecords(page.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la historia reciente.');
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ModalFrame
      id="record-history-dialog"
      eyebrow="Consulta bajo demanda"
      title="Historia reciente del paciente"
      onClose={onClose}
      footer={(
        <>
          <button className={styles.btn} type="button" onClick={onClose}>Cerrar</button>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/patients/${patientId}/records`}>
            Ver historia completa
          </Link>
        </>
      )}
    >
      {isLoading ? (
        <div className={styles.dialogLoading}><Spinner label="Cargando historia reciente…" /></div>
      ) : error ? (
        <div className={styles.dialogError} role="alert">
          <Icon name="warning" size={19} />
          <div><p>{error}</p><button type="button" onClick={() => void load()}>Reintentar</button></div>
        </div>
      ) : records.length === 0 ? (
        <div className={styles.historyEmpty}>
          <Icon name="records" size={24} />
          <p>Este paciente aún no tiene registros clínicos.</p>
        </div>
      ) : (
        <ul className={styles.historyList}>
          {records.map((record) => {
            const definition = getRecordTypeDefinition(record.recordType);
            return (
              <li key={record.id}>
                <Link href={`/patients/${patientId}/records/${record.id}`} className={styles.historyItem}>
                  <span className={styles.historyIcon} aria-hidden="true"><Icon name="document" size={17} /></span>
                  <span className={styles.historyBody}>
                    <strong>{definition.label}</strong>
                    <span>{formatInstant(record.attendedAt, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    <span className={styles.historySummary}>{record.summary}</span>
                  </span>
                  <span className={`${styles.statusPill} ${styles[`status_${record.status}`]}`}>
                    {STATUS_LABEL[record.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ModalFrame>
  );
}
