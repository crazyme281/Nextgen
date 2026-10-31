import React, { useEffect, useState } from 'react';
import {
  IonModal, IonContent, IonButton, IonInput, IonIcon, IonSpinner, IonToast,
} from '@ionic/react';
import { fingerPrintOutline, lockClosedOutline, closeOutline } from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  platformAuthenticatorAvailable, registerBiometric, verifyBiometric,
} from '@/lib/IdentityVerify';
import { tr } from '@/i18n';

interface Props {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * "Verify it's you" — tries the device fingerprint/Face ID/PIN prompt
 * first (real WebAuthn platform authenticator), falls back to typing the
 * account password (real Supabase re-authentication) if biometrics aren't
 * available, fail, or are cancelled.
 */
const VerifyIdentityModal: React.FC<Props> = ({ isOpen, onSuccess, onCancel }) => {
  const { user, profile } = useAuth();
  const [stage, setStage] = useState<'checking' | 'biometric' | 'password'>('checking');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    setError(null);
    setPassword('');
    (async () => {
      setStage('checking');
      const available = await platformAuthenticatorAvailable();
      if (!available) {
        setStage('password');
        return;
      }
      setStage('biometric');
      const credExists = !!localStorage.getItem(`nextgen_webauthn_cred_${user.id}`);
      if (!credExists) {
        const registered = await registerBiometric(user.id, profile?.full_name ?? user.email ?? 'Nextgen user');
        if (!registered) {
          setStage('password');
          return;
        }
      }
      const ok = await verifyBiometric(user.id);
      if (ok) {
        onSuccess();
      } else {
        setStage('password');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const handlePasswordVerify = async () => {
    if (!user?.email || !password) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(tr('That password is incorrect.'));
      return;
    }
    onSuccess();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onCancel} initialBreakpoint={1} breakpoints={[0, 1]}>
      <IonContent className="ion-padding">
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IonIcon icon={closeOutline} style={{ fontSize: 24, cursor: 'pointer' }} onClick={onCancel} />
        </div>

        <div style={{ textAlign: 'center', padding: '12px 16px 24px' }}>
          <IonIcon
            icon={stage === 'password' ? lockClosedOutline : fingerPrintOutline}
            style={{ fontSize: 56, color: 'var(--ng-blue)' }}
          />
          <h2 style={{ margin: '16px 0 4px' }}>{tr('Verify it\'s you')}</h2>
          <p style={{ color: 'var(--ion-color-medium)', fontSize: 14 }}>
            {stage === 'checking' && tr('Checking this device…')}
            {stage === 'biometric' && tr('Confirm with your fingerprint, face, or device PIN.')}
            {stage === 'password' && tr('Enter your account password to continue.')}
          </p>

          {stage === 'checking' && <IonSpinner name="dots" style={{ marginTop: 12 }} />}

          {stage === 'biometric' && (
            <IonButton fill="clear" onClick={() => setStage('password')} style={{ marginTop: 8 }}>
              {tr('Use password instead')}
            </IonButton>
          )}

          {stage === 'password' && (
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <IonInput
                type="password"
                placeholder={tr('Password')}
                value={password}
                onIonInput={(e) => setPassword(e.detail.value ?? '')}
                style={{ '--background': 'var(--ion-item-background)', '--padding-start': '14px', borderRadius: 12 } as React.CSSProperties}
              />
              <IonButton
                expand="block"
                style={{ marginTop: 16 }}
                disabled={!password || busy}
                onClick={handlePasswordVerify}
              >
                {busy ? <IonSpinner name="dots" /> : tr('Verify')}
              </IonButton>
            </div>
          )}
        </div>

        <IonToast isOpen={!!error} message={error ?? ''} duration={3000} onDidDismiss={() => setError(null)} />
      </IonContent>
    </IonModal>
  );
};

export default VerifyIdentityModal;