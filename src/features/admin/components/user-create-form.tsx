'use client';

import { useRef, useState } from 'react';
import type { AdminRole, CreateAdminUserData } from '../types/admin';
import styles from '../../patients/components/patient-form.module.css';

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  password?: string;
}

const FIELD_LABELS: Record<keyof FieldErrors, string> = {
  firstName: 'Nombres',
  lastName: 'Apellidos',
  email: 'Email institucional',
  username: 'Usuario',
  password: 'Contraseña temporal',
};

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
  const errorSummaryRef = useRef<HTMLDivElement>(null);

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
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
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

  function handleCancel() {
    if (
      Object.values(form).some((value) => Boolean(value)) &&
      !window.confirm('Hay datos sin guardar. ¿Deseas cancelar la creación del usuario?')
    ) return;
    onCancel();
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      <h1 className={styles.title}>Nuevo usuario del sistema</h1>

      {error && <p className={styles.formError} role="alert">{error}</p>}

      {Object.keys(fieldErrors).length > 0 && (
        <div
          ref={errorSummaryRef}
          className={styles.errorSummary}
          role="alert"
          tabIndex={-1}
          aria-labelledby="user-create-errors-title"
        >
          <h2 id="user-create-errors-title">Revisa los campos indicados</h2>
          <ul>
            {Object.entries(fieldErrors).map(([field, message]) => (
              <li key={field}>
                <a href={`#user-${field}`}>
                  {FIELD_LABELS[field as keyof FieldErrors]}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="user-firstName">Nombres</label>
          <input
            id="user-firstName"
            className={`${styles.input} ${fieldErrors.firstName ? styles.inputError : ''}`}
            type="text"
            maxLength={80}
            value={form.firstName ?? ''}
            onChange={(e) => set('firstName', e.target.value)}
            autoComplete="given-name"
            required
            aria-invalid={Boolean(fieldErrors.firstName)}
            aria-describedby={fieldErrors.firstName ? 'user-firstName-error' : undefined}
          />
          {fieldErrors.firstName && <span id="user-firstName-error" className={styles.fieldError}>{fieldErrors.firstName}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="user-lastName">Apellidos</label>
          <input
            id="user-lastName"
            className={`${styles.input} ${fieldErrors.lastName ? styles.inputError : ''}`}
            type="text"
            maxLength={100}
            value={form.lastName ?? ''}
            onChange={(e) => set('lastName', e.target.value)}
            autoComplete="family-name"
            required
            aria-invalid={Boolean(fieldErrors.lastName)}
            aria-describedby={fieldErrors.lastName ? 'user-lastName-error' : undefined}
          />
          {fieldErrors.lastName && <span id="user-lastName-error" className={styles.fieldError}>{fieldErrors.lastName}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="user-email">Email institucional</label>
          <input
            id="user-email"
            className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
            type="email"
            maxLength={150}
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'user-email-error' : undefined}
          />
          {fieldErrors.email && <span id="user-email-error" className={styles.fieldError}>{fieldErrors.email}</span>}
        </div>

        <div className={styles.field}>
          <label className={`${styles.label} ${styles.required}`} htmlFor="user-username">Usuario</label>
          <input
            id="user-username"
            className={`${styles.input} ${fieldErrors.username ? styles.inputError : ''}`}
            type="text"
            maxLength={50}
            value={form.username ?? ''}
            onChange={(e) => {
              setUsernameTouched(true);
              set('username', e.target.value);
            }}
            autoComplete="username"
            required
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? 'user-username-error' : undefined}
          />
          {fieldErrors.username && <span id="user-username-error" className={styles.fieldError}>{fieldErrors.username}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="user-documentType">Tipo de documento</label>
          <select
            id="user-documentType"
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
          <label className={styles.label} htmlFor="user-documentNumber">Número de documento</label>
          <input
            id="user-documentNumber"
            className={styles.input}
            type="text"
            maxLength={20}
            value={form.documentNumber ?? ''}
            onChange={(e) => set('documentNumber', e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="user-profession">Profesión o cargo</label>
          <input
            id="user-profession"
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
          <label className={styles.label} htmlFor="user-roleKey">Rol inicial</label>
          <select
            id="user-roleKey"
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
          <label className={`${styles.label} ${styles.required}`} htmlFor="user-password">Contraseña temporal (mín. 8 car.)</label>
          <input
            id="user-password"
            className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
            type="password"
            maxLength={100}
            value={form.password ?? ''}
            onChange={(e) => set('password', e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'user-password-error' : undefined}
          />
          {fieldErrors.password && <span id="user-password-error" className={styles.fieldError}>{fieldErrors.password}</span>}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={handleCancel} disabled={isLoading}>
          Cancelar
        </button>
        <button type="submit" className={styles.submitBtn} disabled={isLoading}>
          {isLoading ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}
