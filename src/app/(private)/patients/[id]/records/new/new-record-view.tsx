'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { createRecord } from '@/features/clinical-records';
import { useRecords } from '@/features/clinical-records/hooks/use-records';
import type { RecordPriority, RecordType } from '@/features/clinical-records';
import { usePatient } from '@/features/patients';
import { PageShell } from '@/shared/components/page-shell';
import {
  ageFromDateOnly,
  currentDateTimeLocal,
  dateTimeLocalToIso,
  formatDateOnly,
  formatInstant,
  isFutureDateTimeLocal,
} from '@/shared/lib/date-time';
import { Icon, Spinner, type IconName } from '@/shared/ui';
import { ApiError } from '@/shared/services/api-client';
import { searchProfessionals, type Professional } from '@/shared/services/professionals.service';
import styles from './manual-record.module.css';

/* ─── Constantes ─────────────────────────────────────────────── */

const RECORD_TYPES: Array<{ value: RecordType; label: string }> = [
  { value: 'CONSULTATION', label: 'Consulta externa' },
  { value: 'EVOLUTION', label: 'Hoja de evolución' },
  { value: 'LAB_RESULT', label: 'Resultado de laboratorio' },
  { value: 'PRESCRIPTION', label: 'Receta / prescripción' },
  { value: 'PROCEDURE', label: 'Procedimiento' },
  { value: 'THERAPY_NOTE', label: 'Nota de terapia' },
  { value: 'OTHER', label: 'Otro documento clínico' },
];

const SERVICES = [
  'Medicina General',
  'Medicina Interna',
  'Cardiología',
  'Pediatría',
  'Ginecología y Obstetricia',
  'Traumatología',
  'Neurología',
  'Dermatología',
  'Psiquiatría',
  'Otro',
];

const PRIORITIES: Array<{ value: RecordPriority; label: string; icon: IconName }> = [
  { value: 'URGENT', label: 'Urgente', icon: 'alert' },
  { value: 'PRIORITY', label: 'Prioritario', icon: 'clock' },
  { value: 'NORMAL', label: 'Normal', icon: 'check' },
  { value: 'ELECTIVE', label: 'Electivo', icon: 'calendar' },
];

const RECORD_TYPE_ICON: Record<string, { icon: IconName; tone: string }> = {
  CONSULTATION: { icon: 'patient', tone: 'blue' },
  EVOLUTION: { icon: 'chart', tone: 'amber' },
  LAB_RESULT: { icon: 'records', tone: 'teal' },
  PRESCRIPTION: { icon: 'document', tone: 'amber' },
  PROCEDURE: { icon: 'scan', tone: 'blue' },
  THERAPY_NOTE: { icon: 'edit', tone: 'teal' },
  OTHER: { icon: 'folder', tone: 'blue' },
};

const SUMMARY_MAX = 2000;
const NOTES_MAX = 4000;

interface DraftState {
  recordType: string;
  attendedAt: string;
  doctorName: string;
  service: string;
  summary: string;
  notes: string;
  preliminaryDiagnosis: string;
  plan: string;
  priority: RecordPriority;
}

function emptyDraft(): DraftState {
  return {
    recordType: '',
    attendedAt: currentDateTimeLocal(),
    doctorName: '',
    service: '',
    summary: '',
    notes: '',
    preliminaryDiagnosis: '',
    plan: '',
    priority: 'NORMAL',
  };
}

function formatShortDate(iso: string): string {
  return formatInstant(iso, { day: '2-digit', month: 'short', year: 'numeric' });
}

type FieldErrors = Partial<Record<'recordType' | 'attendedAt' | 'doctorName' | 'summary' | 'notes', string>>;

const FIELD_LABELS: Record<keyof FieldErrors, string> = {
  recordType: 'Tipo de registro',
  attendedAt: 'Fecha y hora de atención',
  doctorName: 'Médico o profesional',
  summary: 'Resumen clínico',
  notes: 'Notas adicionales',
};

function validateDraft(form: DraftState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.recordType) errors.recordType = 'Selecciona un tipo de registro.';
  if (!form.attendedAt) errors.attendedAt = 'Ingresa la fecha y hora de atención.';
  else if (!dateTimeLocalToIso(form.attendedAt)) errors.attendedAt = 'Ingresa una fecha y hora válida.';
  else if (isFutureDateTimeLocal(form.attendedAt)) {
    errors.attendedAt = 'La fecha y hora de atención no puede estar en el futuro.';
  }
  if (!form.doctorName.trim()) errors.doctorName = 'Ingresa el médico o profesional responsable.';
  if (!form.summary.trim()) errors.summary = 'Ingresa el resumen clínico.';
  else if (form.summary.length > SUMMARY_MAX) {
    errors.summary = `Reduce el resumen a ${SUMMARY_MAX} caracteres o menos.`;
  }
  if (form.notes.length > NOTES_MAX) {
    errors.notes = `Reduce las notas a ${NOTES_MAX} caracteres o menos.`;
  }
  return errors;
}

/* ─── Vista ──────────────────────────────────────────────────── */

interface NewRecordViewProps {
  patientId: string;
}

export function NewRecordView({ patientId }: NewRecordViewProps) {
  const { user } = useSession();
  const router = useRouter();
  const { patient } = usePatient(patientId);
  const { data: recentRecords, isLoading: loadingRecords } = useRecords(patientId);

  const draftKey = `clinicview:record-draft:${patientId}`;
  const [form, setForm] = useState<DraftState>(emptyDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const dirtyRef = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Combobox de médicos registrados en el sistema.
  const [doctorOptions, setDoctorOptions] = useState<Professional[]>([]);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [activeDoctorIndex, setActiveDoctorIndex] = useState(-1);
  const doctorSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doctorWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (doctorWrapRef.current && !doctorWrapRef.current.contains(event.target as Node)) {
        setDoctorOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function searchDoctors(query: string) {
    if (doctorSearchRef.current) clearTimeout(doctorSearchRef.current);
    doctorSearchRef.current = setTimeout(async () => {
      try {
        const results = await searchProfessionals(query);
        setDoctorOptions(results);
        setActiveDoctorIndex(-1);
        setDoctorOpen(true);
      } catch {
        setDoctorOptions([]);
      }
    }, 300);
  }

  // Restaurar borrador guardado (una sola vez al montar).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<DraftState>;
        setForm((prev) => ({ ...prev, ...saved }));
        dirtyRef.current = true;
        setDraftNotice('Borrador restaurado');
      }
    } catch {
      // Borrador corrupto — se ignora.
    }
  }, [draftKey]);

  // Autosave con debounce mientras el usuario escribe.
  function update(patch: Partial<DraftState>) {
    dirtyRef.current = true;
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
      autosaveRef.current = setTimeout(() => {
        try {
          window.localStorage.setItem(draftKey, JSON.stringify(next));
        } catch {
          // Storage lleno o bloqueado — el autosave es best-effort.
        }
      }, 600);
      return next;
    });
    if (submitted) setFieldErrors(validateDraft({ ...form, ...patch }));
  }

  function saveDraftNow() {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(form));
      setDraftNotice('Borrador guardado');
      setTimeout(() => setDraftNotice(null), 2500);
    } catch {
      setDraftNotice(null);
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // sin consecuencias
    }
  }

  function selectDoctor(professional: Professional) {
    update({ doctorName: professional.fullName });
    setDoctorOpen(false);
    setActiveDoctorIndex(-1);
  }

  function cancelRegistration() {
    if (
      dirtyRef.current &&
      !window.confirm('Se eliminará el borrador de esta atención. ¿Deseas cancelar el registro?')
    ) {
      return;
    }
    clearDraft();
    router.push(`/patients/${patientId}/records`);
  }

  function handleDoctorKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && doctorOpen) {
      event.preventDefault();
      setDoctorOpen(false);
      setActiveDoctorIndex(-1);
      return;
    }
    if (!doctorOpen || doctorOptions.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveDoctorIndex((current) => {
        const start = current < 0 ? (direction > 0 ? -1 : 0) : current;
        return (start + direction + doctorOptions.length) % doctorOptions.length;
      });
    } else if (event.key === 'Enter' && activeDoctorIndex >= 0) {
      event.preventDefault();
      const selected = doctorOptions[activeDoctorIndex];
      if (selected) selectDoctor(selected);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const validationErrors = validateDraft(form);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    const attendedAt = dateTimeLocalToIso(form.attendedAt);
    if (!attendedAt) return;
    setIsLoading(true);
    setError(null);
    try {
      const record = await createRecord(patientId, {
        recordType: form.recordType as RecordType,
        attendedAt,
        summary: form.summary.trim(),
        notes: form.notes.trim() || undefined,
        doctorName: form.doctorName.trim() || undefined,
        service: form.service || undefined,
        preliminaryDiagnosis: form.preliminaryDiagnosis.trim() || undefined,
        plan: form.plan.trim() || undefined,
        priority: form.priority,
      });
      clearDraft();
      router.replace(`/patients/${patientId}/records/${record.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrar la atención.');
      setIsLoading(false);
    }
  }

  const patientAge = useMemo(() => ageFromDateOnly(patient?.dateOfBirth), [patient]);

  if (!user) return null;

  return (
    <PageShell>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link href="/patients">Pacientes</Link>
        <span aria-hidden="true">›</span>
        {patient ? (
          <Link href={`/patients/${patientId}`}>
            {patient.lastName}, {patient.firstName}
          </Link>
        ) : (
          <span>…</span>
        )}
        <span aria-hidden="true">›</span>
        <span>Nuevo registro manual</span>
      </nav>

      {/* Header del paciente */}
      {patient && (
        <section className={styles.patientCard}>
          <div className={styles.patientTop}>
            <span className={styles.avatar} aria-hidden="true">
              {(patient.firstName[0] ?? '') + (patient.lastName[0] ?? '')}
            </span>
            <div>
              <h1 className={styles.patientName}>
                {patient.lastName}, {patient.firstName}
              </h1>
              <div className={styles.badgeRow}>
                <span className={styles.docBadge}>
                  {patient.documentType} <strong>{patient.documentNumber}</strong>
                </span>
                {patient.isActive && (
                  <span className={styles.activeBadge}>
                    <Icon name="check" size={12} /> Paciente activo
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.demoGrid}>
            <div className={styles.demoItem}>
              <Icon name="calendar" size={16} />
              <div>
                <span className={styles.demoLabel}>Fecha de nacimiento</span>
                <span className={styles.demoValue}>
                  {formatDateOnly(patient.dateOfBirth, {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                  {patientAge != null && ` (${patientAge} años)`}
                </span>
              </div>
            </div>
            <div className={styles.demoItem}>
              <Icon name="patient" size={16} />
              <div>
                <span className={styles.demoLabel}>Sexo</span>
                <span className={styles.demoValue}>
                  {patient.sex === 'M' ? 'Masculino' : patient.sex === 'F' ? 'Femenino' : 'Otro'}
                </span>
              </div>
            </div>
            <div className={styles.demoItem}>
              <Icon name="phone" size={16} />
              <div>
                <span className={styles.demoLabel}>Teléfono</span>
                <span className={styles.demoValue}>{patient.phone ?? '—'}</span>
              </div>
            </div>
            <div className={styles.demoItem}>
              <Icon name="mail" size={16} />
              <div>
                <span className={styles.demoLabel}>Correo electrónico</span>
                <span className={styles.demoValue}>{patient.email ?? '—'}</span>
              </div>
            </div>
            <div className={styles.demoItem}>
              <Icon name="location" size={16} />
              <div>
                <span className={styles.demoLabel}>Dirección</span>
                <span className={styles.demoValue}>{patient.address ?? '—'}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className={styles.layout}>
        {/* ─── Formulario ─── */}
        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHeader}>
            <span className={styles.formHeaderIcon} aria-hidden="true">
              <Icon name="calendar" size={22} />
            </span>
            <div>
              <h2 className={styles.formTitle}>Nuevo registro manual de atención</h2>
              <p className={styles.formSubtitle}>
                Registra una atención clínica estructurada asociada al paciente.
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className={styles.error}>
              <Icon name="alert" size={16} /> {error}
            </p>
          )}

          {Object.keys(fieldErrors).length > 0 && (
            <div
              ref={errorSummaryRef}
              className={styles.errorSummary}
              role="alert"
              tabIndex={-1}
              aria-labelledby="record-create-errors-title"
            >
              <h3 id="record-create-errors-title">Revisa los campos indicados</h3>
              <ul>
                {Object.entries(fieldErrors).map(([field, message]) => (
                  <li key={field}>
                    <a href={`#${field}`}>
                      {FIELD_LABELS[field as keyof FieldErrors]}: {message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="recordType">
                Tipo de registro <span className={styles.required}>*</span>
              </label>
              <select
                id="recordType"
                className={styles.select}
                value={form.recordType}
                onChange={(e) => update({ recordType: e.target.value })}
                disabled={isLoading}
                required
                aria-invalid={Boolean(fieldErrors.recordType)}
                aria-describedby={fieldErrors.recordType ? 'recordType-error' : undefined}
              >
                <option value="">Seleccionar tipo de registro</option>
                {RECORD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              {fieldErrors.recordType && (
                <p id="recordType-error" className={styles.fieldError}>{fieldErrors.recordType}</p>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="attendedAt">
                Fecha y hora de atención <span className={styles.required}>*</span>
              </label>
              <input
                id="attendedAt"
                type="datetime-local"
                className={styles.input}
                value={form.attendedAt}
                max={currentDateTimeLocal()}
                onChange={(e) => update({ attendedAt: e.target.value })}
                disabled={isLoading}
                required
                aria-invalid={Boolean(fieldErrors.attendedAt)}
                aria-describedby={fieldErrors.attendedAt ? 'attendedAt-error' : undefined}
              />
              {fieldErrors.attendedAt && (
                <p id="attendedAt-error" className={styles.fieldError}>{fieldErrors.attendedAt}</p>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="doctorName">
                Médico / profesional <span className={styles.required}>*</span>
              </label>
              <div className={styles.combobox} ref={doctorWrapRef}>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <Icon name="search" size={16} />
                  </span>
                  <input
                    id="doctorName"
                    className={styles.input}
                    placeholder="Buscar médico o profesional…"
                    value={form.doctorName}
                    onChange={(e) => {
                      update({ doctorName: e.target.value });
                      searchDoctors(e.target.value);
                    }}
                    onFocus={() => searchDoctors(form.doctorName)}
                    onKeyDown={handleDoctorKeyDown}
                    maxLength={120}
                    disabled={isLoading}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={doctorOpen}
                    aria-controls="doctor-options"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      activeDoctorIndex >= 0 ? `doctor-option-${doctorOptions[activeDoctorIndex]?.id}` : undefined
                    }
                    required
                    aria-invalid={Boolean(fieldErrors.doctorName)}
                    aria-describedby={fieldErrors.doctorName ? 'doctorName-error' : undefined}
                  />
                </div>
                {doctorOpen && doctorOptions.length > 0 && (
                  <ul id="doctor-options" className={styles.comboList} role="listbox">
                    {doctorOptions.map((professional, index) => (
                      <li key={professional.id}>
                        <button
                          id={`doctor-option-${professional.id}`}
                          type="button"
                          role="option"
                          aria-selected={
                            form.doctorName === professional.fullName || activeDoctorIndex === index
                          }
                          className={styles.comboOption}
                          onMouseEnter={() => setActiveDoctorIndex(index)}
                          onClick={() => selectDoctor(professional)}
                        >
                          <span className={styles.comboName}>{professional.fullName}</span>
                          {professional.profession && (
                            <span className={styles.comboMeta}>{professional.profession}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {doctorOpen && doctorOptions.length === 0 && form.doctorName.trim().length > 1 && (
                  <div className={styles.comboList}>
                    <p className={styles.comboEmpty}>
                      Sin coincidencias en el sistema — se guardará como texto libre.
                    </p>
                  </div>
                )}
              </div>
              {fieldErrors.doctorName && (
                <p id="doctorName-error" className={styles.fieldError}>{fieldErrors.doctorName}</p>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="service">Servicio / especialidad</label>
              <select
                id="service"
                className={styles.select}
                value={form.service}
                onChange={(e) => update({ service: e.target.value })}
                disabled={isLoading}
              >
                <option value="">Seleccionar servicio o especialidad</option>
                {SERVICES.map((service) => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${styles.field} ${styles.fieldBlock}`}>
            <label className={styles.label} htmlFor="summary">
              Resumen clínico <span className={styles.required}>*</span>
            </label>
            <textarea
              id="summary"
              className={styles.textarea}
              rows={4}
              placeholder="Describe el motivo de consulta, hallazgos relevantes, evolución y observaciones clínicas…"
              value={form.summary}
              onChange={(e) => update({ summary: e.target.value })}
              maxLength={SUMMARY_MAX}
              disabled={isLoading}
              required
              aria-invalid={Boolean(fieldErrors.summary)}
              aria-describedby={[
                'summary-counter',
                fieldErrors.summary ? 'summary-error' : '',
              ].filter(Boolean).join(' ')}
            />
            {fieldErrors.summary && (
              <p id="summary-error" className={styles.fieldError}>{fieldErrors.summary}</p>
            )}
            <span id="summary-counter" className={`${styles.counter} ${form.summary.length >= SUMMARY_MAX ? styles.counterOver : ''}`}>
              {form.summary.length} / {SUMMARY_MAX} caracteres
            </span>
          </div>

          <div className={`${styles.field} ${styles.fieldBlock}`}>
            <label className={styles.label} htmlFor="notes">Notas adicionales</label>
            <textarea
              id="notes"
              className={styles.textarea}
              rows={3}
              placeholder="Información complementaria, antecedentes relevantes, comentarios, etc."
              value={form.notes}
              onChange={(e) => update({ notes: e.target.value })}
              maxLength={NOTES_MAX}
              disabled={isLoading}
              aria-invalid={Boolean(fieldErrors.notes)}
              aria-describedby={[
                'notes-counter',
                fieldErrors.notes ? 'notes-error' : '',
              ].filter(Boolean).join(' ')}
            />
            {fieldErrors.notes && (
              <p id="notes-error" className={styles.fieldError}>{fieldErrors.notes}</p>
            )}
            <span id="notes-counter" className={`${styles.counter} ${form.notes.length >= NOTES_MAX ? styles.counterOver : ''}`}>
              {form.notes.length} / {NOTES_MAX} caracteres
            </span>
          </div>

          <div className={styles.row3}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="diagnosis">Diagnóstico preliminar</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <Icon name="search" size={16} />
                </span>
                <input
                  id="diagnosis"
                  className={styles.input}
                  placeholder="Buscar o escribir diagnóstico…"
                  value={form.preliminaryDiagnosis}
                  onChange={(e) => update({ preliminaryDiagnosis: e.target.value })}
                  maxLength={300}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="plan">Indicaciones / plan</label>
              <input
                id="plan"
                className={styles.input}
                placeholder="Escribe indicaciones o plan de tratamiento…"
                value={form.plan}
                onChange={(e) => update({ plan: e.target.value })}
                maxLength={2000}
                disabled={isLoading}
              />
            </div>
            <fieldset className={`${styles.field} ${styles.priorityFieldset}`}>
              <legend className={styles.label}>Estado / prioridad</legend>
              <div className={styles.chips} role="radiogroup" aria-label="Prioridad de la atención">
                {PRIORITIES.map((priority, index) => (
                  <button
                    key={priority.value}
                    type="button"
                    role="radio"
                    aria-checked={form.priority === priority.value}
                    tabIndex={form.priority === priority.value ? 0 : -1}
                    className={`${styles.chip} ${styles[`chip_${priority.value}`]} ${form.priority === priority.value ? styles.chipActive : ''}`}
                    onClick={() => update({ priority: priority.value })}
                    onKeyDown={(event) => {
                      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                      event.preventDefault();
                      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                      const nextIndex = (index + direction + PRIORITIES.length) % PRIORITIES.length;
                      const nextPriority = PRIORITIES[nextIndex];
                      if (!nextPriority) return;
                      update({ priority: nextPriority.value });
                      const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                      buttons?.[nextIndex]?.focus();
                    }}
                    disabled={isLoading}
                  >
                    <Icon name={priority.icon} size={14} />
                    {priority.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.autosaveNote}>
            <span className={styles.autosaveDot} aria-hidden="true">
              <Icon name="download" size={14} />
            </span>
            <span>
              <strong>Borrador automático</strong>
              Los cambios se guardan automáticamente en este navegador mientras completas el formulario.
            </span>
          </div>

          <div className={styles.actions}>
            {draftNotice && (
              <span className={styles.draftSaved} role="status">
                <Icon name="check" size={13} /> {draftNotice}
              </span>
            )}
            <button
              className={styles.btn}
              type="button"
              onClick={cancelRegistration}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              className={`${styles.btn} ${styles.btnOutline}`}
              type="button"
              onClick={saveDraftNow}
              disabled={isLoading}
            >
              Guardar borrador
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              type="submit"
              disabled={isLoading}
            >
              <Icon name="records" size={16} />
              {isLoading ? 'Registrando…' : 'Registrar atención'}
            </button>
          </div>
        </form>

        {/* ─── Sidebar ─── */}
        <aside className={styles.sidebar}>
          <section className={styles.sideCard} aria-labelledby="tips-title">
            <h2 id="tips-title" className={styles.sideTitle}>
              <Icon name="sparkle" size={16} />
              Sugerencias para completar
            </h2>
            <div className={styles.tipList} style={{ marginTop: '0.875rem' }}>
              <p className={styles.tip}>
                <Icon name="check" size={15} />
                Selecciona el tipo de registro adecuado para clasificar correctamente la atención.
              </p>
              <p className={styles.tip}>
                <Icon name="check" size={15} />
                Incluye un resumen clínico claro y conciso para facilitar el seguimiento.
              </p>
              <p className={styles.tip}>
                <Icon name="check" size={15} />
                Agrega indicaciones o plan para dejar registrado el manejo del paciente.
              </p>
            </div>
          </section>

          <section className={styles.sideCard} aria-labelledby="recent-title">
            <div className={styles.sideHeader}>
              <h2 id="recent-title" className={styles.sideTitle}>Registros recientes del paciente</h2>
              <Link href={`/patients/${patientId}/records`} className={styles.sideLink}>
                Ver todos <Icon name="chevron-right" size={12} />
              </Link>
            </div>

            {loadingRecords ? (
              <Spinner label="Cargando registros…" />
            ) : recentRecords.length === 0 ? (
              <p className={styles.emptyHint}>Este paciente aún no tiene registros manuales.</p>
            ) : (
              <div className={styles.recentList}>
                {recentRecords.slice(0, 3).map((record) => {
                  const meta = RECORD_TYPE_ICON[record.recordType] ?? RECORD_TYPE_ICON.OTHER;
                  const typeLabel =
                    RECORD_TYPES.find((t) => t.value === record.recordType)?.label ?? record.recordType;
                  return (
                    <Link
                      key={record.id}
                      href={`/patients/${patientId}/records/${record.id}`}
                      className={styles.recentItem}
                    >
                      <span className={`${styles.recentIcon} ${styles[`rIcon_${meta.tone}`]}`} aria-hidden="true">
                        <Icon name={meta.icon} size={15} />
                      </span>
                      <span className={styles.recentBody}>
                        <span className={styles.recentTitle}>{typeLabel}</span>
                        <span className={styles.recentMeta}>
                          {formatShortDate(record.attendedAt)}
                          {record.doctorName ? ` · ${record.doctorName}` : ''}
                        </span>
                      </span>
                      <span
                        className={`${styles.recentBadge} ${
                          record.status === 'ACTIVE'
                            ? styles.rBadge_green
                            : record.status === 'CORRECTED'
                              ? styles.rBadge_teal
                              : styles.rBadge_red
                        }`}
                      >
                        {record.status === 'ACTIVE' ? 'Completado' : record.status === 'CORRECTED' ? 'Corregido' : 'Anulado'}
                      </span>
                    </Link>
                  );
                })}
                <Link href={`/patients/${patientId}`} className={styles.fullHistoryLink}>
                  Ver historial clínico completo <Icon name="arrow-right" size={13} />
                </Link>
              </div>
            )}
          </section>

          <section className={styles.sideCard} aria-labelledby="info-title">
            <h2 id="info-title" className={styles.sideTitle}>
              <Icon name="shield" size={16} />
              Información útil
            </h2>
            <p className={styles.infoText} style={{ marginTop: '0.625rem' }}>
              La información registrada aquí formará parte de la historia clínica del
              paciente y podrá ser consultada por el equipo de salud autorizado.
            </p>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
