import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  type LocalMessage,
  deleteMessages,
  localEvents,
  putMessages,
  toLocalMessage,
} from '@/lib/localDb';
import { flushOutbox, pendingCount, syncAll } from '@/lib/messageSync';
import { isAppLocked, onAppLockChange } from '@/lib/biometric';
import InAppMessageBanner, { type MessageNotice } from '@/components/InAppMessageBanner';
import { tr } from '@/i18n';

interface MessagingContextValue {
  /** Whether the device currently has a connection. */
  isOnline: boolean;
  /** Messages typed offline that haven't reached the server yet. */
  pending: number;
  /** Sync now (also runs automatically on login, reconnect and app resume). */
  syncNow: () => Promise<void>;
}

const MessagingContext = createContext<MessagingContextValue>({
  isOnline: true,
  pending: 0,
  syncNow: async () => undefined,
});

export const useMessaging = (): MessagingContextValue => useContext(MessagingContext);

const RETRY_DELAYS_MS = [3000, 10000, 30000, 60000];

function previewFor(m: LocalMessage): string {
  if (m.media_type === 'image') return '📷 Photo';
  if (m.media_type === 'video') return '🎥 Video';
  if (m.media_type === 'audio') return '🎤 Voice message';
  if (m.media_type === 'document') return '📄 Document';
  if (m.body) return m.body.length > 90 ? `${m.body.slice(0, 90)}…` : m.body;
  return 'New message';
}

/**
 * Owns everything that has to keep working on every screen, not just inside
 * an open chat:
 *  - saves EVERY incoming message to the on-device database as it arrives
 *  - syncs with Supabase on login, on reconnect and when the app is reopened
 *  - sends messages that were written offline
 *  - shows the in-app banner for new messages (foreground only)
 *
 * Mount inside the Router and inside AuthProvider.
 */
export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session, isOfflineSession } = useAuth();
  const history = useHistory();
  const location = useLocation();

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState<MessageNotice | null>(null);

  const userId = user?.id ?? null;
  const canTalkToServer = !!session && !isOfflineSession;

  // Refs so long-lived callbacks (realtime, timers) always see current values.
  const pathRef = useRef(location.pathname);
  useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);
  const appActiveRef = useRef(true);
  const nameCache = useRef(new Map<string, string>());
  const groupTitleCache = useRef(new Map<string, string | null>());
  const realtimeLive = useRef(false);
  const retryAttempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ----------------------------- notifications ----------------------------- */

  const resolveTitle = useCallback(async (msg: LocalMessage): Promise<string> => {
    let sender = nameCache.current.get(msg.sender_id);
    if (!sender) {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', msg.sender_id).maybeSingle();
      sender = (data as { full_name: string | null } | null)?.full_name ?? 'New message';
      nameCache.current.set(msg.sender_id, sender);
    }
    if (!groupTitleCache.current.has(msg.conversation_id)) {
      const { data } = await supabase.from('conversations').select('kind, title').eq('id', msg.conversation_id).maybeSingle();
      const convo = data as { kind: string; title: string | null } | null;
      groupTitleCache.current.set(msg.conversation_id, convo?.kind === 'group' ? convo.title ?? 'Group' : null);
    }
    const group = groupTitleCache.current.get(msg.conversation_id);
    return group ? `${sender} · ${group}` : sender;
  }, []);

  const canShowBanner = useCallback((conversationId?: string): boolean => {
    // Only while the app is open in the foreground, and never over the lock screen.
    if (!appActiveRef.current || document.visibilityState !== 'visible') return false;
    if (isAppLocked()) return false;
    // Already reading that very conversation — the message appears in the thread itself.
    if (conversationId && pathRef.current.replace(/\/$/, '') === `/chats/room/${conversationId}`) return false;
    return true;
  }, []);

  const notifyIncoming = useCallback(async (msg: LocalMessage) => {
    if (!canShowBanner(msg.conversation_id)) return;
    const title = await resolveTitle(msg);
    if (!canShowBanner(msg.conversation_id)) return; // state may have changed while we looked up the name
    setNotice({
      key: `${msg.id}`,
      title,
      preview: previewFor(msg),
      path: `/chats/room/${msg.conversation_id}`,
    });
  }, [canShowBanner, resolveTitle]);

  /* --------------------------------- syncing -------------------------------- */

  const refreshPending = useCallback(async () => {
    if (!userId) { setPending(0); return; }
    try { setPending(await pendingCount(userId)); } catch { /* ignore */ }
  }, [userId]);

  // navigator.onLine is only a hint (Android WebViews can say "offline" while mobile data works), so
  // it never blocks a sync: we just try, and let the request's own result decide.
  const runSync = useCallback(async (light = false): Promise<void> => {
    if (!userId || !canTalkToServer) return;
    try {
      const { newIncoming } = await syncAll(userId, { light });
      retryAttempt.current = 0;
      setIsOnline(true);
      // Messages that arrived while the device was offline / app was closed: one summary banner.
      if (newIncoming.length === 1) {
        await notifyIncoming(newIncoming[0]);
      } else if (newIncoming.length > 1 && canShowBanner()) {
        setNotice({
          key: `sync-${Date.now()}`,
          title: `${newIncoming.length} new messages`,
          preview: 'Tap to open your chats',
          path: '/tabs/chats',
        });
      }
    } catch {
      // Still unreachable (or the server hiccupped): back off and retry while we think we're online.
      if (retryTimer.current) clearTimeout(retryTimer.current);
      const delay = RETRY_DELAYS_MS[Math.min(retryAttempt.current, RETRY_DELAYS_MS.length - 1)];
      retryAttempt.current += 1;
      setIsOnline(navigator.onLine);
      retryTimer.current = setTimeout(() => { runSync(); }, delay);
    } finally {
      refreshPending();
    }
  }, [userId, canTalkToServer, notifyIncoming, canShowBanner, refreshPending]);

  // First sync after login / app open, and whenever the session becomes real again.
  useEffect(() => {
    if (!userId) return;
    refreshPending();
    runSync();
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, [userId, canTalkToServer, runSync, refreshPending]);

  // Connectivity + app foreground/background.
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      retryAttempt.current = 0;
      // Small delay: right after the radio comes back, the first request often still fails.
      setTimeout(() => { runSync(); }, 800);
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    let handle: { remove: () => void } | undefined;
    let cancelled = false;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      appActiveRef.current = isActive;
      if (isActive) {
        setIsOnline(navigator.onLine);
        runSync();
      } else {
        setNotice(null);
      }
    }).then((h) => { if (cancelled) h.remove(); else handle = h; });

    const onVisibility = () => {
      appActiveRef.current = document.visibilityState === 'visible';
      if (!appActiveRef.current) setNotice(null);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      handle?.remove();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [runSync]);

  // Safety nets, so new messages arrive even if the live socket is blocked or silently dropped (common
  // on mobile networks): poll while the live connection is down, plus a slow poll even when it's up,
  // and re-try anything waiting in the outbox every few seconds.
  useEffect(() => {
    if (!userId || !canTalkToServer) return;
    let ticks = 0;
    const timer = setInterval(() => {
      if (!appActiveRef.current || document.visibilityState !== 'visible') return;
      ticks += 1;
      pendingCount(userId).then((n) => {
        setPending(n);
        if (n > 0) flushOutbox(userId).then(() => refreshPending()).catch(() => undefined);
      }).catch(() => undefined);
      // every 8s while the live connection is down, every ~40s while it is up
      if (!realtimeLive.current || ticks % 5 === 0) runSync(true);
    }, 8000);
    return () => clearInterval(timer);
  }, [userId, canTalkToServer, runSync, refreshPending]);

  // Anything covering the app with the lock screen must also hide the banner.
  useEffect(() => onAppLockChange((locked) => { if (locked) setNotice(null); }), []);

  // Keep the "waiting to send" counter honest as messages go out.
  useEffect(() => localEvents.on((e) => { if (e.type === 'upsert' || e.type === 'synced') refreshPending(); }), [refreshPending]);

  /* ------------------------------ live messages ----------------------------- */

  useEffect(() => {
    if (!userId || !canTalkToServer) return;

    const channel = supabase
      .channel(`inbox-store-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          // payload.new.body is ciphertext; read the decrypted row through messages_plain (same RLS).
          const insertedId = (payload.new as { id: string }).id;
          const { data } = await supabase.from('messages_plain').select('*').eq('id', insertedId).maybeSingle();
          if (!data) return; // not visible to this user, or already gone
          const msg = toLocalMessage(data as unknown as LocalMessage);
          const fresh = await putMessages(userId, [msg]);
          localEvents.emit({ type: 'upsert', conversationId: msg.conversation_id, ids: [msg.id] });
          if (fresh.length > 0 && msg.sender_id !== userId) notifyIncoming(msg);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        async (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          await deleteMessages(userId, [id]);
          localEvents.emit({ type: 'delete', conversationId: null, ids: [id] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_deletions', filter: `user_id=eq.${userId}` },
        async (payload) => {
          const id = (payload.new as { message_id?: string }).message_id;
          if (!id) return;
          await deleteMessages(userId, [id]);
          localEvents.emit({ type: 'delete', conversationId: null, ids: [id] });
        }
      )
      .subscribe((status) => {
        realtimeLive.current = status === 'SUBSCRIBED';
        // A reconnected socket can have missed events: catch up from the server.
        if (status === 'SUBSCRIBED') runSync();
      });

    return () => {
      realtimeLive.current = false;
      supabase.removeChannel(channel);
    };
  }, [userId, canTalkToServer, notifyIncoming, runSync]);

  const syncNow = useCallback(async () => {
    if (!userId) return;
    await flushOutbox(userId).catch(() => undefined);
    await runSync();
  }, [userId, runSync]);

  return (
    <MessagingContext.Provider value={{ isOnline, pending, syncNow }}>
      {children}
      {userId && !isOnline && (
        <div
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 99990,
            top: 'calc(env(safe-area-inset-top, 0px) + 2px)', pointerEvents: 'none',
            background: 'rgba(30,27,46,0.88)', color: '#fff', fontSize: 11, padding: '3px 10px',
            borderRadius: 10, whiteSpace: 'nowrap',
          }}
        >
          {tr('Offline — showing saved messages')}
        </div>
      )}
      <InAppMessageBanner
        notice={notice}
        onOpen={(n) => { setNotice(null); history.push(n.path); }}
        onDismiss={() => setNotice(null)}
      />
    </MessagingContext.Provider>
  );
};
