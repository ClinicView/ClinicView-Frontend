'use client';

import { useRef, useState } from 'react';
import {
  currentDateOnly,
  isFutureDateOnly,
  isValidDateOnly,
  toDateOnlyInputValue,
} from '@/shared/lib/date-time';
import type { Patient, Sex, UpdatePatientData } from '../types/patient';
import styles from './patient-form.module.css';

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

const FIELD_LABELS: Record<keyof FieldErrors, string> = {
  firstName: 'Nombres',
  lastName: 'Apellidos',
  dateOfBirth: 'Fecha de nacimiento',
};

function validate(data: UpdatePatientData): FieldErrors {
  const e: FieldErrors = {};
  if (!data.firstName?.trim()) e.firstName = 'Requerido';
  if (!data.lastName?.trim()) e.lastName = 'Requerido';
  if (!data.dateOfBirth) e.dateOfBirth = 'Requerido';
  else if (!isValidDateOnly(data.dateOfBirth)) e.dateOfBirth = 'Fecha inválida';
  else if (isFutureDateOnly(data.dateOfBirth)) e.dateOfBirth = 'No puede estar en el futuro';
  return e;
}

interface PatientEditFormProps {
  patient: Patient;
  onSubmit: (data: UpdatePatientData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

export function PatientEditForm({
  patient,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: PatientEditFormProps) {
  const [form, setForm] = useState<UpdatePatientData>({
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: toDateOnlyInputValue(patient.dateOfBirth),
    sex: patient.sex,
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    address: patient.address ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof UpdatePatientData>(key: K, value: UpdatePatientData[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched) setFieldErrors(validate(next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    const payload: UpdatePatientData = {
      firstName: form.firstName?.trim(),
      lastName: form.lastName?.trim(),
      dateOfBirth: form.dateOfBirth,
      sex: form.sex,
      phone: form.phone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      address: form.address?.trim() || undefined,
    };
    await onSubmit(payload);
  }

  function handleCancel() {
    const hasChanges =
      form.firstName !== patient.firstName ||
      form.lastName !== patient.lastName ||
      form.dateOfBirth !== toDateOnlyInputValue(patient.dateOfBirth) ||
      form.sex !== patient.sex ||
      (form.phone ?? '') !== (patient.phone ?? '') ||
      (form.email ?? '') !== (patient.email ?? '') ||
      (form.address ?? '') !== (patient.address ?? '');
    if (hasChanges && !window.confirm('Hay cambios sin guardar. ¿Deseas salir del formulario?')) return;
    onCancel();
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h1 className={styles.title}>Editar paciente</h1>

      {error && <p className={styles.formError} role="alert">{error}</p>}

      {Object.keys(fieldErrors).length > 0 && (
        <div
          ref={errorSummaryRef}
          className={styles.errorSummary}
          role="alert"
          tabIndex={-1}
          aria-labelledby="patient-edit-errors-title"
        >
          <h3 id="patient-edit-errors-title">Revisa los campos indicados</h3>
          <ul>
            {Object.entries(fieldErrors).map(([field, message]) => (
              <li key={field}>
                <a href={`#patient-edit-${field}`}>
                  {FIELD_LABELS[field as keyof FieldErrors]}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-edit-lastName">Apellidos</label>
          <input
            id="patient-edit-lastName"
            className={`${styles.input} ${fieldErrors.lastName ? styles.inputError : ''}`}
            type="text"
            maxLength={100}
            value={form.lastName ?? ''}
            onChange={(e) => set('lastName', e.target.value)}
            autoComplete="family-name"
            aria-invalid={Boolean(fieldErrors.lastName)}
            aria-describedby={fieldErrors.lastName ? 'patient-edit-lastName-error' : undefined}
            required
          />
          {fieldErrors.lastName && <span id="patient-edit-lastName-error" className={styles.fieldError}>{fieldErrors.lastName}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-edit-firstName">Nombres</label>
          <input
            id="patient-edit-firstName"
            className={`${styles.input} ${fieldErrors.firstName ? styles.inputError : ''}`}
            type="text"
            maxLength={100}
            value={form.firstName ?? ''}
            onChange={(e) => set('firstName', e.target.value)}
            autoComplete="given-name"
            aria-invalid={Boolean(fieldErrors.firstName)}
            aria-describedby={fieldErrors.firstName ? 'patient-edit-firstName-error' : undefined}
            required
          />
          {fieldErrors.firstName && <span id="patient-edit-firstName-error" className={styles.fieldError}>{fieldErrors.firstName}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-edit-dateOfBirth">Fecha de nacimiento</label>
          <input
            id="patient-edit-dateOfBirth"
            className={`${styles.input} ${fieldErrors.dateOfBirth ? styles.inputError : ''}`}
            type="date"
            max={currentDateOnly()}
            value={form.dateOfBirth ?? ''}
            onChange={(e) => set('dateOfBirth', e.target.value)}
            autoComplete="bday"
            aria-invalid={Boolean(fieldErrors.dateOfBirth)}
            aria-describedby={fieldErrors.dateOfBirth ? 'patient-edit-dateOfBirth-error' : undefined}
            required
          />
          {fieldErrors.dateOfBirth && <span id="patient-edit-dateOfBirth-error" className={styles.fieldError}>{fieldErrors.dateOfBirth}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="patient-edit-sex">Sexo</label>
          <select
            id="patient-edit-sex"
            className={styles.select}
            value={form.sex ?? ''}
            onChange={(e) => set('sex', e.target.value as Sex)}
          >
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="patient-edit-phone">Teléfono</label>
          <input
            id="patient-edit-phone"
            className={styles.input}
            type="tel"
            maxLength={20}
            value={form.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
            autoComplete="tel"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="patient-edit-email">Correo electrónico</label>
          <input
            id="patient-edit-email"
            className={styles.input}
            type="email"
            maxLength={150}
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.label} htmlFor="patient-edit-address">Dirección</label>
          <input
            id="patient-edit-address"
            className={styles.input}
            type="text"
            maxLength={250}
            value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
            autoComplete="street-address"
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={handleCancel} disabled={isLoading}>
          Cancelar
        </button>
        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
