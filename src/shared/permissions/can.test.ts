import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getLandingPath, satisfiesPermissionRequirement } from './can';

const permissions = ['patients.read', 'records.read', 'records.create'];

test('exige todos los permisos declarados en allOf', () => {
  assert.equal(
    satisfiesPermissionRequirement(permissions, {
      allOf: ['patients.read', 'records.read'],
    }),
    true,
  );
  assert.equal(
    satisfiesPermissionRequirement(permissions, {
      allOf: ['patients.read', 'documents.read'],
    }),
    false,
  );
});

test('acepta al menos un permiso declarado en anyOf', () => {
  assert.equal(
    satisfiesPermissionRequirement(permissions, {
      anyOf: ['documents.validate', 'records.create'],
    }),
    true,
  );
  assert.equal(
    satisfiesPermissionRequirement(permissions, {
      anyOf: ['documents.validate', 'admin.users.manage'],
    }),
    false,
  );
});

test('combina allOf y anyOf sin relajar ninguno de los grupos', () => {
  assert.equal(
    satisfiesPermissionRequirement(permissions, {
      allOf: ['patients.read'],
      anyOf: ['records.create', 'documents.upload'],
    }),
    true,
  );
  assert.equal(
    satisfiesPermissionRequirement(permissions, {
      allOf: ['patients.read', 'documents.read'],
      anyOf: ['records.create'],
    }),
    false,
  );
});

test('una política vacía no restringe contenido autenticado', () => {
  assert.equal(satisfiesPermissionRequirement([], {}), true);
});

test('elige una ruta inicial que el rol realmente puede abrir', () => {
  assert.equal(getLandingPath(['patients.read', 'documents.read']), '/dashboard');
  assert.equal(getLandingPath(['patients.read']), '/patients');
  assert.equal(getLandingPath(['review.read']), '/review');
  assert.equal(getLandingPath(['users.read']), '/admin/users');
  assert.equal(getLandingPath(['admin.audit.read']), '/admin/audit');
  assert.equal(getLandingPath([]), '/profile');
});
