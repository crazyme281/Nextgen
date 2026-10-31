-- =========================================================================
-- Hello J — Row Level Security policies
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.identity_verifications enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.calls enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.live_posts enable row level security;
alter table public.push_tokens enable row level security;

-- ---- PROFILES ----
-- Anyone signed in can view basic profile info (needed to render chats/contacts/live feed).
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ---- IDENTITY VERIFICATIONS ----
create policy "users manage their own verification requests"
  on public.identity_verifications for select using (auth.uid() = user_id);
create policy "users can submit their own verification requests"
  on public.identity_verifications for insert with check (auth.uid() = user_id);

-- ---- CONTACTS ----
create policy "users manage their own contact list"
  on public.contacts for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ---- CONVERSATIONS ----
create policy "participants can view their conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );
create policy "authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.uid() = created_by);

-- ---- CONVERSATION PARTICIPANTS ----
create policy "participants can view participant rows for their conversations"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp2
      where cp2.conversation_id = conversation_id and cp2.user_id = auth.uid()
    )
  );
create policy "users can update their own participant row (e.g. last_read_at)"
  on public.conversation_participants for update
  using (auth.uid() = user_id);
create policy "users can be added as participants"
  on public.conversation_participants for insert
  with check (true); -- inserts happen via SECURITY DEFINER RPCs

-- ---- MESSAGES ----
create policy "participants can read messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );
create policy "participants can send messages in their conversations"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- ---- CALLS ----
create policy "users can view calls they took part in"
  on public.calls for select
  using (auth.uid() = caller_id or auth.uid() = callee_id);
create policy "users can log calls they initiated"
  on public.calls for insert
  with check (auth.uid() = caller_id);

-- ---- WALLETS ----
create policy "users can view their own wallet"
  on public.wallets for select using (auth.uid() = user_id);
-- balance_minor is only ever mutated via the transfer_funds() SECURITY DEFINER function.

-- ---- WALLET TRANSACTIONS ----
create policy "users can view their own transactions"
  on public.wallet_transactions for select using (auth.uid() = user_id);

-- ---- PRODUCTS ----
create policy "active products are publicly readable to authenticated users"
  on public.products for select
  using (is_active = true or auth.uid() = seller_id);
create policy "sellers manage their own products"
  on public.products for insert with check (auth.uid() = seller_id);
create policy "sellers can update their own products"
  on public.products for update using (auth.uid() = seller_id);
create policy "sellers can delete their own products"
  on public.products for delete using (auth.uid() = seller_id);

-- ---- ORDERS ----
create policy "buyers and sellers can view their orders"
  on public.orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "buyers can create orders"
  on public.orders for insert with check (auth.uid() = buyer_id);
create policy "buyers and sellers can update order status"
  on public.orders for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- ---- LIVE POSTS ----
create policy "live posts are readable by authenticated users"
  on public.live_posts for select using (auth.role() = 'authenticated');
create policy "users can create their own posts"
  on public.live_posts for insert with check (auth.uid() = author_id);
create policy "users can delete their own posts"
  on public.live_posts for delete using (auth.uid() = author_id);

-- ---- PUSH TOKENS ----
create policy "users manage their own push tokens"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
