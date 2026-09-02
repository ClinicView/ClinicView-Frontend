'use client';

import { useEffect, useRef, useState } from 'react';
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
  const { notifications, unreadCount, refresh, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Cerrar al hacer clic fuera o presionar Escape.
  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  function handleOpen() {
    setIsOpen((open) => !open);
    if (!isOpen) void refresh();
  }

  function handleClick(notification: AppNotification) {
    if (!notification.readAt) void markRead(notification.id);
    setIsOpen(false);
    if (notification.patientId && notification.documentId) {
      router.push(`/patients/${notification.patientId}/documents/${notification.documentId}`);
    } else if (notification.patientId) {
      router.push(`/patients/${notification.patientId}`);
    }
  }

  return (
    <div className={styles.wrapper} ref={panelRef}>
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

      {isOpen && (
        <div
          id="notifications-panel"
          className={styles.panel}
          role="dialog"
          aria-labelledby="notifications-title"
        >
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelEyebrow}>Centro de actividad</span>
              <h2 id="notifications-title" className={styles.panelTitle}>Notificaciones</h2>
            </div>
            {unreadCount > 0 && (
              <button className={styles.markAll} type="button" onClick={() => void markAllRead()}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Icon name="bell" size={22} />
              </span>
              <p>Sin notificaciones por ahora.</p>
              <p className={styles.emptyHint}>
                Te avisaremos aquí cuando una digitalización termine de procesarse.
              </p>
            </div>
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
                        <span className={styles.itemTitle}>{notification.title}</span>
                        {notification.body && (
                          <span className={styles.itemText}>{notification.body}</span>
                        )}
                        <span className={styles.itemWhen}>{formatWhen(notification.createdAt)}</span>
                      </span>
                      {!notification.readAt && <span className={styles.unreadDot} aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
