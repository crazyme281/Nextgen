# Nextgen — Ionic React + Supabase

Rebuild of the Nextgen super-app ("Connect. Trust. Transact.") on a real
client/server architecture:

- **Frontend:** Ionic React + TypeScript + Vite, packaged for Android/iOS via Capacitor
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)
- **Database:** PostgreSQL with Row Level Security on every table

## What's here

```
src/
  context/AuthContext.tsx      Supabase session + profile state
  lib/supabase.ts              Supabase client
  pages/
    auth/                      Login, Register, VerifyOtp
    chats/                     ChatsList, ChatRoom (Realtime messaging)
    calls/                     CallsList (call log)
    contacts/                  ContactsList (add by phone, start chat)
    pay/                       Wallet (J Pay: balance + transactions)
    market/                    MarketHome, ProductDetail (J Market)
    live/                      LiveFeed (J Live, Realtime)
    settings/                  Settings, Profile
  components/TrustBadge.tsx    "J Trust Ring" identity-trust avatar ring
  theme/variables.css          Brand colors (orange #FF7900 etc.), Poppins
supabase/migrations/
  0001_init_schema.sql         Tables, views, RPC functions, Realtime wiring
  0002_rls_policies.sql        Row Level Security policies for every table
```

## Getting started

1. **Create a Supabase project** at supabase.com (or use an existing one).
2. **Run the migrations** against it, in order:
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```
   (or paste the two SQL files into the Supabase SQL editor, in order)
3. **Configure env vars**:
   ```bash
   cp .env.example .env
   # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   # (Project Settings -> API in the Supabase dashboard)
   ```
4. **Install & run**:
   ```bash
   npm install
   npm run dev
   ```
5. **Generate real TS types** once your schema is live (replaces the stub in `src/types/database.types.ts`):
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.types.ts
   ```
6. **Native builds** (Android/iOS) via Capacitor:
   ```bash
   npm run build
   npx cap add android   # first time only
   npx cap add ios       # first time only
   npm run cap:sync
   npm run cap:android   # opens Android Studio
   npm run cap:ios       # opens Xcode
   ```

## Data model overview

| Module        | Tables                                                   |
|---------------|-----------------------------------------------------------|
| Identity      | `profiles`, `identity_verifications` (drives J Verify trust ring) |
| Contacts      | `contacts`                                                 |
| Chats         | `conversations`, `conversation_participants`, `messages` (Realtime) |
| Calls         | `calls`                                                     |
| J Pay         | `wallets`, `wallet_transactions`, `transfer_funds()` RPC   |
| J Market      | `products`, `orders`                                        |
| J Live        | `live_posts` (Realtime)                                     |
| Notifications | `push_tokens`                                                |

Every table has Row Level Security enabled — see `0002_rls_policies.sql`.
Money is stored in **minor units** (kobo) as `bigint` to avoid float rounding.

## What's implemented vs. what's next

**Implemented (working end-to-end against the schema):**
Auth (signup/login/email OTP), profile edit, contacts + add-by-phone,
1:1 chat with Realtime delivery + read receipts, call log view, wallet
balance + transaction history, market browse + product detail + order
placement, live feed with Realtime updates.

**Left as follow-up work** (flagged because the original prototype had
these as UI-only mockups too — genuine payment/telephony integration
needs a licensed provider, not just a schema):
- Actual voice/video calling (needs a WebRTC or PSTN provider — Twilio,
  Agora, etc. — `calls` table is ready to log the results)
- Real money movement in/out of the platform (`wallets` currently only
  moves value *between* Nextgen users via `transfer_funds()`; card
  top-ups/withdrawals need a licensed payment processor, e.g. Paystack/Flutterwave)
- Group chats (schema supports `kind = 'group'`; UI only covers direct chats today)
- Push notifications wiring (table `push_tokens` exists; hook up
  `@capacitor/push-notifications` + a Supabase Edge Function to send via FCM/APNs)
- J Verify document upload/KYC review flow (table exists; needs Storage
  bucket + admin review UI)

## Deploying the web app to Vercel

1. Push this folder to a Git repository (the included `.gitignore` keeps `.env` out) and import it at vercel.com/new. Vercel detects Vite; `vercel.json` already sets the build command, output folder, SPA routing and headers.
2. Under Project Settings > Environment Variables, add the names listed in `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AI_BACKEND_URL` and `VITE_PAYSTACK_PUBLIC_KEY`. Redeploy after changing them, because Vite bakes them in at build time.
3. In Supabase > Authentication > URL Configuration, set Site URL to your Vercel domain and add `https://YOUR-DOMAIN/**` to Redirect URLs. Password reset and device-link QR codes use the site's own address.
4. The AI backend must allow your Vercel domain in its CORS settings.
5. Run `npm install` once locally and commit the updated `package-lock.json`. The lockfile was missing `capacitor-native-biometric`, so `vercel.json` installs with `npm install`; after you commit the fixed lock you can switch `installCommand` back to `npm ci`.

Fingerprint unlock and push notifications are native-only (Android/iOS via Capacitor) and stay off in the browser. The website is online-only: it has no service worker and does not queue messages offline.
