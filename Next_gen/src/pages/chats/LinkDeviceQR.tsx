import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonButton, IonSpinner, IonIcon,
} from '@ionic/react';
import { checkmarkCircle, refreshOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import QRCode from 'qrcode';
import { useHistory } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { tr } from '@/i18n';

interface PairingRequest {
  requestId: string;
  encryptedUserId: string;
  iv: string;
  expiresAt: string;
}

/**
 * "Scan QR code" — the QR is a real, scannable link encoding this
 * account's user id, encrypted server-side (see create-device-link edge
 * function). Any camera/QR app can scan it; scanning opens /claim-device
 * on whatever device did the scanning, which verifies the encryption and
 * signs that device into the SAME account via a real Supabase session
 * (claim-device-link edge function + magic-link verification) — genuine
 * two-device pairing, not a same-device shortcut.
 *
 * This screen watches the request in realtime and moves to the success
 * screen automatically the moment the other device claims it.
 */
const LinkDeviceQR: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [request, setRequest] = useState<PairingRequest | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createRequest = async () => {
    setError(null);
    setExpired(false);
    setQrDataUrl(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const { data: json, error: fnError } = await supabase.functions.invoke('create-device-link', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (fnError || !json) {
      setError(tr('Failed to generate a pairing code.'));
      return;
    }
    const pairing = json as PairingRequest;
    setRequest(pairing);

    const claimUrl = `${window.location.origin}/claim-device?rid=${pairing.requestId}&c=${encodeURIComponent(pairing.encryptedUserId)}&iv=${encodeURIComponent(pairing.iv)}`;
    QRCode.toDataURL(claimUrl, { width: 260, margin: 1, color: { dark: '#12151C', light: '#F3F6FB' } })
      .then(setQrDataUrl)
      .catch(() => setError(tr('Failed to render the QR code.')));

    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    const msLeft = new Date(pairing.expiresAt).getTime() - Date.now();
    expiryTimer.current = setTimeout(() => setExpired(true), Math.max(msLeft, 0));
  };

  useEffect(() => {
    if (!user) return;
    createRequest();
    return () => { if (expiryTimer.current) clearTimeout(expiryTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!request) return undefined;
    const channel = supabase
      .channel(`pairing-${request.requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'device_pairing_requests', filter: `id=eq.${request.requestId}` },
        (payload) => {
          const row = payload.new as { status: string };
          if (row.status === 'claimed') {
            history.replace('/chats/link-device-success');
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [request, history]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/chats/linked-devices" text="" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Scan QR code')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ textAlign: 'center', padding: '16px 24px', color: 'var(--ion-color-medium)', fontSize: 14 }}>
          {tr('Scan this with the camera on the device you want to link.')}
        </div>

        <div style={{
          margin: '16px auto', width: 300, background: '#0c0f16',
          borderRadius: 16, padding: '32px 0', display: 'flex', justifyContent: 'center',
        }}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, minHeight: 220, display: 'flex', alignItems: 'center' }}>
            {expired ? (
              <div style={{ width: 220, textAlign: 'center', color: '#333' }}>
                <p>{tr('This code expired.')}</p>
              </div>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt={tr('Device pairing QR code')} width={220} height={220} />
            ) : (
              <div style={{ width: 220, height: 220, display: 'grid', placeItems: 'center' }}><IonSpinner /></div>
            )}
          </div>
        </div>

        {expired ? (
          <div className="ion-padding">
            <IonButton expand="block" shape="round" onClick={createRequest}>
              <IonIcon icon={refreshOutline} slot="start" />
              {tr('Generate a new code')}
            </IonButton>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--ion-color-medium)', fontSize: 13 }}>
            <IonSpinner name="dots" style={{ width: 16, height: 16 }} />
            {tr('Waiting for scan…')}
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', color: 'var(--ng-security-red)', fontSize: 13, padding: '12px 24px' }}>
            {error}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <IonButton fill="clear" onClick={() => history.push('/chats/link-device-email')}>
            {tr('Link with email instead')}
          </IonButton>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32, color: 'var(--ion-color-medium)', fontSize: 12 }}>
          <IonIcon icon={checkmarkCircle} style={{ fontSize: 14 }} />
          <span>{tr('The QR encodes an encrypted, one-time-use link to your account — not your password.')}</span>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LinkDeviceQR;