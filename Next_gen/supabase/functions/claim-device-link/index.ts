import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getKey(): Promise<CryptoKey> {
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`device-link:${SUPABASE_SERVICE_ROLE_KEY}`));
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function fromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Called by the SECOND (not-yet-authenticated) device after scanning the
 * QR from an already-logged-in device. Verifies the encrypted user id in
 * the scanned payload really does decrypt to the user id on the matching
 * pending request (this binds the two together — a requestId can't be
 * paired with a mismatched/edited ciphertext), then issues that second
 * device a REAL Supabase session for the same account via a generated
 * magic-link token, exactly the way Supabase's own passwordless login
 * works — not a fake/simulated login.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const { requestId, encryptedUserId, iv, deviceLabel } = await req.json();
  if (!requestId || !encryptedUserId || !iv) {
    return new Response(JSON.stringify({ error: 'Malformed pairing link.' }), { status: 400 });
  }

  try {
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('device_pairing_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: 'This pairing link is invalid.' }), { status: 404 });
    }
    if (row.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'This pairing link was already used.' }), { status: 409 });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from('device_pairing_requests').update({ status: 'expired' }).eq('id', requestId);
      return new Response(JSON.stringify({ error: 'This QR code has expired. Generate a new one.' }), { status: 410 });
    }

    // Decrypt what was scanned and confirm it matches this exact row —
    // proof the QR wasn't tampered with or mixed up with another request.
    const key = await getKey();
    let decryptedUserId: string;
    try {
      const plaintextBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(fromBase64(iv)) },
        key,
        fromBase64(encryptedUserId)
      );
      decryptedUserId = new TextDecoder().decode(plaintextBuf);
    } catch {
      return new Response(JSON.stringify({ error: 'This pairing link failed verification.' }), { status: 400 });
    }
    if (decryptedUserId !== row.user_id || encryptedUserId !== row.encrypted_user_id) {
      return new Response(JSON.stringify({ error: 'This pairing link failed verification.' }), { status: 400 });
    }

    const { data: authUser, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    if (authUserErr || !authUser.user?.email) {
      return new Response(JSON.stringify({ error: 'Could not resolve the account for this device.' }), { status: 500 });
    }

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email,
    });
    if (linkErr || !link) throw linkErr ?? new Error('Failed to generate session link');

    await supabaseAdmin
      .from('device_pairing_requests')
      .update({ status: 'claimed', device_label: deviceLabel ?? 'Unknown device' })
      .eq('id', requestId);

    return new Response(
      JSON.stringify({
        email: authUser.user.email,
        tokenHash: link.properties.hashed_token,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('claim-device-link error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});