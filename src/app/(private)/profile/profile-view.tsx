'use client';

import { useRouter } from 'next/navigation';
import { PageShell } from '@/shared/components/page-shell';
import { useSession } from '@/features/auth';
import { useProfile } from '@/features/profile';
import { logoutRequest } from '@/shared/session/logout';
import styles from './profile.module.css';

const CAPABILITY_LABELS: Array<{ permissions: string[]; label: string }> = [
  { permissions: ['patients.read'], label: 'Gestion de pacientes' },
  { permissions: ['documents.read', 'documents.upload'], label: 'Digitalizacion de historias clinicas' },
  { permissions: ['documents.validate', 'review.read'], label: 'Revision y validacion digital' },
  { permissions: ['records.read', 'records.create'], label: 'Registro manual de atencion' },
  { permissions: ['admin.users.manage', 'admin.roles.manage'], label: 'Administracion del sistema' },
];

function getSessionRole(permissions: string[]): string {
  if (permissions.some((permission) => ['admin.users.manage', 'admin.roles.manage'].includes(permission))) {
    return 'Administracion';
  }
  if (permissions.some((permission) => ['documents.validate', 'review.read'].includes(permission))) {
    return 'Revisor clinico';
  }
  if (permissions.some((permission) => ['patients.read', 'records.read', 'documents.read'].includes(permission))) {
    return 'Profesional clinico';
  }
  return 'Usuario';
}

export function ProfileView() {
  const { user, session, isAuthenticated, clearSession } = useSession();
  const { profile, isLoading, error } = useProfile();
  const router = useRouter();

  if (!user) return null;

  async function handleLogout() {
    if (session) {
      await logoutRequest(session.accessToken, session.refreshToken);
    }
    clearSession();
    router.replace('/login');
  }

  const capabilities = CAPABILITY_LABELS
    .filter((item) => item.permissions.some((permission) => user.permissions.includes(permission)))
    .map((item) => item.label);
  const roleLabel = profile?.roles[0]?.name ?? getSessionRole(user.permissions);
  const title = profile?.fullName ?? user.email;
  const identifier = profile?.username ? `@${profile.username}` : user.email;
  const documentLabel = profile?.documentType && profile.documentNumber
    ? `${profile.documentType} ${profile.documentNumber}`
    : 'No registrado';

  return (
    <PageShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.kicker}>Perfil profesional</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>
            {roleLabel}{profile?.profession ? ` · ${profile.profession}` : ''}
          </p>
        </header>

        <section className={styles.card} aria-labelledby="profile-main-title">
          <div className={styles.cardHeader}>
            <h2 id="profile-main-title" className={styles.sectionTitle}>Datos principales</h2>
            <button className={styles.logoutButton} type="button" onClick={() => void handleLogout()}>
              Cerrar sesion
            </button>
          </div>
          {isLoading && <p className={styles.emptyText}>Cargando ficha profesional...</p>}
          {error && <p className={styles.softError}>{error}</p>}
          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Identificador</span>
              <span className={styles.detailValue}>{identifier}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Correo</span>
              <span className={styles.detailValue}>{user.email}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Documento</span>
              <span className={styles.detailValueMuted}>{documentLabel}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Profesión o cargo</span>
              <span className={profile?.profession ? styles.detailValue : styles.detailValueMuted}>
                {profile?.profession ?? 'No registrado'}
              </span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Rol principal</span>
              <span className={styles.detailValue}>{roleLabel}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Estado de sesion</span>
              <span className={styles.statusBadge}>{isAuthenticated ? 'Activa' : 'No activa'}</span>
            </div>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="profile-capabilities-title">
          <h2 id="profile-capabilities-title" className={styles.sectionTitle}>Capacidades</h2>
          {capabilities.length > 0 ? (
            <div className={styles.chipList}>
              {capabilities.map((capability) => (
                <span key={capability} className={styles.chip}>{capability}</span>
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>No hay capacidades visibles en la sesion actual.</p>
          )}
        </section>

        <details className={styles.card}>
          <summary className={styles.summary}>Ver permisos tecnicos</summary>
          <div className={styles.permissionList}>
            {user.permissions.map((permission) => (
              <code key={permission} className={styles.permission}>{permission}</code>
            ))}
          </div>
        </details>
      </div>
    </PageShell>
  );
}
