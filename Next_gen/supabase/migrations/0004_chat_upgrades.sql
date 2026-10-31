-- =========================================================================
-- Hello J — Chat upgrades (WhatsApp-model): delivery/read receipts,
-- media messages, group creation, presence-ready realtime wiring.
--
-- Presence (online/last-seen) and typing indicators are deliberately NOT
-- modelled here — they're ephemeral and belong on Supabase Realtime's
-- Presence/Broadcast channels (see src/lib/presence.ts), not durable
-- tables. This mirrors how WhatsApp keeps that data off disk.
-- =========================================================================

-- ---- MESSAGE MEDIA ----
alter table public.messages
  add column if not exists media_type text
    check (media_type in ('image', 'video', 'audio', 'document'));

-- ---- MESSAGE RECEIPTS ----
-- One row per (message, other participant) so this works for groups too,
-- unlike a single status column on the message itself.
create table public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index message_receipts_user_idx on public.message_receipts (user_id);

-- Populate one pending receipt row per OTHER participant whenever a
-- message is inserted. Marked "delivered" immediately since Supabase
-- Realtime pushes to online clients right away; delivered_at is set at
-- insert time — read_at is set later, via mark_conversation_read.
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.message_receipts (message_id, user_id, delivered_at)
  select new.id, cp.user_id, now()
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id;
  return new;
end;
$$;

create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.handle_new_message();

-- mark_conversation_read (from 0001) already advances last_read_at.
-- Extend it to also stamp read_at on this viewer's receipt rows so
-- ChatRoom can render single/double/blue ticks per-message.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid();

  update public.message_receipts mr
  set read_at = now()
  from public.messages m
  where mr.message_id = m.id
    and m.conversation_id = p_conversation_id
    and mr.user_id = auth.uid()
    and mr.read_at is null;
end;
$$;

-- ---- GROUP CREATION ----
-- The schema (conversation_kind = 'group') already supported groups; there
-- was just no RPC to create one with an initial member list.
create or replace function public.create_group_conversation(p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_member uuid;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Group title is required';
  end if;
  if array_length(p_member_ids, 1) is null then
    raise exception 'A group needs at least one other member';
  end if;

  insert into public.conversations (kind, title, created_by)
  values ('group', trim(p_title), auth.uid())
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, auth.uid());

  foreach v_member in array p_member_ids loop
    if v_member <> auth.uid() then
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conversation_id, v_member)
      on conflict do nothing;
    end if;
  end loop;

  return v_conversation_id;
end;
$$;

-- View: group chats summary (parallel to conversation_summaries, which is
-- direct-only) so ChatsList can show a name + member count instead of a
-- single "other" participant.
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
  ) as unread_count
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
left join lateral (
  select body, media_type, created_at from public.messages m
  where m.conversation_id = c.id order by m.created_at desc limit 1
) lm on true
where c.kind = 'group';

-- ---- STORAGE: chat media bucket ----
-- Private bucket; access is via signed URLs, gated by RLS on storage.objects
-- so only conversation participants can read a given file. Path convention:
-- chat-media/<conversation_id>/<message-id-or-uuid>.<ext>
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

create policy "participants can read media in their conversations"
  on storage.objects for select
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.conversation_participants cp
      where cp.user_id = auth.uid()
        and cp.conversation_id::text = (storage.foldername(name))[1]
    )
  );

create policy "participants can upload media to their conversations"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.conversation_participants cp
      where cp.user_id = auth.uid()
        and cp.conversation_id::text = (storage.foldername(name))[1]
    )
  );

-- ---- RLS ----
alter table public.message_receipts enable row level security;

create policy "participants can view receipts for their conversations"
  on public.message_receipts for select
  using (
    exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_receipts.message_id and cp.user_id = auth.uid()
    )
  );

-- Clients never insert receipts directly (the trigger does it as the
-- message sender via SECURITY DEFINER); they only ever update their own
-- row's read_at, and only via mark_conversation_read (also SECURITY
-- DEFINER). No client-facing insert/update policy is needed as a result.

-- Realtime publication changes (message_receipts, conversations) live in
-- their own migration file (0005_chat_realtime.sql). ALTER PUBLICATION
-- statements take catalog locks that the Realtime service's own background
-- process also touches; bundled into a transaction with other DDL on the
-- same tables (the trigger on messages, the new column, etc.) this is a
-- reliable way to deadlock. Keep publication changes isolated and minimal.