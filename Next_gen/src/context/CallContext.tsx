import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { call, close, videocam } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase, ensureRealtimeAuth } from '@/lib/supabase';
import type { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { useAuth } from '@/context/AuthContext';
import type { CallInvite } from '@/lib/webrtc';
import { registerForCallPush } from '@/lib/push';
import { tr } from '@/i18n';

interface StartCallArgs {
  peerId: string;
  peerName: string;
  peerAvatar: string | null;
  conversationId: string;
  type: 'audio' | 'video';
}

interface CallContextValue {
  startCall: (args: StartCallArgs) => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

interface CallInviteRow {
  call_id: string;
  caller_id: string;
  caller_name: string | null;
  caller_avatar: string | null;
  conversation_id: string;
  call_type: 'audio' | 'video';
  status: string;
}

const rowToInvite = (row: CallInviteRow): CallInvite => ({
  callId: row.call_id,
  callerId: row.caller_id,
  callerName: row.caller_name ?? 'Unknown',
  callerAvatar: row.caller_avatar,
  conversationId: row.conversation_id,
  type: row.call_type,
});

// How often to re-check the database directly for a pending invite this
// device might have missed. This is the safety net underneath the
// realtime broadcast — belt and suspenders, since the broadcast alone
// has already proven to have a real, hard-to-pin-down delivery gap.
const POLL_INTERVAL_MS = 4000;

/**
 * Incoming calls now have TWO independent delivery paths, not one:
 *
 *  1. A persisted `call_invites` row (see migration 0028) — queried
 *     directly on mount, on every app resume/foreground, and on a
 *     regular short poll. This is the reliable path: it doesn't depend
 *     on this device having been actively, continuously subscribed to
 *     anything at the exact millisecond the invite was sent.
 *  2. The pre-existing `user-calls:{myId}` private broadcast channel AND
 *     a `postgres_changes` subscription on call_invites INSERTs — for
 *     instant delivery while this device is already active, without
 *     waiting for the next poll tick.
 *
 * Whichever path notices an invite first wins; both just call the same
 * setIncoming().
 */
export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const history = useHistory();
  const [incoming, setIncoming] = useState<CallInvite | null>(null);
  const inCallRef = useRef(false);
  const incomingRef = useRef<CallInvite | null>(null);
  incomingRef.current = incoming;

  useEffect(() => {
    if (!user) return;
    const userId = user.id; // stable string — see note on the old bug
    // this replaced: depending on the whole `user` object here caused
    // this effect to tear down and rebuild on every token refresh.

    const checkForPendingInvite = async () => {
      if (inCallRef.current || incomingRef.current) return;
      const { data } = await supabase
        .from('call_invites')
        .select('call_id, caller_id, caller_name, caller_avatar, conversation_id, call_type, status')
        .eq('callee_id', userId)
        .eq('status', 'ringing')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        console.log('[calls] pending invite found via poll/check', data);
        setIncoming(rowToInvite(data as CallInviteRow));
      }
    };

    // Catches anything missed while this device was closed/backgrounded,
    // the moment the app opens or comes back to the foreground.
    checkForPendingInvite();
    const onVisible = () => { if (document.visibilityState === 'visible') checkForPendingInvite(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const pollTimer = setInterval(checkForPendingInvite, POLL_INTERVAL_MS);

    let broadcastChannel: ReturnType<typeof supabase.channel> | null = null;
    let tableChannel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      await ensureRealtimeAuth();

      broadcastChannel = supabase
        .channel(`user-calls:${userId}`, { config: { private: true } })
        .on('broadcast', { event: 'invite' }, ({ payload }: { payload: unknown }) => {
          console.log('[calls] invite received via broadcast', payload);
          if (inCallRef.current) {
            console.log('[calls] invite ignored — inCallRef already true');
            return;
          }
          setIncoming(payload as CallInvite);
        })
        .on('broadcast', { event: 'cancel' }, ({ payload }: { payload: unknown }) => {
          console.log('[calls] cancel received via broadcast', payload);
          setIncoming((cur) => (cur?.callId === (payload as { callId: string }).callId ? null : cur));
        })
        .subscribe((status, err) => {
          console.log('[calls] user-calls inbox subscription status:', status, err ?? '');
        });

      // RLS-gated table subscription, not a private broadcast channel —
      // a structurally different delivery path from the one above, so a
      // problem with one doesn't take out the other.
      tableChannel = supabase
        .channel(`call-invites-inbox:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'call_invites', filter: `callee_id=eq.${userId}` },
          ({ new: row }) => {
            console.log('[calls] invite received via postgres_changes', row);
            if (inCallRef.current) return;
            setIncoming(rowToInvite(row as CallInviteRow));
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'call_invites', filter: `callee_id=eq.${userId}` },
          ({ new: row }) => {
            const r = row as CallInviteRow;
            if (r.status !== 'ringing') {
              setIncoming((cur) => (cur?.callId === r.call_id ? null : cur));
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[calls] call_invites table subscription status:', status, err ?? '');
        });
    })();

    // Covers the app being fully backgrounded/closed — the realtime
    // WebSocket dies with the suspended JS runtime, so only a real FCM
    // push can reach it (see lib/push.ts + supabase/functions/send-call-push).
    registerForCallPush(userId, history, () => { inCallRef.current = true; });

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      clearInterval(pollTimer);
      if (broadcastChannel) supabase.removeChannel(broadcastChannel);
      if (tableChannel) supabase.removeChannel(tableChannel);
    };
  }, [user?.id]);

  const startCall = ({ peerId, peerName, peerAvatar, conversationId, type }: StartCallArgs) => {
    const callId = crypto.randomUUID();
    inCallRef.current = true;
    history.push(`/calls/room/${callId}`, {
      role: 'caller',
      peerId,
      peerName,
      peerAvatar,
      conversationId,
      type,
    });
  };

  // Resets the "busy" flag CallScreen's finish() calls the moment a call
  // actually ends (hangup, decline, timeout, or connection failure) —
  // without this, it stayed stuck true forever after the first call.
  const endCall = () => {
    inCallRef.current = false;
  };

  const accept = async () => {
    if (!incoming) return;
    inCallRef.current = true;
    await supabase.from('call_invites').update({ status: 'accepted' }).eq('call_id', incoming.callId);
    history.push(`/calls/room/${incoming.callId}`, {
      role: 'callee',
      peerId: incoming.callerId,
      peerName: incoming.callerName,
      peerAvatar: incoming.callerAvatar,
      conversationId: incoming.conversationId,
      type: incoming.type,
    });
    setIncoming(null);
  };

  const decline = async () => {
    if (!incoming) return;
    await supabase.from('call_invites').update({ status: 'declined' }).eq('call_id', incoming.callId);
    await ensureRealtimeAuth();
    const ch = supabase.channel(`call:${incoming.callId}`, { config: { private: true } });
    await ch.subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'decline', payload: {} });
        setTimeout(() => supabase.removeChannel(ch), 300);
      }
    });
    await supabase.from('calls').insert({
      caller_id: incoming.callerId,
      callee_id: user!.id,
      status: 'declined',
      duration_seconds: 0,
      call_type: incoming.type,
    });
    setIncoming(null);
  };

  return (
    <CallContext.Provider value={{ startCall, endCall }}>
      {children}
      {incoming && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
            background: 'var(--ng-blue, #0a84ff)', color: '#fff',
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          }}
        >
          <IonIcon icon={incoming.type === 'video' ? videocam : call} style={{ fontSize: 22 }} />
          <div style={{ flex: 1, lineHeight: 1.2 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{incoming.callerName}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {tr('Incoming')} {incoming.type === 'video' ? tr('video') : tr('voice')} {tr('call…')}
            </div>
          </div>
          <button
            onClick={decline}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20,
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IonIcon icon={close} style={{ color: '#fff', fontSize: 18 }} />
          </button>
          <button
            onClick={accept}
            style={{
              background: '#2dd36f', border: 'none', borderRadius: 20,
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IonIcon icon={call} style={{ color: '#fff', fontSize: 18 }} />
          </button>
        </div>
      )}
    </CallContext.Provider>
  );
};

export const useCall = (): CallContextValue => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};