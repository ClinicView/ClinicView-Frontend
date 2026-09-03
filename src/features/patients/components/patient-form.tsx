'use client';

import { useRef, useState } from 'react';
import { currentDateOnly, isFutureDateOnly, isValidDateOnly } from '@/shared/lib/date-time';
import type { CreatePatientData, DocumentType, Sex } from '../types/patient';
import styles from './patient-form.module.css';

interface FieldErrors {
  documentType?: string;
  documentNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
}

const FIELD_LABELS: Record<keyof FieldErrors, string> = {
  documentType: 'Tipo de documento',
  documentNumber: 'Número de documento',
  firstName: 'Nombres',
  lastName: 'Apellidos',
  dateOfBirth: 'Fecha de nacimiento',
  sex: 'Sexo',
};

function validate(data: Partial<CreatePatientData>): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.documentType) errors.documentType = 'Requerido';
  if (!data.documentNumber?.trim()) errors.documentNumber = 'Requerido';
  if (!data.firstName?.trim()) errors.firstName = 'Requerido';
  if (!data.lastName?.trim()) errors.lastName = 'Requerido';
  if (!data.dateOfBirth) errors.dateOfBirth = 'Requerido';
  else if (!isValidDateOnly(data.dateOfBirth)) errors.dateOfBirth = 'Fecha inválida';
  else if (isFutureDateOnly(data.dateOfBirth)) errors.dateOfBirth = 'No puede estar en el futuro';
  if (!data.sex) errors.sex = 'Requerido';
  return errors;
}

interface PatientFormProps {
  onSubmit: (data: CreatePatientData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

export function PatientForm({ onSubmit, onCancel, isLoading, error }: PatientFormProps) {
  const [form, setForm] = useState<Partial<CreatePatientData>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof CreatePatientData>(key: K, value: CreatePatientData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (touched) {
      setFieldErrors(validate({ ...form, [key]: value }));
    }
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
    await onSubmit(form as CreatePatientData);
  }

  function handleCancel() {
    if (
      Object.values(form).some((value) => Boolean(value)) &&
      !window.confirm('Hay datos sin guardar. ¿Deseas cancelar el registro?')
    ) return;
    onCancel();
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h2 className={styles.title}>Registrar paciente</h2>

      {error && <p className={styles.formError} role="alert">{error}</p>}

      {Object.keys(fieldErrors).length > 0 && (
        <div
          ref={errorSummaryRef}
          className={styles.errorSummary}
          role="alert"
          tabIndex={-1}
          aria-labelledby="patient-create-errors-title"
        >
          <h3 id="patient-create-errors-title">Revisa los campos indicados</h3>
          <ul>
            {Object.entries(fieldErrors).map(([field, message]) => (
              <li key={field}>
                <a href={`#patient-${field}`}>
                  {FIELD_LABELS[field as keyof FieldErrors]}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.grid}>
        {/* Tipo de documento */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-documentType">Tipo de documento</label>
          <select
            id="patient-documentType"
            className={`${styles.select} ${fieldErrors.documentType ? styles.inputError : ''}`}
            value={form.documentType ?? ''}
            onChange={(e) => set('documentType', e.target.value as DocumentType)}
            aria-invalid={Boolean(fieldErrors.documentType)}
            aria-describedby={fieldErrors.documentType ? 'patient-documentType-error' : undefined}
            required
          >
            <option value="">Seleccionar…</option>
            <option value="DNI">DNI</option>
            <option value="CE">Carné de Extranjería</option>
            <option value="PAS">Pasaporte</option>
            <option value="OTHER">Otro</option>
          </select>
          {fieldErrors.documentType && <span id="patient-documentType-error" className={styles.fieldError}>{fieldErrors.documentType}</span>}
        </div>

        {/* Número de documento */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-documentNumber">Número de documento</label>
          <input
            id="patient-documentNumber"
            className={`${styles.input} ${fieldErrors.documentNumber ? styles.inputError : ''}`}
            type="text"
            maxLength={20}
            value={form.documentNumber ?? ''}
            onChange={(e) => set('documentNumber', e.target.value)}
            aria-invalid={Boolean(fieldErrors.documentNumber)}
            aria-describedby={fieldErrors.documentNumber ? 'patient-documentNumber-error' : undefined}
            required
          />
          {fieldErrors.documentNumber && <span id="patient-documentNumber-error" className={styles.fieldError}>{fieldErrors.documentNumber}</span>}
        </div>

        {/* Apellidos */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-lastName">Apellidos</label>
          <input
            id="patient-lastName"
            className={`${styles.input} ${fieldErrors.lastName ? styles.inputError : ''}`}
            type="text"
            maxLength={100}
            value={form.lastName ?? ''}
            onChange={(e) => set('lastName', e.target.value)}
            autoComplete="family-name"
            aria-invalid={Boolean(fieldErrors.lastName)}
            aria-describedby={fieldErrors.lastName ? 'patient-lastName-error' : undefined}
            required
          />
          {fieldErrors.lastName && <span id="patient-lastName-error" className={styles.fieldError}>{fieldErrors.lastName}</span>}
        </div>

        {/* Nombres */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-firstName">Nombres</label>
          <input
            id="patient-firstName"
            className={`${styles.input} ${fieldErrors.firstName ? styles.inputError : ''}`}
            type="text"
            maxLength={100}
            value={form.firstName ?? ''}
            onChange={(e) => set('firstName', e.target.value)}
            autoComplete="given-name"
            aria-invalid={Boolean(fieldErrors.firstName)}
            aria-describedby={fieldErrors.firstName ? 'patient-firstName-error' : undefined}
            required
          />
          {fieldErrors.firstName && <span id="patient-firstName-error" className={styles.fieldError}>{fieldErrors.firstName}</span>}
        </div>

        {/* Fecha de nacimiento */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-dateOfBirth">Fecha de nacimiento</label>
          <input
            id="patient-dateOfBirth"
            className={`${styles.input} ${fieldErrors.dateOfBirth ? styles.inputError : ''}`}
            type="date"
            max={currentDateOnly()}
            value={form.dateOfBirth ?? ''}
            onChange={(e) => set('dateOfBirth', e.target.value)}
            autoComplete="bday"
            aria-invalid={Boolean(fieldErrors.dateOfBirth)}
            aria-describedby={fieldErrors.dateOfBirth ? 'patient-dateOfBirth-error' : undefined}
            required
          />
          {fieldErrors.dateOfBirth && <span id="patient-dateOfBirth-error" className={styles.fieldError}>{fieldErrors.dateOfBirth}</span>}
        </div>

        {/* Sexo */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="patient-sex">Sexo</label>
          <select
            id="patient-sex"
            className={`${styles.select} ${fieldErrors.sex ? styles.inputError : ''}`}
            value={form.sex ?? ''}
            onChange={(e) => set('sex', e.target.value as Sex)}
            aria-invalid={Boolean(fieldErrors.sex)}
            aria-describedby={fieldErrors.sex ? 'patient-sex-error' : undefined}
            required
          >
            <option value="">Seleccionar…</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="OTHER">Otro</option>
          </select>
          {fieldErrors.sex && <span id="patient-sex-error" className={styles.fieldError}>{fieldErrors.sex}</span>}
        </div>

        {/* Teléfono */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="patient-phone">Teléfono</label>
          <input
            id="patient-phone"
            className={styles.input}
            type="tel"
            maxLength={20}
            value={form.phone ?? ''}
            onChange={(e) => set('phone', e.target.value || undefined)}
            autoComplete="tel"
          />
        </div>

        {/* Email */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="patient-email">Correo electrónico</label>
          <input
            id="patient-email"
            className={styles.input}
            type="email"
            maxLength={150}
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value || undefined)}
            autoComplete="email"
          />
        </div>

        {/* Dirección */}
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.label} htmlFor="patient-address">Dirección</label>
          <input
            id="patient-address"
            className={styles.input}
            type="text"
            maxLength={250}
            value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value || undefined)}
            autoComplete="street-address"
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={handleCancel} disabled={isLoading}>
          Cancelar
        </button>
        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? 'Guardando…' : 'Registrar paciente'}
        </button>
      </div>
    </form>
  );
}
