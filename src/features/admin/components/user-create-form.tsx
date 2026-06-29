'use client';

import { useState } from 'react';
import type { AdminRole, CreateAdminUserData } from '../types/admin';
import styles from '../../patients/components/patient-form.module.css';

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  password?: string;
}

function normalizeUsername(firstName?: string, lastName?: string): string {
  const firstInitial = firstName?.trim().charAt(0) ?? '';
  const firstLastName = lastName?.trim().split(/\s+/)[0] ?? '';
  return `${firstInitial}${firstLastName}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
}

function validate(d: Partial<CreateAdminUserData>): FieldErrors {
  const e: FieldErrors = {};
  if (!d.firstName?.trim()) e.firstName = 'Requerido';
  if (!d.lastName?.trim()) e.lastName = 'Requerido';
  if (!d.email?.trim()) e.email = 'Requerido';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = 'Email inválido';
  if (!d.username?.trim()) e.username = 'Requerido';
  else if (!/^[a-zA-Z0-9._-]{3,50}$/.test(d.username)) e.username = '3 a 50 caracteres: letras, números, punto, guion o guion bajo';
  if (!d.password) e.password = 'Requerido';
  else if (d.password.length < 8) e.password = 'Mínimo 8 caracteres';
  return e;
}

interface UserCreateFormProps {
  onSubmit: (data: CreateAdminUserData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  roles: AdminRole[];
}

export function UserCreateForm({ onSubmit, onCancel, isLoading, error, roles }: UserCreateFormProps) {
  const [form, setForm] = useState<Partial<CreateAdminUserData>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);

  function set<K extends keyof CreateAdminUserData>(key: K, value: string) {
    const next = { ...form, [key]: value };
    if ((key === 'firstName' || key === 'lastName') && !usernameTouched) {
      next.username = normalizeUsername(
        key === 'firstName' ? value : next.firstName,
        key === 'lastName' ? value : next.lastName,
      );
    }
    setForm(next);
    if (touched) setFieldErrors(validate(next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const payload: CreateAdminUserData = {
      firstName: form.firstName?.trim() ?? '',
      lastName: form.lastName?.trim() ?? '',
      email: form.email?.trim() ?? '',
      username: form.username?.trim() ?? '',
      password: form.password ?? '',
      ...(form.documentType ? { documentType: form.documentType } : {}),
      ...(form.documentNumber?.trim() ? { documentNumber: form.documentNumber.trim() } : {}),
      ...(form.profession?.trim() ? { profession: form.profession.trim() } : {}),
      ...(form.roleKey ? { roleKey: form.roleKey } : {}),
    };
    await onSubmit(payload);
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h2 className={styles.title}>Nuevo usuario del sistema</h2>

      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Nombres</label>
          <input
            className={`${styles.input} ${fieldErrors.firstName ? styles.inputError : ''}`}
            type="text"
            maxLength={80}
            value={form.firstName ?? ''}
            onChange={(e) => set('firstName', e.target.value)}
            autoComplete="given-name"
          />
          {fieldErrors.firstName && <span className={styles.fieldError}>{fieldErrors.firstName}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Apellidos</label>
          <input
            className={`${styles.input} ${fieldErrors.lastName ? styles.inputError : ''}`}
            type="text"
            maxLength={100}
            value={form.lastName ?? ''}
            onChange={(e) => set('lastName', e.target.value)}
            autoComplete="family-name"
          />
          {fieldErrors.lastName && <span className={styles.fieldError}>{fieldErrors.lastName}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Email institucional</label>
          <input
            className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
            type="email"
            maxLength={150}
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
          />
          {fieldErrors.email && <span className={styles.fieldError}>{fieldErrors.email}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`}>Usuario</label>
          <input
            className={`${styles.input} ${fieldErrors.username ? styles.inputError : ''}`}
            type="text"
            maxLength={50}
            value={form.username ?? ''}
            onChange={(e) => {
              setUsernameTouched(true);
              set('username', e.target.value);
            }}
            autoComplete="username"
          />
          {fieldErrors.username && <span className={styles.fieldError}>{fieldErrors.username}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Tipo de documento</label>
          <select
            className={styles.input}
            value={form.documentType ?? ''}
            onChange={(e) => set('documentType', e.target.value)}
          >
            <option value="">Sin especificar</option>
            <option value="DNI">DNI</option>
            <option value="CE">Carné de extranjería</option>
            <option value="PAS">Pasaporte</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Número de documento</label>
          <input
            className={styles.input}
            type="text"
            maxLength={20}
            value={form.documentNumber ?? ''}
            onChange={(e) => set('documentNumber', e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Profesión o cargo</label>
          <input
            className={styles.input}
            type="text"
            maxLength={120}
            placeholder="Médico, enfermera, administrador..."
            value={form.profession ?? ''}
            onChange={(e) => set('profession', e.target.value)}
            autoComplete="organization-title"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Rol inicial</label>
          <select
            className={styles.input}
            value={form.roleKey ?? ''}
            onChange={(e) => set('roleKey', e.target.value)}
          >
            <option value="">Sin rol inicial</option>
            {roles.map((role) => (
              <option key={role.key} value={role.key}>{role.name}</option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={`${styles.label} ${styles.required}`}>Contraseña temporal (mín. 8 car.)</label>
          <input
            className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
            type="password"
            maxLength={100}
            value={form.password ?? ''}
            onChange={(e) => set('password', e.target.value)}
            autoComplete="new-password"
          />
          {fieldErrors.password && <span className={styles.fieldError}>{fieldErrors.password}</span>}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isLoading}>
          Cancelar
        </button>
        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}
