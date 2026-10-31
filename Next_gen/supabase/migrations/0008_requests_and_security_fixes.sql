-- =========================================================================
-- Security fix + Request Money feature
-- =========================================================================

-- ---- SECURITY FIX: transfer_funds had no caller check ----
-- As originally written, ANY authenticated user could call
-- transfer_funds(p_from = someone_else's_id, p_to = themselves, ...) and
-- drain an arbitrary wallet, because the function only checked balance,
-- never who was calling it. Re-create it requiring the caller to BE the
-- sender.
create or replace function public.transfer_funds(p_from uuid, p_to uuid, p_amount_minor bigint, p_description text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ref uuid := gen_random_uuid();
begin
  if auth.uid() is null or auth.uid() <> p_from then
    raise exception 'Not authorized to move funds from that wallet';
  end if;

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

-- ---- SECURITY FIX: credit_wallet_from_webhook must be server-only ----
-- This function has no auth.uid() check by design — it's meant to be
-- called exclusively by trusted server code (edge functions using the
-- service_role key) after independently verifying a real payment with the
-- processor. It must NEVER be callable by a logged-in user's own session,
-- or anyone could credit their own wallet for free.
revoke execute on function public.credit_wallet_from_webhook(uuid, bigint, text, text) from public;
revoke execute on function public.credit_wallet_from_webhook(uuid, bigint, text, text) from authenticated;
revoke execute on function public.credit_wallet_from_webhook(uuid, bigint, text, text) from anon;
-- service_role bypasses grants entirely (it's the Postgres superuser-like
-- role Supabase uses for the service key), so no explicit grant is needed —
-- this revoke is what actually closes the hole.

-- =========================================================================
-- PAYMENT REQUESTS ("Request" — ask a contact to pay you)
-- =========================================================================
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,  -- person asking to be paid
  payee_id uuid not null references public.profiles(id) on delete cascade,      -- person being asked to pay
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN',
  description text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (requester_id <> payee_id)
);
create index payment_requests_requester_idx on public.payment_requests (requester_id, created_at desc);
create index payment_requests_payee_idx on public.payment_requests (payee_id, created_at desc);

alter table public.payment_requests enable row level security;

create policy "either party can view a payment request"
  on public.payment_requests for select
  using (auth.uid() = requester_id or auth.uid() = payee_id);

create policy "a user can request money for themselves"
  on public.payment_requests for insert
  with check (auth.uid() = requester_id);

create policy "the requester can cancel their own pending request"
  on public.payment_requests for update
  using (auth.uid() = requester_id and status = 'pending')
  with check (status = 'cancelled');

alter publication supabase_realtime add table public.payment_requests;

-- Fulfilling a request moves real money, so it goes through an RPC (same
-- escrow/atomicity pattern as checkout_order) rather than a client update.
create or replace function public.fulfill_payment_request(p_request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_req record;
begin
  select * into v_req from public.payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'This request has already been resolved';
  end if;
  if auth.uid() <> v_req.payee_id then
    raise exception 'Not authorized to fulfill this request';
  end if;

  -- transfer_funds re-checks auth.uid() = p_from itself; payee (the payer here) is the caller, so it matches.
  perform public.transfer_funds(v_req.payee_id, v_req.requester_id, v_req.amount_minor, coalesce(v_req.description, 'Payment request'));

  update public.payment_requests set status = 'paid', resolved_at = now() where id = p_request_id;
end;
$$;

create or replace function public.decline_payment_request(p_request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.payment_requests
    set status = 'declined', resolved_at = now()
    where id = p_request_id and payee_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Request not found, already resolved, or not yours to decline';
  end if;
end;
$$;

-- =========================================================================
-- CARDS: needed so verify-card's upsert (see edge function) can dedupe on
-- the processor's own authorization code instead of creating a duplicate
-- saved_cards row every time the same card is used to fund the wallet.
-- =========================================================================
alter table public.saved_cards add constraint saved_cards_provider_token_key unique (provider_token);