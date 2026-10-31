-- Next Gen — AI assistant schema
--
-- Backs the ported Zorah frontend (the "AI" button on Chats). Deliberately
-- namespaced ai_* rather than reusing the existing `conversations` /
-- `messages` tables — those already mean "a chat between two people" and
-- have their own encryption/receipts/reactions machinery that has nothing
-- to do with talking to the AI backend. Mirrors Zorah's own schema
-- (projects / conversations / messages) column-for-column, just renamed
-- and pointed at this project's profiles table.

create table public.ai_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null default 'New Project',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  project_id uuid references public.ai_projects(id) on delete set null,
  title text not null default 'New Chat',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_projects_user_idx on public.ai_projects (user_id, updated_at desc);
create index ai_conversations_user_idx on public.ai_conversations (user_id, last_message_at desc nulls last, updated_at desc);
create index ai_conversations_project_idx on public.ai_conversations (project_id);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at asc);

create trigger ai_projects_set_updated_at before update on public.ai_projects
  for each row execute procedure public.set_updated_at();
create trigger ai_conversations_set_updated_at before update on public.ai_conversations
  for each row execute procedure public.set_updated_at();

-- Keeps the sidebar's "most recent chat first" ordering correct without
-- the client having to remember to also touch the parent conversation row
-- on every single message insert.
create or replace function public.ai_touch_conversation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.ai_conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

create trigger ai_messages_touch_conversation after insert on public.ai_messages
  for each row execute procedure public.ai_touch_conversation();

-- ---- RLS ----
alter table public.ai_projects enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy "users manage their own ai projects"
  on public.ai_projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage their own ai conversations"
  on public.ai_conversations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users manage their own ai messages"
  on public.ai_messages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- Storage ----
-- Public bucket (like story-media/avatars) rather than signed-URL private
-- (like chat-media) — these are images sent to the AI model, not private
-- person-to-person media, and a public URL is what the model/backend
-- fetches directly. Path convention: <user_id>/<image_id>.jpg
insert into storage.buckets (id, name, public)
values ('ai-attachments', 'ai-attachments', true)
on conflict (id) do nothing;

create policy "ai attachment images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'ai-attachments');

create policy "users can upload their own ai attachment images"
  on storage.objects for insert
  with check (
    bucket_id = 'ai-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own ai attachment images"
  on storage.objects for delete
  using (
    bucket_id = 'ai-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
