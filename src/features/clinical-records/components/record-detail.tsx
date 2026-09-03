'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatInstant } from '@/shared/lib/date-time';
import { can } from '@/shared/permissions/can';
import { Spinner, Alert } from '@/shared/ui';
import { useRecord } from '../hooks/use-record';
import {
  getRecordDetailsPresentation,
  recordDetailsIncludeValue,
} from '../lib/record-details-presentation';
import { getRecordTypeDefinition } from '../lib/record-type-definitions';
import { RecordAttachmentsGallery } from './record-attachments-gallery';
import { RecordDetailsView } from './record-details-view';
import styles from './record-detail.module.css';

function formatDateTime(iso: string): string {
  return formatInstant(iso, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface RecordDetailProps {
  patientId: string;
  recordId: string;
  permissions: string[];
}

export function RecordDetail({ patientId, recordId, permissions }: RecordDetailProps) {
  const { record, isLoading, error, actionError, isActing, void: doVoid } = useRecord(
    patientId,
    recordId,
  );
  const router = useRouter();
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const voidReasonRef = useRef<HTMLTextAreaElement>(null);
  const voidTriggerRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (showVoidForm) requestAnimationFrame(() => voidReasonRef.current?.focus());
  }, [showVoidForm]);

  if (isLoading) return <Spinner label="Cargando registro…" />;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!record) return null;

  const canCorrect = can(permissions, 'records.correct') && record.status === 'ACTIVE';
  const canVoid = can(permissions, 'records.void') && record.status === 'ACTIVE';
  const definition = getRecordTypeDefinition(record.recordType);
  const details = getRecordDetailsPresentation(record.recordType, record.details);
  const professionalName = record.professionalNameSnapshot ?? record.doctorName;
  const showLegacyDiagnosis =
    Boolean(record.preliminaryDiagnosis) &&
    !recordDetailsIncludeValue(details, record.preliminaryDiagnosis);
  const showLegacyPlan =
    Boolean(record.plan) && !recordDetailsIncludeValue(details, record.plan);
  const showLegacyNotes =
    Boolean(record.notes) && !recordDetailsIncludeValue(details, record.notes);

  async function handleVoid() {
    const trimmed = voidReason.trim();
    if (trimmed.length < 10) return;
    await doVoid(trimmed);
    setShowVoidForm(false);
    setVoidReason('');
    requestAnimationFrame(() => statusRef.current?.focus());
  }

  function closeVoidForm() {
    setShowVoidForm(false);
    setVoidReason('');
    requestAnimationFrame(() => voidTriggerRef.current?.focus());
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.typeTag}>{definition.label}</h1>
          {record.parentRecordId && (
            <button
              type="button"
              className={styles.correctionLink}
              onClick={() =>
                router.push(`/patients/${patientId}/records/${record.parentRecordId}`)
              }
            >
              Ver original
            </button>
          )}
        </div>
        <span
          ref={statusRef}
          className={`${styles.statusBadge} ${styles[record.status]}`}
          tabIndex={-1}
          aria-live="polite"
        >
          {record.status === 'ACTIVE' ? 'Activo' : record.status === 'CORRECTED' ? 'Corregido' : 'Anulado'}
        </span>
      </div>

      <dl className={styles.grid}>
        <div className={styles.field}>
          <dt className={styles.fieldLabel}>Fecha de atención</dt>
          <dd className={styles.fieldValue}><time dateTime={record.attendedAt}>{formatDateTime(record.attendedAt)}</time></dd>
        </div>
        <div className={styles.field}>
          <dt className={styles.fieldLabel}>Registrado</dt>
          <dd className={styles.fieldValue}><time dateTime={record.createdAt}>{formatDateTime(record.createdAt)}</time></dd>
        </div>
        <div className={styles.field}>
          <dt className={styles.fieldLabel}>Origen</dt>
          <dd className={styles.fieldValue}>
            {record.origin === 'MANUAL' ? 'Entrada manual' : 'Digitalizado'}
          </dd>
        </div>
        {professionalName && (
          <div className={styles.field}>
            <dt className={styles.fieldLabel}>Médico / profesional</dt>
            <dd className={styles.fieldValue}>{professionalName}</dd>
          </div>
        )}
        {record.professionalLicenseSnapshot && (
          <div className={styles.field}>
            <dt className={styles.fieldLabel}>Colegiatura / identificador</dt>
            <dd className={styles.fieldValue}>{record.professionalLicenseSnapshot}</dd>
          </div>
        )}
        {record.service && (
          <div className={styles.field}>
            <dt className={styles.fieldLabel}>Servicio / especialidad</dt>
            <dd className={styles.fieldValue}>{record.service}</dd>
          </div>
        )}
        {record.priority && record.priority !== 'NORMAL' && (
          <div className={styles.field}>
            <dt className={styles.fieldLabel}>Prioridad</dt>
            <dd className={styles.fieldValue}>
              {record.priority === 'URGENT'
                ? 'Urgente'
                : record.priority === 'PRIORITY'
                  ? 'Prioritario'
                  : 'Electivo'}
            </dd>
          </div>
        )}
        {record.correctionsCount > 0 && (
          <div className={styles.field}>
            <dt className={styles.fieldLabel}>Correcciones</dt>
            <dd className={styles.fieldValue}>{record.correctionsCount}</dd>
          </div>
        )}
      </dl>

      {record.voidReason && (
        <>
          <hr className={styles.divider} />
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Motivo de anulación</h2>
            <div className={styles.voidBox}>{record.voidReason}</div>
          </div>
        </>
      )}

      <hr className={styles.divider} />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Resumen</h2>
        <div className={styles.textBlock}>{record.summary}</div>
      </div>

      {details.length > 0 && (
        <>
          <hr className={styles.divider} />
          <RecordDetailsView sections={details} />
        </>
      )}

      <RecordAttachmentsGallery
        recordType={record.recordType}
        attachments={record.attachments ?? []}
      />

      {showLegacyNotes && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Notas adicionales</h2>
          <div className={styles.textBlock}>{record.notes}</div>
        </div>
      )}

      {showLegacyDiagnosis && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Diagnóstico preliminar</h2>
          <div className={styles.textBlock}>{record.preliminaryDiagnosis}</div>
        </div>
      )}

      {showLegacyPlan && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Indicaciones / plan</h2>
          <div className={styles.textBlock}>{record.plan}</div>
        </div>
      )}

      <hr className={styles.divider} />

      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => router.back()}>
          Volver
        </button>

        {canCorrect && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() =>
              router.push(`/patients/${patientId}/records/${recordId}/correct`)
            }
          >
            Corregir
          </button>
        )}

        {canVoid && (
          <button
            ref={voidTriggerRef}
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => {
              if (showVoidForm) closeVoidForm();
              else setShowVoidForm(true);
            }}
            disabled={isActing}
            aria-expanded={showVoidForm}
            aria-controls="void-record-form"
          >
            Anular
          </button>
        )}
      </div>

      {showVoidForm && (
        <section
          id="void-record-form"
          className={styles.voidForm}
          aria-labelledby="void-record-title"
        >
          <h2 id="void-record-title" className={styles.voidTitle}>Confirmar anulación</h2>
          <label className={styles.voidLabel} htmlFor="void-reason">
            Motivo de anulación <span aria-hidden="true">*</span>
          </label>
          <textarea
            ref={voidReasonRef}
            id="void-reason"
            className={styles.voidTextarea}
            placeholder="Motivo de anulación (mínimo 10 caracteres)…"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={3}
            minLength={10}
            required
            aria-invalid={voidReason.length > 0 && voidReason.trim().length < 10}
            aria-describedby="void-reason-help"
          />
          <p id="void-reason-help" className={styles.voidHelp}>
            Explica el motivo con al menos 10 caracteres. El registro se conservará para trazabilidad.
          </p>
          <div className={`${styles.actions} ${styles.actionsCompact}`}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => void handleVoid()}
              disabled={isActing || voidReason.trim().length < 10}
            >
              {isActing ? 'Anulando…' : 'Confirmar anulación'}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={closeVoidForm}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}

      {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
    </div>
  );
}
