import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars are missing. Copy .env.example to .env and fill in ' +
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  );
}

// Realtime Authorization (private channels, see migration
// "0021 realtime call broadcast authorization.sql") checks RLS policies on
// realtime.messages using auth.uid() — but that only resolves if the
// Realtime websocket connection itself carries the signed-in user's JWT.
// Without this, `{ config: { private: true } }` channels connect as an
// anonymous/unauthenticated session for RLS purposes: every policy check
// silently fails, so calls ring on the caller's side and never arrive on
// the callee's.
//
// Note: this can't be done via the `accessToken` client option — that puts
// the client into "third-party auth" mode, which supabase-js explicitly
// disallows combining with `supabase.auth.onAuthStateChange` (the app's
// own AuthContext relies on that). Calling `realtime.setAuth()` directly
// is the correct approach when using Supabase's own built-in Auth.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
    // Mobile networks silently drop idle sockets; a shorter heartbeat notices that (and reconnects) sooner.
    heartbeatIntervalMs: 15000,
  },
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) supabase.realtime.setAuth(session.access_token);
});

// Prime it immediately too, in case the very first Realtime connection
// happens before onAuthStateChange has fired for the first time.
supabase.auth.getSession().then(({ data }) => {
  if (data.session?.access_token) supabase.realtime.setAuth(data.session.access_token);
});

// The onAuthStateChange/getSession wiring above runs on its own async
// timeline — there's no guarantee it finishes before something elsewhere
// (e.g. CallContext's incoming-call listener, which subscribes as soon as
// the user is available) creates and joins a private channel. If that join
// happens first, it authenticates as nobody, and no later setAuth() call
// retroactively re-authorizes that already-open join. Anywhere that's
// about to subscribe to a private channel should `await` this immediately
// beforehand to guarantee the JWT is attached first.
export async function ensureRealtimeAuth(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    supabase.realtime.setAuth(data.session.access_token);
  }
}