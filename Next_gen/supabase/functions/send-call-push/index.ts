// supabase/functions/send-call-push/index.ts
//
// Deploy:  supabase functions deploy send-call-push
// Secrets: supabase secrets set FIREBASE_SERVICE_ACCOUNT='<paste the full
//          contents of the service-account JSON file Firebase gives you>'
//
// Called BY THE CLIENT (jwt-verified) the moment a call is placed, right
// alongside the existing realtime 'invite' broadcast in CallScreen.tsx.
// The realtime broadcast only reaches the callee while their app is
// actively running in the foreground; this reaches them via a real
// system push even if the app is backgrounded or fully closed — Android
// suspends the WebSocket the moment the app isn't foregrounded, so
// there's no other way to wake it.
//
// Uses FCM's HTTP v1 API directly via a service-account-signed JWT
// (Google's documented server-to-server auth flow) rather than pulling in
// the full firebase-admin SDK, which isn't published for Deno.
//
// CORS: a browser sends an OPTIONS preflight before any cross-origin
// POST with a JSON body + Authorization header. This now handles that
// explicitly — without it, the preflight itself was rejected and the
// browser never sent the real POST at all.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIREBASE_SERVICE_ACCOUNT_RAW = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

// Google's documented service-account JWT bearer flow for a short-lived
// OAuth2 access token — this is what firebase-admin does under the hood.
async function getFcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  if (!FIREBASE_SERVICE_ACCOUNT_RAW) {
    return new Response(
      JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT secret is not configured yet — call still rings via realtime for foregrounded apps.' }),
      { status: 501, headers: jsonHeaders }
    );
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseAsUser.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: jsonHeaders });
  }
  // The caller's identity comes from their verified JWT, never from the
  // request body — otherwise anyone could spoof a push claiming to be a
  // call from someone else.
  const callerId = userData.user.id;

  const { callId, calleeId, conversationId, callType, callerName, callerAvatar } = await req.json();
  if (!callId || !calleeId || !conversationId || !callType) {
    return new Response(JSON.stringify({ error: 'callId, calleeId, conversationId, callType are required' }), { status: 400, headers: jsonHeaders });
  }

  const { data: tokens, error: tokensErr } = await supabaseAdmin
    .from('push_tokens')
    .select('token, platform')
    .eq('user_id', calleeId);
  if (tokensErr) {
    return new Response(JSON.stringify({ error: tokensErr.message }), { status: 500, headers: jsonHeaders });
  }
  if (!tokens || tokens.length === 0) {
    // Not an error — the callee may just never have opened the app on a
    // device with push registered yet. Realtime already covers them if
    // they're online right now.
    return new Response(JSON.stringify({ sent: 0, reason: 'no registered devices' }), { status: 200, headers: jsonHeaders });
  }

  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_RAW) as ServiceAccount;
  const accessToken = await getFcmAccessToken(serviceAccount);

  const staleTokens: string[] = [];
  let sent = 0;

  await Promise.all(
    tokens.map(async (row) => {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token: row.token,
              // Deliberately data-only — NO `notification` block. If one
              // is present, Android auto-displays a plain system
              // notification itself whenever the app isn't foregrounded,
              // bypassing our own code entirely (and any custom
              // Answer/Decline actions with it). A data-only message
              // always reaches CallMessagingService.onMessageReceived on
              // the device, in every app state (foreground, background,
              // or fully killed), which is what lets it build the real
              // incoming-call notification with actions instead.
              data: {
                type: 'incoming_call',
                callId,
                conversationId,
                callerId,
                callerName: callerName ?? '',
                callerAvatar: callerAvatar ?? '',
                callType,
              },
              android: {
                priority: 'high',
              },
            },
          }),
        }
      );
      if (res.ok) {
        sent += 1;
      } else {
        const body = await res.json().catch(() => ({}));
        if (body?.error?.status === 'UNREGISTERED' || body?.error?.status === 'INVALID_ARGUMENT') {
          staleTokens.push(row.token);
        }
      }
    })
  );

  if (staleTokens.length > 0) {
    await supabaseAdmin.from('push_tokens').delete().eq('user_id', calleeId).in('token', staleTokens);
  }

  return new Response(JSON.stringify({ sent, staleRemoved: staleTokens.length }), {
    status: 200,
    headers: jsonHeaders,
  });
});