// supabase/functions/verify-card/index.ts
//
// Deploy:  supabase functions deploy verify-card
// Secrets: supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
//
// Called BY THE CLIENT (jwt-verified) after Paystack's inline popup returns
// a `reference`. This function NEVER trusts the client's word that the
// charge succeeded — it re-fetches the transaction from Paystack's own API
// using the secret key, and only then credits the wallet / saves the card.
// This is the same "never trust the client, verify server-side" rule the
// webhook follows — the difference is just which side initiates the check.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseAsUser.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
  }
  const userId = userData.user.id;

  const { reference } = await req.json();
  if (!reference || typeof reference !== 'string') {
    return new Response(JSON.stringify({ error: 'reference is required' }), { status: 400 });
  }

  // Idempotency: if we've already processed this reference, don't double-credit.
  const { data: already } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id')
    .eq('reference', reference)
    .maybeSingle();
  if (already) {
    return new Response(JSON.stringify({ ok: true, alreadyProcessed: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const verifyJson = await verifyRes.json();

    if (!verifyRes.ok || verifyJson.data?.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Transaction was not successful' }), { status: 400 });
    }

    const data = verifyJson.data;

    // Guard against a stolen/replayed reference from a DIFFERENT user's
    // transaction being used to credit this caller's wallet.
    const paidByEmail: string = data.customer?.email ?? '';
    if (paidByEmail && !paidByEmail.startsWith(userId)) {
      // We set customer email to `${userId}@nextgenpay.user` when creating
      // Paystack customers (see create-virtual-account), so this check
      // confirms the transaction actually belongs to the calling user.
      return new Response(JSON.stringify({ error: 'Reference does not belong to this user' }), { status: 403 });
    }

    // 1. Credit the wallet (service-role RPC, same one the bank-transfer webhook uses).
    const { error: creditErr } = await supabaseAdmin.rpc('credit_wallet_from_webhook', {
      p_user_id: userId,
      p_amount_minor: data.amount,
      p_provider_ref: reference,
      p_description: 'Wallet top-up (card)',
    });
    if (creditErr) throw creditErr;

    // 2. Save the card for reuse, if Paystack returned a reusable authorization.
    const auth = data.authorization;
    if (auth?.reusable && auth?.authorization_code) {
      await supabaseAdmin.from('saved_cards').upsert(
        {
          user_id: userId,
          provider: 'paystack',
          provider_token: auth.authorization_code,
          last4: auth.last4,
          brand: auth.brand,
          exp_month: auth.exp_month,
          exp_year: auth.exp_year,
        },
        { onConflict: 'provider_token' }
      );
    }

    return new Response(JSON.stringify({ ok: true, amountMinor: data.amount }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('verify-card error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});
