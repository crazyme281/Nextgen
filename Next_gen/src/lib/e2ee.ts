/**
 * End-to-end message encryption.
 *
 * Design: ECDH (P-256) + AES-GCM envelope encryption, done entirely with
 * the browser's native Web Crypto API (no extra dependencies).
 *
 *  - Each device generates its own ECDH keypair. The PRIVATE key is
 *    stored as a native CryptoKey in IndexedDB and this code never calls
 *    exportKey on it or sends it anywhere — it's only ever used in-place
 *    by deriveKey/deriveBits. (WebCrypto ties one extractable flag to
 *    both keys of an EC pair, so it can't be marked non-extractable at
 *    the API level while the public key stays exportable — see the note
 *    on ensureKeyPair below.)
 *  - The PUBLIC key is uploaded to profiles.public_key so other users can
 *    encrypt messages to this account.
 *  - Every message gets a random one-time AES-GCM key ("message key") that
 *    actually encrypts the text. That message key is then individually
 *    wrapped (encrypted) for each conversation participant, using a shared
 *    secret derived via ECDH(myPrivateKey, theirPublicKey) — so only
 *    someone holding the matching private key can unwrap it and read the
 *    message.
 *
 * Known limitations (worth knowing, not hidden):
 *  - No forward secrecy / ratcheting (unlike Signal) — a compromised
 *    private key can decrypt that device's past traffic. Good enough to
 *    keep the server and network from reading messages, not a full
 *    Signal-protocol implementation.
 *  - Keys are per-device. Logging in on a second device currently starts
 *    a fresh keypair there and can't read messages encrypted for the
 *    first device's key — there's no key-backup/sync step yet.
 *  - Attachments (images/video/audio/docs) are NOT covered — only message
 *    text (`body`) is encrypted right now.
 */

const DB_NAME = 'nextgen-e2ee';
const STORE_NAME = 'keypairs';
const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function bufToBase64(buf: ArrayBuffer): string {
  let binary = '';
  new Uint8Array(buf).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

interface StoredKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

/**
 * Returns this device's ECDH keypair, generating and persisting one on
 * first use. If a keypair already exists locally but the account has no
 * public_key on the server yet (e.g. server data was reset), it re-uploads
 * the existing local public key rather than silently generating a second,
 * orphaned keypair.
 *
 * Note on extractability: WebCrypto's generateKey() applies one
 * `extractable` flag to BOTH keys in an EC pair — there's no way to ask
 * for an extractable public key and a non-extractable private key from a
 * single call. The private key is therefore technically exportable via
 * the SubtleCrypto API, but this codebase never calls exportKey on it and
 * never transmits it anywhere; it only ever leaves IndexedDB to be used
 * directly by crypto.subtle.deriveKey/deriveBits calls in this file.
 */
export async function ensureKeyPair(
  userId: string,
  uploadPublicKey: (jwk: JsonWebKey) => Promise<void>,
  currentServerPublicKey: JsonWebKey | null
): Promise<StoredKeyPair> {
  const existing = await idbGet<StoredKeyPair>(userId);
  if (existing) {
    if (!currentServerPublicKey) {
      const jwk = await crypto.subtle.exportKey('jwk', existing.publicKey);
      await uploadPublicKey(jwk);
    }
    return existing;
  }

  const pair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits']) as CryptoKeyPair;
  const stored: StoredKeyPair = { privateKey: pair.privateKey, publicKey: pair.publicKey };
  await idbSet(userId, stored);
  const jwk = await crypto.subtle.exportKey('jwk', stored.publicKey);
  await uploadPublicKey(jwk);
  return stored;
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ECDH_PARAMS, true, []);
}

async function deriveSharedAesKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedEnvelope {
  ciphertext: string; // base64
  iv: string; // base64
  encryptedKeys: Record<string, { data: string; iv: string }>;
}

/**
 * Encrypts `plaintext` once with a fresh random AES key, then wraps that
 * key individually for every recipient (including the sender, so the
 * sender can decrypt their own sent messages on this device).
 */
export async function encryptMessage(
  plaintext: string,
  myUserId: string,
  myPrivateKey: CryptoKey,
  recipientPublicKeys: Record<string, JsonWebKey>
): Promise<EncryptedEnvelope> {
  const messageKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    messageKey,
    new TextEncoder().encode(plaintext)
  );
  const rawMessageKey = await crypto.subtle.exportKey('raw', messageKey);

  const encryptedKeys: EncryptedEnvelope['encryptedKeys'] = {};
  const recipients = { ...recipientPublicKeys };
  // Sender always gets a copy of their own message key so they can read
  // their own outgoing messages back.
  if (!recipients[myUserId]) {
    const myPub = await idbGet<StoredKeyPair>(myUserId);
    if (myPub) {
      const jwk = await crypto.subtle.exportKey('jwk', myPub.publicKey);
      recipients[myUserId] = jwk;
    }
  }

  await Promise.all(Object.entries(recipients).map(async ([userId, pubJwk]) => {
    const theirPublicKey = await importPublicKey(pubJwk);
    const sharedKey = await deriveSharedAesKey(myPrivateKey, theirPublicKey);
    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, sharedKey, rawMessageKey);
    encryptedKeys[userId] = { data: bufToBase64(wrapped), iv: bufToBase64(wrapIv.buffer) };
  }));

  return {
    ciphertext: bufToBase64(ciphertextBuf),
    iv: bufToBase64(iv.buffer),
    encryptedKeys,
  };
}

/**
 * Reverses encryptMessage for the current user: unwraps the message key
 * using this device's private key + the sender's public key, then decrypts
 * the ciphertext. Returns null if this device has no entry in
 * encrypted_keys (e.g. it joined a group after the message was sent) or if
 * anything about the envelope doesn't check out.
 */
export async function decryptMessage(
  envelope: { body: string | null; iv: string | null; encrypted_keys: Record<string, { data: string; iv: string }> | null },
  myUserId: string,
  myPrivateKey: CryptoKey,
  senderPublicKey: JsonWebKey
): Promise<string | null> {
  if (!envelope.body || !envelope.iv || !envelope.encrypted_keys) return null;
  const mine = envelope.encrypted_keys[myUserId];
  if (!mine) return null;
  try {
    const senderKey = await importPublicKey(senderPublicKey);
    const sharedKey = await deriveSharedAesKey(myPrivateKey, senderKey);
    const rawMessageKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(base64ToBuf(mine.iv)) },
      sharedKey,
      base64ToBuf(mine.data)
    );
    const messageKey = await crypto.subtle.importKey('raw', rawMessageKey, { name: 'AES-GCM' }, false, ['decrypt']);
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(base64ToBuf(envelope.iv)) },
      messageKey,
      base64ToBuf(envelope.body)
    );
    return new TextDecoder().decode(plaintextBuf);
  } catch {
    return null;
  }
}