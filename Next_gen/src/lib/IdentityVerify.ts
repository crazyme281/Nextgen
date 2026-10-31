/**
 * Local identity re-verification before a sensitive action (linking a new
 * device). Two real mechanisms, tried in order:
 *
 *  1. WebAuthn platform authenticator — the actual OS fingerprint/Face ID/
 *     Windows Hello prompt, via navigator.credentials. On first use on a
 *     device we register a credential (create); afterwards we just ask for
 *     an assertion (get). This is a genuine biometric/platform-PIN prompt,
 *     not a fake dialog.
 *
 *     Caveat, stated plainly: the credential/challenge here isn't verified
 *     against a server-stored public key (that needs a WebAuthn relying-
 *     party backend we don't have yet). It's used the way many apps use
 *     biometrics for an "unlock" gate — proof the OS's local authenticator
 *     approved *someone* physically present, not a server-checked
 *     cryptographic signature. The account-level security boundary is
 *     still the Supabase session.
 *
 *  2. Password re-entry — a REAL re-authentication against Supabase via
 *     signInWithPassword, used automatically when WebAuthn isn't
 *     available/supported, and offered as a fallback if the biometric
 *     prompt fails or is cancelled.
 */

const CRED_ID_KEY = (userId: string) => `nextgen_webauthn_cred_${userId}`;

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function randomChallenge(): BufferSource {
  return crypto.getRandomValues(new Uint8Array(32)) as unknown as BufferSource;
}

/** Registers a platform authenticator credential for this device, once. */
export async function registerBiometric(userId: string, displayName: string): Promise<boolean> {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'Nextgen' },
        user: {
          id: new TextEncoder().encode(userId) as unknown as BufferSource,
          name: displayName,
          displayName,
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_ID_KEY(userId), cred.id);
    return true;
  } catch {
    return false;
  }
}

/** Prompts the platform authenticator (fingerprint/face/PIN) for approval. */
export async function verifyBiometric(userId: string): Promise<boolean> {
  const credId = localStorage.getItem(CRED_ID_KEY(userId));
  try {
    const options: CredentialRequestOptions = {
      publicKey: {
        challenge: randomChallenge(),
        userVerification: 'required',
        timeout: 60000,
        ...(credId
          ? { allowCredentials: [{ id: (Uint8Array.from(atob(credId.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)) as unknown as BufferSource), type: 'public-key' }] }
          : {}),
      },
    };
    const assertion = await navigator.credentials.get(options);
    return !!assertion;
  } catch {
    return false;
  }
}

export interface VerifyResult {
  success: boolean;
  method: 'biometric' | 'password' | null;
}