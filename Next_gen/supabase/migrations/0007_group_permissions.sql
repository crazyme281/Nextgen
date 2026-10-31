-- =========================================================================
-- Hello J — Group roles & permissions.
--
-- Adds: a per-participant role (admin/member), a group avatar/name that
-- admins can edit, and a group_permissions row per group controlling who
-- can edit settings / send messages / add members / invite via link, plus
-- an "approve new members" admin toggle. Mirrors the WhatsApp group-info
-- permission model.
-- =========================================================================

-- ---- Roles ----
alter table public.conversation_participants
  add column if not exists role text not null default 'member'
    check (role in ('admin', 'member'));

-- ---- Group avatar ----
alter table public.conversations
  add column if not exists avatar_url text;

-- Clients could previously select/insert conversations but never update one
-- (no UPDATE policy existed). Admins need this to set title/avatar_url.
create policy "group admins can update their group conversation"
  on public.conversations for update
  using (
    kind = 'group'
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
        and cp.role = 'admin'
    )
  );

-- ---- Group permissions ----
-- 'all' = every participant can do this, 'admins' = admins only.
-- Created before create_group_conversation() below since that function
-- inserts a default row here for every new group.
create table public.group_permissions (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  edit_settings text not null default 'admins' check (edit_settings in ('all', 'admins')),
  send_messages text not null default 'all' check (send_messages in ('all', 'admins')),
  add_members text not null default 'admins' check (add_members in ('all', 'admins')),
  invite_via_link text not null default 'admins' check (invite_via_link in ('all', 'admins')),
  approve_new_members boolean not null default false
);

alter table public.group_permissions enable row level security;

create policy "participants can view their group's permissions"
  on public.group_permissions for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = group_permissions.conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "admins can update their group's permissions"
  on public.group_permissions for update
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = group_permissions.conversation_id
        and cp.user_id = auth.uid()
        and cp.role = 'admin'
    )
  );

-- No client-facing insert policy: rows are created only by
-- create_group_conversation (SECURITY DEFINER) below.

-- ---- create_group_conversation: creator becomes admin, others members ----
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

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conversation_id, auth.uid(), 'admin');

  foreach v_member in array p_member_ids loop
    if v_member <> auth.uid() then
      insert into public.conversation_participants (conversation_id, user_id, role)
      values (v_conversation_id, v_member, 'member')
      on conflict do nothing;
    end if;
  end loop;

  insert into public.group_permissions (conversation_id) values (v_conversation_id);

  return v_conversation_id;
end;
$$;