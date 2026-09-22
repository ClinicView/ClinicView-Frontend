const LOCAL_API_BASE_URL = 'http://localhost:3001/api';
const SAME_ORIGIN_API_BASE_URL = '/api';

function invalidApiUrl(): never {
  // Never echo the configured value: it could contain accidentally pasted secrets.
  throw new Error('NEXT_PUBLIC_API_URL debe ser una ruta absoluta como /api o una URL HTTP(S), sin credenciales, parámetros ni fragmentos.');
}

/**
 * Pure configuration resolver shared by every browser API consumer.
 * An explicit loopback URL remains valid for local production builds and E2E;
 * production never selects localhost implicitly.
 */
export function resolveApiBaseUrl(configuredUrl: string | undefined, environment: string | undefined): string {
  if (configuredUrl === undefined) {
    return environment === 'production' ? SAME_ORIGIN_API_BASE_URL : LOCAL_API_BASE_URL;
  }

  const value = configuredUrl.trim();
  const hasControlCharacter = [...value].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f);
  if (!value || hasControlCharacter || /[\s\\?#]/.test(value) || value.startsWith('//')) invalidApiUrl();

  const relative = value.startsWith('/');
  if (!relative && !/^https?:\/\/[^/]/i.test(value)) invalidApiUrl();

  let parsed: URL;
  try {
    parsed = relative ? new URL(value, 'https://clinicview.invalid') : new URL(value);
  } catch {
    return invalidApiUrl();
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) invalidApiUrl();
  const pathname = parsed.pathname.replace(/\/+$/, '');
  if (relative && !pathname) invalidApiUrl();
  return relative ? pathname : `${parsed.origin}${pathname}`;
}

// Literal property access is required for Next.js to inline this public build setting.
// This URL is public; never put a token, password or other secret in it.
export const API_BASE_URL = resolveApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NODE_ENV,
);
