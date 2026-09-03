'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { getLandingPath } from '@/shared/permissions/can';
import { useSessionContext } from '../context/session-context';
import { authService } from '../services/auth.service';

export type LoginError =
  | 'login_failed'
  | 'rate_limited'
  | 'server_error'
  | 'invalid_session'
  | 'auth_timeout'
  | 'auth_cancelled'
  | 'network_error';

export interface UseLoginResult {
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  isLoading: boolean;
  error: LoginError | null;
  clearError: () => void;
}

export function useLogin(): UseLoginResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const { setSession, clearSession } = useSessionContext();
  const router = useRouter();

  const clearError = useCallback(() => setError(null), []);

  async function login(email: string, password: string, rememberMe: boolean): Promise<void> {
    setIsLoading(true);
    setError(null);
    clearSession();
    try {
      const session = await authService.login(email, password, rememberMe);
      setSession(session);
      router.replace(getLandingPath(session.user.permissions));
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : 'network_error';
      const knownErrors: LoginError[] = [
        'login_failed',
        'rate_limited',
        'server_error',
        'invalid_session',
        'auth_timeout',
        'auth_cancelled',
        'network_error',
      ];
      setError(knownErrors.includes(reason as LoginError) ? reason as LoginError : 'network_error');
    } finally {
      setIsLoading(false);
    }
  }

  return { login, isLoading, error, clearError };
}
