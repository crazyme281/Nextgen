/**
 * Minimal WebRTC helper for 1:1 audio/video calls.
 *
 * Signaling (offer/answer/ICE candidates, invite/accept/decline/hangup) is
 * carried over Supabase Realtime Broadcast channels — no signaling server
 * or extra infra needed. Two channel "namespaces" are used:
 *
 *  - `user-calls:{userId}` — a channel each signed-in user subscribes to
 *    for their whole session (see CallContext). Used only to deliver the
 *    initial "invite" to a callee who hasn't joined a per-call channel yet.
 *  - `call:{callId}` — created per call, joined by both caller and callee,
 *    carries the actual SDP offer/answer and ICE candidates plus
 *    accept/decline/hangup signals.
 *
 * Uses public STUN plus a free demo TURN relay (Metered's openrelay
 * service) as a fallback for peers behind restrictive/symmetric NATs,
 * where STUN alone can't establish a direct path. The demo TURN
 * credentials are publicly published by Metered for testing
 * (https://www.metered.ca/tools/openrelay/) — they're not private to
 * this app, aren't rate-limit-guaranteed, and shouldn't be relied on for
 * production traffic at scale. For production, sign up for your own
 * TURN credentials (Metered, Twilio, or self-hosted coturn) and swap
 * them in below — same shape, just your own username/credential.
 */

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(ICE_SERVERS);
}

export async function getLocalStream(type: 'audio' | 'video'): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video' ? { facingMode: 'user' } : false,
  });
}

export interface CallInvite {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  conversationId: string;
  type: 'audio' | 'video';
}