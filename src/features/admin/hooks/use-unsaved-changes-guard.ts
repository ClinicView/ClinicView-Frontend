'use client';

import { useEffect } from 'react';

export function useUnsavedChangesGuard(isDirty: boolean, message: string): void {
  useEffect(() => {
    if (!isDirty) return;

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    function interceptInternalLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.href === window.location.href) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    function interceptExternalForm(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.unsavedGuardSubmit === 'allow') return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', interceptInternalLink, true);
    document.addEventListener('submit', interceptExternalForm, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', interceptInternalLink, true);
      document.removeEventListener('submit', interceptExternalForm, true);
    };
  }, [isDirty, message]);
}
