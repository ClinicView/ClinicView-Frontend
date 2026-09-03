import {
  beginLogoutTransition,
  runExclusiveAuthOperation,
} from './auth-coordinator';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Bloquea la restauración local antes de tocar la red. Si la petición falla,
 * la cookie HttpOnly podría seguir en el navegador, pero no volverá a abrir la
 * sesión hasta que un login explícito reemplace el estado.
 */
export async function logoutRequest(): Promise<boolean> {
  const epoch = beginLogoutTransition();
  try {
    return await runExclusiveAuthOperation(epoch, async (signal) => {
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal,
      });
      return response.ok;
    });
  } catch {
    return false;
  }
}
