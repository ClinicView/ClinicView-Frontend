import {
  beginLogoutTransition,
  runExclusiveAuthOperation,
} from './auth-coordinator';
import { API_BASE_URL } from '../services/api-url';

/**
 * Bloquea la restauración local antes de tocar la red. Si la petición falla,
 * la cookie HttpOnly podría seguir en el navegador, pero no volverá a abrir la
 * sesión hasta que un login explícito reemplace el estado.
 */
export async function logoutRequest(): Promise<boolean> {
  const epoch = beginLogoutTransition();
  try {
    return await runExclusiveAuthOperation(epoch, async (signal) => {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
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
