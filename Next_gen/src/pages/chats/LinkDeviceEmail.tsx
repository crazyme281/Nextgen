import React, { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonInput, IonButton, IonSpinner, IonToast, IonIcon,
} from '@ionic/react';
import { mailOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/i18n';

const detectDeviceLabel = () => {
  const ua = navigator.userAgent;
  const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Browser';
  const os = ua.includes('Windows') ? 'Windows PC' : ua.includes('Mac') ? 'Mac' : ua.includes('Android') ? 'Android device' : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS device' : 'Device';
  return `${os} · ${browser}`;
};

/**
 * Link a device by email — sends a real 6-digit one-time code via
 * Supabase Auth's email OTP and verifies it with verifyOtp. The email
 * must match this account's own registered email: this screen is for
 * proving it's really you on a new device, not for linking someone
 * else's inbox.
 */
const LinkDeviceEmail: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    if (!email.trim()) return;
    if (user?.email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      setError(tr('That email doesn’t match this account. Use the email you registered with.'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setStep('code');
  };

  const verifyCode = async () => {
    if (!code.trim() || !user) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (verifyError) {
      setBusy(false);
      setError(tr('That code is incorrect or has expired.'));
      return;
    }
    const { error: insertError } = await supabase.from('push_tokens').insert({
      user_id: user.id,
      token: `email-${crypto.randomUUID()}`,
      platform: 'web',
      device_label: `${detectDeviceLabel()} (via email)`,
    });
    setBusy(false);
    if (!insertError) {
      history.replace('/chats/link-device-success');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/chats/link-device-qr" text="" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Link with email')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <IonIcon icon={mailOutline} style={{ fontSize: 48, color: 'var(--ng-blue)' }} />
          <h2 style={{ margin: '16px 0 4px' }}>
            {step === 'email' ? tr('Enter your email') : tr('Enter the code')}
          </h2>
          <p style={{ color: 'var(--ion-color-medium)', fontSize: 14 }}>
            {step === 'email'
              ? tr('We’ll send a one-time code to verify it’s you.')
              : `We sent a 6-digit code to ${email}.`}
          </p>
        </div>

        {step === 'email' ? (
          <>
            <IonInput
              type="email"
              placeholder={tr('you@example.com')}
              value={email}
              onIonInput={(e) => setEmail(e.detail.value ?? '')}
              style={{ '--background': 'var(--ion-item-background)', '--padding-start': '14px', borderRadius: 12 } as React.CSSProperties}
            />
            <IonButton expand="block" style={{ marginTop: 16 }} disabled={!email || busy} onClick={sendCode}>
              {busy ? <IonSpinner name="dots" /> : tr('Send code')}
            </IonButton>
          </>
        ) : (
          <>
            <IonInput
              type="tel"
              inputMode="numeric"
              placeholder="000000"
              maxlength={6}
              value={code}
              onIonInput={(e) => setCode(e.detail.value ?? '')}
              style={{
                '--background': 'var(--ion-item-background)', '--padding-start': '14px',
                borderRadius: 12, textAlign: 'center', letterSpacing: 6, fontSize: 20,
              } as React.CSSProperties}
            />
            <IonButton expand="block" style={{ marginTop: 16 }} disabled={code.length < 6 || busy} onClick={verifyCode}>
              {busy ? <IonSpinner name="dots" /> : tr('Verify')}
            </IonButton>
            <IonButton fill="clear" expand="block" onClick={sendCode} disabled={busy}>
              {tr('Resend code')}
            </IonButton>
          </>
        )}

        <IonToast isOpen={!!error} message={error ?? ''} duration={3500} onDidDismiss={() => setError(null)} />
      </IonContent>
    </IonPage>
  );
};

export default LinkDeviceEmail;