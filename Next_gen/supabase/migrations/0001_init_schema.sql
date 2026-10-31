-- =========================================================================
-- Hello J — Initial schema (v1)
-- Frontend: Ionic React  |  Backend/Auth/DB: Supabase (PostgreSQL)
-- =========================================================================
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- =========================================================================
-- ENUM TYPES
-- =========================================================================
create type trust_level as enum ('unverified', 'verified_identity', 'verified_business', 'high_assurance', 'risk_detected');
create type account_type as enum ('individual', 'business', 'admin');
create type call_direction as enum ('incoming', 'outgoing');
create type call_status as enum ('answered', 'missed', 'declined');
create type wallet_tx_type as enum ('credit', 'debit');
create type order_status as enum ('pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded');
create type conversation_kind as enum ('direct', 'group');

-- =========================================================================
-- PROFILES  (1:1 with auth.users)
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  phone text unique,
  avatar_url text,
  bio text,
  account_type account_type not null default 'individual',
  trust_level trust_level not null default 'unverified',
  is_online boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_phone_idx on public.profiles (phone);
create index profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);
create index profiles_full_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id, currency)
  values (new.id, 'NGN')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- J VERIFY — identity verification requests (drives profiles.trust_level)
-- =========================================================================
create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,           -- e.g. 'nin', 'bvn', 'passport', 'cac' (business)
  document_ref text,                     -- external reference/number (store hashed/tokenised, not raw)
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index identity_verifications_user_idx on public.identity_verifications (user_id);

-- =========================================================================
-- CONTACTS  (Hello J address book — asymmetric, like a phone contact list)
-- =========================================================================
create table public.contacts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_user_id),
  check (owner_id <> contact_user_id)
);

-- =========================================================================
-- CONVERSATIONS / PARTICIPANTS / MESSAGES  (Chats — realtime)
-- =========================================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind conversation_kind not null default 'direct',
  title text,                             -- used for group chats
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text,
  media_url text,
  reply_to_id uuid references public.messages(id),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- Ensures a 1:1 direct conversation is reused instead of duplicated.
create or replace function public.get_or_create_direct_conversation(p_user_a uuid, p_user_b uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  select cp1.conversation_id into v_conversation_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2 on cp1.conversation_id = cp2.conversation_id
  join public.conversations c on c.id = cp1.conversation_id
  where c.kind = 'direct' and cp1.user_id = p_user_a and cp2.user_id = p_user_b
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (kind, created_by) values ('direct', p_user_a)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, p_user_a), (v_conversation_id, p_user_b);

  return v_conversation_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid();
$$;

create or replace function public.add_contact_by_phone(p_owner_id uuid, p_phone text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_target uuid;
begin
  select id into v_target from public.profiles where phone = p_phone;
  if v_target is null then
    raise exception 'No Hello J user found with that phone number';
  end if;
  insert into public.contacts (owner_id, contact_user_id)
  values (p_owner_id, v_target)
  on conflict do nothing;
end;
$$;

-- View: chats list with the other participant + last message + unread count
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
  ) as unread_count
from public.conversations c
join public.conversation_participants cp on cp.conversation_id = c.id
join public.conversation_participants other_cp on other_cp.conversation_id = c.id and other_cp.user_id <> cp.user_id
join public.profiles other on other.id = other_cp.user_id
left join lateral (
  select body, created_at from public.messages m
  where m.conversation_id = c.id order by m.created_at desc limit 1
) lm on true
where c.kind = 'direct';

-- View: contacts with profile + trust info
create or replace view public.contacts_view as
select
  ct.owner_id,
  ct.contact_user_id,
  coalesce(ct.display_name, p.full_name) as full_name,
  p.avatar_url,
  p.trust_level,
  p.phone
from public.contacts ct
join public.profiles p on p.id = ct.contact_user_id
where ct.is_blocked = false;

-- =========================================================================
-- CALLS
-- =========================================================================
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id),
  callee_id uuid not null references public.profiles(id),
  status call_status not null,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);
create index calls_caller_idx on public.calls (caller_id, created_at desc);
create index calls_callee_idx on public.calls (callee_id, created_at desc);

create or replace view public.call_log_view as
select
  cl.id,
  case when cl.caller_id = auth.uid() then cl.callee_id else cl.caller_id end as peer_id,
  p.full_name as peer_full_name,
  p.avatar_url as peer_avatar_url,
  case when cl.caller_id = auth.uid() then 'outgoing' else 'incoming' end::call_direction as direction,
  cl.status,
  cl.duration_seconds,
  cl.created_at,
  auth.uid() as viewer_id
from public.calls cl
join public.profiles p on p.id = case when cl.caller_id = auth.uid() then cl.callee_id else cl.caller_id end
where cl.caller_id = auth.uid() or cl.callee_id = auth.uid();

-- =========================================================================
-- J PAY — wallets & transactions
-- =========================================================================
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance_minor bigint not null default 0,   -- amount in minor units (kobo)
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  counterparty_id uuid references public.profiles(id),
  type wallet_tx_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN',
  description text,
  reference text unique,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);

-- Atomic peer-to-peer transfer (call via RPC from the client / an edge function).
create or replace function public.transfer_funds(p_from uuid, p_to uuid, p_amount_minor bigint, p_description text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ref uuid := gen_random_uuid();
begin
  if p_amount_minor <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update public.wallets set balance_minor = balance_minor - p_amount_minor
  where user_id = p_from and balance_minor >= p_amount_minor;
  if not found then
    raise exception 'Insufficient balance';
  end if;

  update public.wallets set balance_minor = balance_minor + p_amount_minor
  where user_id = p_to;

  insert into public.wallet_transactions (user_id, counterparty_id, type, amount_minor, description, reference)
  values (p_from, p_to, 'debit', p_amount_minor, p_description, v_ref::text);
  insert into public.wallet_transactions (user_id, counterparty_id, type, amount_minor, description, reference)
  values (p_to, p_from, 'credit', p_amount_minor, p_description, v_ref::text || '-credit');
end;
$$;

-- =========================================================================
-- J MARKET — products & orders
-- =========================================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  title text not null,
  description text,
  price_minor bigint not null check (price_minor >= 0),
  currency text not null default 'NGN',
  image_url text,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_seller_idx on public.products (seller_id);
create index products_active_idx on public.products (is_active, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  amount_minor bigint not null,
  currency text not null default 'NGN',
  status order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);

-- =========================================================================
-- J LIVE — feed posts
-- =========================================================================
create table public.live_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  body text,
  media_url text,
  created_at timestamptz not null default now()
);
create index live_posts_created_idx on public.live_posts (created_at desc);

create or replace view public.live_feed_view as
select
  lp.id, lp.body, lp.media_url, lp.created_at,
  p.id as author_id, p.full_name as author_full_name,
  p.avatar_url as author_avatar_url, p.trust_level as author_trust_level
from public.live_posts lp
join public.profiles p on p.id = lp.author_id;

-- =========================================================================
-- NOTIFICATIONS (device push tokens, for Capacitor Push Notifications)
-- =========================================================================
create table public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android','ios','web')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- =========================================================================
-- updated_at helper trigger
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute procedure public.set_updated_at();

-- =========================================================================
-- REALTIME
-- =========================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.live_posts;
alter publication supabase_realtime add table public.calls;
