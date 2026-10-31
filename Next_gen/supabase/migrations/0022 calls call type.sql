-- Documents a change that was already made directly on the live database
-- (call_type already exists on both public.calls and call_log_view) but
-- was never captured as a local migration file until now. Written as
-- idempotent so it's safe to run even though the live DB already has it.

alter table public.calls add column if not exists call_type text not null default 'audio' check (call_type in ('audio', 'video'));

create or replace view public.call_log_view as
select
  cl.id,
  case when cl.caller_id = auth.uid() then cl.callee_id else cl.caller_id end as peer_id,
  p.full_name as peer_full_name,
  p.avatar_url as peer_avatar_url,
  p.trust_level as peer_trust_level,
  case when cl.caller_id = auth.uid() then 'outgoing' else 'incoming' end::call_direction as direction,
  cl.status,
  cl.call_type,
  cl.duration_seconds,
  cl.created_at,
  auth.uid() as viewer_id
from public.calls cl
join public.profiles p on p.id = case when cl.caller_id = auth.uid() then cl.callee_id else cl.caller_id end
where cl.caller_id = auth.uid() or cl.callee_id = auth.uid();