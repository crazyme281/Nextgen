import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { WIPE_LOCAL_DATA_ON_SIGN_OUT, clearLocalData } from '@/lib/localDb';
import { flushOutbox } from '@/lib/messageSync';
import { clearFingerprintState } from '@/lib/biometric';

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  trust_level: 'unverified' | 'verified_identity' | 'verified_business' | 'high_assurance' | 'risk_detected';
  account_type: 'individual' | 'business' | 'admin';
}

interface AuthContextValue {
  session: Session | null;
  /** The signed-in user — also set (from the on-device copy) when the app is opened with no internet. */
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True when the app was opened offline and is running on the cached identity until the network returns. */
  isOfflineSession: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Who was signed in on this device, saved after every successful sign-in /
 * token refresh. Supabase can't hand back a session while offline once the
 * 1-hour access token has expired (it needs the network to refresh it), so
 * without this the app would bounce an offline user to the login screen
 * instead of showing the messages already stored on the phone. Cleared on
 * logout, and whenever the server itself says the session is gone.
 */
const IDENTITY_KEY = 'ng.offlineIdentity';
interface CachedIdentity { id: string; email: string | null; profile: Profile | null }

function readIdentity(): CachedIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as CachedIdentity) : null;
  } catch { return null; }
}
function writeIdentity(identity: CachedIdentity): void {
  try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity)); } catch { /* ignore */ }
}
function clearIdentity(): void {
  try { localStorage.removeItem(IDENTITY_KEY); } catch { /* ignore */ }
}

function looksLikeNetworkError(err: { name?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.name === 'AuthRetryableFetchError') return true;
  return /fetch|network|timeout/i.test(err.message ?? '');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offlineUser, setOfflineUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const explicitSignOut = useRef(false);

  const loadProfile = async (userId: string, email: string | null) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      const p = data as unknown as Profile;
      setProfile(p);
      writeIdentity({ id: userId, email, profile: p });
    }
    // Message encryption is now handled entirely server-side (see
    // nextgen_msg_encrypt/decrypt + the messages_plain view) and
    // authorized by RLS, i.e. by being signed into the account — not by
    // any per-device key. There's nothing left to set up here.
  };

  const refreshProfile = async () => {
    if (session?.user?.id) await loadProfile(session.user.id, session.user.email ?? null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session) {
        setSession(data.session);
        setOfflineUser(null);
        const existing = readIdentity();
        writeIdentity({ id: data.session.user.id, email: data.session.user.email ?? null, profile: existing?.profile ?? null });
        loadProfile(data.session.user.id, data.session.user.email ?? null);
      } else {
        const cached = readIdentity();
        const unreachable = (typeof navigator !== 'undefined' && navigator.onLine === false) || looksLikeNetworkError(error);
        if (cached && unreachable) {
          // Opened with no connection: stay signed in on the cached identity.
          setOfflineUser({ id: cached.id, email: cached.email ?? undefined } as unknown as User);
          setProfile(cached.profile);
        } else {
          clearIdentity();
        }
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        setSession(newSession);
        setOfflineUser(null);
        const existing = readIdentity();
        writeIdentity({
          id: newSession.user.id,
          email: newSession.user.email ?? null,
          profile: existing && existing.id === newSession.user.id ? existing.profile : null,
        });
        loadProfile(newSession.user.id, newSession.user.email ?? null);
      } else if (event === 'SIGNED_OUT') {
        // A real sign-out (explicit, or the server revoked the session). A
        // network blip never produces SIGNED_OUT, so it's safe to clear here.
        setSession(null);
        setProfile(null);
        setOfflineUser(null);
        if (!explicitSignOut.current) clearIdentity();
      }
    });

    // Back online while running on the cached identity: pick the real session up straight away
    // (supabase-js refreshes the expired token on its own; this just doesn't wait for its timer).
    const onOnline = () => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSession(data.session);
          setOfflineUser(null);
        }
      });
    };
    window.addEventListener('online', onOnline);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('online', onOnline);
    };
  }, []);

  // Started "offline" on the cached identity but the network is actually fine (or came back without an
  // `online` event, which mobile WebViews don't always fire): keep checking, so the real session — and
  // with it sending and receiving — is picked up within seconds rather than only after an app restart.
  useEffect(() => {
    if (!offlineUser || session) return;
    const check = () => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSession(data.session);
          setOfflineUser(null);
        }
      });
    };
    const timer = setInterval(check, 6000);
    return () => clearInterval(timer);
  }, [offlineUser, session]);

  const signOut = async () => {
    const userId = session?.user?.id ?? offlineUser?.id ?? null;
    explicitSignOut.current = true;
    try {
      // Give any message still waiting in the outbox one last chance to go out
      // before the local copy is removed. Never block logout for long.
      if (userId && navigator.onLine) {
        await Promise.race([flushOutbox(userId), new Promise((r) => setTimeout(r, 4000))]);
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Offline: the server can't be told, but the device must still be signed out.
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
          .forEach((k) => localStorage.removeItem(k));
      }
      setSession(null);
      setProfile(null);
      setOfflineUser(null);
      clearIdentity();
      clearFingerprintState();
      if (userId && WIPE_LOCAL_DATA_ON_SIGN_OUT) await clearLocalData(userId);
    } finally {
      explicitSignOut.current = false;
    }
  };

  const user = session?.user ?? offlineUser;

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, isOfflineSession: !session && !!offlineUser, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
