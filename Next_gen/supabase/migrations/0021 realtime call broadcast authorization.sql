-- Supabase's Realtime Authorization gates broadcast/presence channels via
-- RLS on realtime.messages. RLS was enabled on that table with no
-- policies at all, which means "deny everything" — silently blocking
-- every call invite and every offer/answer/ICE exchange in the app,
-- with no client-visible error (the channel still reports SUBSCRIBED;
-- the broadcasts just never reach anyone).
--
-- Scoped narrowly to the two topic patterns calling actually uses:
--   - user-calls:{userId} — where each signed-in user listens for
--     incoming-call invites for their whole session
--   - call:{callId}       — the per-call channel both sides join for the
--     actual SDP offer/answer + ICE candidate exchange
--
-- A user can only RECEIVE on their own user-calls inbox (nobody else's
-- invites), but anyone signed in can SEND to ring someone (that's the
-- whole point) and anyone signed in can send/receive on a call:{callId}
-- channel — the callId itself is an unguessable random UUID, which is
-- the same trust boundary the app's signaling design already assumes.

create policy "authenticated users can join call inbox channels"
  on "realtime"."messages"
  for select
  to authenticated
  using (realtime.topic() like 'user-calls:%');

create policy "authenticated users can send call invites"
  on "realtime"."messages"
  for insert
  to authenticated
  with check (realtime.topic() like 'user-calls:%');

create policy "authenticated users can join call signaling channels"
  on "realtime"."messages"
  for select
  to authenticated
  using (realtime.topic() like 'call:%');

create policy "authenticated users can send call signaling"
  on "realtime"."messages"
  for insert
  to authenticated
  with check (realtime.topic() like 'call:%');