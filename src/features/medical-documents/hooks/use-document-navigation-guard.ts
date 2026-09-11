'use client';

import { useCallback, useEffect, useRef } from 'react';

interface NavigationEvent extends Event {
  destination: { url: string };
  hashChange: boolean;
  downloadRequest: string | null;
}
type NavigationWindow = Window & { navigation?: EventTarget };
const MESSAGE = 'Hay cambios sin guardar en la revisión del documento. ¿Deseas salir y descartarlos?';

/** Deliberate exit, without fabricating history entries or trapping browser traversal. */
export function useDocumentNavigationGuard(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const approved = useRef<{ url: string | null; until: number } | null>(null);
  const confirmExit = useCallback((url: string | null = null) => {
    if (!dirtyRef.current) return true;
    if (!window.confirm(MESSAGE)) return false;
    approved.current = { url, until: Date.now() + 1500 };
    return true;
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (approved.current && approved.current.until > Date.now()) return;
      event.preventDefault(); event.returnValue = '';
    };
    const guardLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.origin === window.location.origin) return;
      if (!confirmExit(destination.href)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const navigate = (raw: Event) => {
      const event = raw as NavigationEvent;
      if (!event.cancelable || event.defaultPrevented || event.hashChange || event.downloadRequest !== null) return;
      const destination = new URL(event.destination.url);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.origin === window.location.origin) return;
      const approval = approved.current;
      // Keep the approval for a following beforeunload in a cross-document exit.
      if (approval && approval.until > Date.now() && (!approval.url || approval.url === destination.href)) return;
      if (!confirmExit(destination.href)) event.preventDefault();
    };
    const navigation = (window as NavigationWindow).navigation;
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardLink, true);
    navigation?.addEventListener('navigate', navigate);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardLink, true);
      navigation?.removeEventListener('navigate', navigate);
    };
  }, [dirty, confirmExit]);

  return confirmExit;
}
