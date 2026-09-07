'use client';

import { useEffect, useRef, useState } from 'react';
import { ContextHelp } from '@/shared/ui/context-help';
import { formatInstant, currentDateOnly } from '@/shared/lib/date-time';
import {
  getClinicalSummary,
  getClinicalSummaryHistory,
  saveClinicalSummary,
} from '../services/clinical-summary.service';
import type {
  ClinicalSummary,
  ClinicalSummaryPayload,
  ReconciliationStatus,
  SummaryEntry,
  AllergyEntry,
  ProblemEntry,
  MedicationEntry,
} from '../types/clinical-summary';
import styles from './clinical-summary.module.css';

const STATUS_LABEL = {
  UNKNOWN: 'Por verificar',
  NONE_KNOWN: 'Ninguno conocido (declarado)',
  RECORDED: 'Elementos registrados',
};
const SEVERITY_LABEL = {
  UNKNOWN: 'No precisada',
  MILD: 'Leve',
  MODERATE: 'Moderada',
  SEVERE: 'Grave',
};

export function SummaryContent({
  payload,
}: {
  payload: ClinicalSummaryPayload;
}) {
  return (
    <div className={styles.columns}>
      <section>
        <h3>Alergias y reacciones</h3>
        <p>{STATUS_LABEL[payload.allergyStatus]}</p>
        <ul>
          {payload.allergies.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong> · {a.reaction} ·{' '}
              {SEVERITY_LABEL[a.severity]}
              {a.notes && <p>{a.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Problemas de salud</h3>
        <p>{STATUS_LABEL[payload.problemStatus]}</p>
        <ul>
          {payload.problems.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              {p.code && ` (${p.code})`} ·{' '}
              {p.status === 'ACTIVE' ? 'Activo' : 'Resuelto'}
              {p.onsetDate && ` · Inicio: ${p.onsetDate}`}
              {p.notes && <p>{p.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Medicación habitual</h3>
        <p>{STATUS_LABEL[payload.medicationStatus]}</p>
        <ul>
          {payload.medications.map((m) => (
            <li key={m.id}>
              <strong>{m.name}</strong> · {m.regimen} ·{' '}
              {m.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}
              {m.indication && <p>Indicación: {m.indication}</p>}
              {m.notes && <p>{m.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type Field<T> = {
  key: keyof T & string;
  label: string;
  required?: boolean;
  max: number;
  type?: 'date';
  options?: Record<string, string>;
};
function RowsEditor<T extends SummaryEntry>({
  title,
  items,
  status,
  fields,
  onItems,
  onStatus,
  newItem,
}: {
  title: string;
  items: T[];
  status: ReconciliationStatus;
  fields: Field<T>[];
  onItems: (items: T[]) => void;
  onStatus: (status: ReconciliationStatus) => void;
  newItem: () => T;
}) {
  return (
    <fieldset className={styles.group}>
      <legend>{title}</legend>
      <label className={styles.field}>
        Estado de revisión
        <select
          value={status}
          onChange={(e) => onStatus(e.target.value as ReconciliationStatus)}
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option
              key={value}
              value={value}
              disabled={items.length > 0 && value !== 'RECORDED'}
            >
              {label}
            </option>
          ))}
        </select>
      </label>
      {items.map((entry, index) => (
        <fieldset key={entry.id} className={styles.entry}>
          <legend>
            {title} · {index + 1}
          </legend>
          <div className={styles.formGrid}>
            {fields.map((field) => (
              <label className={styles.field} key={field.key}>
                {field.label}
                {field.required ? ' *' : ''}
                {field.options ? (
                  <select
                    value={String(entry[field.key] ?? '')}
                    onChange={(e) =>
                      onItems(
                        items.map((item) =>
                          item.id === entry.id
                            ? { ...item, [field.key]: e.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    {Object.entries(field.options).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type ?? 'text'}
                    maxLength={field.max}
                    max={field.type === 'date' ? currentDateOnly() : undefined}
                    value={String(entry[field.key] ?? '')}
                    required={field.required}
                    onChange={(e) =>
                      onItems(
                        items.map((item) =>
                          item.id === entry.id
                            ? { ...item, [field.key]: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                )}
              </label>
            ))}
          </div>
          <button
            type="button"
            className={styles.button}
            onClick={() =>
              onItems(items.filter((item) => item.id !== entry.id))
            }
          >
            Retirar elemento {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className={styles.button}
        disabled={items.length >= 100}
        onClick={() => onItems([...items, newItem()])}
      >
        Añadir: {title.toLowerCase()}
      </button>
      <p className={styles.hint}>
        Retirar un elemento no elimina las revisiones anteriores. Para problemas
        resueltos o medicamentos suspendidos, cambia su estado.
      </p>
    </fieldset>
  );
}

export function ClinicalSummaryPanel({
  patientId,
  canEdit,
}: {
  patientId: string;
  canEdit: boolean;
}) {
  const [current, setCurrent] = useState<ClinicalSummary | null>(null);
  const [form, setForm] = useState<ClinicalSummaryPayload | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState<ClinicalSummary[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCurrent(null);
    setError(null);
    setHistory([]);
    void getClinicalSummary(patientId)
      .then((data) => {
        if (!cancelled) setCurrent(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la información clínica.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, reload]);
  useEffect(() => {
    if (!form) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [form]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !current) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const clean = JSON.parse(
        JSON.stringify(form, (_key, value: unknown) =>
          value === '' ? undefined : value,
        ),
      ) as ClinicalSummaryPayload;
      const result = await saveClinicalSummary(
        patientId,
        clean,
        current.version,
        reason.trim(),
      );
      setCurrent(result);
      setForm(null);
      setReason('');
      setHistory([]);
      setSaved(true);
      window.dispatchEvent(new Event('clinicview:patient-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }
  async function loadHistory(beforeVersion?: number) {
    setHistoryLoading(true);
    setError(null);
    try {
      const result = await getClinicalSummaryHistory(patientId, beforeVersion);
      setHistory((items) =>
        beforeVersion ? [...items, ...result.data] : result.data,
      );
      setHistoryCursor(result.nextBeforeVersion);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar el historial.',
      );
    } finally {
      setHistoryLoading(false);
    }
  }
  function cancel() {
    if (
      !window.confirm(
        '¿Descartar los cambios sin guardar en la información longitudinal?',
      )
    )
      return;
    setForm(null);
    setReason('');
    setError(null);
  }
  return (
    <section
      id="clinical-summary"
      className={styles.panel}
      aria-labelledby="clinical-summary-title"
    >
      <header className={styles.header}>
        <div>
          <h2 id="clinical-summary-title">Información clínica longitudinal</h2>
          <p>Datos vigentes del paciente, revisados por el equipo de salud.</p>
        </div>
        <ContextHelp title="Información clínica longitudinal">
          <p>
            Esta información acompaña al paciente entre atenciones. No se
            completa automáticamente desde el OCR ni reemplaza una consulta o
            una receta.
          </p>
          <p>
            «Por verificar» significa que falta revisar el dato. «Ninguno
            conocido» requiere confirmación con el paciente, su representante o
            una fuente clínica. Indica esa fuente en el motivo.
          </p>
          <p>
            Registra alergias con su reacción; conserva problemas resueltos y
            medicación suspendida cambiando su estado. Cada actualización
            conserva una revisión con autor, fecha y motivo.
          </p>
        </ContextHelp>
      </header>
      {error && (
        <div ref={errorRef} role="alert" tabIndex={-1} className={styles.error}>
          <p>{error}</p>
          {!form && (
            <button
              className={styles.button}
              type="button"
              onClick={() => setReload((v) => v + 1)}
            >
              Reintentar
            </button>
          )}
          {form && (
            <p>
              Si existe un conflicto, conserva tus notas, cancela y recarga
              antes de volver a editar.
            </p>
          )}
        </div>
      )}
      {saved && (
        <p role="status">
          Información actualizada; la revisión anterior se conserva.
        </p>
      )}
      {!current && !error && <p role="status">Cargando información clínica…</p>}
      {current && !form && (
        <>
          <SummaryContent payload={current.payload} />
          <p className={styles.hint}>
            {current.createdAt
              ? `Revisión ${current.version} · ${current.recordedByName} · ${formatInstant(current.createdAt)}`
              : 'Todavía no se ha realizado una revisión clínica.'}
          </p>
          {current.reason && <p>Motivo / fuente: {current.reason}</p>}
          <div className={styles.actions}>
            {canEdit && (
              <button
                className={styles.primary}
                type="button"
                onClick={() => {
                  setForm(structuredClone(current.payload));
                  setSaved(false);
                }}
              >
                Revisar y actualizar
              </button>
            )}
            <button
              className={styles.button}
              type="button"
              disabled={historyLoading || current.version === 0}
              onClick={() => void loadHistory()}
            >
              Ver revisiones anteriores
            </button>
          </div>
        </>
      )}
      {current && form && (
        <form onSubmit={(e) => void submit(e)}>
          <fieldset disabled={saving} className={styles.editFields}>
            <RowsEditor<AllergyEntry>
              title="Alergias"
              items={form.allergies}
              status={form.allergyStatus}
              onStatus={(allergyStatus) => setForm({ ...form, allergyStatus })}
              onItems={(allergies) =>
                setForm({
                  ...form,
                  allergies,
                  allergyStatus: allergies.length ? 'RECORDED' : 'UNKNOWN',
                })
              }
              newItem={() => ({
                id: crypto.randomUUID(),
                name: '',
                reaction: '',
                severity: 'UNKNOWN',
              })}
              fields={[
                {
                  key: 'name',
                  label: 'Sustancia / alérgeno',
                  max: 200,
                  required: true,
                },
                {
                  key: 'reaction',
                  label: 'Reacción',
                  max: 500,
                  required: true,
                },
                {
                  key: 'severity',
                  label: 'Gravedad',
                  max: 20,
                  options: SEVERITY_LABEL,
                },
                { key: 'notes', label: 'Observaciones / fuente', max: 1000 },
              ]}
            />
            <RowsEditor<ProblemEntry>
              title="Problemas de salud"
              items={form.problems}
              status={form.problemStatus}
              onStatus={(problemStatus) => setForm({ ...form, problemStatus })}
              onItems={(problems) =>
                setForm({
                  ...form,
                  problems,
                  problemStatus: problems.length ? 'RECORDED' : 'UNKNOWN',
                })
              }
              newItem={() => ({
                id: crypto.randomUUID(),
                name: '',
                status: 'ACTIVE',
              })}
              fields={[
                { key: 'name', label: 'Problema', max: 200, required: true },
                {
                  key: 'code',
                  label: 'Código diagnóstico (si consta)',
                  max: 30,
                },
                {
                  key: 'onsetDate',
                  label: 'Fecha de inicio conocida',
                  max: 10,
                  type: 'date',
                },
                {
                  key: 'status',
                  label: 'Estado',
                  max: 20,
                  options: { ACTIVE: 'Activo', RESOLVED: 'Resuelto' },
                },
                { key: 'notes', label: 'Observaciones / fuente', max: 1000 },
              ]}
            />
            <RowsEditor<MedicationEntry>
              title="Medicación habitual"
              items={form.medications}
              status={form.medicationStatus}
              onStatus={(medicationStatus) =>
                setForm({ ...form, medicationStatus })
              }
              onItems={(medications) =>
                setForm({
                  ...form,
                  medications,
                  medicationStatus: medications.length ? 'RECORDED' : 'UNKNOWN',
                })
              }
              newItem={() => ({
                id: crypto.randomUUID(),
                name: '',
                regimen: '',
                status: 'ACTIVE',
              })}
              fields={[
                {
                  key: 'name',
                  label: 'Medicamento y concentración',
                  max: 200,
                  required: true,
                },
                {
                  key: 'regimen',
                  label: 'Dosis, vía y frecuencia documentadas',
                  max: 200,
                  required: true,
                },
                { key: 'indication', label: 'Indicación', max: 200 },
                {
                  key: 'status',
                  label: 'Estado',
                  max: 20,
                  options: { ACTIVE: 'Activa', STOPPED: 'Suspendida' },
                },
                { key: 'notes', label: 'Observaciones / fuente', max: 1000 },
              ]}
            />
            <label className={styles.field}>
              Motivo de la actualización y fuente consultada *
              <textarea
                minLength={5}
                maxLength={500}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </label>
            <div className={styles.actions}>
              <button className={styles.button} type="button" onClick={cancel}>
                Cancelar
              </button>
              <button className={styles.primary} type="submit">
                {saving ? 'Guardando revisión…' : 'Guardar revisión clínica'}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {history.length > 0 && (
        <section className={styles.history}>
          <h3>Historial de revisiones</h3>
          {history.map((item) => (
            <details key={item.version}>
              <summary>
                Revisión {item.version} · {item.recordedByName} ·{' '}
                {item.createdAt && formatInstant(item.createdAt)}
              </summary>
              <p>Motivo / fuente: {item.reason}</p>
              <SummaryContent payload={item.payload} />
            </details>
          ))}
          {historyCursor && (
            <button
              className={styles.button}
              type="button"
              disabled={historyLoading}
              onClick={() => void loadHistory(historyCursor)}
            >
              Cargar revisiones anteriores
            </button>
          )}
        </section>
      )}
    </section>
  );
}
