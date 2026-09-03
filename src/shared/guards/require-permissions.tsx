'use client';

import type { PermissionRequirement } from '@/shared/permissions/can';
import { satisfiesPermissionRequirement } from '@/shared/permissions/can';
import { useSession } from '@/shared/session/use-session';
import { PageShell } from '@/shared/components/page-shell';
import { ForbiddenState } from '@/shared/components/forbidden-state';

interface RequirePermissionsProps extends PermissionRequirement {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

/**
 * Límite declarativo de autorización para rutas cliente. El backend sigue
 * siendo la autoridad final; este guard evita solicitudes y controles que el
 * rol actual no puede utilizar.
 */
export function RequirePermissions({
  allOf,
  anyOf,
  children,
  title,
  description,
}: RequirePermissionsProps) {
  const { user, isLoading } = useSession();

  if (isLoading || !user) return null;

  if (!satisfiesPermissionRequirement(user.permissions, { allOf, anyOf })) {
    return (
      <PageShell>
        <ForbiddenState title={title} description={description} />
      </PageShell>
    );
  }

  return <>{children}</>;
}
