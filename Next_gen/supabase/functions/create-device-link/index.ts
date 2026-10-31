import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Symmetric key for encrypting the user id that goes into the QR payload.
// Derived from the service-role key (already a secret only this project's
// edge functions have access to) rather than a separately provisioned
// secret — same effect, no extra provisioning step needed.
async function getKey(): Promise<CryptoKey> {
  const material = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`device-link:${SUPABASE_SERVICE_ROLE_KEY}`));
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

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

  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(userId)
    );
    const encryptedUserId = toBase64(ciphertextBuf);
    const ivB64 = toBase64(iv.buffer);

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('device_pairing_requests')
      .insert({ user_id: userId, encrypted_user_id: encryptedUserId, iv: ivB64 })
      .select('id, expires_at')
      .single();
    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        requestId: inserted.id,
        encryptedUserId,
        iv: ivB64,
        expiresAt: inserted.expires_at,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('create-device-link error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
});