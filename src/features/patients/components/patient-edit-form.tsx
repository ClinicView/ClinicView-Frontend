'use client';

import { useState } from 'react';
import type { Patient, Sex, UpdatePatientData } from '../types/patient';
import styles from './patient-form.module.css';

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

function validate(data: UpdatePatientData): FieldErrors {
  const e: FieldErrors = {};
  if (!data.firstName?.trim()) e.firstName = 'Requerido';
  if (!data.lastName?.trim()) e.lastName = 'Requerido';
  if (!data.dateOfBirth) e.dateOfBirth = 'Requerido';
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
    dateOfBirth: patient.dateOfBirth.slice(0, 10),
    sex: patient.sex,
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    address: patient.address ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);

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
    if (Object.keys(errors).length > 0) return;

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

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h2 className={styles.title}>Editar paciente</h2>

      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Apellidos</label>
          <input
            className={`${styles.input} ${fieldErrors.lastName ? styles.inputError : ''}`}
            type="text"
            maxLength={100}
            value={form.lastName ?? ''}
            onChange={(e) => set('lastName', e.target.value)}
          />
          {fieldErrors.lastName && <span className={styles.fieldError}>{fieldErrors.lastName}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Nombres</label>
          <input
            className={`${styles.input} ${fieldErrors.firstName ? styles.inputError : ''}`}
            type="text"
            maxLength={100}
            value={form.firstName ?? ''}
            onChange={(e) => set('firstName', e.target.value)}
          />
          {fieldErrors.firstName && <span className={styles.fieldError}>{fieldErrors.firstName}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Fecha de nacimiento</label>
          <input
            className={`${styles.input} ${fieldErrors.dateOfBirth ? styles.inputError : ''}`}
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.dateOfBirth ?? ''}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
          {fieldErrors.dateOfBirth && <span className={styles.fieldError}>{fieldErrors.dateOfBirth}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Sexo</label>
          <select
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
          <label className={styles.label}>Teléfono</label>
          <input
            className={styles.input}
            type="tel"
            maxLength={20}
            value={form.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Correo electrónico</label>
          <input
            className={styles.input}
            type="email"
            maxLength={150}
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.label}>Dirección</label>
          <input
            className={styles.input}
            type="text"
            maxLength={250}
            value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isLoading}>
          Cancelar
        </button>
        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
