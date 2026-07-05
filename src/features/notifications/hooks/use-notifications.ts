'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications.service';
import type { AppNotification } from '../types/notification';

const POLL_INTERVAL_MS = 25_000;

/**
 * Notificaciones del usuario con polling ligero (25 s) y refresco al volver
 * a la pestaña. Suficiente para avisar cuando termina una digitalización
 * sin necesidad de websockets.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const result = await listNotifications();
      setNotifications(result.data);
      setUnreadCount(result.unreadCount);
    } catch {
      // Sin red o backend caído: se reintenta en el próximo ciclo.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);

    function onFocus() {
      void refresh();
    }
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        await markNotificationRead(id);
      } catch {
        void refresh();
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((item) => (item.readAt ? item : { ...item, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      void refresh();
    }
  }, [refresh]);

  return { notifications, unreadCount, refresh, markRead, markAllRead };
}
