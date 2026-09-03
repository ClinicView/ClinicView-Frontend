'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminRole, AdminUser } from '../types/admin';
import { assignRole, deactivateUser, listRoles, listUsers } from '../services/admin.service';

export function useAdminUsers({ loadRoles = true }: { loadRoles?: boolean } = {}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRolesError(null);
    const [usersResult, rolesResult] = await Promise.allSettled([
      listUsers(),
      loadRoles ? listRoles() : Promise.resolve([]),
    ]);

    if (usersResult.status === 'fulfilled') {
      setUsers(usersResult.value);
    } else {
      setUsers([]);
      setError(
        usersResult.reason instanceof Error
          ? usersResult.reason.message
          : 'Error al cargar usuarios.',
      );
    }

    if (rolesResult.status === 'fulfilled') {
      setRoles(rolesResult.value);
    } else {
      setRoles([]);
      setRolesError('No se pudieron cargar los roles disponibles.');
    }

    setIsLoading(false);
  }, [loadRoles]);

  useEffect(() => { void load(); }, [load]);

  async function doDeactivate(id: string): Promise<void> {
    setActionError(null);
    try {
      const updated = await deactivateUser(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al desactivar usuario.');
    }
  }

  async function doAssignRole(userId: string, roleKey: string): Promise<void> {
    setActionError(null);
    try {
      const updated = await assignRole(userId, roleKey);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al asignar rol.');
    }
  }

  return {
    users,
    roles,
    isLoading,
    error,
    rolesError,
    actionError,
    reload: load,
    deactivate: doDeactivate,
    assignRole: doAssignRole,
  };
}
