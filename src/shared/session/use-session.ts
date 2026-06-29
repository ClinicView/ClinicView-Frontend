'use client';

import { useSessionContext } from './session-context';
import type { Session, SessionUser } from './types';

export type { Session, SessionUser };

export interface UseSessionResult {
  session: Session | null;
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  clearSession: () => void;
  setSession: (session: Session | null) => void;
}

export function useSession(): UseSessionResult {
  const { session, isLoading, clearSession, setSession } = useSessionContext();
  return {
    session,
    user: session?.user ?? null,
    isLoading,
    isAuthenticated: session !== null,
    clearSession,
    setSession,
  };
}
