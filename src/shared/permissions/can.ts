import type { Permission } from './permissions';

// Funciones puras — shared/ no importa desde features/.
// Para usar en hooks de features, pasar permissions como argumento.

export function can(permissions: string[], permission: Permission): boolean {
  return permissions.includes(permission);
}

export function canAny(permissions: string[], required: Permission[]): boolean {
  return required.some((p) => permissions.includes(p));
}

export function canAll(permissions: string[], required: Permission[]): boolean {
  return required.every((p) => permissions.includes(p));
}

export interface PermissionRequirement {
  allOf?: readonly Permission[];
  anyOf?: readonly Permission[];
}

/**
 * Evalúa una política compuesta del mismo modo que el backend: todos los
 * permisos de `allOf` y, cuando exista, al menos uno de `anyOf`.
 */
export function satisfiesPermissionRequirement(
  permissions: readonly string[],
  requirement: PermissionRequirement,
): boolean {
  const matchesAll =
    !requirement.allOf?.length ||
    requirement.allOf.every((permission) => permissions.includes(permission));
  const matchesAny =
    !requirement.anyOf?.length ||
    requirement.anyOf.some((permission) => permissions.includes(permission));

  return matchesAll && matchesAny;
}

/** Primera ruta utilizable por el rol actual, en orden de trabajo clínico. */
export function getLandingPath(permissions: readonly string[]): string {
  if (
    satisfiesPermissionRequirement(permissions, {
      allOf: ['patients.read', 'documents.read'],
    })
  ) {
    return '/dashboard';
  }
  if (permissions.includes('patients.read')) return '/patients';
  if (permissions.includes('review.read')) return '/review';
  if (permissions.includes('users.read')) return '/admin/users';
  if (permissions.includes('admin.audit.read')) return '/admin/audit';
  return '/profile';
}
