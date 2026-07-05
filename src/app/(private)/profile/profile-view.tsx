'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

  if (!user) return null;

  async function handleLogout() {
    if (session) {
      await logoutRequest(session.accessToken, session.refreshToken);
    }
    clearSession();
    router.replace('/login');
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
      <section className={styles.headerCard}>
        <span className={styles.avatar} aria-hidden="true">{getInitials(displayName)}</span>
        <div className={styles.headerInfo}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{displayName}</h1>
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
                  {formatLastLogin(profile?.lastLoginAt ?? null)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button className={styles.logoutBtn} type="button" onClick={() => void handleLogout()}>
          <Icon name="logout" size={15} />
          Cerrar sesión
        </button>
      </section>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {/* Datos principales */}
          <section className={styles.card} aria-labelledby="main-data-title">
            <p id="main-data-title" className={styles.cardTitle}>
              <Icon name="profile" size={17} /> Datos principales
            </p>
            {isLoading && <p className={styles.emptyText}>Cargando ficha profesional…</p>}
            {error && <p className={styles.softError}>{error}</p>}
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <Icon name="patient" size={16} />
                <div>
                  <span className={styles.detailLabel}>Identificador</span>
                  <span className={styles.detailValue}>
                    {profile?.username ? `@${profile.username}` : user.email}
                  </span>
                </div>
              </div>
              <div className={styles.detailItem}>
                <Icon name="folder" size={16} />
                <div>
                  <span className={styles.detailLabel}>Profesión o cargo</span>
                  <span className={profile?.profession ? styles.detailValue : styles.detailValueMuted}>
                    {profile?.profession ?? 'No registrado'}
                  </span>
                </div>
              </div>
              <div className={styles.detailItem}>
                <Icon name="mail" size={16} />
                <div>
                  <span className={styles.detailLabel}>Correo</span>
                  <span className={styles.detailValue}>{user.email}</span>
                </div>
              </div>
              <div className={styles.detailItem}>
                <Icon name="shield" size={16} />
                <div>
                  <span className={styles.detailLabel}>Rol principal</span>
                  <span className={styles.detailValue}>{roleLabel}</span>
                </div>
              </div>
              <div className={styles.detailItem}>
                <Icon name="records" size={16} />
                <div>
                  <span className={styles.detailLabel}>Documento</span>
                  <span
                    className={
                      profile?.documentType && profile.documentNumber
                        ? styles.detailValue
                        : styles.detailValueMuted
                    }
                  >
                    {profile?.documentType && profile.documentNumber
                      ? `${profile.documentType} ${profile.documentNumber}`
                      : 'No registrado'}
                  </span>
                </div>
              </div>
              <div className={styles.detailItem}>
                <Icon name="clock" size={16} />
                <div>
                  <span className={styles.detailLabel}>Estado de sesión</span>
                  <span className={styles.sessionDot}>
                    {isAuthenticated ? 'Activa' : 'No activa'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Accesos principales */}
          <section className={styles.card} aria-labelledby="access-title">
            <p id="access-title" className={styles.cardTitle}>
              <Icon name="sparkle" size={17} /> Accesos principales
            </p>
            <div className={styles.accessGrid}>
              {accessLinks.map((item) => (
                <Link key={item.label} href={item.href} className={styles.accessCard}>
                  <span className={styles.accessIcon} aria-hidden="true">
                    <Icon name={item.icon} size={17} />
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Permisos técnicos */}
          <section className={styles.card} aria-labelledby="perms-title">
            <p id="perms-title" className={styles.cardTitle}>
              <Icon name="shield" size={17} /> Permisos técnicos
            </p>
            <div className={styles.permGroups}>
              {permissionGroups.map((group) => (
                <div key={group.title} className={styles.permGroup}>
                  <p className={styles.permGroupTitle}>
                    <Icon name={group.icon} size={15} /> {group.title}
                  </p>
                  {group.items.map((permission) => (
                    <p key={permission} className={styles.permItem}>
                      <Icon name="check" size={13} />
                      {PERMISSION_LABELS[permission] ?? permission}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar de preferencias */}
        <aside>
          <section className={styles.sideCard} aria-labelledby="prefs-title">
            <p id="prefs-title" className={styles.cardTitle}>
              <Icon name="admin" size={17} /> Preferencias
            </p>
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
