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

// ─── Module-level token state (memory-only, cleared on page reload) ──────────

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _onTokensRefreshed: ((access: string, refresh: string) => void) | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setApiTokens(access: string, refresh: string): void {
  _accessToken = access;
  _refreshToken = refresh;
}

export function clearApiTokens(): void {
  _accessToken = null;
  _refreshToken = null;
}

export function configureApiClientCallbacks(config: {
  onTokensRefreshed: (access: string, refresh: string) => void;
  onUnauthorized: () => void;
}): void {
  _onTokensRefreshed = config.onTokensRefreshed;
  _onUnauthorized = config.onUnauthorized;
}

// ─── Internal fetch with refresh logic ───────────────────────────────────────

async function tryRefresh(): Promise<boolean> {
  if (!_refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: _refreshToken }),
    });
    if (!res.ok) return false;
    const tokens = await res.json() as { access_token: string; refresh_token: string };
    setApiTokens(tokens.access_token, tokens.refresh_token);
    _onTokensRefreshed?.(tokens.access_token, tokens.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function doFetch(path: string, init: RequestInit, isRetry = false): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (_accessToken) headers.set('Authorization', `Bearer ${_accessToken}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return doFetch(path, init, true);
    clearApiTokens();
    _onUnauthorized?.();
    throw new ApiError(401, 'Sesión expirada. Vuelve a iniciar sesión.');
  }

  return res;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json() as { message?: string | string[] };
      const raw = body.message;
      message = Array.isArray(raw) ? raw.join(', ') : (raw ?? message);
    } catch { /* ignore */ }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export async function apiGet<T>(path: string): Promise<T> {
  return parseResponse<T>(await doFetch(path, { method: 'GET' }));
}

export async function apiBlob(path: string): Promise<Blob> {
  const res = await doFetch(path, { method: 'GET' });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json() as { message?: string | string[] };
      const raw = body.message;
      message = Array.isArray(raw) ? raw.join(', ') : (raw ?? message);
    } catch { /* ignore */ }
    throw new ApiError(res.status, message);
  }
  return res.blob();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parseResponse<T>(
    await doFetch(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  );
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return parseResponse<T>(
    await doFetch(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  );
}

export async function apiDelete<T>(path: string): Promise<T> {
  return parseResponse<T>(await doFetch(path, { method: 'DELETE' }));
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers();
  if (_accessToken) headers.set('Authorization', `Bearer ${_accessToken}`);
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiUpload<T>(path, formData);
    clearApiTokens();
    _onUnauthorized?.();
    throw new ApiError(401, 'Sesión expirada. Vuelve a iniciar sesión.');
  }
  return parseResponse<T>(res);
}
