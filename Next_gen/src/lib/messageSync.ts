import { Capacitor } from '@capacitor/core';
/**
 * Keeps the on-device message database (see localDb.ts) in step with
 * Supabase. Three jobs:
 *
 *  1. Send: text messages typed while offline sit in the outbox and are
 *     sent, in order, as soon as the server is reachable.
 *  2. Pull: ask the server only for messages newer than the newest one we
 *     already have (per conversation), so reconnecting is cheap.
 *  3. Reconcile: drop local copies of messages that were deleted for
 *     everyone, or hidden by this user, while the device was offline.
 *
 * Every message gets its id on the device (crypto.randomUUID) and that id
 * is used as the database primary key, so retrying a send whose response
 * was lost can never create a duplicate: the second attempt hits the
 * primary key (error 23505) and is treated as "already delivered".
 */
import { supabase } from '@/lib/supabase';
import {
  type LocalMessage,
  type OutboxEntry,
  deleteMessages,
  deleteOutbox,
  getLatestSyncedAt,
  getMessagesByIds,
  getOutbox,
  getOutboxEntry,
  localEvents,
  putMessages,
  putOutbox,
  reconcileWindow,
  setMeta,
  toLocalMessage,
} from '@/lib/localDb';

const PAGE_SIZE = 500;
const FIRST_SYNC_WINDOW = 200;
const CONVERSATION_BATCH = 4;

const REQUEST_TIMEOUT_MS = 15000;

/**
 * True for failures that mean "can't reach the server right now" (retry later), as opposed to the
 * server rejecting the request. Deliberately based on what the request itself reported, NOT on
 * navigator.onLine: Android WebViews can report "offline" while mobile data works (VPN, data saver,
 * captive networks), and gating on it is exactly what stops sync from ever trying.
 */
export function isNetworkFailure(err: { message?: string; code?: string; status?: number; name?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('aborted') ||
    msg.includes('abort') ||
    err.name === 'AbortError' ||
    err.status === 0
  );
}

/** Runs `fn` with an AbortSignal that fires after REQUEST_TIMEOUT_MS so a dead connection can't hang a send forever. */
async function withTimeout<T>(fn: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

export type SendOutcome =
  | { status: 'sent'; created_at: string }
  | { status: 'queued' } // offline — safely stored, will go out on reconnect
  | { status: 'failed'; error: string }; // server rejected it

/**
 * Saves a text message on the device first (so it survives the app being
 * killed), then tries to send it right away.
 */
export async function sendTextMessage(
  userId: string,
  msg: { id: string; conversation_id: string; body: string; reply_to_id: string | null; created_at: string }
): Promise<SendOutcome> {
  const local: LocalMessage = {
    id: msg.id,
    conversation_id: msg.conversation_id,
    sender_id: userId,
    body: msg.body,
    media_url: null,
    media_type: null,
    created_at: msg.created_at,
    is_encrypted: true,
    reply_to_id: msg.reply_to_id,
    game_invitation_id: null,
    local_status: 'pending',
  };
  const entry: OutboxEntry = {
    id: msg.id,
    conversation_id: msg.conversation_id,
    sender_id: userId,
    body: msg.body,
    reply_to_id: msg.reply_to_id,
    created_at: msg.created_at,
    attempts: 0,
  };
  try {
    await putMessages(userId, [local]);
    await putOutbox(userId, entry);
  } catch {
    // The on-device database is unavailable (storage error, quota...). Sending must not depend on it:
    // fall back to a direct send; the message just won't be queued if this also fails.
    const direct = await insertEntry(entry);
    if (direct.ok) return { status: 'sent', created_at: direct.created_at };
    if (direct.network) return { status: 'failed', error: 'No connection. Please try again.' };
    return { status: 'failed', error: direct.message };
  }
  return attemptSend(userId, msg.id);
}

type InsertResult =
  | { ok: true; created_at: string }
  | { ok: false; network: boolean; duplicate: boolean; message: string };

async function insertEntry(entry: OutboxEntry): Promise<InsertResult> {
  try {
    const { data, error } = await withTimeout((signal) =>
      supabase
        .from('messages')
        .insert({
          id: entry.id,
          conversation_id: entry.conversation_id,
          sender_id: entry.sender_id,
          body: entry.body,
          reply_to_id: entry.reply_to_id,
          game_invitation_id: null,
        })
        .select('id, created_at')
        .abortSignal(signal)
        .single()
    );
    if (!error && data) return { ok: true, created_at: data.created_at as string };
    return {
      ok: false,
      network: isNetworkFailure(error),
      // Primary key already exists: an earlier attempt got through and only the response was lost.
      duplicate: error?.code === '23505',
      message: error?.message ?? 'Message could not be sent.',
    };
  } catch (e) {
    return { ok: false, network: true, duplicate: false, message: e instanceof Error ? e.message : 'Network error' };
  }
}

// One send per message id at a time, so the compose screen and the background flush can never both insert it.
const sendsInFlight = new Map<string, Promise<SendOutcome>>();

function attemptSend(userId: string, id: string): Promise<SendOutcome> {
  const running = sendsInFlight.get(id);
  if (running) return running;
  const p = attemptSendOnce(userId, id).finally(() => { sendsInFlight.delete(id); });
  sendsInFlight.set(id, p);
  return p;
}

async function attemptSendOnce(userId: string, id: string): Promise<SendOutcome> {
  const entry = await getOutboxEntry(userId, id);
  if (!entry) {
    // Already delivered by an earlier attempt/flush.
    const [stored] = await getMessagesByIds(userId, [id]);
    return { status: 'sent', created_at: stored?.created_at ?? new Date().toISOString() };
  }

  const result = await insertEntry(entry);
  if (result.ok) return markDelivered(userId, entry.id, result.created_at);

  if (result.duplicate) {
    const { data: existing } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', entry.id)
      .maybeSingle();
    return markDelivered(userId, entry.id, (existing?.created_at as string | undefined) ?? entry.created_at);
  }

  if (result.network) {
    // The website is online-only: nothing is queued for later. Drop the local copy so it can't be
    // re-sent behind the user's back; the compose screen restores what the user typed.
    if (!Capacitor.isNativePlatform()) {
      await deleteOutbox(userId, entry.id);
      await deleteMessages(userId, [entry.id]);
      localEvents.emit({ type: 'delete', conversationId: entry.conversation_id, ids: [entry.id] });
      return { status: 'failed', error: 'No internet connection. Please reconnect and try again.' };
    }
    return { status: 'queued' };
  }

  // The server understood the request and said no (permissions, conversation gone, ...). Retrying can't
  // fix that, so don't leave the message spinning in the queue: remove it and tell the user.
  await deleteOutbox(userId, entry.id);
  await deleteMessages(userId, [entry.id]);
  localEvents.emit({ type: 'delete', conversationId: entry.conversation_id, ids: [entry.id] });
  return { status: 'failed', error: result.message };
}

async function markDelivered(userId: string, id: string, serverCreatedAt: string): Promise<SendOutcome> {
  const [stored] = await getMessagesByIds(userId, [id]);
  if (stored) {
    // Adopt the server's timestamp so ordering matches what everyone else sees.
    const { local_status: _drop, ...rest } = stored;
    await putMessages(userId, [{ ...rest, created_at: serverCreatedAt }]);
    localEvents.emit({ type: 'upsert', conversationId: stored.conversation_id, ids: [id] });
  }
  await deleteOutbox(userId, id);
  return { status: 'sent', created_at: serverCreatedAt };
}

/** Sends everything waiting in the outbox, oldest first. Stops at the first network failure. */
export async function flushOutbox(userId: string): Promise<void> {
  const entries = await getOutbox(userId);
  for (const entry of entries) {
    const outcome = await attemptSend(userId, entry.id);
    // Still can't reach the server: stop here (keeps order); the retry timer in MessagingProvider tries again.
    if (outcome.status === 'queued') break;
  }
}

export async function pendingCount(userId: string): Promise<number> {
  return (await getOutbox(userId)).length;
}

/* ------------------------------------------------------------------ */
/* Pulling                                                             */
/* ------------------------------------------------------------------ */

export interface SyncResult {
  /** Messages from other people that were new to this device. */
  newIncoming: LocalMessage[];
}

let syncInFlight: Promise<SyncResult> | null = null;

/**
 * Sync. Concurrent callers share one run. `light` skips the deleted-message check (one extra query per
 * conversation) and is what the background poll uses; a full sync runs on login, reconnect and app resume.
 */
export function syncAll(userId: string, opts: { light?: boolean } = {}): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSync(userId, !!opts.light).finally(() => { syncInFlight = null; });
  return syncInFlight;
}

async function runSync(userId: string, light: boolean): Promise<SyncResult> {
  const result: SyncResult = { newIncoming: [] };

  // 1) Outgoing first, so the server order matches the order they were typed.
  await flushOutbox(userId);

  // 2) Which conversations does this user belong to?
  const { data: memberships, error: memberErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);
  if (memberErr || !memberships) throw memberErr ?? new Error('sync: could not list conversations');
  const conversationIds = (memberships as { conversation_id: string }[]).map((m) => m.conversation_id);

  // 3) Messages this user hid ("delete for me").
  const { data: hiddenRows } = await supabase
    .from('message_deletions')
    .select('message_id')
    .eq('user_id', userId);
  const hidden = new Set<string>(((hiddenRows ?? []) as { message_id: string }[]).map((h) => h.message_id));
  if (hidden.size > 0) await deleteMessages(userId, [...hidden]);

  // 4) Per-conversation delta pull, a few at a time.
  for (let i = 0; i < conversationIds.length; i += CONVERSATION_BATCH) {
    const batch = conversationIds.slice(i, i + CONVERSATION_BATCH);
    const pulled = await Promise.all(batch.map((cid) => syncConversation(userId, cid, hidden, light)));
    pulled.forEach((p) => result.newIncoming.push(...p));
  }

  await setMeta(userId, 'last_full_sync_at', new Date().toISOString());
  localEvents.emit({ type: 'synced' });
  return result;
}

async function syncConversation(userId: string, conversationId: string, hidden: Set<string>, light: boolean): Promise<LocalMessage[]> {
  const since = await getLatestSyncedAt(userId, conversationId);
  const fresh: LocalMessage[] = [];

  if (!since) {
    // Never synced this conversation on this device: grab the most recent window.
    const { data, error } = await supabase
      .from('messages_plain')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(FIRST_SYNC_WINDOW);
    if (error) throw error;
    const rows = ((data ?? []) as unknown as LocalMessage[]).reverse().filter((m) => !hidden.has(m.id));
    // History being downloaded for the first time is not "new" — don't report it as incoming.
    await putMessages(userId, rows.map(toLocalMessage));
    if (rows.length) localEvents.emit({ type: 'upsert', conversationId, ids: rows.map((m) => m.id) });
  } else {
    // `gte` (not `gt`) so two messages sharing a timestamp can't be skipped; putMessages is idempotent.
    let cursor = since;
    for (;;) {
      const { data, error } = await supabase
        .from('messages_plain')
        .select('*')
        .eq('conversation_id', conversationId)
        .gte('created_at', cursor)
        .order('created_at', { ascending: true })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const rows = ((data ?? []) as unknown as LocalMessage[]).filter((m) => !hidden.has(m.id));
      if (rows.length) {
        const inserted = await putMessages(userId, rows.map(toLocalMessage));
        fresh.push(...inserted);
        localEvents.emit({ type: 'upsert', conversationId, ids: rows.map((m) => m.id) });
      }
      const page = (data ?? []) as unknown as LocalMessage[];
      if (page.length < PAGE_SIZE) break;
      const last = page[page.length - 1].created_at;
      if (last === cursor) break; // whole page shares one timestamp — avoid looping forever
      cursor = last;
    }
  }

  if (light) return fresh.filter((m) => m.sender_id !== userId);

  // Deleted-for-everyone while offline? Compare against the server's latest window of ids.
  const { data: idRows } = await supabase
    .from('messages')
    .select('id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(FIRST_SYNC_WINDOW);
  if (idRows && idRows.length > 0) {
    const ids = idRows as { id: string; created_at: string }[];
    const oldest = ids[ids.length - 1].created_at;
    const removed = await reconcileWindow(userId, conversationId, oldest, new Set(ids.map((r) => r.id)));
    if (removed.length) localEvents.emit({ type: 'delete', conversationId, ids: removed });
  }

  return fresh.filter((m) => m.sender_id !== userId);
}
