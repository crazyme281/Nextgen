import React, { useEffect, useState } from 'react';
import { IonIcon, IonLoading, useIonRouter } from '@ionic/react';
import {
  lockClosedOutline, checkmarkCircle, eyeOutline, eyeOffOutline, arrowForwardOutline,
} from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import AuthShell from '@/components/AuthShell';
import { tr } from '@/i18n';

/**
 * Landing page for the Supabase "reset password" email link
 * (redirectTo is set to `${origin}/reset-password` in ForgotPassword.tsx).
 * Supabase's client parses the recovery token from the URL automatically
 * (detectSessionInUrl: true) and fires a PASSWORD_RECOVERY auth event.
 */
const ResetPassword: React.FC = () => {
  const router = useIonRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Only a session that came from the emailed recovery link may choose a new password. An ordinary
    // signed-in session (or one resumed with a fingerprint) must NOT be enough to reach this form.
    const recoveryPending = sessionStorage.getItem('ng.recoveryPending') === '1';
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && recoveryPending) setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { sessionStorage.setItem('ng.recoveryPending', '1'); setReady(true); }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setError(null);
    if (password.length < 8) {
      setError(tr('Password must be at least 8 characters.'));
      return;
    }
    if (password !== confirmPassword) {
      setError(tr('Passwords do not match.'));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    sessionStorage.removeItem('ng.recoveryPending');
    setDone(true);
    setTimeout(() => router.push('/tabs/chats', 'root', 'replace'), 1500);
  };

  if (done) {
    return (
      <AuthShell title={tr('Password updated')}>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <IonIcon icon={checkmarkCircle} className="ng-success-icon" />
          <p style={{ color: 'var(--ngl-tagline)', fontSize: 13 }}>{tr('Taking you to Nextgen...')}</p>
        </div>
      </AuthShell>
    );
  }

  if (!ready) {
    return (
      <AuthShell
        title={tr('Link expired or invalid')}
        subtitle={tr('This password reset link is no longer valid. Request a new one from the login screen.')}
      >
        <button type="button" className="ng-btn-primary" onClick={() => router.push('/forgot-password')}>
          {tr('Request new link')}
          <IonIcon icon={arrowForwardOutline} style={{ position: 'absolute', right: 22 }} />
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={tr('Set a new password')} subtitle={tr('Must be at least 8 characters.')}>
      <div className="ng-field">
        <IonIcon icon={lockClosedOutline} />
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder={tr('New password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          className="ng-eye"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? tr('Hide password') : tr('Show password')}
        >
          <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
        </button>
      </div>

      <div className="ng-field">
        <IonIcon icon={lockClosedOutline} />
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder={tr('Confirm password')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      {error && <div className="ng-error">{error}</div>}

      <button
        type="button"
        className="ng-btn-primary"
        onClick={handleReset}
        disabled={busy || !password || !confirmPassword}
      >
        {tr('Update password')}
        <IonIcon icon={arrowForwardOutline} style={{ position: 'absolute', right: 22 }} />
      </button>

      <IonLoading isOpen={busy} message={tr('Updating password...')} />
    </AuthShell>
  );
};

export default ResetPassword;
