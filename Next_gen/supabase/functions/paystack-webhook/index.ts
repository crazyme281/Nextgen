// supabase/functions/paystack-webhook/index.ts
//
// Deploy:  supabase functions deploy paystack-webhook --no-verify-jwt
// Secrets: supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
// Then set this function's URL as the webhook URL in the Paystack dashboard.
//
// This function is the ONLY thing allowed to credit a wallet from a real
// bank transfer. It runs with the service-role key (never shipped to the
// client) and verifies Paystack's HMAC-SHA512 signature before trusting
// anything in the payload.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return computed === signature;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  if (!(await verifySignature(rawBody, signature))) {
    // Do NOT process anything from an unverified caller.
    return new Response('invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // Idempotency: record the event first. If we've already stored this
  // provider_event_id, this is a Paystack retry — acknowledge and stop.
  const providerEventId: string = event?.data?.id?.toString() ?? crypto.randomUUID();
  const { error: insertErr } = await supabaseAdmin
    .from('payment_webhook_events')
    .insert({
      provider: 'paystack',
      provider_event_id: providerEventId,
      event_type: event.event,
      payload: event,
    });

  if (insertErr) {
    // unique violation => already processed this exact event
    if (insertErr.code === '23505') {
      return new Response('already processed', { status: 200 });
    }
    console.error('webhook_events insert failed', insertErr);
    return new Response('storage error', { status: 500 });
  }

  // Relevant events: a charge into a customer's dedicated virtual account,
  // or a direct successful charge (e.g. card top-up).
  const relevantEvents = ['charge.success', 'dedicatedaccount.credit'];
  if (relevantEvents.includes(event.event)) {
    try {
      const customerCode: string = event.data.customer.customer_code;
      const amountMinor: number = event.data.amount; // Paystack sends amount in kobo already
      const reference: string = event.data.reference ?? `paystack-${providerEventId}`;

      // Map the processor's customer_code back to a Nextgen user via virtual_accounts.
      const { data: va, error: vaErr } = await supabaseAdmin
        .from('virtual_accounts')
        .select('user_id')
        .eq('provider_customer_id', customerCode)
        .single();

      if (vaErr || !va) {
        console.error('No virtual_accounts match for customer_code', customerCode, vaErr);
        return new Response('unknown customer', { status: 200 }); // ack so Paystack stops retrying; alert separately
      }

      const { error: creditErr } = await supabaseAdmin.rpc('credit_wallet_from_webhook', {
        p_user_id: va.user_id,
        p_amount_minor: amountMinor,
        p_provider_ref: reference,
        p_description: 'Wallet top-up (bank transfer)',
      });

      if (creditErr) {
        console.error('credit_wallet_from_webhook failed', creditErr);
        return new Response('credit failed', { status: 500 });
      }

      await supabaseAdmin
        .from('payment_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('provider', 'paystack')
        .eq('provider_event_id', providerEventId);
    } catch (e) {
      console.error('webhook processing error', e);
      return new Response('processing error', { status: 500 });
    }
  }

  return new Response('ok', { status: 200 });
});