import type { Session, SessionUser } from './types';

interface SessionJwtPayload extends SessionUser {
  exp: number;
  sessionVersion: number;
  tokenType: 'access';
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function sessionFromAccessToken(accessToken: string): Session | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
    const encodedPayload = parts[1];
    if (encodedPayload.length > 65_536) return null;

    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<SessionJwtPayload>;
    if (
      typeof payload.sub !== 'string'
      || payload.sub.trim().length === 0
      || typeof payload.email !== 'string'
      || payload.email.trim().length === 0
      || !Array.isArray(payload.permissions)
      || !payload.permissions.every(
        (permission) => typeof permission === 'string' && permission.length > 0,
      )
      || typeof payload.exp !== 'number'
      || !Number.isSafeInteger(payload.exp)
      || payload.exp * 1000 <= Date.now()
      || !Number.isSafeInteger(payload.sessionVersion)
      || Number(payload.sessionVersion) < 0
      || payload.tokenType !== 'access'
    ) {
      return null;
    }

    return {
      accessToken,
      user: {
        sub: payload.sub,
        email: payload.email,
        permissions: [...new Set(payload.permissions)],
      },
    };
  } catch {
    return null;
  }
}
