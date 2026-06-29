'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/features/auth';
import { UserCreateForm, createUser, listRoles } from '@/features/admin';
import type { AdminRole, CreateAdminUserData } from '@/features/admin';
import { PageShell } from '@/shared/components/page-shell';
import { ApiError } from '@/shared/services/api-client';

export function NewUserView() {
  const { user } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);

  useEffect(() => {
    let mounted = true;
    listRoles()
      .then((items) => {
        if (mounted) setRoles(items);
      })
      .catch(() => {
        if (mounted) setRoles([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!user) return null;

  async function handleSubmit(data: CreateAdminUserData) {
    setIsLoading(true);
    setError(null);
    try {
      await createUser(data);
      router.replace('/admin/users');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear el usuario.');
      setIsLoading(false);
    }
  }

  return (
    <PageShell>
      <UserCreateForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/users')}
        isLoading={isLoading}
        error={error}
        roles={roles}
      />
    </PageShell>
  );
}
