'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSessionContext } from '../context/session-context';
import { authService } from '../services/auth.service';
import type { Session } from '../types';

function decodeJwtPayload<T>(token: string): T {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64)) as T;
}

export interface UseLoginResult {
  login: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useLogin(): UseLoginResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSession } = useSessionContext();
  const router = useRouter();

  async function login(email: string, password: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const tokens = await authService.login(email, password);
      const payload = decodeJwtPayload<{ sub: string; email: string; permissions: string[] }>(
        tokens.access_token,
      );
      const session: Session = {
        user: { sub: payload.sub, email: payload.email, permissions: payload.permissions },
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
      setSession(session);
      router.replace('/dashboard');
    } catch {
      // Mensaje genérico — no revelar si la cuenta existe.
      setError('Email o contraseña incorrectos. Verifica tus credenciales.');
    } finally {
      setIsLoading(false);
    }
  }

  return { login, isLoading, error };
}
