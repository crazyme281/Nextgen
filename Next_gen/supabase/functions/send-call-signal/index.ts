// supabase/functions/send-call-signal/index.ts
//
// Writes a persisted call_invites row (the reliable, queryable path —
// see migration 0028) AND broadcasts on the callee's user-calls:{id}
// private channel (the instant-delivery path while they're actively
// subscribed). Broadcast alone has no delivery guarantee if the client
// wasn't subscribed at the exact moment it was sent, and no way to catch
// up afterward — the persisted row fixes that: the app can just query
// for it directly on load/resume, not only react to a live event.
//
// CORS: a browser sends an OPTIONS preflight before any cross-origin
// POST with a JSON body + Authorization header. Handled explicitly below
// — without it, the preflight itself gets rejected and the browser never
// sends the real POST at all.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

interface SignalPayload {
  calleeId: string;
  event: 'invite' | 'cancel';
  payload: {
    callId: string;
    callerId?: string;
    callerName?: string;
    callerAvatar?: string | null;
    conversationId?: string;
    type?: 'audio' | 'video';
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseAsUser.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: jsonHeaders });
  }

  try {
    const body: SignalPayload = await req.json();
    if (!body.calleeId || !body.event || !body.payload?.callId) {
      return new Response(JSON.stringify({ error: 'missing calleeId, event, or payload.callId' }), { status: 400, headers: jsonHeaders });
    }

    if (body.event === 'invite') {
      const { callId, callerName, callerAvatar, conversationId, type } = body.payload;
      if (!conversationId || !type) {
        return new Response(JSON.stringify({ error: 'invite payload requires conversationId and type' }), { status: 400, headers: jsonHeaders });
      }
      const { error: insertErr } = await supabaseAdmin.from('call_invites').insert({
        call_id: callId,
        caller_id: userData.user.id,
        callee_id: body.calleeId,
        caller_name: callerName ?? null,
        caller_avatar: callerAvatar ?? null,
        conversation_id: conversationId,
        call_type: type,
      });
      if (insertErr) {
        console.error('call_invites insert failed', insertErr);
        // Don't abort the whole call over this — still attempt the
        // realtime broadcast below, which may still get through.
      }
    } else if (body.event === 'cancel') {
      await supabaseAdmin
        .from('call_invites')
        .update({ status: 'cancelled' })
        .eq('call_id', body.payload.callId)
        .eq('status', 'ringing');
    }

    // Best-effort instant delivery on top of the persisted row above —
    // if the callee's client is actively subscribed right now, this
    // reaches them immediately instead of waiting for their next poll.
    const channel = supabaseAdmin.channel(`user-calls:${body.calleeId}`, { config: { private: true } });
    const joined = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });
    if (joined) {
      await channel.send({ type: 'broadcast', event: body.event, payload: body.payload });
    }
    setTimeout(() => supabaseAdmin.removeChannel(channel), 1000);

    return new Response(JSON.stringify({ ok: true, broadcastDelivered: joined }), { headers: jsonHeaders });
  } catch (e) {
    console.error('send-call-signal error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: jsonHeaders });
  }
});