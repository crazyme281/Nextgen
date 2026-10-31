// supabase/functions/create-virtual-account/index.ts
//
// Deploy:  supabase functions deploy create-virtual-account
// Secrets: supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
//
// Called BY THE CLIENT (with the user's own auth JWT — this function is
// deployed WITH jwt verification, unlike the webhook). It:
//   1. Reads the caller's profile (needs full_name + phone + email).
//   2. Creates (or fetches) a Paystack customer for them.
//   3. Requests a Dedicated Virtual Account for that customer.
//   4. Stores the result in virtual_accounts using the service-role key
//      (client has no insert policy on that table — see migration 0003).
//
// The Paystack secret key never reaches the client; only this function
// holds it, and it runs server-side in Supabase's infrastructure.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function paystack(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.status === false) {
    throw new Error(json.message ?? `Paystack ${path} failed`);
  }
  return json.data;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  // Identify the caller from their JWT (this function IS jwt-verified by default).
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAsUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseAsUser.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
  }
  const userId = userData.user.id;

  // Already provisioned? Return the existing one instead of creating a duplicate.
  const { data: existing } = await supabaseAdmin
    .from('virtual_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ virtualAccount: existing }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('full_name, phone')
    .eq('id', userId)
    .single();
  if (profileErr || !profile?.phone) {
    return new Response(JSON.stringify({ error: 'Profile needs a phone number and name first' }), {
      status: 400,
    });
  }

  const [firstName, ...rest] = (profile.full_name ?? 'Nextgen User').split(' ');
  const lastName = rest.join(' ') || 'User';

  try {
    const customer = await paystack('/customer', {
      email: `${userId}@nextgenpay.user`, // Paystack requires an email; synthetic is fine if no real email captured
      first_name: firstName,
      last_name: lastName,
      phone: profile.phone,
    });

    const dva = await paystack('/dedicated_account', {
      customer: customer.customer_code,
      preferred_bank: 'wema-bank', // or 'titan-paystack' depending on what's enabled on your Paystack account
    });

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('virtual_accounts')
      .insert({
        user_id: userId,
        provider: 'paystack',
        account_number: dva.account_number,
        bank_name: dva.bank.name,
        account_name: dva.account_name,
        provider_customer_id: customer.customer_code,
        provider_account_id: dva.id?.toString(),
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ virtualAccount: inserted }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('create-virtual-account error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});