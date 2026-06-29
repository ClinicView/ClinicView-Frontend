'use client';

import { useSession } from '@/features/auth';
import { UserList } from '@/features/admin';
import { PageShell } from '@/shared/components/page-shell';

export function UsersView() {
  const { user } = useSession();
  if (!user) return null;

  return (
    <PageShell>
      <h1 className="viewHeading">Gestión de usuarios</h1>
      <UserList />
    </PageShell>
  );
}
