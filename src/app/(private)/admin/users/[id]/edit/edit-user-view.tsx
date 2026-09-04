'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminUser, UpdateAdminUserData } from '@/features/admin';
import {
  getUser,
  resetUserPassword,
  updateUser,
} from '@/features/admin/services/admin.service';
import { useSession } from '@/features/auth';
import { PageShell } from '@/shared/components/page-shell';
import { can } from '@/shared/permissions/can';
import { ApiError } from '@/shared/services/api-client';
import { Icon, Spinner } from '@/shared/ui';
import { useUnsavedChangesGuard } from '@/features/admin/hooks/use-unsaved-changes-guard';
import styles from './user-edit.module.css';

interface Props { userId: string }

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  documentType: '' | 'DNI' | 'CE' | 'PAS' | 'OTHER';
  documentNumber: string;
  profession: string;
}

function toForm(user: AdminUser): FormState {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
    documentType: user.documentType ?? '',
    documentNumber: user.documentNumber ?? '',
    profession: user.profession ?? '',
  };
}

export function EditUserView({ userId }: Props) {
  const router = useRouter();
  const { user: sessionUser } = useSession();
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const credentialErrorRef = useRef<HTMLParagraphElement>(null);

  const canEdit = Boolean(sessionUser && can(sessionUser.permissions, 'users.update'));
  const canReset = Boolean(
    sessionUser
    && sessionUser.sub !== userId
    && can(sessionUser.permissions, 'admin.users.manage'),
  );
  const isDirty = useMemo(
    () => Boolean(target && form && JSON.stringify(form) !== JSON.stringify(toForm(target))),
    [form, target],
  );
  const credentialsDirty = Boolean(newPassword || confirmation);
  useUnsavedChangesGuard(
    isDirty || credentialsDirty,
    'Hay cambios sin guardar. ¿Deseas salir y descartarlos?',
  );

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getUser(userId)
      .then((loaded) => {
        if (!active) return;
        setTarget(loaded);
        setForm(toForm(loaded));
        setError(null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el usuario.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setNotice(null);
  }

  function reportCredentialError(message: string) {
    setCredentialError(message);
    requestAnimationFrame(() => credentialErrorRef.current?.focus());
  }

  function goBack() {
    if ((isDirty || credentialsDirty) && !window.confirm('Hay cambios sin guardar. ¿Deseas salir?')) return;
    router.push('/admin/users');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !canEdit) return;
    setError(null);
    setNotice(null);
    setIsSaving(true);
    const payload: UpdateAdminUserData = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      username: form.username.trim(),
      documentType: form.documentType || null,
      documentNumber: form.documentNumber.trim(),
      profession: form.profession.trim(),
    };
    try {
      const updated = await updateUser(userId, payload);
      setTarget(updated);
      setForm(toForm(updated));
      setNotice('Datos del usuario actualizados.');
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo actualizar el usuario.');
    } finally {
      setIsSaving(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCredentialError(null);
    setNotice(null);
    if (newPassword.length < 12 || !/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      reportCredentialError('La nueva contraseña debe tener al menos 12 caracteres, una letra y un número.');
      return;
    }
    if (newPassword !== confirmation) {
      reportCredentialError('La confirmación de contraseña no coincide.');
      return;
    }
    setIsResetting(true);
    try {
      await resetUserPassword(userId, newPassword);
      setNewPassword('');
      setConfirmation('');
      setShowPasswords(false);
      setNotice('Contraseña restablecida. Todas las sesiones anteriores fueron revocadas.');
    } catch (reason) {
      reportCredentialError(
        reason instanceof ApiError
          ? reason.message
          : 'No se pudo restablecer la contraseña.',
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <PageShell>
      <div className={styles.header}>
        <button className={styles.backButton} type="button" onClick={goBack}>
          <Icon name="chevron-right" size={17} />
          Volver a usuarios
        </button>
        <div>
          <h1 ref={headingRef} className={styles.title} tabIndex={-1}>Editar usuario</h1>
          <p className={styles.subtitle}>Actualiza su identidad profesional y administra sus credenciales.</p>
        </div>
      </div>

      {isLoading && <Spinner label="Cargando usuario…" />}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {!isLoading && target && form && (
        <div className={styles.layout}>
          <form className={styles.card} data-unsaved-guard-submit="allow" onSubmit={(event) => void save(event)}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}><Icon name="profile" size={20} /></span>
              <div>
                <h2>Datos de la cuenta</h2>
                <p>@{target.username} · {target.roles[0]?.name ?? 'Sin rol'}</p>
              </div>
            </div>
            <fieldset className={styles.fieldset} disabled={!canEdit || isSaving}>
              <legend className={styles.visuallyHidden}>Datos editables del usuario</legend>
              <div className={styles.grid}>
                <label className={styles.field}>Nombres
                  <input required minLength={2} maxLength={80} autoComplete="given-name" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
                </label>
                <label className={styles.field}>Apellidos
                  <input required minLength={2} maxLength={100} autoComplete="family-name" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
                </label>
                <label className={styles.field}>Email institucional
                  <input required type="email" maxLength={150} autoComplete="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                  <small>Cambiar el email revoca las sesiones activas.</small>
                </label>
                <label className={styles.field}>Usuario
                  <input required minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]+" autoComplete="username" value={form.username} onChange={(e) => setField('username', e.target.value)} />
                </label>
                <label className={styles.field}>Tipo de documento
                  <select value={form.documentType} onChange={(e) => setField('documentType', e.target.value as FormState['documentType'])}>
                    <option value="">Sin especificar</option>
                    <option value="DNI">DNI</option>
                    <option value="CE">Carné de extranjería</option>
                    <option value="PAS">Pasaporte</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </label>
                <label className={styles.field}>Número de documento
                  <input maxLength={20} value={form.documentNumber} onChange={(e) => setField('documentNumber', e.target.value)} />
                </label>
                <label className={`${styles.field} ${styles.fullWidth}`}>Profesión o cargo
                  <input maxLength={120} autoComplete="organization-title" value={form.profession} onChange={(e) => setField('profession', e.target.value)} />
                </label>
              </div>
            </fieldset>
            <div className={styles.actions}>
              <button className={styles.secondaryButton} type="button" onClick={goBack}>Cancelar</button>
              {canEdit && <button className={styles.primaryButton} type="submit" disabled={!isDirty || isSaving}>{isSaving ? 'Guardando…' : 'Guardar cambios'}</button>}
            </div>
          </form>

          <aside className={styles.sideColumn}>
            <section className={styles.card} aria-labelledby="credential-title">
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}><Icon name="lock" size={20} /></span>
                <div>
                  <h2 id="credential-title">Credenciales</h2>
                <p>Acciones sensibles con revocación de sesiones.</p>
                </div>
              </div>
              {canReset ? (
                <form data-unsaved-guard-submit="allow" onSubmit={(event) => void resetPassword(event)}>
                  {credentialError && <p ref={credentialErrorRef} className={styles.inlineError} role="alert" tabIndex={-1}>{credentialError}</p>}
                  <button
                    className={styles.revealButton}
                    type="button"
                    aria-pressed={showPasswords}
                    onClick={() => setShowPasswords((visible) => !visible)}
                  >
                    {showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                  </button>
                  <div className={styles.passwordFields}>
                    <label className={styles.field}>Nueva contraseña administrativa
                      <input type={showPasswords ? 'text' : 'password'} minLength={12} maxLength={100} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                      <small>Mínimo 12 caracteres, una letra y un número.</small>
                    </label>
                    <label className={styles.field}>Confirmar contraseña
                      <input type={showPasswords ? 'text' : 'password'} minLength={12} maxLength={100} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
                    </label>
                  </div>
                  <button className={styles.warningButton} type="submit" disabled={isResetting || !newPassword || !confirmation}>
                    {isResetting ? 'Restableciendo…' : 'Restablecer y cerrar sesiones'}
                  </button>
                </form>
              ) : (
                <p className={styles.helpText}>
                  {sessionUser?.sub === userId
                    ? 'Por seguridad, cambia tu propia contraseña desde Mi perfil.'
                    : 'No tienes permiso para restablecer credenciales.'}
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
