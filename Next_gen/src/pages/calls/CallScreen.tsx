import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonContent, IonIcon, IonSpinner } from '@ionic/react';
import {
  call, mic, micOff, videocam, videocamOff, camera, personCircle,
} from 'ionicons/icons';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { supabase, ensureRealtimeAuth } from '@/lib/supabase';
import type { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { useAuth } from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import { createPeerConnection, getLocalStream } from '@/lib/webrtc';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

interface CallRouteState {
  role: 'caller' | 'callee';
  peerId: string;
  peerName: string;
  peerAvatar: string | null;
  conversationId: string;
  type: 'audio' | 'video';
}

type CallPhase = 'connecting' | 'ringing' | 'active' | 'ended';

// A push-notification-triggered answer needs real headroom: FCM delivery
// latency + the person noticing/unlocking + tapping + the app cold-
// starting from backgrounded/killed can easily eat 15-20+ seconds before
// CallScreen even mounts on the callee's side. 30s was cutting that too
// close — the caller was giving up right as the callee's app was still
// launching.
const RING_TIMEOUT_MS = 60000;
const CONNECT_TIMEOUT_MS = 30000;

const CallScreen: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const location = useLocation<CallRouteState>();
  const history = useHistory();
  const { user, profile } = useAuth();
  const { endCall } = useCall();
  const state = location.state;

  const [phase, setPhase] = useState<CallPhase>('connecting');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [endedReason, setEndedReason] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedOnceRef = useRef(false);
  const endedRef = useRef(false);
  // ICE candidates from the other side can (and, for the caller's very
  // first candidates, reliably will) arrive before this side has called
  // setRemoteDescription — addIceCandidate() before that point isn't
  // reliably queued on every Android WebView version, so queue them here
  // ourselves and flush once the remote description is actually set.
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = async (finalStatus: 'answered' | 'missed' | 'declined', reason?: string) => {
    if (endedRef.current) return;
    endedRef.current = true;
    endCall(); // release CallContext's inCallRef so future invites aren't ignored
    setEndedReason(reason ?? null);
    setPhase('ended');
    if (timerRef.current) clearInterval(timerRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);

    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    if (!state) return;

    // If we're the caller and the callee never answered, they haven't
    // joined `call:{callId}` — nothing on that channel reaches them. Clear
    // their still-ringing incoming banner directly, however we got here
    // (manual hang-up, the ring timing out, or the connection failing).
    if (state.role === 'caller' && !connectedOnceRef.current) {
      // Same restriction as the invite send above — the caller can't join
      // the callee's own private inbox channel directly, so this has to
      // go through the server too.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-call-signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ calleeId: state.peerId, event: 'cancel', payload: { callId } }),
        }).catch(() => {});
      }
    }
    // Both the caller's and callee's CallScreen instances call finish()
    // independently when a call ends (each side reacts to hangup/decline/
    // timeout on its own). Only the caller writes the call-log row and
    // the in-chat summary message — otherwise both sides would each
    // insert their own copy and you'd get duplicates of both.
    if (state.role === 'caller') {
      await supabase.from('calls').insert({
        caller_id: user!.id,
        callee_id: state.peerId,
        status: finalStatus,
        duration_seconds: connectedOnceRef.current ? seconds : 0,
        call_type: state.type,
      });

      // So the call actually shows up as something in the conversation —
      // not just a signaling event neither side can see afterwards.
      const icon = state.type === 'video' ? '🎥' : '📞';
      const label = state.type === 'video' ? 'Video call' : 'Voice call';
      const summary =
        finalStatus === 'answered'
          ? `${icon} ${label} · ${fmt(connectedOnceRef.current ? seconds : 0)}`
          : finalStatus === 'declined'
            ? `${icon} ${label} declined`
            : `${icon} Missed ${label.toLowerCase()}`;
      await supabase.from('messages').insert({
        conversation_id: state.conversationId,
        sender_id: user!.id,
        body: summary,
      });
    }

    setTimeout(() => history.replace(`/chats/room/${state.conversationId}`), 1200);
  };

  useEffect(() => {
    if (!state || !user) {
      history.replace('/tabs/chats');
      return;
    }

    let ringTimeout: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await getLocalStream(state.type);
      } catch {
        setEndedReason('Could not access camera/microphone.');
        setPhase('ended');
        setTimeout(() => history.replace(`/chats/room/${state.conversationId}`), 1800);
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams;
        if (state.type === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
      };

      const onLikelyConnected = () => {
        if (connectedOnceRef.current) return; // already handled
        connectedOnceRef.current = true;
        setPhase('active');
        if (ringTimeout) clearTimeout(ringTimeout);
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[calls] pc.connectionState:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          onLikelyConnected();
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          finish(connectedOnceRef.current ? 'answered' : 'missed', 'Connection failed');
        }
      };
      // connectionState (the aggregate state above) isn't implemented
      // consistently on every Android System WebView version — some only
      // ever report 'new'/'connecting' even once media is actually
      // flowing. iceConnectionState has been supported far longer and
      // more consistently, so treat either signal as "connected".
      pc.oniceconnectionstatechange = () => {
        console.log('[calls] pc.iceConnectionState:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          onLikelyConnected();
        } else if (pc.iceConnectionState === 'failed') {
          finish(connectedOnceRef.current ? 'answered' : 'missed', 'Connection failed');
        }
      };

      const channel = supabase.channel(`call:${callId}`, { config: { private: true } });
      channelRef.current = channel;
      await ensureRealtimeAuth();

      channel.on('broadcast', { event: 'ice' }, ({ payload }: { payload: { from: 'caller' | 'callee'; candidate: RTCIceCandidateInit } }) => {
        const from = payload.from as 'caller' | 'callee';
        if (from === state.role) return;
        const typeMatch = payload.candidate.candidate?.match(/typ (\w+)/);
        console.log('[calls] remote ICE candidate type:', typeMatch?.[1] ?? 'unknown');
        if (remoteDescSetRef.current) {
          pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        } else {
          pendingCandidatesRef.current.push(payload.candidate);
        }
      });

      const flushPendingCandidates = () => {
        remoteDescSetRef.current = true;
        pendingCandidatesRef.current.forEach((c) => {
          pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        });
        pendingCandidatesRef.current = [];
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          // typ host = same-network direct; typ srflx = STUN (public IP
          // discovered, still needs a compatible NAT); typ relay = TURN
          // (works through anything, but only if the relay is actually
          // reachable). If we only ever see "host"/"srflx" here and never
          // "relay", the TURN server isn't being reached at all — the
          // single most common reason two devices on different networks
          // can ring and reach "Connecting" but never actually connect.
          const typeMatch = ev.candidate.candidate.match(/typ (\w+)/);
          console.log('[calls] local ICE candidate type:', typeMatch?.[1] ?? 'unknown', ev.candidate.candidate);
          channel.send({ type: 'broadcast', event: 'ice', payload: { from: state.role, candidate: ev.candidate } });
        } else {
          console.log('[calls] local ICE candidate gathering complete');
        }
      };

      if (state.role === 'caller') {
        channel.on('broadcast', { event: 'accept' }, async () => {
          setPhase('connecting');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: offer } });
          // The callee accepted, so ringing is over — if we don't reach
          // "connected" within a reasonable window from here, something
          // (usually NAT traversal / TURN reachability) is actually wrong,
          // not just "still ringing". Fail clearly instead of spinning
          // forever.
          connectTimeoutRef.current = setTimeout(() => {
            if (!connectedOnceRef.current) finish('missed', 'Call failed to connect');
          }, CONNECT_TIMEOUT_MS);
        });
        channel.on('broadcast', { event: 'answer' }, async ({ payload }: { payload: { sdp: RTCSessionDescriptionInit } }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          flushPendingCandidates();
        });
        channel.on('broadcast', { event: 'decline' }, () => finish('declined'));
        channel.on('broadcast', { event: 'hangup' }, () => finish(connectedOnceRef.current ? 'answered' : 'missed'));

        channel.subscribe(async (status: REALTIME_SUBSCRIBE_STATES) => {
          if (status === 'SUBSCRIBED') {
            setPhase('ringing');
            // Delivering the invite by joining the callee's own
            // user-calls:{peerId} channel directly from this (the
            // caller's) client doesn't work: that channel is private and
            // locked to the callee only, so the caller's own join attempt
            // gets rejected before the broadcast ever goes out — silently,
            // with no client-visible error. Routed through send-call-signal
            // instead, which sends it server-side with the service role,
            // bypassing that restriction correctly.
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (token) {
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-call-signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  calleeId: state.peerId,
                  event: 'invite',
                  payload: {
                    callId, callerId: user.id, callerName: profile?.full_name ?? 'Unknown',
                    callerAvatar: profile?.avatar_url ?? null, conversationId: state.conversationId, type: state.type,
                  },
                }),
              }).catch(() => {});
            }

            // Realtime only reaches the callee while their app is
            // actively in the foreground — fire-and-forget a real push
            // too, so it also reaches them if backgrounded/closed. Never
            // block or fail the call over this; the in-app path above
            // is already sent regardless of whether this succeeds.
            if (token) {
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-call-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  callId,
                  calleeId: state.peerId,
                  conversationId: state.conversationId,
                  callType: state.type,
                  callerName: profile?.full_name ?? 'Unknown',
                  callerAvatar: profile?.avatar_url ?? null,
                }),
              }).catch(() => {}); // best-effort — realtime path already covers the foreground case
            }

            ringTimeout = setTimeout(() => finish('missed'), RING_TIMEOUT_MS);
          }
        });
      } else {
        channel.on('broadcast', { event: 'offer' }, async ({ payload }: { payload: { sdp: RTCSessionDescriptionInit } }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          flushPendingCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({ type: 'broadcast', event: 'answer', payload: { sdp: answer } });
          setPhase('connecting');
          connectTimeoutRef.current = setTimeout(() => {
            if (!connectedOnceRef.current) finish('missed', 'Call failed to connect');
          }, CONNECT_TIMEOUT_MS);
        });
        channel.on('broadcast', { event: 'hangup' }, () => finish(connectedOnceRef.current ? 'answered' : 'missed'));

        channel.subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
          if (status === 'SUBSCRIBED') {
            channel.send({ type: 'broadcast', event: 'accept', payload: {} });
          }
        });
      }
    })();

    return () => {
      if (ringTimeout) clearTimeout(ringTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  const hangUp = () => {
    channelRef.current?.send({ type: 'broadcast', event: 'hangup', payload: {} });
    finish(connectedOnceRef.current ? 'answered' : state?.role === 'caller' ? 'missed' : 'declined');
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted((m) => !m);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = videoOff; });
    setVideoOff((v) => !v);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!state) return null;

  return (
    <IonPage>
      <IonContent fullscreen style={{ '--background': '#111' } as React.CSSProperties}>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: '#fff' }}>
          {state.type === 'video' && phase !== 'ended' && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
            />
          )}
          <audio ref={remoteAudioRef} autoPlay />

          {(state.type === 'audio' || phase !== 'active') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <BrandMark size={32} />
              {state.peerAvatar ? (
                <img src={state.peerAvatar} alt="" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <IonIcon icon={personCircle} style={{ fontSize: 110, opacity: 0.8 }} />
              )}
              <div style={{ fontSize: 22, fontWeight: 700 }}>{state.peerName}</div>
              <div style={{ fontSize: 14, opacity: 0.75 }}>
                {phase === 'connecting' && <><IonSpinner name="dots" /> {tr('Connecting…')}</>}
                {phase === 'ringing' && (state.role === 'caller' ? tr('Ringing…') : tr('Calling…'))}
                {phase === 'active' && fmt(seconds)}
                {phase === 'ended' && (endedReason ?? tr('Call ended'))}
              </div>
            </div>
          )}

          {state.type === 'video' && phase === 'active' && !videoOff && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute', top: 16, right: 16, width: 100, height: 140, borderRadius: 12,
                objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', background: '#222',
              }}
            />
          )}

          {phase !== 'ended' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, padding: '24px 0 40px', zIndex: 2 }}>
              <button onClick={toggleMute} style={btnStyle(muted ? '#fff' : 'rgba(255,255,255,0.2)')}>
                <IonIcon icon={muted ? micOff : mic} style={{ fontSize: 22, color: muted ? '#111' : '#fff' }} />
              </button>
              {state.type === 'video' && (
                <button onClick={toggleVideo} style={btnStyle(videoOff ? '#fff' : 'rgba(255,255,255,0.2)')}>
                  <IonIcon icon={videoOff ? videocamOff : videocam} style={{ fontSize: 22, color: videoOff ? '#111' : '#fff' }} />
                </button>
              )}
              {state.type === 'video' && (
                <button style={btnStyle('rgba(255,255,255,0.2)')}>
                  <IonIcon icon={camera} style={{ fontSize: 22, color: '#fff' }} />
                </button>
              )}
              <button onClick={hangUp} style={btnStyle('#eb445a')}>
                <IonIcon icon={call} style={{ fontSize: 22, color: '#fff', transform: 'rotate(135deg)' }} />
              </button>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

const btnStyle = (bg: string): React.CSSProperties => ({
  width: 56, height: 56, borderRadius: '50%', border: 'none', background: bg,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
});

export default CallScreen;