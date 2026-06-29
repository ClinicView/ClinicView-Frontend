'use client';

import { useState } from 'react';
import type { ClinicalRecord, CorrectRecordData, CreateRecordData, RecordType } from '../types/record';
import styles from './record-form.module.css';

const TYPE_OPTIONS: { value: RecordType; label: string }[] = [
  { value: 'CONSULTATION', label: 'Consulta' },
  { value: 'LAB_RESULT', label: 'Resultado de laboratorio' },
  { value: 'PRESCRIPTION', label: 'Receta / prescripción' },
  { value: 'THERAPY_NOTE', label: 'Nota de terapia' },
  { value: 'EVOLUTION', label: 'Evolución' },
  { value: 'PROCEDURE', label: 'Procedimiento' },
  { value: 'OTHER', label: 'Otro' },
];

// ─── Create mode ─────────────────────────────────────────────────────────────

interface CreateModeProps {
  mode: 'create';
  onSubmit: (data: CreateRecordData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

// ─── Correct mode ─────────────────────────────────────────────────────────────

interface CorrectModeProps {
  mode: 'correct';
  original: ClinicalRecord;
  onSubmit: (data: CorrectRecordData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

type RecordFormProps = CreateModeProps | CorrectModeProps;

interface FieldErrors {
  recordType?: string;
  attendedAt?: string;
  summary?: string;
}

function validateCreate(d: Partial<CreateRecordData>): FieldErrors {
  const e: FieldErrors = {};
  if (!d.recordType) e.recordType = 'Requerido';
  if (!d.attendedAt) e.attendedAt = 'Requerido';
  if (!d.summary?.trim()) e.summary = 'Requerido';
  return e;
}

function validateCorrect(d: Partial<CorrectRecordData>): FieldErrors {
  const e: FieldErrors = {};
  if (!d.summary?.trim()) e.summary = 'Requerido';
  return e;
}

function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function RecordForm(props: RecordFormProps) {
  const isCreate = props.mode === 'create';

  const initialAttendedAt =
    !isCreate && props.mode === 'correct'
      ? props.original.attendedAt.slice(0, 16)
      : todayLocal();

  const initialSummary =
    !isCreate && props.mode === 'correct' ? props.original.summary : '';

  const initialNotes =
    !isCreate && props.mode === 'correct' ? (props.original.notes ?? '') : '';

  const [recordType, setRecordType] = useState<RecordType | ''>(
    isCreate ? '' : (props as CorrectModeProps).original.recordType,
  );
  const [attendedAt, setAttendedAt] = useState(initialAttendedAt);
  const [summary, setSummary] = useState(initialSummary);
  const [notes, setNotes] = useState(initialNotes);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);

  function revalidate(patch: Partial<{ recordType: string; attendedAt: string; summary: string }>) {
    if (!touched) return;
    const current = { recordType, attendedAt, summary, ...patch };
    setFieldErrors(isCreate ? validateCreate(current as CreateRecordData) : validateCorrect(current));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);

    if (isCreate) {
      const data: Partial<CreateRecordData> = { recordType: recordType as RecordType, attendedAt, summary };
      const errors = validateCreate(data);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
      await props.onSubmit({ recordType: recordType as RecordType, attendedAt, summary, notes: notes || undefined });
    } else {
      const data: Partial<CorrectRecordData> = { summary };
      const errors = validateCorrect(data);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
      await props.onSubmit({ attendedAt, summary, notes: notes || undefined });
    }
  }

  const title = isCreate ? 'Nuevo registro manual de atención' : 'Corregir registro manual de atención';
  const submitLabel = isCreate ? 'Registrar atención' : 'Guardar corrección';

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h2 className={styles.title}>{title}</h2>

      {props.error && <p className={styles.formError}>{props.error}</p>}

      {!isCreate && (
        <div className={styles.infoBox}>
          <span className={styles.infoLabel}>Corrección de registro. </span>
          El original quedará en estado CORREGIDO y se creará una nueva historia activa con los datos que ingreses.
        </div>
      )}

      <div className={styles.grid}>
        {isCreate && (
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.required}`}>Tipo de registro</label>
            <select
              className={`${styles.select} ${fieldErrors.recordType ? styles.inputError : ''}`}
              value={recordType}
              onChange={(e) => {
                setRecordType(e.target.value as RecordType);
                revalidate({ recordType: e.target.value });
              }}
            >
              <option value="">Seleccionar…</option>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {fieldErrors.recordType && <span className={styles.fieldError}>{fieldErrors.recordType}</span>}
          </div>
        )}

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Fecha y hora de atención</label>
          <input
            className={`${styles.input} ${fieldErrors.attendedAt ? styles.inputError : ''}`}
            type="datetime-local"
            value={attendedAt}
            max={todayLocal()}
            onChange={(e) => {
              setAttendedAt(e.target.value);
              revalidate({ attendedAt: e.target.value });
            }}
          />
          {fieldErrors.attendedAt && <span className={styles.fieldError}>{fieldErrors.attendedAt}</span>}
          {!isCreate && (
            <span className={styles.hint}>Dejar en blanco para mantener la fecha original.</span>
          )}
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={`${styles.label} ${styles.required}`}>Resumen (máx. 2000 car.)</label>
          <textarea
            className={`${styles.textarea} ${fieldErrors.summary ? styles.inputError : ''}`}
            maxLength={2000}
            rows={4}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              revalidate({ summary: e.target.value });
            }}
          />
          {fieldErrors.summary && <span className={styles.fieldError}>{fieldErrors.summary}</span>}
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.label}>Notas adicionales (máx. 4000 car.)</label>
          <textarea
            className={styles.textarea}
            maxLength={4000}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={props.onCancel}
          disabled={props.isLoading}
        >
          Cancelar
        </button>
        <button type="submit" className={styles.submitBtn} disabled={props.isLoading}>
          {props.isLoading ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
