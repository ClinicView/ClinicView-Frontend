'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageShell } from '@/shared/components/page-shell';
import { useSession } from '@/features/auth';
import { useProfile } from '@/features/profile';
import { can, canAny } from '@/shared/permissions/can';
import { logoutRequest } from '@/shared/session/logout';
import { Icon, type IconName } from '@/shared/ui';
import styles from './profile.module.css';

function getSessionRole(permissions: string[]): string {
  if (permissions.some((p) => ['admin.users.manage', 'admin.roles.manage'].includes(p))) {
    return 'Administrador del sistema';
  }
  if (permissions.some((p) => ['documents.validate', 'review.read'].includes(p))) {
    return 'Revisor clínico';
  }
  if (permissions.some((p) => ['patients.read', 'records.read', 'documents.read'].includes(p))) {
    return 'Profesional clínico';
  }
  return 'Usuario';
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'US';
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const today = new Date();
  const time = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Hoy, ${time}`;
  return `${date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${time}`;
}

/** Agrupación de permisos técnicos por dominio, con etiquetas legibles. */
const PERMISSION_GROUPS: Array<{
  title: string;
  icon: IconName;
  prefixes: string[];
}> = [
  { title: 'Usuarios y roles', icon: 'users', prefixes: ['users.', 'roles.', 'admin.'] },
  { title: 'Pacientes', icon: 'patient', prefixes: ['patients.'] },
  { title: 'Digitalización', icon: 'scan', prefixes: ['documents.'] },
  { title: 'Revisión digital', icon: 'review', prefixes: ['review.'] },
  { title: 'Registro clínico', icon: 'records', prefixes: ['records.'] },
  { title: 'Entidades clínicas', icon: 'sparkle', prefixes: ['entities.'] },
];

const PERMISSION_LABELS: Record<string, string> = {
  'users.read': 'Ver usuarios',
  'users.create': 'Crear usuarios',
  'users.update': 'Editar usuarios',
  'users.deactivate': 'Desactivar usuarios',
  'roles.read': 'Ver roles',
  'roles.manage': 'Gestionar roles',
  'admin.users.manage': 'Gestionar usuarios',
  'admin.roles.manage': 'Gestionar roles',
  'patients.read': 'Ver pacientes',
  'patients.create': 'Registrar pacientes',
  'patients.update': 'Editar datos básicos',
  'records.read': 'Ver registros',
  'records.create': 'Crear registros',
  'records.correct': 'Corregir registros',
  'records.void': 'Anular registros',
  'documents.upload': 'Subir documentos',
  'documents.read': 'Ver documentos',
  'documents.validate': 'Validar documentos',
  'documents.reject': 'Rechazar documentos',
  'review.read': 'Ver cola de revisión',
  'entities.read': 'Ver entidades',
  'entities.validate': 'Validar entidades',
};

export function ProfileView() {
  const { user, session, isAuthenticated, clearSession } = useSession();
  const { profile, isLoading, error } = useProfile();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const request = session ? logoutRequest() : Promise.resolve(true);
    clearSession();
    router.replace('/login');
    void request;
  }

  const permissions = user.permissions;
  const roleLabel = profile?.roles[0]?.name ?? getSessionRole(permissions);
  const displayName = profile?.fullName ?? user.email;

  const permissionGroups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    items: permissions.filter((p) => group.prefixes.some((prefix) => p.startsWith(prefix))),
  })).filter((group) => group.items.length > 0);

  const allAccessLinks: Array<{ label: string; icon: IconName; href: string; show: boolean }> = [
    { label: 'Gestión de pacientes', icon: 'users', href: '/patients', show: can(permissions, 'patients.read') },
    { label: 'Digitalización de historias', icon: 'scan', href: '/patients', show: can(permissions, 'documents.read') },
    { label: 'Revisión y validación', icon: 'review', href: '/review', show: can(permissions, 'review.read') },
    { label: 'Registro manual de atención', icon: 'records', href: '/patients', show: can(permissions, 'records.create') },
    { label: 'Administración del sistema', icon: 'admin', href: '/admin', show: canAny(permissions, ['admin.users.manage', 'admin.roles.manage']) },
  ];
  const accessLinks = allAccessLinks.filter((item) => item.show);

  return (
    <PageShell>
      {/* Header */}
      <section className={styles.headerCard} aria-labelledby="profile-title">
        <span className={styles.avatar} aria-hidden="true">{getInitials(displayName)}</span>
        <div className={styles.headerInfo}>
          <div className={styles.nameRow}>
            <h1 id="profile-title" className={styles.name}>{displayName}</h1>
            <span className={styles.roleBadge}>
              <Icon name="check" size={13} /> {roleLabel}
            </span>
          </div>
          <div className={styles.headerMeta}>
            <div className={styles.headerMetaItem}>
              <Icon name="mail" size={16} />
              <div>
                <span className={styles.headerMetaLabel}>Correo</span>
                <span className={styles.headerMetaValue}>{user.email}</span>
              </div>
            </div>
            <div className={styles.headerMetaItem}>
              <Icon name="admin" size={16} />
              <div>
                <span className={styles.headerMetaLabel}>Rol principal</span>
                <span className={styles.headerMetaValue}>{roleLabel}</span>
              </div>
            </div>
            <div className={styles.headerMetaItem}>
              <Icon name="clock" size={16} />
              <div>
                <span className={styles.headerMetaLabel}>Último acceso</span>
                <span className={styles.headerMetaValue}>
                  {profile?.lastLoginAt ? (
                    <time dateTime={profile.lastLoginAt}>{formatLastLogin(profile.lastLoginAt)}</time>
                  ) : (
                    formatLastLogin(null)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          className={styles.logoutBtn}
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
        >
          <Icon name="logout" size={15} />
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </section>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {/* Datos principales */}
          <section className={styles.card} aria-labelledby="main-data-title">
            <h2 id="main-data-title" className={styles.cardTitle}>
              <Icon name="profile" size={17} /> Datos principales
            </h2>
            {isLoading && <p className={styles.emptyText} role="status">Cargando ficha profesional…</p>}
            {error && <p className={styles.softError} role="alert">{error}</p>}
            <dl className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <dt className={styles.detailLabel}>
                  <Icon name="patient" size={16} />
                  <span>Identificador</span>
                </dt>
                <dd className={styles.detailValue}>
                  {profile?.username ? `@${profile.username}` : user.email}
                </dd>
              </div>
              <div className={styles.detailItem}>
                <dt className={styles.detailLabel}>
                  <Icon name="folder" size={16} />
                  <span>Profesión o cargo</span>
                </dt>
                <dd className={profile?.profession ? styles.detailValue : styles.detailValueMuted}>
                  {profile?.profession ?? 'No registrado'}
                </dd>
              </div>
              <div className={styles.detailItem}>
                <dt className={styles.detailLabel}>
                  <Icon name="mail" size={16} />
                  <span>Correo</span>
                </dt>
                <dd className={styles.detailValue}>{user.email}</dd>
              </div>
              <div className={styles.detailItem}>
                <dt className={styles.detailLabel}>
                  <Icon name="shield" size={16} />
                  <span>Rol principal</span>
                </dt>
                <dd className={styles.detailValue}>{roleLabel}</dd>
              </div>
              <div className={styles.detailItem}>
                <dt className={styles.detailLabel}>
                  <Icon name="records" size={16} />
                  <span>Documento</span>
                </dt>
                <dd
                  className={
                    profile?.documentType && profile.documentNumber
                      ? styles.detailValue
                      : styles.detailValueMuted
                  }
                >
                  {profile?.documentType && profile.documentNumber
                    ? `${profile.documentType} ${profile.documentNumber}`
                    : 'No registrado'}
                </dd>
              </div>
              <div className={styles.detailItem}>
                <dt className={styles.detailLabel}>
                  <Icon name="clock" size={16} />
                  <span>Estado de sesión</span>
                </dt>
                <dd className={styles.sessionDot}>
                  {isAuthenticated ? 'Activa' : 'No activa'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Accesos principales */}
          <section className={styles.card} aria-labelledby="access-title">
            <h2 id="access-title" className={styles.cardTitle}>
              <Icon name="sparkle" size={17} /> Accesos principales
            </h2>
            <nav className={styles.accessGrid} aria-label="Accesos principales del perfil">
              {accessLinks.map((item) => (
                <Link key={item.label} href={item.href} className={styles.accessCard}>
                  <span className={styles.accessIcon} aria-hidden="true">
                    <Icon name={item.icon} size={17} />
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </section>

          {/* Permisos técnicos */}
          <section className={styles.card} aria-labelledby="perms-title">
            <h2 id="perms-title" className={styles.cardTitle}>
              <Icon name="shield" size={17} /> Permisos técnicos
            </h2>
            <div className={styles.permGroups}>
              {permissionGroups.map((group, index) => (
                <section
                  key={group.title}
                  className={styles.permGroup}
                  aria-labelledby={`permission-group-${index}`}
                >
                  <h3 id={`permission-group-${index}`} className={styles.permGroupTitle}>
                    <Icon name={group.icon} size={15} /> {group.title}
                  </h3>
                  <ul className={styles.permList}>
                    {group.items.map((permission) => (
                      <li key={permission} className={styles.permItem}>
                        <Icon name="check" size={13} />
                        {PERMISSION_LABELS[permission] ?? permission}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar de preferencias */}
        <aside aria-label="Preferencias de la cuenta">
          <section className={styles.sideCard} aria-labelledby="prefs-title">
            <h2 id="prefs-title" className={styles.cardTitle}>
              <Icon name="admin" size={17} /> Preferencias
            </h2>
            <div className={styles.prefRow}>
              <span className={styles.prefIcon} aria-hidden="true">
                <Icon name="bell" size={17} />
              </span>
              <span className={styles.prefBody}>
                <span className={styles.prefTitle}>Notificaciones</span>
                <span className={styles.prefHint}>
                  Activadas — recibirás avisos cuando tus digitalizaciones terminen de procesarse.
                </span>
              </span>
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
