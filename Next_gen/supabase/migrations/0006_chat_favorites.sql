-- =========================================================================
-- Hello J — Favorite conversations.
--
-- Favoriting is personal (like starring an email), not shared across
-- participants, so it lives on conversation_participants — one row per
-- (conversation, user) already exists there.
-- =========================================================================
alter table public.conversation_participants
  add column if not exists is_favorite boolean not null default false;

-- No new RPC needed: "users can update their own participant row" (0002)
-- already covers this column — the client can toggle it directly with
-- .update({ is_favorite }) filtered to conversation_id + user_id = auth.uid().

-- ---- Recreate views to surface is_favorite for the viewer ----
create or replace view public.conversation_summaries as
select
  cp.user_id as viewer_id,
  c.id as conversation_id,
  other.id as other_user_id,
  other.full_name as other_full_name,
  other.avatar_url as other_avatar_url,
  other.trust_level as other_trust_level,
  lm.body as last_message,
  lm.created_at as last_message_at,
  (
    select count(*) from public.messages m
    where m.conversation_id = c.id and m.created_at > cp.last_read_at and m.sender_id <> cp.user_id
  ) as unread_count,
  cp.is_favorite
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
join public.conversation_participants other_cp on other_cp.conversation_id = c.id and other_cp.user_id <> cp.user_id
join public.profiles other on other.id = other_cp.user_id
left join lateral (
  select body, created_at from public.messages m
  where m.conversation_id = c.id order by m.created_at desc limit 1
) lm on true
where c.kind = 'direct';

create or replace view public.group_conversation_summaries as
select
  cp.user_id as viewer_id,
  c.id as conversation_id,
  c.title,
  (
    select count(*) from public.conversation_participants cp2
    where cp2.conversation_id = c.id
  ) as member_count,
  lm.body as last_message,
  lm.media_type as last_message_media_type,
  lm.created_at as last_message_at,
  (
    select count(*) from public.messages m
    where m.conversation_id = c.id and m.created_at > cp.last_read_at and m.sender_id <> cp.user_id
  ) as unread_count,
  cp.is_favorite
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
left join lateral (
  select body, media_type, created_at from public.messages m
  where m.conversation_id = c.id order by m.created_at desc limit 1
) lm on true
where c.kind = 'group';