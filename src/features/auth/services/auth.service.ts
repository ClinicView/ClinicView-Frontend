import {
  AuthOperationCancelledError,
  AuthOperationTimeoutError,
  beginLoginTransition,
  completeLoginTransition,
  runExclusiveAuthOperation,
} from '@/shared/session/auth-coordinator';
import { sessionFromAccessToken } from '@/shared/session/session-token';
import type { Session } from '@/shared/session/types';
import type { TokenResponse } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function readLoginResponse(response: Response): Promise<Session> {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('login_failed');
    if (response.status === 429) throw new Error('rate_limited');
    if (response.status >= 500) throw new Error('server_error');
    throw new Error('login_unavailable');
  }

  const body = await response.json() as Partial<TokenResponse>;
  const session = typeof body.access_token === 'string'
    ? sessionFromAccessToken(body.access_token)
    : null;
  if (!session) throw new Error('invalid_session');
  return session;
}

export const authService = {
  async login(email: string, password: string, rememberMe: boolean): Promise<Session> {
    const epoch = beginLoginTransition();

    try {
      const session = await runExclusiveAuthOperation(epoch, async (signal) => {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({ email, password, rememberMe }),
          signal,
        });
        return readLoginResponse(response);
      });

      if (!completeLoginTransition(epoch)) throw new AuthOperationCancelledError();
      return session;
    } catch (error) {
      if (error instanceof AuthOperationTimeoutError) throw new Error('auth_timeout');
      if (error instanceof AuthOperationCancelledError) throw new Error('auth_cancelled');
      if (error instanceof TypeError) throw new Error('network_error');
      throw error;
    }
  },
};
