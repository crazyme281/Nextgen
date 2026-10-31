# Nextgen — Marketplace, Chat & Pay: Architecture Review + Build Plan

**Stack confirmed from upload:** Ionic React (Capacitor-ready) + Supabase (Postgres/Auth/Realtime/Storage). Schema is already reasonably mature: `profiles`, `conversations`/`messages`, `wallets`/`wallet_transactions` (with an atomic `transfer_funds()` RPC), `products`/`orders`, `live_posts`, `calls`. RLS is enabled everywhere and is mostly sound.

The three things you flagged are genuinely three separate subsystems (marketplace, real-time chat, payments), each with a different mature product to learn from. Below: what's there today, what's missing, and how Temu / WhatsApp / Moniepoint-OPay actually solve the same problems — then a concrete schema + build plan for each.

---

## 1. Marketplace — user-to-user buying & selling (Temu model)

### What's already there
- `products` table with `seller_id`, RLS already lets **any authenticated user insert a product where `seller_id = auth.uid()`** — so the backend already supports multi-vendor selling. Nothing blocks it at the DB layer.
- `orders` table linking `buyer_id`/`seller_id`/`product_id`.

### What's missing
- **No "Sell" UI at all.** No product-create form, no image upload to Supabase Storage, no seller dashboard (my listings, edit/deactivate, incoming orders).
- **No cart.** `ProductDetail.tsx` calls `orders.insert()` directly on "Buy now" — one product, qty 1, no shipping address, no order summary.
- **No variants/inventory** (size, color, stock count) — every Temu-style listing needs this or you can't sell clothing/electronics properly.
- **No payment linkage.** An order is created with `status: 'pending'` and nothing ever moves it forward — no debit from buyer wallet, no credit to seller, no way to mark `paid`.
- **No trust mechanism for buyer↔seller** beyond your existing `trust_level` ring, which is good — reuse it here.

### How Temu actually works (relevant parts for a P2P version)
- **Listings have variants** (size/color) selected before add-to-cart, not before viewing.
- **Escrow-style buyer protection**: the buyer's money is captured at checkout but only released to the seller after delivery is confirmed (or a return window like 90 days lapses without dispute). Low-value disputes are often refunded without requiring the item back — that's a business-rule decision you can defer, but the **escrow hold** pattern is what matters architecturally.
- **Seller never sees the money instantly** — funds sit in a pending/escrow state tied to the order, and a scheduled job or delivery-confirmation event releases it.
- **Order has a state machine**: `pending → paid → shipped → delivered → completed (funds released) / disputed / refunded`. Your enum already has `pending, paid, shipped, completed, cancelled, refunded` — good, you just need to *drive* it and add `disputed`.

### Concrete schema additions
```sql
-- Variants (size/color/etc.) — optional per product
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,              -- e.g. "Size: L / Color: Blue"
  price_delta_minor bigint not null default 0,
  stock_qty integer not null default 0,
  sku text
);

-- Multiple images per product (MarketHome/ProductDetail only handle one today)
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0
);

-- A real cart instead of instant single-item "Buy now"
create table public.cart_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id),
  qty integer not null default 1 check (qty > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id, variant_id)
);

-- Escrow: orders hold funds until release
alter type order_status add value if not exists 'disputed';
alter table public.orders add column if not exists shipping_address jsonb;
alter table public.orders add column if not exists escrow_released_at timestamptz;
alter table public.orders add column if not exists variant_id uuid references public.product_variants(id);
alter table public.orders add column if not exists qty integer not null default 1;

create table public.order_events (   -- audit trail: who moved the order and when
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  from_status order_status,
  to_status order_status not null,
  note text,
  created_at timestamptz not null default now()
);
```

### The critical RPC: pay-for-order-with-escrow
This is the piece that actually connects Marketplace → Pay. It must be one atomic function, called instead of a bare `orders.insert`:
```sql
create or replace function public.checkout_order(p_product_id uuid, p_variant_id uuid, p_qty int, p_shipping jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_order_id uuid;
  v_amount bigint;
  v_seller uuid;
begin
  select price_minor + coalesce((select price_delta_minor from product_variants where id = p_variant_id), 0),
         seller_id
    into v_amount, v_seller
  from products where id = p_product_id;

  v_amount := v_amount * p_qty;

  -- debit buyer wallet into escrow (no credit yet — held, not sent)
  update wallets set balance_minor = balance_minor - v_amount
    where user_id = auth.uid() and balance_minor >= v_amount;
  if not found then raise exception 'Insufficient balance'; end if;

  insert into orders (product_id, variant_id, qty, buyer_id, seller_id, amount_minor, currency, status, shipping_address)
  values (p_product_id, p_variant_id, p_qty, auth.uid(), v_seller, v_amount, 'NGN', 'paid', p_shipping)
  returning id into v_order_id;

  insert into wallet_transactions (user_id, type, amount_minor, description, reference)
  values (auth.uid(), 'debit', v_amount, 'Order #'||v_order_id, v_order_id::text);

  return v_order_id;
end;
$$;
```
Funds are debited but **not yet credited to the seller** — that only happens on a separate `release_escrow(order_id)` call once the buyer marks the order delivered (or after N days auto-release, run as a cron/Edge Function). That's the Temu buyer-protection pattern.

### UI to build
1. `market/SellProduct.tsx` — form + Supabase Storage image upload (multi-image), variant builder.
2. `market/MyListings.tsx` — seller's own products, toggle `is_active`, edit, view orders against each.
3. `market/Cart.tsx` — cart badge in tab bar, add/remove/qty, checkout button → calls `checkout_order`.
4. `market/OrderDetail.tsx` (buyer) + `market/SellerOrders.tsx` (seller) — status timeline driven by `order_events`, "mark shipped", "confirm delivery" (triggers escrow release), "open dispute".
5. Add a reviews table (`product_reviews`: order_id, rating, comment) gated so only a buyer with a `completed` order can review — this is what makes a P2P listing trustworthy the way Temu's review volume does.

---

## 2. Chat — real-time messaging (WhatsApp model)

### What's already there
This is your strongest subsystem. `messages` is in the realtime publication, `ChatRoom.tsx` already subscribes via `postgres_changes` and does optimistic scroll. `get_or_create_direct_conversation()` and `mark_conversation_read()` are solid, correct patterns.

### What's missing (vs. WhatsApp)
WhatsApp's actual architecture is: client-to-server over a persistent connection (historically Erlang/XMPP-derived, now MQTT-like), **the server never reads message content** (E2E via the Signal protocol) and only tracks three delivery states — **sent → delivered → read** (the checkmarks) — plus presence (online/last-seen) via connection heartbeats. Group fanout spawns a delivery job per member.

Your app doesn't need Signal-protocol E2E to be useful (that's a large, separate crypto project — flag it as a v2 stretch goal, not v1), but you're missing the **delivery/read status model** and **presence**, which is most of what makes a chat app feel like WhatsApp instead of a comment thread.

```sql
-- Per-recipient delivery/read tracking (works for groups too, unlike a single status column)
create table public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);
-- populate one row per OTHER participant when a message is inserted (trigger),
-- client updates delivered_at on receipt, read_at on view (like your mark_conversation_read).

alter publication supabase_realtime add table public.message_receipts;

-- Typing indicator: ephemeral, don't persist to disk — use Supabase Realtime *Presence* / Broadcast
-- channel instead of a table (this mirrors how WhatsApp keeps presence out of durable storage).

alter table public.messages add column if not exists media_type text
  check (media_type in ('image','video','audio','document')) default null;
```

For **presence / online / last-seen**, use Supabase Realtime's `Presence` API (a purpose-built ephemeral channel — exactly the "connection heartbeat" idea WhatsApp uses) rather than polling `profiles.is_online`:
```ts
const channel = supabase.channel('presence:global', { config: { presence: { key: user.id } } });
channel.on('presence', { event: 'sync' }, () => { /* update online set */ });
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() });
});
```
Same channel type (Broadcast, not a table) is the right tool for **typing indicators** — sub-second, no DB writes.

### UI to build
1. Double-tick / single-tick / blue-tick rendering in `ChatRoom.tsx` off `message_receipts`.
2. Media messages — reuse the Storage bucket from marketplace uploads; `media_type` drives rendering (image bubble, audio waveform player, etc.).
3. Typing indicator bubble, wired to Broadcast, not Postgres.
4. Presence dot on `TrustBadge` avatars in `ChatsList` / `ContactsList`, replacing (or backing) `profiles.is_online`.
5. Group chat creation flow — schema (`conversation_kind = 'group'`) already supports it; there's just no UI to create one or add participants beyond the 1:1 RPC.

**Note on E2E encryption:** WhatsApp's actual privacy guarantee comes from the Signal Protocol running client-side; the server is a blind relay. Bolting that onto a Supabase-RLS app is a legitimate but *large* separate effort (key exchange, per-device keys, ratcheting) — worth flagging to stakeholders as "not in v1" rather than silently skipping it.

---

## 3. Pay — wallet funding & transfers (Moniepoint / OPay model)

### What's already there
Genuinely good foundations: `wallets` (balance in kobo), `wallet_transactions`, and `transfer_funds()` is a correctly-written atomic double-entry P2P transfer (debit + credit rows with a shared reference). `Wallet.tsx` renders balance and a transaction feed. The "Send / Request / Top up / Cards" buttons are pure UI stubs right now — no handlers.

### What's missing
The wallet currently has **no way to get real money in or out**. That's the entire value proposition of OPay/Moniepoint: they're not just an in-app ledger, they're a bridge to the actual Nigerian banking rails.

### How Moniepoint/OPay actually fund a wallet
Both are licensed to hold customer funds and both use the same core trick that any Nigerian fintech relies on: a **dedicated virtual account number (VAN)** per user, generated via a licensed processor (their own microfinance-bank license for Moniepoint, or a partner bank/processor). When someone sends money to that unique account number by regular bank transfer (NIP), the processor sends your backend a **webhook**, and you credit the wallet. This is why transfers into these apps feel instant — it's NIBSS Instant Payment settlement plus a webhook, not a manual reconciliation. They also do **name enquiry** (resolve account number → account name before you confirm a transfer), which is what makes "no need to remember a bank code" possible.

**For your app, you don't need a banking license** — you use a **payments processor that offers virtual accounts as a product**, most commonly for Nigeria: **Paystack** (Dedicated Virtual Accounts) or **Flutterwave** (Virtual Account Numbers). The pattern is identical regardless of provider:

```
1. On signup (or first "Top up"), call processor API → create a dedicated virtual account
   tied to this user, store the account number/bank name on the profile.
2. User transfers real money to that account number from any bank app.
3. Processor sends a webhook to your Edge Function when the transfer lands.
4. Edge Function verifies the webhook signature, then calls a SECURITY DEFINER RPC
   to credit wallets.balance_minor and insert a wallet_transactions row.
5. Realtime pushes the new balance to Wallet.tsx — same as your existing pattern.
```

### Schema additions
```sql
create table public.virtual_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null,              -- 'paystack' | 'flutterwave'
  account_number text not null,
  bank_name text not null,
  provider_customer_id text,
  created_at timestamptz not null default now()
);

create table public.payment_webhook_events (   -- idempotency + audit for every provider callback
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  payload jsonb not null,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- cards for "Cards" tab — store only a tokenised reference, NEVER raw PAN/CVV
create table public.saved_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_token text not null,   -- processor's card token, e.g. Paystack authorization_code
  last4 text not null,
  brand text,
  created_at timestamptz not null default now()
);
```

### Server-side piece (must NOT be client-callable directly)
The webhook handler is a **Supabase Edge Function**, not a client RPC, because it must run with your processor's secret key and verify a signature header (e.g. Paystack sends `x-paystack-signature`, an HMAC-SHA512 of the raw body using your secret key — reject anything that doesn't match, and always re-fetch the transaction status from the provider's API rather than trusting the webhook payload's amount blindly).

```ts
// supabase/functions/paystack-webhook/index.ts (sketch)
serve(async (req) => {
  const sig = req.headers.get('x-paystack-signature');
  const raw = await req.text();
  if (!verifyHmac(raw, sig, PAYSTACK_SECRET)) return new Response('invalid', { status: 401 });
  const event = JSON.parse(raw);
  if (event.event === 'charge.success' || event.event === 'dedicatedaccount.credit') {
    await supabaseAdmin.rpc('credit_wallet_from_webhook', {
      p_user_id: mapAccountToUser(event.data.customer.customer_code),
      p_amount_minor: event.data.amount,
      p_provider_ref: event.data.reference,
    });
  }
  return new Response('ok');
});
```

### "Send money" (off-platform, like Moniepoint/OPay transfer-out)
Your `transfer_funds()` RPC already covers **in-app** wallet-to-wallet transfer (Nextgen user to Nextgen user) — that part is done, just needs the "Send" button wired to a recipient picker. Sending **out** to an external bank account (like OPay's "send to any bank") is a separate processor call (Paystack Transfers API / Flutterwave Transfers) that debits the wallet and initiates a payout — flag that as its own ticket since it needs transfer-recipient verification (name enquiry) and usually a transaction PIN step for security, matching what you saw in the Moniepoint/OPay UX teardown pattern (resolve name → confirm → PIN → send).

### UI to build
1. `pay/TopUp.tsx` — show the user's dedicated virtual account number/bank (generate on first visit if `virtual_accounts` row doesn't exist), "copy account number", live balance refresh via Realtime once the webhook lands.
2. `pay/Send.tsx` — contact/phone picker (reuse `contacts_view`) → amount → PIN confirm → `transfer_funds()`.
3. `pay/SendExternal.tsx` (v2) — bank/account-number entry, name-enquiry call, confirm, processor Transfers API.
4. `pay/Cards.tsx` — list `saved_cards`, "add card" via processor's hosted card tokenisation (never handle raw card data on your own server/client).
5. A transaction **PIN** on the profile (hashed, separate from login password) gated before `transfer_funds`/`checkout_order` — every one of these apps requires a second factor before money moves.

---

## Suggested build order

1. **Payments foundation first** — virtual accounts + webhook + `credit_wallet_from_webhook`. Nothing in Marketplace checkout works without real money entering the wallet.
2. **Marketplace: Sell UI + Cart + `checkout_order` escrow RPC** — this is what turns `products`/`orders` from "technically insertable" into an actual feature.
3. **Chat: receipts + presence + media** — lower risk, mostly additive to code that already works well.
4. **Order fulfillment loop**: shipping status, delivery confirmation → `release_escrow`, reviews.
5. **v2 stretch**: E2E encryption for chat, external bank transfer-out, dispute/refund workflow.

Want me to start implementing any of these — e.g. the `SellProduct.tsx` + Storage upload flow, or the Paystack virtual-account + webhook piece — as actual code against your repo?