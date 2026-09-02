'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/shared/ui';
import { useNotifications } from '../hooks/use-notifications';
import type { AppNotification } from '../types/notification';
import styles from './notifications-bell.module.css';

const TYPE_META: Record<string, { icon: IconName; tone: string }> = {
  DOCUMENT_PROCESSED: { icon: 'check', tone: 'green' },
  DOCUMENT_FAILED: { icon: 'alert', tone: 'red' },
  DOCUMENT_VALIDATED: { icon: 'shield', tone: 'green' },
  SYSTEM: { icon: 'bell', tone: 'blue' },
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function NotificationsBell() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isRefreshing,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closePanel = useCallback((restoreFocus: boolean) => {
    if (panelRef.current?.open) panelRef.current.close();
    setIsOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  // Cerrar al hacer clic fuera o presionar Escape.
  useEffect(() => {
    if (!isOpen) return;

    if (panelRef.current && !panelRef.current.open) {
      panelRef.current.showModal();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel(true);
        return;
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusableElements = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);

        if (focusableElements.length === 0) {
          event.preventDefault();
          titleRef.current?.focus();
          return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (
          event.shiftKey
          && (activeElement === first
            || activeElement === titleRef.current
            || !panelRef.current.contains(activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closePanel, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const animationFrame = window.requestAnimationFrame(() => titleRef.current?.focus());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  function handleOpen() {
    setIsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) void refresh();
      return nextOpen;
    });
  }

  function handleClick(notification: AppNotification) {
    if (!notification.readAt) void markRead(notification.id);
    const hasDestination = Boolean(notification.patientId);
    closePanel(!hasDestination);
    if (notification.patientId && notification.documentId) {
      router.push(`/patients/${notification.patientId}/documents/${notification.documentId}`);
    } else if (notification.patientId) {
      router.push(`/patients/${notification.patientId}`);
    }
  }

  function handleDialogPointerDown(event: React.PointerEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const isOnBackdrop =
      event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom;

    if (isOnBackdrop) closePanel(true);
  }

  async function handleMarkAllRead() {
    setIsMarkingAll(true);
    try {
      await markAllRead();
    } finally {
      closeButtonRef.current?.focus();
      setIsMarkingAll(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        className={styles.bellBtn}
        type="button"
        aria-label={
          unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : 'Notificaciones'
        }
        aria-expanded={isOpen}
        aria-controls="notifications-panel"
        aria-haspopup="dialog"
        onClick={handleOpen}
      >
        <Icon name="bell" size={19} />
        {unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <span className="screenReaderOnly" role="status" aria-live="polite" aria-atomic="true">
        {unreadCount > 0
          ? `${unreadCount} ${unreadCount === 1 ? 'notificación sin leer' : 'notificaciones sin leer'}`
          : 'No hay notificaciones sin leer'}
      </span>

      {isOpen && (
        <dialog
          ref={panelRef}
          id="notifications-panel"
          className={styles.panel}
          aria-labelledby="notifications-title"
          aria-busy={isRefreshing}
          onCancel={(event) => {
            event.preventDefault();
            closePanel(true);
          }}
          onPointerDown={handleDialogPointerDown}
        >
          {isRefreshing && (
            <span className="screenReaderOnly" role="status" aria-live="polite">
              Actualizando notificaciones
            </span>
          )}
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>Centro de actividad</span>
              <h2
                id="notifications-title"
                ref={titleRef}
                className={styles.panelTitle}
                tabIndex={-1}
              >
                Notificaciones
              </h2>
            </div>
            <div className={styles.panelActions}>
              {(unreadCount > 0 || isMarkingAll) && (
                <button
                  className={styles.markAll}
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  disabled={isMarkingAll}
                >
                  {isMarkingAll ? 'Marcando…' : 'Marcar todas como leídas'}
                </button>
              )}
              <button
                ref={closeButtonRef}
                className={styles.closeBtn}
                type="button"
                onClick={() => closePanel(true)}
                aria-label="Cerrar notificaciones"
              >
                <Icon name="close" size={19} />
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.loadError} role="alert">
              <Icon name="warning" size={18} />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Reintentando…' : 'Reintentar'}
              </button>
            </div>
          )}

          {notifications.length === 0 ? (
            !error && (
              <div className={styles.empty}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  <Icon name="bell" size={22} />
                </span>
                <p>Sin notificaciones por ahora.</p>
                <p className={styles.emptyHint}>
                  Te avisaremos aquí cuando una digitalización termine de procesarse.
                </p>
              </div>
            )
          ) : (
            <ul className={styles.list}>
              {notifications.map((notification) => {
                const meta = TYPE_META[notification.type] ?? TYPE_META.SYSTEM;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={`${styles.item} ${!notification.readAt ? styles.itemUnread : ''}`}
                      onClick={() => handleClick(notification)}
                    >
                      <span className={`${styles.itemIcon} ${styles[`tone_${meta.tone}`]}`} aria-hidden="true">
                        <Icon name={meta.icon} size={15} />
                      </span>
                      <span className={styles.itemBody}>
                        {!notification.readAt && (
                          <span className="screenReaderOnly">Sin leer. </span>
                        )}
                        <span className={styles.itemTitle}>{notification.title}</span>
                        {notification.body && (
                          <span className={styles.itemText}>{notification.body}</span>
                        )}
                        <time className={styles.itemWhen} dateTime={notification.createdAt}>
                          {formatWhen(notification.createdAt)}
                        </time>
                      </span>
                      {!notification.readAt && <span className={styles.unreadDot} aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </dialog>
      )}
    </div>
  );
}
