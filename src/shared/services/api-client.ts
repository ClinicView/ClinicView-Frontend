import {
  beginLogoutTransition,
  getAuthEpoch,
  isAuthEpochCurrent,
  isSessionRestoreBlocked,
  runExclusiveAuthOperation,
} from '@/shared/session/auth-coordinator';
import { sessionFromAccessToken } from '@/shared/session/session-token';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// El access token permanece solo en memoria. La sesión restaurable vive en una
// cookie HttpOnly administrada exclusivamente por el backend.
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let onAccessTokenRefreshed: ((access: string) => void) | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiAccessToken(access: string): void {
  accessToken = access;
}

export function clearApiAccessToken(): void {
  accessToken = null;
}

export function configureApiClientCallbacks(config: {
  onAccessTokenRefreshed: (access: string) => void;
  onUnauthorized: () => void;
}): void {
  onAccessTokenRefreshed = config.onAccessTokenRefreshed;
  onUnauthorized = config.onUnauthorized;
}

/**
 * Restaura/rota la sesión una sola vez por pestaña. El coordinador serializa la
 * rotación con login/logout, también entre pestañas compatibles con Web Locks.
 */
export function refreshApiSession(options: { notify?: boolean } = {}): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  if (isSessionRestoreBlocked()) return Promise.resolve(null);

  const epoch = getAuthEpoch();
  refreshInFlight = runExclusiveAuthOperation(epoch, async (signal) => {
    if (isSessionRestoreBlocked()) return null;

    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) return null;

    const body = await response.json() as { access_token?: unknown };
    if (typeof body.access_token !== 'string') return null;
    const restored = sessionFromAccessToken(body.access_token);
    if (!restored || !isAuthEpochCurrent(epoch) || isSessionRestoreBlocked()) return null;

    setApiAccessToken(restored.accessToken);
    if (options.notify !== false) onAccessTokenRefreshed?.(restored.accessToken);
    return restored.accessToken;
  })
    .catch(() => null)
    .then((restoredAccessToken) => {
      // Si no fue cancelado por un login/logout más reciente, el fallo deja la
      // restauración bloqueada. Así una cookie que no pudo revocarse no reaparece.
      if (
        !restoredAccessToken
        && isAuthEpochCurrent(epoch)
        && !isSessionRestoreBlocked()
      ) {
        beginLogoutTransition();
      }
      return restoredAccessToken;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function doFetch(path: string, init: RequestInit, isRetry = false): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers,
  });

  if (response.status === 401) {
    if (!isRetry) {
      const refreshedAccessToken = await refreshApiSession();
      if (refreshedAccessToken) return doFetch(path, init, true);
    }
    expireLocalSession();
  }

  return response;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = await response.json() as { message?: string | string[] };
      const raw = body.message;
      message = Array.isArray(raw) ? raw.join(', ') : (raw ?? message);
    } catch {
      // Una respuesta sin JSON conserva el mensaje HTTP neutral.
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string, init: Omit<RequestInit, 'method'> = {}): Promise<T> {
  return parseResponse<T>(await doFetch(path, { ...init, method: 'GET' }));
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await doFetch(path, { method: 'GET' });
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = await response.json() as { message?: string | string[] };
      const raw = body.message;
      message = Array.isArray(raw) ? raw.join(', ') : (raw ?? message);
    } catch {
      // Una respuesta binaria/de red conserva el mensaje HTTP neutral.
    }
    throw new ApiError(response.status, message);
  }
  return response.blob();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parseResponse<T>(
    await doFetch(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return parseResponse<T>(
    await doFetch(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return parseResponse<T>(
    await doFetch(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  );
}

export async function apiDelete<T>(path: string): Promise<T> {
  return parseResponse<T>(await doFetch(path, { method: 'DELETE' }));
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return uploadWithRetry<T>(path, formData, false);
}

async function uploadWithRetry<T>(
  path: string,
  formData: FormData,
  isRetry: boolean,
): Promise<T> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
    credentials: 'include',
  });

  if (response.status === 401) {
    if (!isRetry) {
      const refreshedAccessToken = await refreshApiSession();
      if (refreshedAccessToken) return uploadWithRetry<T>(path, formData, true);
    }
    expireLocalSession();
  }
  return parseResponse<T>(response);
}

function expireLocalSession(): never {
  clearApiAccessToken();
  if (!isSessionRestoreBlocked()) beginLogoutTransition();
  onUnauthorized?.();
  throw new ApiError(401, 'Sesión expirada. Vuelve a iniciar sesión.');
}
