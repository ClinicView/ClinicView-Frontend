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
