/**
 * On-device message database (WhatsApp-style local storage).
 *
 * Everything the user can read in a chat is kept here, in IndexedDB inside
 * the app's private WebView storage. The UI reads from this first and the
 * network only *updates* it, which is what makes chats readable with no
 * internet connection.
 *
 * One database per signed-in user (`nextgen-local-<userId>`), so two
 * accounts on the same phone can never see each other's messages.
 *
 * Stores
 *  - messages : every message we have seen, keyed by message id
 *  - outbox   : text messages written while offline, waiting to be sent
 *  - meta     : small key/value cache (chat-list snapshot, peer/group info,
 *               last sync time)
 */

/** Delete this user's on-device messages when they explicitly log out. */
export const WIPE_LOCAL_DATA_ON_SIGN_OUT = true;

const DB_VERSION = 1;

export interface LocalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | 'audio' | 'document' | null;
  created_at: string;
  is_encrypted: boolean;
  reply_to_id: string | null;
  game_invitation_id: string | null;
  /** Client-only. 'pending' = saved on device, not yet accepted by the server. */
  local_status?: 'pending' | 'failed';
}

export interface OutboxEntry {
  /** Same as the message id — the id is generated on the device and reused as the DB primary key. */
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  reply_to_id: string | null;
  created_at: string;
  attempts: number;
}

/* ------------------------------------------------------------------ */
/* Change events — lets any screen react to the local DB changing      */
/* ------------------------------------------------------------------ */

export type LocalEvent =
  | { type: 'upsert'; conversationId: string; ids: string[] }
  | { type: 'delete'; conversationId: string | null; ids: string[] }
  | { type: 'synced' };

type Listener = (e: LocalEvent) => void;
const listeners = new Set<Listener>();

export const localEvents = {
  on(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  emit(e: LocalEvent): void {
    listeners.forEach((fn) => {
      try { fn(e); } catch { /* one bad listener must not break the others */ }
    });
  },
};

/* ------------------------------------------------------------------ */
/* Connection handling                                                 */
/* ------------------------------------------------------------------ */

let openDbUserId: string | null = null;
let openDbPromise: Promise<IDBDatabase> | null = null;

const dbName = (userId: string) => `nextgen-local-${userId}`;

function openDb(userId: string): Promise<IDBDatabase> {
  if (openDbPromise && openDbUserId === userId) return openDbPromise;

  // Switching accounts: close the previous user's connection.
  if (openDbPromise) {
    openDbPromise.then((db) => db.close()).catch(() => undefined);
  }
  openDbUserId = userId;
  openDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName(userId), DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const messages = db.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('by_conv', ['conversation_id', 'created_at']);
      db.createObjectStore('outbox', { keyPath: 'id' });
      db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      openDbPromise = null;
      reject(req.error);
    };
  });
  return openDbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Keeps only the fields we store, so extra view columns never leak into the cache. */
export function toLocalMessage(row: Partial<LocalMessage> & { id: string }): LocalMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id as string,
    sender_id: row.sender_id as string,
    body: row.body ?? null,
    media_url: row.media_url ?? null,
    media_type: row.media_type ?? null,
    created_at: row.created_at as string,
    is_encrypted: row.is_encrypted ?? false,
    reply_to_id: row.reply_to_id ?? null,
    game_invitation_id: row.game_invitation_id ?? null,
    ...(row.local_status ? { local_status: row.local_status } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

/**
 * Saves messages (insert or overwrite by id). Returns the ones that were
 * NOT already stored — i.e. genuinely new to this device.
 */
export async function putMessages(userId: string, msgs: LocalMessage[]): Promise<LocalMessage[]> {
  if (msgs.length === 0) return [];
  const db = await openDb(userId);
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  const fresh: LocalMessage[] = [];
  await Promise.all(
    msgs.map(async (m) => {
      const existing = await reqToPromise(store.get(m.id));
      if (!existing) fresh.push(m);
      store.put(toLocalMessage(m));
    })
  );
  await txDone(tx);
  return fresh;
}

/** Latest `limit` messages of a conversation, oldest first. */
export async function getMessages(userId: string, conversationId: string, limit = 200): Promise<LocalMessage[]> {
  const db = await openDb(userId);
  const tx = db.transaction('messages', 'readonly');
  const index = tx.objectStore('messages').index('by_conv');
  const range = IDBKeyRange.bound([conversationId, ''], [conversationId, '\uffff']);
  const out: LocalMessage[] = [];
  await new Promise<void>((resolve, reject) => {
    const cursorReq = index.openCursor(range, 'prev');
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor || out.length >= limit) { resolve(); return; }
      out.push(cursor.value as LocalMessage);
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  return out.reverse();
}

export async function getMessagesByIds(userId: string, ids: string[]): Promise<LocalMessage[]> {
  if (ids.length === 0) return [];
  const db = await openDb(userId);
  const tx = db.transaction('messages', 'readonly');
  const store = tx.objectStore('messages');
  const rows = await Promise.all(ids.map((id) => reqToPromise(store.get(id))));
  return rows.filter((r): r is LocalMessage => !!r);
}

/** created_at of the newest message we have that the server has confirmed. */
export async function getLatestSyncedAt(userId: string, conversationId: string): Promise<string | null> {
  const db = await openDb(userId);
  const tx = db.transaction('messages', 'readonly');
  const index = tx.objectStore('messages').index('by_conv');
  const range = IDBKeyRange.bound([conversationId, ''], [conversationId, '\uffff']);
  return new Promise((resolve, reject) => {
    const cursorReq = index.openCursor(range, 'prev');
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) { resolve(null); return; }
      const m = cursor.value as LocalMessage;
      if (m.local_status) { cursor.continue(); return; } // skip not-yet-sent messages
      resolve(m.created_at);
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

export async function deleteMessages(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb(userId);
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  ids.forEach((id) => store.delete(id));
  await txDone(tx);
}

/**
 * Removes locally-stored messages that the server no longer has (deleted
 * for everyone while this device was offline). Only looks at messages at or
 * after `fromCreatedAt` — the window the server just told us about — and
 * never touches messages still waiting in the outbox. Messages newer than
 * `olderThan` are also left alone: the server's list was fetched a moment ago,
 * so a message sent since then would look "missing" and be wrongly removed.
 */
export async function reconcileWindow(
  userId: string,
  conversationId: string,
  fromCreatedAt: string,
  serverIds: Set<string>,
  olderThan: string = new Date(Date.now() - 120_000).toISOString()
): Promise<string[]> {
  const db = await openDb(userId);
  const tx = db.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  const index = store.index('by_conv');
  const range = IDBKeyRange.bound([conversationId, fromCreatedAt], [conversationId, '\uffff']);
  const removed: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const cursorReq = index.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) { resolve(); return; }
      const m = cursor.value as LocalMessage;
      if (!m.local_status && m.created_at <= olderThan && !serverIds.has(m.id)) {
        removed.push(m.id);
        cursor.delete();
      }
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  await txDone(tx);
  return removed;
}

/* ------------------------------------------------------------------ */
/* Outbox                                                              */
/* ------------------------------------------------------------------ */

export async function putOutbox(userId: string, entry: OutboxEntry): Promise<void> {
  const db = await openDb(userId);
  const tx = db.transaction('outbox', 'readwrite');
  tx.objectStore('outbox').put(entry);
  await txDone(tx);
}

export async function getOutbox(userId: string): Promise<OutboxEntry[]> {
  const db = await openDb(userId);
  const tx = db.transaction('outbox', 'readonly');
  const rows = (await reqToPromise(tx.objectStore('outbox').getAll())) as OutboxEntry[];
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getOutboxEntry(userId: string, id: string): Promise<OutboxEntry | undefined> {
  const db = await openDb(userId);
  const tx = db.transaction('outbox', 'readonly');
  return reqToPromise(tx.objectStore('outbox').get(id)) as Promise<OutboxEntry | undefined>;
}

export async function deleteOutbox(userId: string, id: string): Promise<void> {
  const db = await openDb(userId);
  const tx = db.transaction('outbox', 'readwrite');
  tx.objectStore('outbox').delete(id);
  await txDone(tx);
}

/* ------------------------------------------------------------------ */
/* Meta (small cached values)                                          */
/* ------------------------------------------------------------------ */

export async function getMeta<T>(userId: string, key: string): Promise<T | undefined> {
  try {
    const db = await openDb(userId);
    const tx = db.transaction('meta', 'readonly');
    return (await reqToPromise(tx.objectStore('meta').get(key))) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function setMeta(userId: string, key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb(userId);
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(value, key);
    await txDone(tx);
  } catch {
    /* cache only — never fail the caller because of it */
  }
}

/* ------------------------------------------------------------------ */
/* Wipe                                                                */
/* ------------------------------------------------------------------ */

export async function clearLocalData(userId: string): Promise<void> {
  if (openDbPromise && openDbUserId === userId) {
    try { (await openDbPromise).close(); } catch { /* ignore */ }
    openDbPromise = null;
    openDbUserId = null;
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(dbName(userId));
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
