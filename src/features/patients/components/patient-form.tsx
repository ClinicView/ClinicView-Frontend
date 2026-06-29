'use client';

import { useState } from 'react';
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

function validate(data: Partial<CreatePatientData>): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.documentType) errors.documentType = 'Requerido';
  if (!data.documentNumber?.trim()) errors.documentNumber = 'Requerido';
  if (!data.firstName?.trim()) errors.firstName = 'Requerido';
  if (!data.lastName?.trim()) errors.lastName = 'Requerido';
  if (!data.dateOfBirth) errors.dateOfBirth = 'Requerido';
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
    if (Object.keys(errors).length > 0) return;
    await onSubmit(form as CreatePatientData);
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h2 className={styles.title}>Registrar paciente</h2>

      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.grid}>
        {/* Tipo de documento */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Tipo de documento</label>
          <select
            className={`${styles.select} ${fieldErrors.documentType ? styles.inputError : ''}`}
            value={form.documentType ?? ''}
            onChange={(e) => set('documentType', e.target.value as DocumentType)}
          >
            <option value="">Seleccionar…</option>
            <option value="DNI">DNI</option>
            <option value="CE">Carné de Extranjería</option>
            <option value="PAS">Pasaporte</option>
            <option value="OTHER">Otro</option>
          </select>
          {fieldErrors.documentType && <span className={styles.fieldError}>{fieldErrors.documentType}</span>}
        </div>

        {/* Número de documento */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Número de documento</label>
          <input
            className={`${styles.input} ${fieldErrors.documentNumber ? styles.inputError : ''}`}
            type="text"
            maxLength={20}
            value={form.documentNumber ?? ''}
            onChange={(e) => set('documentNumber', e.target.value)}
          />
          {fieldErrors.documentNumber && <span className={styles.fieldError}>{fieldErrors.documentNumber}</span>}
        </div>

        {/* Apellidos */}
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

        {/* Nombres */}
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

        {/* Fecha de nacimiento */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Fecha de nacimiento</label>
          <input
            className={`${styles.input} ${fieldErrors.dateOfBirth ? styles.inputError : ''}`}
            type="date"
            max={new Date().toISOString().split('T')[0]}
            value={form.dateOfBirth ?? ''}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
          {fieldErrors.dateOfBirth && <span className={styles.fieldError}>{fieldErrors.dateOfBirth}</span>}
        </div>

        {/* Sexo */}
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Sexo</label>
          <select
            className={`${styles.select} ${fieldErrors.sex ? styles.inputError : ''}`}
            value={form.sex ?? ''}
            onChange={(e) => set('sex', e.target.value as Sex)}
          >
            <option value="">Seleccionar…</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="OTHER">Otro</option>
          </select>
          {fieldErrors.sex && <span className={styles.fieldError}>{fieldErrors.sex}</span>}
        </div>

        {/* Teléfono */}
        <div className={styles.field}>
          <label className={styles.label}>Teléfono</label>
          <input
            className={styles.input}
            type="tel"
            maxLength={20}
            value={form.phone ?? ''}
            onChange={(e) => set('phone', e.target.value || undefined)}
          />
        </div>

        {/* Email */}
        <div className={styles.field}>
          <label className={styles.label}>Correo electrónico</label>
          <input
            className={styles.input}
            type="email"
            maxLength={150}
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value || undefined)}
          />
        </div>

        {/* Dirección */}
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.label}>Dirección</label>
          <input
            className={styles.input}
            type="text"
            maxLength={250}
            value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value || undefined)}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isLoading}>
          Cancelar
        </button>
        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? 'Guardando…' : 'Registrar paciente'}
        </button>
      </div>
    </form>
  );
}
