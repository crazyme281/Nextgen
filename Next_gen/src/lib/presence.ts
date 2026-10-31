import { useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Presence (online / last-seen) and typing indicators, modelled the way
 * WhatsApp actually does it: as ephemeral state on a live connection, not
 * as rows in a table. Supabase Realtime's Presence/Broadcast APIs are the
 * purpose-built tool for this — see the architecture doc, section 2.
 */

// ---- Global online presence --------------------------------------------

let globalChannel: RealtimeChannel | null = null;
let globalRefCount = 0;
const onlineListeners = new Set<(ids: Set<string>) => void>();
let onlineIds = new Set<string>();

function ensureGlobalChannel(userId: string) {
  if (globalChannel) return;
  globalChannel = supabase.channel('presence:global', {
    config: { presence: { key: userId } },
  });
  globalChannel
    .on('presence', { event: 'sync' }, () => {
      const state = globalChannel!.presenceState();
      onlineIds = new Set(Object.keys(state));
      onlineListeners.forEach((cb) => cb(onlineIds));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await globalChannel!.track({ online_at: new Date().toISOString() });
      }
    });
}

/** Subscribe to the set of currently-online user ids app-wide. */
export function useOnlinePresence(userId: string | undefined): Set<string> {
  const [ids, setIds] = useState<Set<string>>(onlineIds);

  useEffect(() => {
    if (!userId) return;
    ensureGlobalChannel(userId);
    globalRefCount += 1;
    onlineListeners.add(setIds);
    setIds(onlineIds);

    return () => {
      onlineListeners.delete(setIds);
      globalRefCount -= 1;
      if (globalRefCount <= 0 && globalChannel) {
        supabase.removeChannel(globalChannel);
        globalChannel = null;
        onlineIds = new Set();
        globalRefCount = 0;
      }
    };
  }, [userId]);

  return ids;
}

/**
 * True if `targetUserId` is currently online. `viewerId` (the logged-in
 * user) is what joins the shared presence channel — pass useAuth().user?.id.
 */
export function useIsOnline(
  targetUserId: string | null | undefined,
  viewerId: string | undefined
): boolean {
  const online = useOnlinePresence(viewerId);
  return !!targetUserId && online.has(targetUserId);
}

// ---- Per-conversation typing indicator (Broadcast) ----------------------

interface TypingHookResult {
  /** ids of other users currently typing in this conversation */
  typingUserIds: string[];
  /** call on every keystroke in the composer (debounced internally is caller's job) */
  notifyTyping: () => void;
}

/**
 * Sub-second typing indicator over a Broadcast channel scoped to one
 * conversation — never touches Postgres.
 */
export function useTypingIndicator(
  conversationId: string | undefined,
  currentUserId: string | undefined
): TypingHookResult {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const uid = payload?.user_id as string;
        if (!uid || uid === currentUserId) return;
        setTypingUserIds((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
        clearTimeout(timersRef.current[uid]);
        timersRef.current[uid] = setTimeout(() => {
          setTypingUserIds((prev) => prev.filter((id) => id !== uid));
        }, 3000);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, currentUserId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    // throttle to at most once every 2s per user, like WhatsApp's client does
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: currentUserId },
    });
  }, [currentUserId]);

  return { typingUserIds, notifyTyping };
}