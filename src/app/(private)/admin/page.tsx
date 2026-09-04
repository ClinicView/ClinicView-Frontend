'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/shared/components/page-shell';
import { can } from '@/shared/permissions/can';
import { useSession } from '@/shared/session/use-session';
import { Spinner } from '@/shared/ui';

export default function AdminPage() {
  const { user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (can(user.permissions, 'users.read')) {
      router.replace('/admin/users');
      return;
    }
    if (can(user.permissions, 'roles.read')) {
      router.replace('/admin/roles');
      return;
    }
    if (can(user.permissions, 'admin.audit.read')) {
      router.replace('/admin/audit');
      return;
    }
    router.replace('/profile');
  }, [router, user]);

  if (!user) return null;

  return (
    <PageShell>
      <Spinner label="Abriendo administración…" />
    </PageShell>
  );
}
