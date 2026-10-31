import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IonIcon, useIonAlert } from '@ionic/react';
import { fingerPrint } from 'ionicons/icons';
import { App as CapacitorApp } from '@capacitor/app';
import { useI18n } from '@/i18n';
import { useAuth } from '@/context/AuthContext';
import BrandMark from '@/components/BrandMark';
import {
  getFingerprintEnabledUserId,
  hasDeclinedFingerprintPrompt,
  isFingerprintEnabledFor,
  isFingerprintPrompting,
  setAppLocked,
  verifyFingerprint,
} from '@/lib/biometric';
import { offerFingerprintEnrollment } from '@/lib/fingerprintEnroll';
import { tr } from '@/i18n';

/** Re-lock when the app comes back after being in the background longer than this. */
const LOCK_AFTER_MS = 30_000;

/**
 * Fingerprint lock screen + the one-time "enable fingerprint?" offer.
 *
 * Works fully offline: it never touches the network, it only decides whether
 * the (already signed-in) app is shown. Mount once, inside AuthProvider.
 */
const BiometricGate: React.FC = () => {
  useI18n(); // re-render in the new language when it changes
  const { user, loading, isOfflineSession, signOut } = useAuth();
  const [presentAlert] = useIonAlert();

  // Cold start: if fingerprint was enabled, start locked so no chat content flashes before the prompt.
  const [locked, setLockedState] = useState<boolean>(() => getFingerprintEnabledUserId() !== null);
  const [failed, setFailed] = useState(false);

  const prompting = useRef(false);
  const backgroundedAt = useRef<number | null>(null);
  const enrollOffered = useRef(false);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const setLocked = useCallback((value: boolean) => {
    setLockedState(value);
    setAppLocked(value);
  }, []);

  useEffect(() => { setAppLocked(locked); /* publish the initial state */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setFailed(false);
    const ok = await verifyFingerprint('Unlock Nextgen');
    prompting.current = false;
    if (ok) setLocked(false);
    else setFailed(true);
  }, [setLocked]);

  // Once we know who is signed in: lock only applies if THEY enabled it; otherwise drop the cover.
  useEffect(() => {
    if (loading) return;
    if (!user || !isFingerprintEnabledFor(user.id)) {
      if (locked) setLocked(false);
      return;
    }
    if (locked) unlock();
  }, [loading, user, locked, unlock, setLocked]);

  // Lock again after the app has been away for a while.
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    let cancelled = false;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }
      const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (prompting.current || isFingerprintPrompting()) return; // the system fingerprint sheet itself briefly pauses the app
      if (away > LOCK_AFTER_MS && isFingerprintEnabledFor(userIdRef.current)) setLocked(true);
    }).then((h) => { if (cancelled) h.remove(); else handle = h; });
    return () => { cancelled = true; handle?.remove(); };
  }, [setLocked]);

  // Fallback offer for sessions that don't come through the login screen (e.g. after email verification).
  // Skipped on the auth screens: the login screen runs the same step itself and then navigates.
  useEffect(() => {
    if (loading || !user || isOfflineSession || locked || enrollOffered.current) return;
    if (['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password'].includes(window.location.pathname)) return;
    if (isFingerprintEnabledFor(user.id) || hasDeclinedFingerprintPrompt()) return;
    enrollOffered.current = true;
    const timer = setTimeout(() => { offerFingerprintEnrollment(user.id, presentAlert); }, 1500);
    return () => clearTimeout(timer);
  }, [loading, user, isOfflineSession, locked, presentAlert]);

  if (!locked) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100001,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px 28px', textAlign: 'center', color: '#EDEBF5',
        background: 'radial-gradient(ellipse at 15% 10%, #120a24 0%, #0a0714 45%, #060410 100%)',
      }}
    >
      <BrandMark size={72} />
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 18 }}>{tr('Nextgen is locked')}</div>
      <div style={{ fontSize: 13, opacity: 0.65, marginTop: 6 }}>{tr('Use your fingerprint to open your chats')}</div>

      <button
        type="button"
        onClick={unlock}
        aria-label={tr('Unlock with fingerprint')}
        style={{
          marginTop: 34, width: 88, height: 88, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg, #1FA6FF, #7A3DFF 60%, #E339D6)', color: '#fff',
          fontSize: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <IonIcon icon={fingerPrint} />
      </button>

      {failed && (
        <>
          <div style={{ marginTop: 18, fontSize: 13, color: '#FF8A8A' }}>
            {tr('Fingerprint not recognised. Tap the icon to try again.')}
          </div>
          <button
            type="button"
            onClick={async () => { await signOut(); setLocked(false); }}
            style={{ marginTop: 22, background: 'none', border: 'none', color: '#B98CFF', fontSize: 14, textDecoration: 'underline' }}
          >
            {tr('Log out instead')}
          </button>
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.5, maxWidth: 260 }}>
            {tr('Logging out removes saved messages from this phone. They download again when you sign back in.')}
          </div>
        </>
      )}
    </div>
  );
};

export default BiometricGate;
