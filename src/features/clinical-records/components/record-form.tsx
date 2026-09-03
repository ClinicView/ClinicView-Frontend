'use client';

import { useRef, useState } from 'react';
import {
  currentDateTimeLocal,
  dateTimeLocalToIso,
  isFutureDateTimeLocal,
  isoToDateTimeLocal,
} from '@/shared/lib/date-time';
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
  else if (!dateTimeLocalToIso(d.attendedAt)) e.attendedAt = 'Fecha y hora inválida';
  else if (isFutureDateTimeLocal(d.attendedAt)) e.attendedAt = 'No puede estar en el futuro';
  if (!d.summary?.trim()) e.summary = 'Requerido';
  return e;
}

function validateCorrect(
  d: Partial<CorrectRecordData>,
  unchangedAttendedAt?: string,
): FieldErrors {
  const e: FieldErrors = {};
  if (d.attendedAt && !dateTimeLocalToIso(d.attendedAt)) e.attendedAt = 'Fecha y hora inválida';
  else if (
    d.attendedAt &&
    d.attendedAt !== unchangedAttendedAt &&
    isFutureDateTimeLocal(d.attendedAt)
  ) {
    e.attendedAt = 'No puede estar en el futuro';
  }
  if (!d.summary?.trim()) e.summary = 'Requerido';
  return e;
}

const FIELD_LABELS: Record<keyof FieldErrors, string> = {
  recordType: 'Tipo de registro',
  attendedAt: 'Fecha y hora de atención',
  summary: 'Resumen',
};

export function RecordForm(props: RecordFormProps) {
  const isCreate = props.mode === 'create';

  const initialAttendedAt =
    !isCreate && props.mode === 'correct'
      ? isoToDateTimeLocal(props.original.attendedAt)
      : currentDateTimeLocal();

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
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  function revalidate(patch: Partial<{ recordType: string; attendedAt: string; summary: string }>) {
    if (!touched) return;
    const current = { recordType, attendedAt, summary, ...patch };
    setFieldErrors(
      isCreate
        ? validateCreate(current as CreateRecordData)
        : validateCorrect(current, initialAttendedAt),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);

    if (isCreate) {
      const data: Partial<CreateRecordData> = { recordType: recordType as RecordType, attendedAt, summary };
      const errors = validateCreate(data);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }
      await props.onSubmit({
        recordType: recordType as RecordType,
        attendedAt: dateTimeLocalToIso(attendedAt)!,
        summary,
        notes: notes || undefined,
      });
    } else {
      const data: Partial<CorrectRecordData> = { attendedAt, summary };
      const errors = validateCorrect(data, initialAttendedAt);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }
      await props.onSubmit({
        expectedVersion: props.original.version,
        attendedAt:
          attendedAt && attendedAt !== initialAttendedAt
            ? (dateTimeLocalToIso(attendedAt, {
                preserveSubMinuteFrom: props.original.attendedAt,
              }) ?? undefined)
            : undefined,
        summary,
        notes: notes || undefined,
      });
    }
  }

  const title = isCreate ? 'Nuevo registro manual de atención' : 'Corregir registro manual de atención';
  const submitLabel = isCreate ? 'Registrar atención' : 'Guardar corrección';

  function handleCancel() {
    const hasChanges = isCreate
      ? Boolean(recordType || summary || notes)
      : attendedAt !== initialAttendedAt || summary !== initialSummary || notes !== initialNotes;
    if (hasChanges && !window.confirm('Hay cambios sin guardar. ¿Deseas salir del formulario?')) return;
    props.onCancel();
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h1 className={styles.title}>{title}</h1>

      {props.error && <p className={styles.formError} role="alert">{props.error}</p>}

      {Object.keys(fieldErrors).length > 0 && (
        <div
          ref={errorSummaryRef}
          className={styles.errorSummary}
          role="alert"
          tabIndex={-1}
          aria-labelledby="record-form-errors-title"
        >
          <h2 id="record-form-errors-title">Revisa los campos indicados</h2>
          <ul>
            {Object.entries(fieldErrors).map(([field, message]) => (
              <li key={field}>
                <a href={`#record-${field}`}>
                  {FIELD_LABELS[field as keyof FieldErrors]}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isCreate && (
        <div className={styles.infoBox}>
          <span className={styles.infoLabel}>Corrección de registro. </span>
          El original quedará en estado CORREGIDO y se creará una nueva historia activa con los datos que ingreses.
        </div>
      )}

      <div className={styles.grid}>
        {isCreate && (
          <div className={styles.field}>
            <label className={`${styles.label} ${styles.required}`} htmlFor="record-recordType">Tipo de registro</label>
            <select
              id="record-recordType"
              className={`${styles.select} ${fieldErrors.recordType ? styles.inputError : ''}`}
              value={recordType}
              onChange={(e) => {
                setRecordType(e.target.value as RecordType);
                revalidate({ recordType: e.target.value });
              }}
              required
              aria-invalid={Boolean(fieldErrors.recordType)}
              aria-describedby={fieldErrors.recordType ? 'record-recordType-error' : undefined}
            >
              <option value="">Seleccionar…</option>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {fieldErrors.recordType && <span id="record-recordType-error" className={styles.fieldError}>{fieldErrors.recordType}</span>}
          </div>
        )}

        <div className={styles.field}>
          <label className={`${styles.label} ${isCreate ? styles.required : ''}`} htmlFor="record-attendedAt">Fecha y hora de atención</label>
          <input
            id="record-attendedAt"
            className={`${styles.input} ${fieldErrors.attendedAt ? styles.inputError : ''}`}
            type="datetime-local"
            value={attendedAt}
            max={currentDateTimeLocal()}
            onChange={(e) => {
              setAttendedAt(e.target.value);
              revalidate({ attendedAt: e.target.value });
            }}
            required={isCreate}
            aria-invalid={Boolean(fieldErrors.attendedAt)}
            aria-describedby={[
              fieldErrors.attendedAt ? 'record-attendedAt-error' : '',
              !isCreate ? 'record-attendedAt-hint' : '',
            ].filter(Boolean).join(' ') || undefined}
          />
          {fieldErrors.attendedAt && <span id="record-attendedAt-error" className={styles.fieldError}>{fieldErrors.attendedAt}</span>}
          {!isCreate && (
            <span id="record-attendedAt-hint" className={styles.hint}>Dejar en blanco para mantener la fecha original.</span>
          )}
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="record-summary">Resumen (máx. 2000 car.)</label>
          <textarea
            id="record-summary"
            className={`${styles.textarea} ${fieldErrors.summary ? styles.inputError : ''}`}
            maxLength={2000}
            rows={4}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              revalidate({ summary: e.target.value });
            }}
            required
            aria-invalid={Boolean(fieldErrors.summary)}
            aria-describedby={fieldErrors.summary ? 'record-summary-error' : undefined}
          />
          {fieldErrors.summary && <span id="record-summary-error" className={styles.fieldError}>{fieldErrors.summary}</span>}
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.label} htmlFor="record-notes">Notas adicionales (máx. 4000 car.)</label>
          <textarea
            id="record-notes"
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
          onClick={handleCancel}
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
