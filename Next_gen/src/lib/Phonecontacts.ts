/**
 * Reading the phone's address book (only after the user grants permission) and finding which of those
 * people already have a Nextgen account.
 *
 *  - Android/iOS app: @capacitor-community/contacts (permission prompt is shown by the system).
 *  - Browsers: the Contact Picker API where it exists (Chrome on Android); otherwise unsupported.
 *
 * Only phone numbers are sent to the server, in batches, to the match_phone_contacts function, which returns
 * just the public profile of accounts that match. Nothing from the address book is stored.
 */
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

export interface DeviceContact {
  name: string;
  phones: string[];
  emails: string[];
}

export interface MatchedContact {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  /** The name this person has in the user's own phone book. */
  deviceName: string;
}

export type ReadResult =
  | { status: 'granted'; contacts: DeviceContact[] }
  | { status: 'denied' }
  | { status: 'unsupported' };

type PickerContact = { name?: string[]; tel?: string[]; email?: string[] };
type ContactsPicker = { select: (props: string[], opts?: { multiple?: boolean }) => Promise<PickerContact[]> };

/** The parts of the native plugin's contact shape that we read. */
interface NativeContact {
  name?: { display?: string | null; given?: string | null; family?: string | null } | null;
  phones?: { number?: string | null }[] | null;
  emails?: { address?: string | null }[] | null;
}

interface MatchRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  phone_key: string;
}

type RpcResult = { data: unknown; error: { message: string; code?: string } | null };

/**
 * match_phone_contacts and find_user_by_email are database functions added after the generated
 * src/types/database.types.ts was made, so the typed supabase.rpc() doesn't know them. Calling through this
 * loosely-typed handle keeps the build working whether or not the types file has been regenerated.
 */
const callRpc = (fn: string, args: Record<string, unknown>): Promise<RpcResult> =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<RpcResult> }).rpc(fn, args);

/** Same rule as the database's phone_key(): the last 10 digits, so +234 803…, 0803… and 234803… all match. */
export function phoneKey(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export function canReadPhoneContacts(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof navigator !== 'undefined' && !!(navigator as unknown as { contacts?: ContactsPicker }).contacts;
}

export async function readDeviceContacts(): Promise<ReadResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Contacts } = await import('@capacitor-community/contacts');
      let perm = await Contacts.checkPermissions();
      if (perm.contacts !== 'granted') perm = await Contacts.requestPermissions();
      if (perm.contacts !== 'granted') return { status: 'denied' };

      const res = await Contacts.getContacts({ projection: { name: true, phones: true, emails: true } });
      const list = (res.contacts ?? []) as unknown as NativeContact[];
      const contacts: DeviceContact[] = list.map((c: NativeContact) => ({
        name: c.name?.display ?? [c.name?.given, c.name?.family].filter(Boolean).join(' '),
        phones: (c.phones ?? []).map((p) => p.number ?? '').filter(Boolean),
        emails: (c.emails ?? []).map((e) => e.address ?? '').filter(Boolean),
      }));
      return { status: 'granted', contacts };
    } catch {
      return { status: 'denied' };
    }
  }

  const picker = (navigator as unknown as { contacts?: ContactsPicker }).contacts;
  if (!picker) return { status: 'unsupported' };
  try {
    const picked = await picker.select(['name', 'tel', 'email'], { multiple: true });
    return {
      status: 'granted',
      contacts: picked.map((c) => ({ name: c.name?.[0] ?? '', phones: c.tel ?? [], emails: c.email ?? [] })),
    };
  } catch {
    return { status: 'denied' }; // user dismissed the picker
  }
}

/** Which of the phone's contacts have a Nextgen account? */
export async function matchDeviceContacts(contacts: DeviceContact[]): Promise<MatchedContact[]> {
  // phone key -> the name in the user's phone book
  const nameByKey = new Map<string, string>();
  contacts.forEach((c) => c.phones.forEach((p) => {
    const k = phoneKey(p);
    if (k && !nameByKey.has(k)) nameByKey.set(k, c.name);
  }));
  const keys = [...nameByKey.keys()];

  const found = new Map<string, MatchedContact>();
  for (let i = 0; i < keys.length; i += 500) {
    const { data, error } = await callRpc('match_phone_contacts', { p_phones: keys.slice(i, i + 500) });
    if (error) throw new Error(error.message);
    ((data as MatchRow[] | null) ?? []).forEach((row) => {
      if (!found.has(row.id)) {
        found.set(row.id, {
          id: row.id,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
          phone: row.phone,
          deviceName: nameByKey.get(row.phone_key) || row.full_name || '',
        });
      }
    });
  }
  return [...found.values()];
}

/** Resolve a Nextgen account from an email address (preferred) or a phone number. Null if there isn't one. */
export async function findNextgenUser(opts: { email?: string; phone?: string }): Promise<{ id: string; full_name: string | null } | null> {
  const email = opts.email?.trim();
  if (email) {
    const { data, error } = await callRpc('find_user_by_email', { p_email: email });
    if (error) throw new Error(error.message);
    const row = (data as { id: string; full_name: string | null }[] | null)?.[0];
    if (row) return row;
  }
  const phone = opts.phone?.trim();
  if (phone) {
    const { data, error } = await callRpc('match_phone_contacts', { p_phones: [phone] });
    if (error) throw new Error(error.message);
    const row = (data as { id: string; full_name: string | null }[] | null)?.[0];
    if (row) return row;
  }
  return null;
}