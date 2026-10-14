import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useLocation } from "react-router-dom";
import { api, ApiError, type AppNotification } from "../api/client";
import { useAuth } from "./AuthContext";

type NotifContext = {
  unread: number;
  unreadMessages: number;
  items: AppNotification[];
  refresh: () => Promise<void>;
  refreshUnreadMessages: () => Promise<void>;
  markRead: () => Promise<void>;
};

const Ctx = createContext<NotifContext | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnread(0);
      setItems([]);
      return;
    }
    const data = await api<{ notifications: AppNotification[]; unread: number }>(
      "/api/notifications",
    );
    setItems(data.notifications);
    setUnread(data.unread);
  }, [user]);

  const refreshUnreadMessages = useCallback(async () => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }
    try {
      const data = await api<{ unread: number }>("/api/chat/unread");
      setUnreadMessages(data.unread);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setUnreadMessages(0);
        return;
      }
      throw err;
    }
  }, [user]);

  const markRead = useCallback(async () => {
    await api("/api/notifications/read", { method: "POST" });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    void refresh().catch(() => undefined);
    void refreshUnreadMessages().catch(() => undefined);
  }, [refresh, refreshUnreadMessages]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
      void refreshUnreadMessages().catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [user, refresh, refreshUnreadMessages]);

  useEffect(() => {
    if (!user) return;
    const socket: Socket = io({ withCredentials: true });
    socket.on("notification:new", (notif: AppNotification) => {
      setItems((prev) => [notif, ...prev]);
      setUnread((n) => n + 1);
    });
    socket.on("chat:message", (msg: { conversationId: string; senderId: string }) => {
      if (msg.senderId === user.id) return;
      if (pathRef.current === `/chat/${msg.conversationId}`) {
        void refreshUnreadMessages().catch(() => undefined);
        return;
      }
      setUnreadMessages((n) => n + 1);
    });
    return () => {
      socket.close();
    };
  }, [user, refreshUnreadMessages]);

  const value = useMemo(
    () => ({ unread, unreadMessages, items, refresh, refreshUnreadMessages, markRead }),
    [unread, unreadMessages, items, refresh, refreshUnreadMessages, markRead],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotifContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
