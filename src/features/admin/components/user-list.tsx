'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminUsers } from '../hooks/use-admin-users';
import styles from './user-list.module.css';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatDocument(user: { documentType: string | null; documentNumber: string | null }): string {
  if (!user.documentType || !user.documentNumber) return '—';
  return `${user.documentType} ${user.documentNumber}`;
}

export function UserList() {
  const { users, roles, isLoading, error, actionError, deactivate, assignRole } = useAdminUsers();
  const router = useRouter();
  const [pendingDeactivate, setPendingDeactivate] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function handleDeactivate(id: string) {
    setActingId(id);
    await deactivate(id);
    setActingId(null);
    setPendingDeactivate(null);
  }

  async function handleRoleChange(userId: string, roleKey: string) {
    if (!roleKey) return;
    setActingId(userId);
    await assignRole(userId, roleKey);
    setActingId(null);
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {users.length} usuario{users.length !== 1 ? 's' : ''}
        </span>
        <button className={styles.newBtn} onClick={() => router.push('/admin/users/new')}>
          + Nuevo usuario
        </button>
      </div>

      {(error || actionError) && (
        <p className={styles.error}>{error ?? actionError}</p>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Profesión</th>
              <th>Documento</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className={styles.empty}>Cargando…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>No hay usuarios registrados.</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userPrimary}>{u.fullName}</div>
                    <div className={styles.userMeta}>@{u.username} · {u.email}</div>
                    <div className={styles.userMeta}>Último acceso: {formatDate(u.lastLoginAt)}</div>
                  </td>
                  <td>{u.profession ?? '—'}</td>
                  <td>{formatDocument(u)}</td>
                  <td>
                    {u.isActive ? (
                      <select
                        className={styles.select}
                        value={u.roles[0]?.key ?? ''}
                        onChange={(e) => void handleRoleChange(u.id, e.target.value)}
                        disabled={actingId === u.id}
                        aria-label={`Rol de ${u.fullName}`}
                      >
                        <option value="">Sin rol</option>
                        {roles.map((r) => (
                          <option key={r.key} value={r.key}>{r.name}</option>
                        ))}
                      </select>
                    ) : (
                      u.roles[0] ? (
                        <span className={styles.roleBadge}>{u.roles[0].name}</span>
                      ) : (
                        <span className={styles.noRole}>Sin rol</span>
                      )
                    )}
                  </td>
                  <td>{formatDate(u.lastLoginAt)}</td>
                  <td>
                    <span className={`${styles.badge} ${u.isActive ? styles.active : styles.inactive}`}>
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {u.isActive && pendingDeactivate !== u.id && (
                        <button
                          className={`${styles.btn} ${styles.btnDanger}`}
                          onClick={() => setPendingDeactivate(u.id)}
                          disabled={actingId === u.id}
                        >
                          Desactivar
                        </button>
                      )}
                      {pendingDeactivate === u.id && (
                        <>
                          <button
                            className={`${styles.btn} ${styles.btnDanger}`}
                            onClick={() => void handleDeactivate(u.id)}
                            disabled={actingId === u.id}
                          >
                            {actingId === u.id ? 'Desactivando…' : 'Confirmar'}
                          </button>
                          <button
                            className={styles.btn}
                            onClick={() => setPendingDeactivate(null)}
                            disabled={actingId === u.id}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
