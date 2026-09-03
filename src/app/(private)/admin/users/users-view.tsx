'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { useAdminUsers } from '@/features/admin/hooks/use-admin-users';
import type { AdminUser } from '@/features/admin';
import { PageShell } from '@/shared/components/page-shell';
import { Icon, type IconName } from '@/shared/ui';
import styles from './admin-users.module.css';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'US';
}

interface StatCardProps {
  icon: IconName;
  tone: 'blue' | 'green' | 'purple' | 'slate';
  label: string;
  value: number;
  hint: string;
  hintPositive?: boolean;
}

function StatCard({ icon, tone, label, value, hint, hintPositive }: StatCardProps) {
  return (
    <article className={styles.statCard}>
      <span className={`${styles.statIcon} ${styles[`stat_${tone}`]}`} aria-hidden="true">
        <Icon name={icon} size={21} />
      </span>
      <div className={styles.statBody}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
        <span className={`${styles.statHint} ${hintPositive ? styles.statHintPositive : ''}`}>
          {hint}
        </span>
      </div>
    </article>
  );
}

export function UsersView() {
  const { user } = useSession();
  const router = useRouter();
  const { users, roles, isLoading, error, actionError, deactivate, assignRole } = useAdminUsers();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) =>
      u.roles.some((role) => role.key.toLowerCase().includes('admin')),
    ).length;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newThisMonth = users.filter((u) => new Date(u.createdAt) >= startOfMonth).length;
    return { total, active, admins, inactive: total - active, newThisMonth };
  }, [users]);

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      const name = u.roles[0]?.name ?? 'Sin rol';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [users]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      if (query) {
        const haystack = `${u.fullName} ${u.email} ${u.username} ${u.documentNumber ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (roleFilter && u.roles[0]?.key !== roleFilter) return false;
      if (stateFilter === 'active' && !u.isActive) return false;
      if (stateFilter === 'inactive' && u.isActive) return false;
      return true;
    });
  }, [users, search, roleFilter, stateFilter]);

  if (!user) return null;

  async function handleDeactivate(id: string) {
    setActingId(id);
    await deactivate(id);
    setActingId(null);
    setPendingDeactivate(null);
  }

  function requestDeactivate(id: string) {
    setPendingDeactivate(id);
    requestAnimationFrame(() => {
      document.getElementById(`confirm-deactivate-${id}`)?.focus();
    });
  }

  function cancelDeactivate(id: string) {
    setPendingDeactivate(null);
    requestAnimationFrame(() => {
      document.getElementById(`deactivate-${id}`)?.focus();
    });
  }

  async function handleRoleChange(userId: string, roleKey: string) {
    if (!roleKey) return;
    setActingId(userId);
    await assignRole(userId, roleKey);
    setActingId(null);
  }

  function renderRow(u: AdminUser) {
    const isSelf = u.email === user?.email;
    return (
      <tr key={u.id}>
        <td data-label="Usuario">
          <div className={styles.userCell}>
            <span className={styles.avatar} aria-hidden="true">{getInitials(u.fullName)}</span>
            <div className={styles.userIdentity}>
              <p className={styles.userName}>{u.fullName}</p>
              <p className={styles.userEmail}>{u.email}</p>
            </div>
          </div>
        </td>
        <td className={styles.cellMuted} data-label="Profesión">{u.profession ?? '—'}</td>
        <td className={styles.cellMuted} data-label="Documento">
          {u.documentType && u.documentNumber ? `${u.documentType} ${u.documentNumber}` : '—'}
        </td>
        <td data-label="Rol">
          {u.isActive ? (
            <select
              className={styles.roleSelect}
              value={u.roles[0]?.key ?? ''}
              onChange={(e) => void handleRoleChange(u.id, e.target.value)}
              disabled={actingId === u.id}
              aria-label={`Rol de ${u.fullName}`}
            >
              <option value="">Sin rol</option>
              {roles.map((role) => (
                <option key={role.key} value={role.key}>{role.name}</option>
              ))}
            </select>
          ) : (
            <span className={styles.roleBadge}>{u.roles[0]?.name ?? 'Sin rol'}</span>
          )}
        </td>
        <td className={styles.cellMuted} data-label="Último acceso">
          {u.lastLoginAt ? <time dateTime={u.lastLoginAt}>{formatDateTime(u.lastLoginAt)}</time> : '—'}
        </td>
        <td data-label="Estado">
          <span className={`${styles.stateBadge} ${u.isActive ? styles.state_active : styles.state_inactive}`}>
            {u.isActive ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td data-label="Acciones">
          <div className={styles.actions} role="group" aria-label={`Acciones para ${u.fullName}`}>
            {u.isActive && !isSelf && pendingDeactivate !== u.id && (
              <button
                id={`deactivate-${u.id}`}
                className={styles.iconBtn}
                type="button"
                title="Desactivar usuario"
                aria-label={`Desactivar a ${u.fullName}`}
                onClick={() => requestDeactivate(u.id)}
                disabled={actingId === u.id}
              >
                <Icon name="close" size={15} />
              </button>
            )}
            {pendingDeactivate === u.id && (
              <>
                <button
                  id={`confirm-deactivate-${u.id}`}
                  className={styles.confirmBtn}
                  type="button"
                  onClick={() => void handleDeactivate(u.id)}
                  disabled={actingId === u.id}
                >
                  {actingId === u.id ? 'Desactivando…' : 'Confirmar'}
                </button>
                <button
                  className={styles.cancelBtn}
                  type="button"
                  onClick={() => cancelDeactivate(u.id)}
                  disabled={actingId === u.id}
                >
                  Cancelar
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <PageShell>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Gestión de usuarios</h1>
          <p className={styles.subtitle}>Administra accesos, roles y estado del personal del sistema.</p>
        </div>
        <button className={styles.newBtn} type="button" onClick={() => router.push('/admin/users/new')}>
          <Icon name="patient" size={16} />
          Nuevo usuario
        </button>
      </div>

      <section className={styles.statsGrid} aria-label="Indicadores de usuarios">
        <StatCard
          icon="users"
          tone="blue"
          label="Usuarios totales"
          value={stats.total}
          hint={stats.newThisMonth > 0 ? `+${stats.newThisMonth} este mes` : 'Registrados en el sistema'}
          hintPositive={stats.newThisMonth > 0}
        />
        <StatCard
          icon="check"
          tone="green"
          label="Activos"
          value={stats.active}
          hint={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% del total` : '—'}
        />
        <StatCard
          icon="shield"
          tone="purple"
          label="Administradores"
          value={stats.admins}
          hint={stats.total > 0 ? `${Math.round((stats.admins / stats.total) * 100)}% del total` : '—'}
        />
        <StatCard
          icon="clock"
          tone="slate"
          label="Inactivos"
          value={stats.inactive}
          hint="Sin acceso al sistema"
        />
      </section>

      <div className={styles.layout}>
        <section className={styles.mainPanel}>
          <div className={styles.toolbar}>
            <label className={styles.visuallyHidden} htmlFor="admin-user-search">
              Buscar usuarios por nombre, correo o documento
            </label>
            <div className={styles.searchWrap}>
              <Icon name="search" size={16} />
              <input
                id="admin-user-search"
                className={styles.searchInput}
                type="search"
                placeholder="Buscar por nombre, correo o documento…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel} htmlFor="admin-role-filter">Rol</label>
              <select
                id="admin-role-filter"
                className={styles.filterSelect}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">Todos los roles</option>
                {roles.map((role) => (
                  <option key={role.key} value={role.key}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel} htmlFor="admin-state-filter">Estado</label>
              <select
                id="admin-state-filter"
                className={styles.filterSelect}
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
          </div>

          {(error || actionError) && <p className={styles.error} role="alert">{error ?? actionError}</p>}

          <div
            className={styles.tableRegion}
            role="region"
            aria-label="Listado de usuarios del sistema"
            tabIndex={0}
          >
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>Usuarios, roles, estado y acciones disponibles</caption>
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">Profesión</th>
                <th scope="col">Documento</th>
                <th scope="col">Rol</th>
                <th scope="col">Último acceso</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className={styles.empty}>Cargando usuarios…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    {users.length === 0
                      ? 'No hay usuarios registrados.'
                      : 'Ningún usuario coincide con los filtros.'}
                  </td>
                </tr>
              ) : (
                filtered.map(renderRow)
              )}
            </tbody>
          </table>
          </div>

          {!isLoading && filtered.length > 0 && (
            <div className={styles.tableFooter} aria-live="polite" aria-atomic="true">
              <span>
                Mostrando {filtered.length} de {users.length} usuario{users.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </section>

        <aside className={styles.sidebar}>
          <section className={styles.sideCard} aria-labelledby="roles-title">
            <h2 id="roles-title" className={styles.sideTitle}>
              <Icon name="admin" size={16} /> Roles del sistema
            </h2>
            {roleCounts.length === 0 ? (
              <p className={styles.sideText}>Sin datos de roles todavía.</p>
            ) : (
              roleCounts.map(([name, count]) => (
                <div key={name} className={styles.roleRow}>
                  <span className={styles.roleName}>{name}</span>
                  <span className={styles.roleCount}>{count}</span>
                </div>
              ))
            )}
          </section>

          <section className={styles.sideCard} aria-labelledby="reco-title">
            <h2 id="reco-title" className={styles.sideTitle}>
              <Icon name="shield" size={16} /> Permisos y recomendaciones
            </h2>
            <p className={styles.sideText}>
              Revisa periódicamente los accesos y roles para mantener la seguridad del
              sistema. Desactiva a los usuarios que ya no formen parte del personal:
              su historial se conserva para auditoría, pero pierden acceso de inmediato.
            </p>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
