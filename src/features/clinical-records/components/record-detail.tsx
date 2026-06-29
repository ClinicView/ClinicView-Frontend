'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { can } from '@/shared/permissions/can';
import { Spinner, Alert } from '@/shared/ui';
import type { RecordType } from '../types/record';
import { useRecord } from '../hooks/use-record';
import styles from './record-detail.module.css';

const TYPE_LABEL: Record<RecordType, string> = {
  CONSULTATION: 'Consulta',
  LAB_RESULT: 'Resultado de laboratorio',
  PRESCRIPTION: 'Receta / prescripción',
  THERAPY_NOTE: 'Nota de terapia',
  EVOLUTION: 'Evolución',
  PROCEDURE: 'Procedimiento',
  OTHER: 'Otro',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
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

  if (isLoading) return <Spinner label="Cargando registro…" />;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!record) return null;

  const canCorrect = can(permissions, 'records.correct') && record.status === 'ACTIVE';
  const canVoid = can(permissions, 'records.void') && record.status === 'ACTIVE';

  async function handleVoid() {
    const trimmed = voidReason.trim();
    if (trimmed.length < 10) return;
    await doVoid(trimmed);
    setShowVoidForm(false);
    setVoidReason('');
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.typeTag}>{TYPE_LABEL[record.recordType]}</span>
          {record.parentRecordId && (
            <button
              className={styles.correctionLink}
              onClick={() =>
                router.push(`/patients/${patientId}/records/${record.parentRecordId}`)
              }
            >
              Ver original
            </button>
          )}
        </div>
        <span className={`${styles.statusBadge} ${styles[record.status]}`}>
          {record.status === 'ACTIVE' ? 'Activo' : record.status === 'CORRECTED' ? 'Corregido' : 'Anulado'}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Fecha de atención</span>
          <span className={styles.fieldValue}>{formatDateTime(record.attendedAt)}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Registrado</span>
          <span className={styles.fieldValue}>{formatDateTime(record.createdAt)}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Origen</span>
          <span className={styles.fieldValue}>
            {record.origin === 'MANUAL' ? 'Entrada manual' : 'Digitalizado'}
          </span>
        </div>
        {record.correctionsCount > 0 && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Correcciones</span>
            <span className={styles.fieldValue}>{record.correctionsCount}</span>
          </div>
        )}
      </div>

      {record.voidReason && (
        <>
          <hr className={styles.divider} />
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Motivo de anulación</p>
            <div className={styles.voidBox}>{record.voidReason}</div>
          </div>
        </>
      )}

      <hr className={styles.divider} />

      <div className={styles.section}>
        <p className={styles.sectionTitle}>Resumen</p>
        <div className={styles.textBlock}>{record.summary}</div>
      </div>

      {record.notes && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Notas adicionales</p>
          <div className={styles.textBlock}>{record.notes}</div>
        </div>
      )}

      <hr className={styles.divider} />

      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => router.back()}>
          Volver
        </button>

        {canCorrect && (
          <button
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
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => setShowVoidForm((v) => !v)}
            disabled={isActing}
          >
            Anular
          </button>
        )}
      </div>

      {showVoidForm && (
        <div className={styles.voidForm}>
          <textarea
            className={styles.voidTextarea}
            placeholder="Motivo de anulación (mínimo 10 caracteres)…"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={3}
          />
          <div className={`${styles.actions} ${styles.actionsCompact}`}>
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => void handleVoid()}
              disabled={isActing || voidReason.trim().length < 10}
            >
              {isActing ? 'Anulando…' : 'Confirmar anulación'}
            </button>
            <button className={styles.btn} onClick={() => setShowVoidForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {actionError && <p className={styles.actionError}>{actionError}</p>}
    </div>
  );
}
