import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { IonIcon, IonLoading, useIonRouter } from '@ionic/react';
import { mailOutline, checkmarkCircle, arrowForwardOutline } from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import AuthShell from '@/components/AuthShell';
import { tr } from '@/i18n';
import {
  getFingerprintEnabledUserId, getRememberedLoginEmail, isBiometricAvailable, verifyFingerprint,
} from '@/lib/biometric';

// Inside the installed app the web origin is https://localhost, which the phone's browser can't open, so
// the reset email must return to the app through its own URL scheme (see AndroidManifest + DeepLinkHandler
// in App.tsx). Add this exact URL to Supabase > Authentication > URL Configuration > Redirect URLs.
const NATIVE_RESET_URL = 'com.nextgen.app://reset-password';

const ForgotPassword: React.FC = () => {
  const router = useIonRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [fingerprintOffered, setFingerprintOffered] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Offer fingerprint only if it was enabled on this device and the phone supports it.
  useEffect(() => {
    if (!getFingerprintEnabledUserId()) return;
    isBiometricAvailable().then(setFingerprintOffered);
  }, []);

  // Fingerprint here is a convenience, never a way around recovery:
  //  - if this device still holds a valid signed-in session, a matching fingerprint resumes it;
  //  - otherwise it only confirms the phone's owner and fills in their email. The password itself can
  //    still only be changed through the emailed link, which is always required.
  const handleFingerprint = async () => {
    setError(null);
    const ok = await verifyFingerprint(tr('Confirm your fingerprint'));
    if (!ok) { setError(tr('Fingerprint not recognised. Tap the icon to try again.')); return; }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      router.push('/tabs/chats', 'root', 'replace');
      return;
    }
    const remembered = getRememberedLoginEmail();
    if (remembered) setEmail(remembered);
    setNote(tr('Fingerprint confirmed. To keep your account safe, a password can only be reset through the link we email you.'));
  };

  const handleSend = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Capacitor.isNativePlatform() ? NATIVE_RESET_URL : `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title={tr('Check your email')} backHref="/login">
        <div style={{ textAlign: 'center', width: '100%' }}>
          <IonIcon icon={checkmarkCircle} className="ng-success-icon" />
          <p style={{ color: 'var(--ngl-tagline)', fontSize: 13, marginBottom: 22 }}>
            {tr('If an account exists for')} <strong>{email}</strong>{tr(', we\'ve sent a link to reset your password. Open it on this device to continue.')}
          </p>
          <button type="button" className="ng-link" onClick={() => router.push('/login')}>
            {tr('Back to Log In')}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={tr('Reset your password')}
      subtitle={tr('Enter the email on your Nextgen account and we\'ll send you a reset link.')}
      backHref="/login"
    >
      <div className="ng-field">
        <IonIcon icon={mailOutline} />
        <input
          type="email"
          placeholder={tr('Email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {error && <div className="ng-error">{error}</div>}
      {note && <div style={{ color: 'var(--ngl-tagline)', fontSize: 13, margin: '4px 0 10px' }}>{note}</div>}

      {fingerprintOffered && (
        <button type="button" className="ng-link" onClick={handleFingerprint} style={{ marginBottom: 12 }}>
          {tr('Use fingerprint')}
        </button>
      )}

      <button
        type="button"
        className="ng-btn-primary"
        onClick={handleSend}
        disabled={busy || !email}
      >
        {tr('Send reset link')}
        <IonIcon icon={arrowForwardOutline} style={{ position: 'absolute', right: 22 }} />
      </button>

      <IonLoading isOpen={busy} message={tr('Sending reset link...')} />
    </AuthShell>
  );
};

export default ForgotPassword;
