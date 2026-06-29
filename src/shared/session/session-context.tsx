'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearApiTokens, configureApiClientCallbacks, setApiTokens } from '@/shared/services/api-client';
import type { Session } from './types';

interface SessionContextValue {
  session: Session | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearSession = useCallback(() => {
    setSessionState(null);
    clearApiTokens();
  }, []);

  const setSession = useCallback((s: Session | null) => {
    setSessionState(s);
    if (s) {
      setApiTokens(s.accessToken, s.refreshToken);
    } else {
      clearApiTokens();
    }
  }, []);

  useEffect(() => {
    configureApiClientCallbacks({
      onTokensRefreshed: (access, refresh) => {
        setSessionState((prev) =>
          prev ? { ...prev, accessToken: access, refreshToken: refresh } : null,
        );
      },
      onUnauthorized: clearSession,
    });
    setIsLoading(false);
  }, [clearSession]);

  return (
    <SessionContext.Provider value={{ session, isLoading, setSession, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext debe usarse dentro de SessionProvider');
  return ctx;
}
