-- =========================================================================
-- Hello J — Payments funding layer (Moniepoint/OPay-style virtual accounts)
-- Lets real naira enter a wallet via a dedicated bank account number,
-- funded through a licensed processor (Paystack / Flutterwave) instead of
-- Hello J holding a banking license directly.
-- =========================================================================

-- ---- VIRTUAL ACCOUNTS ----
-- One dedicated bank account number per user, issued by the payment
-- processor. A transfer to this account triggers a webhook that credits
-- the wallet — this is the actual mechanism behind Moniepoint/OPay top-ups.
create table public.virtual_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('paystack', 'flutterwave')),
  account_number text not null,
  bank_name text not null,
  account_name text not null,
  provider_customer_id text,
  provider_account_id text,
  created_at timestamptz not null default now()
);

-- ---- WEBHOOK EVENT LEDGER ----
-- Every inbound processor callback is recorded here first, keyed on the
-- provider's own event id, so a retried/duplicated webhook can never
-- double-credit a wallet. The edge function inserts a row before crediting;
-- the unique constraint is the idempotency guard.
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- ---- SAVED CARDS ----
-- Only ever store a processor token/reference. Raw PAN/CVV must never
-- touch Hello J's own client or server — card capture happens on the
-- processor's hosted field/checkout, which returns a token.
create table public.saved_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_token text not null,   -- e.g. Paystack authorization_code
  last4 text not null,
  brand text,
  exp_month text,
  exp_year text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---- TRANSACTION PIN ----
-- A second factor required before money moves (transfer_funds / checkout_order),
-- separate from the login password — mirrors every Nigerian fintech's flow.
alter table public.profiles add column if not exists transaction_pin_hash text;

-- =========================================================================
-- credit_wallet_from_webhook — the ONLY way a top-up reaches a wallet.
-- Called exclusively by the payment-webhook edge function using the
-- service role key; never exposed to the anon/client role.
-- =========================================================================
create or replace function public.credit_wallet_from_webhook(
  p_user_id uuid,
  p_amount_minor bigint,
  p_provider_ref text,
  p_description text default 'Wallet top-up'
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_amount_minor <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- reference is unique, so replaying the same webhook is a no-op, not a double credit
  if exists (select 1 from public.wallet_transactions where reference = p_provider_ref) then
    return;
  end if;

  update public.wallets
    set balance_minor = balance_minor + p_amount_minor
    where user_id = p_user_id;
  if not found then
    raise exception 'No wallet for user %', p_user_id;
  end if;

  insert into public.wallet_transactions (user_id, type, amount_minor, description, reference)
  values (p_user_id, 'credit', p_amount_minor, p_description, p_provider_ref);
end;
$$;

-- =========================================================================
-- set_transaction_pin / verify_transaction_pin
-- =========================================================================
-- crypt()/gen_salt() live in the "extensions" schema on Supabase by default,
-- so search_path must include it (and we schema-qualify the calls too, in
-- case pgcrypto ends up somewhere else on a given project).
create extension if not exists "pgcrypto" schema extensions;

create or replace function public.set_transaction_pin(p_pin text)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if length(p_pin) <> 4 or p_pin !~ '^[0-9]+$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  update public.profiles set transaction_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
    where id = auth.uid();
end;
$$;

create or replace function public.verify_transaction_pin(p_pin text)
returns boolean
language sql
security definer set search_path = public, extensions
as $$
  select coalesce(
    (select transaction_pin_hash = extensions.crypt(p_pin, transaction_pin_hash) from public.profiles where id = auth.uid()),
    false
  );
$$;

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.virtual_accounts enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.saved_cards enable row level security;

create policy "users can view their own virtual account"
  on public.virtual_accounts for select using (auth.uid() = user_id);
-- inserts only ever happen via the service-role key (edge function), no client insert policy.

create policy "users can view their own saved cards"
  on public.saved_cards for select using (auth.uid() = user_id);
create policy "users can delete their own saved cards"
  on public.saved_cards for delete using (auth.uid() = user_id);
-- card insert also happens via a server-side function after processor tokenisation.

-- payment_webhook_events has no client policies at all — service role only,
-- RLS enabled with zero policies means it's fully locked to anon/authenticated.