'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminRole, AdminUser } from '../types/admin';
import { assignRole, deactivateUser, listRoles, listUsers } from '../services/admin.service';

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [u, r] = await Promise.all([listUsers(), listRoles()]);
      setUsers(u);
      setRoles(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  return { users, roles, isLoading, error, actionError, reload: load, deactivate: doDeactivate, assignRole: doAssignRole };
}
