import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/lib/supabase';

/**
 * Registers this device for push notifications and saves the resulting
 * FCM token to `push_tokens`, so the send-call-push edge function has
 * somewhere to deliver an incoming-call notification when the app isn't
 * in the foreground (realtime broadcast alone can't reach a suspended
 * WebSocket connection — see CallContext.tsx / CallScreen.tsx for the
 * foreground-only signaling path this complements).
 *
 * Call once per app session after the user is signed in (see App.tsx).
 * No-ops on web — there's no FCM story here without a service worker +
 * VAPID setup, which is out of scope for now; web users still get the
 * in-app banner via realtime when the tab is open.
 */
export async function registerForCallPush(
  userId: string,
  history: { push: (path: string, state?: unknown) => void },
  onAccepting: () => void
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive !== 'granted') {
    const requested = await PushNotifications.requestPermissions();
    if (requested.receive !== 'granted') return; // user said no — nothing more to do
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token: token.value,
        platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to save push token:', error.message);
    }
  });

  PushNotifications.addListener('registrationError', (err) => {
    // eslint-disable-next-line no-console
    console.warn('Push registration failed:', err);
  });

  // Data payload set by the send-call-push edge function (see
  // supabase/functions/send-call-push). Kept as a fallback for older app
  // builds still running the previous version of this code — the current
  // build sends this as a data-only FCM message and builds its own
  // notification natively (see CallMessagingService.java), so this
  // Capacitor-level event generally won't fire for calls anymore; the
  // 'nextgenIncomingCallAnswer' listener below is the live path.
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    const data = action.notification.data as Record<string, string> | undefined;
    if (data?.type === 'incoming_call' && data.callId && data.conversationId && data.callerId) {
      // Matches what CallContext's own accept() does before navigating —
      // without this, inCallRef never got set on this path, so a second
      // simultaneous invite wouldn't correctly get ignored.
      onAccepting();
      history.push(`/calls/room/${data.callId}`, {
        role: 'callee',
        peerId: data.callerId,
        peerName: data.callerName ?? 'Unknown',
        peerAvatar: data.callerAvatar ?? null,
        conversationId: data.conversationId,
        type: data.callType === 'video' ? 'video' : 'audio',
      });
    }
  });

  // Fired by MainActivity.java when someone taps "Answer" on the native
  // incoming-call notification built by CallMessagingService.java —
  // including from a cold start, where the app wasn't running at all
  // when the call came in. Mirrors the accept() flow exactly.
  window.addEventListener('nextgenIncomingCallAnswer', (event) => {
    const detail = (event as CustomEvent).detail as Record<string, string> | undefined;
    if (!detail?.callId || !detail?.conversationId || !detail?.callerId) return;
    onAccepting();
    history.push(`/calls/room/${detail.callId}`, {
      role: 'callee',
      peerId: detail.callerId,
      peerName: detail.callerName || 'Unknown',
      peerAvatar: detail.callerAvatar || null,
      conversationId: detail.conversationId,
      type: detail.callType === 'video' ? 'video' : 'audio',
    });
  });

  // If a push arrives while the app is already in the foreground, Android
  // suppresses the system notification banner by default — that's correct
  // here, since the realtime in-app banner is already showing.
  PushNotifications.addListener('pushNotificationReceived', (_notification: PushNotificationSchema) => {
    // Intentionally no-op: foreground delivery is handled by the realtime
    // 'invite' broadcast in CallContext.tsx, not by this push.
  });
}