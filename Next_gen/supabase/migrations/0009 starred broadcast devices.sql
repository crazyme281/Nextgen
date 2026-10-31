-- =========================================================================
-- Starred messages, broadcast lists (kept separate from groups), and
-- linked-device metadata for the Chats overflow menu.
-- =========================================================================

-- ---- STARRED MESSAGES (per-user; a user starring a message never affects
--      what anyone else sees) ----
create table public.starred_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);
create index starred_messages_user_idx on public.starred_messages (user_id, created_at desc);

alter table public.starred_messages enable row level security;

create policy "users manage their own starred messages"
  on public.starred_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Joins a starred row with its message + conversation context for the
-- Starred screen. security_invoker means the underlying RLS on messages/
-- conversations still applies — a starred_messages row pointing at a
-- message the user can no longer see (e.g. removed from the conversation)
-- simply won't surface here.
create or replace view public.starred_messages_view as
select
  sm.id as starred_id,
  sm.user_id,
  sm.created_at as starred_at,
  m.id as message_id,
  m.conversation_id,
  m.body,
  m.media_url,
  m.media_type,
  m.created_at as message_created_at,
  m.sender_id,
  sender.full_name as sender_full_name,
  sender.avatar_url as sender_avatar_url,
  coalesce(c.title, peer.full_name, 'Conversation') as conversation_title
from public.starred_messages sm
join public.messages m on m.id = sm.message_id
join public.profiles sender on sender.id = m.sender_id
join public.conversations c on c.id = m.conversation_id
left join public.conversation_participants peer_cp
  on peer_cp.conversation_id = c.id and peer_cp.user_id <> sm.user_id and c.kind = 'direct'
left join public.profiles peer on peer.id = peer_cp.user_id;

alter view public.starred_messages_view set (security_invoker = true);

-- ---- BROADCAST LISTS (NOT a group — messages fan out as individual,
--      private 1:1 messages; recipients never see each other) ----
create table public.broadcast_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index broadcast_lists_owner_idx on public.broadcast_lists (owner_id);

create table public.broadcast_list_members (
  broadcast_list_id uuid not null references public.broadcast_lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (broadcast_list_id, user_id)
);

alter table public.broadcast_lists enable row level security;
alter table public.broadcast_list_members enable row level security;

create policy "owners manage their own broadcast lists"
  on public.broadcast_lists for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners manage their own broadcast list members"
  on public.broadcast_list_members for all
  using (exists (select 1 from public.broadcast_lists bl where bl.id = broadcast_list_id and bl.owner_id = auth.uid()))
  with check (exists (select 1 from public.broadcast_lists bl where bl.id = broadcast_list_id and bl.owner_id = auth.uid()));

-- ---- LINKED DEVICES: push_tokens already models "a device this account
--      is registered on"; add the columns a real device-list UI needs. ----
alter table public.push_tokens add column if not exists device_label text;
alter table public.push_tokens add column if not exists last_seen_at timestamptz not null default now();