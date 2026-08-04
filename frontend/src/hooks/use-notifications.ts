import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/src/lib/api";

export type NotificationItem = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  booking_id?: string | null;
  read: boolean;
  created_at: string;
};

type Ctx = {
  items: NotificationItem[];
  unread: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  latest: NotificationItem | null; // newest unseen since last poll
};

const POLL_MS = 5000;

/**
 * Hook that polls the backend for notifications. Returns unread count + list
 * and exposes a `latest` item that fires only once per new notification, so
 * screens can display a transient toast.
 */
export function useNotifications(active: boolean = true): Ctx {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState<NotificationItem | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listNotifications();
      setItems(list as any);
      const u = (list as any[]).filter((n) => !n.read).length;
      setUnread(u);
      if (firstLoad.current) {
        (list as any[]).forEach((n) => seenIds.current.add(n.id));
        firstLoad.current = false;
      } else {
        const fresh = (list as any[]).find((n) => !seenIds.current.has(n.id) && !n.read);
        if (fresh) {
          setLatest(fresh);
          (list as any[]).forEach((n) => seenIds.current.add(n.id));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [active, refresh]);

  const markAllRead = useCallback(async () => {
    try { await api.markAllRead(); await refresh(); } catch {}
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    try { await api.markRead(id); await refresh(); } catch {}
  }, [refresh]);

  return { items, unread, latest, refresh, markAllRead, markRead };
}
