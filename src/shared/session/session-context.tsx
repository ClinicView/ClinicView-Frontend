'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  clearApiAccessToken,
  configureApiClientCallbacks,
  refreshApiSession,
  setApiAccessToken,
} from '@/shared/services/api-client';
import {
  isSessionRestoreBlocked,
  subscribeAuthChanges,
} from './auth-coordinator';
import { sessionFromAccessToken } from './session-token';
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
  const [isLoading, setIsLoading] = useState(true);
  const requestVersionRef = useRef(0);
  const bootstrapPromiseRef = useRef<Promise<string | null> | null>(null);

  const clearSession = useCallback(() => {
    requestVersionRef.current += 1;
    setSessionState(null);
    setIsLoading(false);
    clearApiAccessToken();
  }, []);

  const setSession = useCallback((nextSession: Session | null) => {
    requestVersionRef.current += 1;
    setSessionState(nextSession);
    setIsLoading(false);
    if (nextSession) {
      setApiAccessToken(nextSession.accessToken);
    } else {
      clearApiAccessToken();
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    const applyAccessToken = (accessToken: string | null, requestVersion: number) => {
      if (disposed || requestVersion !== requestVersionRef.current) return;
      const restored = accessToken ? sessionFromAccessToken(accessToken) : null;
      setSessionState(restored);
      setIsLoading(false);
      if (restored) setApiAccessToken(restored.accessToken);
      else clearApiAccessToken();
    };

    const restoreFromCookie = (bootstrap = false) => {
      const requestVersion = ++requestVersionRef.current;
      if (isSessionRestoreBlocked()) {
        applyAccessToken(null, requestVersion);
        return;
      }

      setIsLoading(true);
      const request = bootstrap
        ? (bootstrapPromiseRef.current ??= refreshApiSession({ notify: false }))
        : refreshApiSession({ notify: false });
      void request.then((accessToken) => applyAccessToken(accessToken, requestVersion));
    };

    configureApiClientCallbacks({
      onAccessTokenRefreshed: (accessToken) => {
        const restored = sessionFromAccessToken(accessToken);
        if (disposed) return;
        if (!restored) {
          clearSession();
          return;
        }
        setSessionState(restored);
      },
      onUnauthorized: clearSession,
    });

    const unsubscribe = subscribeAuthChanges((change) => {
      if (change.type === 'logout') {
        clearSession();
      } else {
        restoreFromCookie();
      }
    });

    restoreFromCookie(true);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [clearSession]);

  return (
    <SessionContext.Provider value={{ session, isLoading, setSession, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSessionContext debe usarse dentro de SessionProvider');
  return context;
}
