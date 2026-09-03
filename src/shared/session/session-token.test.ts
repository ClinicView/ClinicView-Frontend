import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sessionFromAccessToken } from './session-token';

function jwt(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `header.${encoded}.signature`;
}

test('restaura únicamente los datos de sesión esperados desde un access token vigente', () => {
  const accessToken = jwt({
    sub: 'user-1',
    email: 'médico@clinicview.local',
    permissions: ['patients.read', 'records.create'],
    exp: Math.floor(Date.now() / 1000) + 60,
    sessionVersion: 2,
    tokenType: 'access',
    ignored: 'no se expone',
  });

  assert.deepEqual(sessionFromAccessToken(accessToken), {
    accessToken,
    user: {
      sub: 'user-1',
      email: 'médico@clinicview.local',
      permissions: ['patients.read', 'records.create'],
    },
  });
});

test('rechaza tokens vencidos, corruptos o con claims incompletos', () => {
  assert.equal(sessionFromAccessToken('token-inválido'), null);
  assert.equal(sessionFromAccessToken(jwt({
    sub: 'user-1',
    email: 'medico@clinicview.local',
    permissions: ['patients.read'],
    exp: Math.floor(Date.now() / 1000) - 1,
    sessionVersion: 2,
    tokenType: 'access',
  })), null);
  assert.equal(sessionFromAccessToken(jwt({
    sub: 'user-1',
    email: 'medico@clinicview.local',
    permissions: [42],
    exp: Math.floor(Date.now() / 1000) + 60,
    sessionVersion: 2,
    tokenType: 'access',
  })), null);
  assert.equal(sessionFromAccessToken(jwt({
    sub: 'user-1',
    email: 'medico@clinicview.local',
    permissions: ['patients.read'],
    exp: Math.floor(Date.now() / 1000) + 60,
    sessionVersion: 2,
    tokenType: 'refresh',
  })), null);
  assert.equal(sessionFromAccessToken(jwt({
    sub: '',
    email: 'medico@clinicview.local',
    permissions: [],
    exp: Math.floor(Date.now() / 1000) + 60,
    sessionVersion: 0,
    tokenType: 'access',
  })), null);
});
