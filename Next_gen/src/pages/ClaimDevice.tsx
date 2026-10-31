import React, { useEffect, useState } from 'react';
import { IonPage, IonContent, IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { checkmarkCircle, alertCircleOutline } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

const detectDeviceLabel = () => {
  const ua = navigator.userAgent;
  const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Browser';
  const os = ua.includes('Windows') ? 'Windows PC' : ua.includes('Mac') ? 'Mac' : ua.includes('Android') ? 'Android device' : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS device' : 'Device';
  return `${os} · ${browser}`;
};

/**
 * PUBLIC route — the device that scans another device's "Link a device" QR
 * lands here, not yet signed in as anyone. Verifies the encrypted payload
 * with claim-device-link (server-side), then completes a real Supabase
 * sign-in on THIS device via verifyOtp — this is the actual moment two
 * devices become linked to the same account, not a cosmetic confirmation.
 */
const ClaimDevice: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working');
  const [message, setMessage] = useState('Verifying this device…');

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search);
      const requestId = params.get('rid');
      const encryptedUserId = params.get('c');
      const iv = params.get('iv');
      if (!requestId || !encryptedUserId || !iv) {
        setStatus(tr('error'));
        setMessage(tr('This link is missing information and can’t be used.'));
        return;
      }

      const { data: claimed, error: claimError } = await supabase.functions.invoke(
        'claim-device-link',
        { body: { requestId, encryptedUserId, iv, deviceLabel: detectDeviceLabel() } }
      );
      const result = claimed as { email: string; tokenHash: string } | { error: string } | null;

      if (claimError || !result || 'error' in result) {
        setStatus(tr('error'));
        setMessage((result && 'error' in result && result.error) || 'This pairing link is no longer valid.');
        return;
      }

      setMessage(tr('Signing in…'));
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: result.email,
        token_hash: result.tokenHash,
        type: 'magiclink',
      });
      if (otpError) {
        setStatus(tr('error'));
        setMessage(tr('Could not complete sign-in on this device.'));
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from('push_tokens').insert({
          user_id: userData.user.id,
          token: `claim-${crypto.randomUUID()}`,
          platform: 'web',
          device_label: detectDeviceLabel(),
        });
      }

      setStatus(tr('success'));
      setMessage(tr('This device is now linked to your account.'));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12,
        }}
        >
          <BrandMark size={56} />
          {status === 'working' && <IonSpinner style={{ width: 48, height: 48 }} />}
          {status === 'success' && (
            <IonIcon icon={checkmarkCircle} style={{ fontSize: 72, color: 'var(--ng-verified-green)' }} />
          )}
          {status === 'error' && (
            <IonIcon icon={alertCircleOutline} style={{ fontSize: 72, color: 'var(--ng-security-red)' }} />
          )}
          <h2 style={{ margin: 0 }}>
            {status === 'success' ? tr('Successfully Linked') : status === 'error' ? tr('Couldn’t link this device') : tr('Linking device…')}
          </h2>
          <p style={{ color: 'var(--ion-color-medium)', maxWidth: 300 }}>{message}</p>
          {status === 'success' && (
            <IonButton shape="round" style={{ marginTop: 16 }} onClick={() => history.replace('/tabs/chats')}>
              {tr('Continue')}
            </IonButton>
          )}
          {status === 'error' && (
            <IonButton shape="round" fill="outline" style={{ marginTop: 16 }} onClick={() => history.replace('/login')}>
              {tr('Go to sign in')}
            </IonButton>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ClaimDevice;