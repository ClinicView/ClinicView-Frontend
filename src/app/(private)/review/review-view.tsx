'use client';

import { useSession } from '@/features/auth';
import { can } from '@/shared/permissions/can';
import { ReviewQueue } from '@/features/review';
import { PageShell } from '@/shared/components/page-shell';
import { Alert } from '@/shared/ui';

export function ReviewView() {
  const { user } = useSession();
  if (!user) return null;

  if (!can(user.permissions, 'review.read')) {
    return (
      <PageShell>
        <Alert variant="error">No tienes permisos para acceder a la cola de revisión.</Alert>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ReviewQueue />
    </PageShell>
  );
}
