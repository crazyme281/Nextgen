import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonIcon, IonButton, IonToast, IonAlert,
} from '@ionic/react';
import {
  desktopOutline, phonePortraitOutline, globeOutline, trashOutline,
  informationCircleOutline, lockClosed,
} from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import VerifyIdentityModal from '@/components/VerifyIdentityModal';
import { tr } from '@/i18n';

interface DeviceRow {
  token: string;
  platform: string;
  device_label: string | null;
  created_at: string;
  last_seen_at: string;
}

const platformIcon = (platform: string) => {
  if (platform === 'android' || platform === 'ios') return phonePortraitOutline;
  if (platform === 'web') return desktopOutline;
  return globeOutline;
};

const relativeTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Active now';
  if (mins < 60) return `Last active: ${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last active: ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Last active: ${days} day${days === 1 ? '' : 's'} ago`;
};

/**
 * "Linked devices" — opens on an intro screen explaining what linking a
 * device does, THEN the device list below. This intro always shows first.
 *
 * "Link a device" now requires verifying it's you (fingerprint/PIN or
 * password — see VerifyIdentityModal) before showing the QR/email linking
 * screen, rather than linking immediately.
 *
 * Backed by push_tokens — see prior note: this models registered devices
 * that can receive notifications for this account, not literally-active
 * sessions (Supabase's client SDK can't enumerate other JWT sessions).
 */
const LinkedDevices: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [showVerify, setShowVerify] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('push_tokens')
      .select('token, platform, device_label, created_at, last_seen_at')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false });
    if (data) setDevices(data as unknown as DeviceRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const removeDevice = async (token: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', token);
    if (error) {
      setToast(tr('Failed to remove device.'));
      return;
    }
    setDevices((prev) => prev.filter((d) => d.token !== token));
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/chats" text="" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Linked devices')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {/* Intro — always shown first */}
        <div style={{ textAlign: 'center', padding: '32px 24px 8px' }}>
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 6, marginBottom: 20,
          }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'var(--ion-item-background)', border: '1px solid var(--ion-border-color)',
              display: 'grid', placeItems: 'center',
            }}
            >
              <IonIcon icon={phonePortraitOutline} style={{ fontSize: 30, color: 'var(--ng-blue)' }} />
            </div>
            <div style={{
              width: 76, height: 76, borderRadius: 18,
              background: 'linear-gradient(135deg, var(--ng-blue), var(--ng-deep-blue))',
              display: 'grid', placeItems: 'center',
            }}
            >
              <IonIcon icon={desktopOutline} style={{ fontSize: 36, color: '#fff' }} />
            </div>
          </div>

          <h2 style={{ margin: '0 0 8px' }}>{tr('Use Nextgen on other devices')}</h2>
          <p style={{ color: 'var(--ion-color-medium)', fontSize: 14, maxWidth: 340, margin: '0 auto' }}>
            {tr('You can link other devices to this account, including Windows, Mac and Web.')}{' '}
            <span
              style={{ color: 'var(--ion-color-primary)', cursor: 'pointer' }}
              onClick={() => setToast(tr('Linked devices let this account be used from a browser or desktop app.'))}
            >
              {tr('Learn more')}
            </span>
          </p>
        </div>

        <div className="ion-padding">
          <IonButton expand="block" shape="round" onClick={() => setShowVerify(true)} disabled={loading}>
            {tr('Link a device')}
          </IonButton>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '0 24px 20px', color: 'var(--ion-color-medium)', fontSize: 12, textAlign: 'center',
        }}
        >
          <IonIcon icon={lockClosed} style={{ fontSize: 14 }} />
          <span>
            {tr('Your messages are')}{' '}
            <span style={{ color: 'var(--ng-verified-green)', fontWeight: 600 }}>{tr('end-to-end encrypted')}</span>
            {' '}{tr('on all your devices.')}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0 24px 16px',
          color: 'var(--ion-color-medium)', fontSize: 12,
        }}
        >
          <IonIcon icon={informationCircleOutline} style={{ fontSize: 16, marginTop: 1 }} />
          <span>{tr('A linked device can send and receive messages on this account until you remove it below.')}</span>
        </div>

        {/* Already-linked devices */}
        {devices.length > 0 && (
          <>
            <div style={{
              padding: '8px 16px 4px', fontSize: 12, fontWeight: 600,
              letterSpacing: 0.5, color: 'var(--ion-color-medium)',
            }}
            >
              {tr('LINKED DEVICES')}
            </div>
            <IonList lines="full" inset>
              {devices.map((d) => (
                <IonItem key={d.token}>
                  <IonIcon icon={platformIcon(d.platform)} slot="start" style={{ color: 'var(--ng-blue)', fontSize: 26 }} />
                  <IonLabel>
                    <h2 style={{ fontWeight: 600 }}>{d.device_label ?? d.platform}</h2>
                    <p>{relativeTime(d.last_seen_at)}</p>
                  </IonLabel>
                  <IonButton fill="clear" color="danger" slot="end" onClick={() => setConfirmRemove(d.token)}>
                    <IonIcon icon={trashOutline} slot="icon-only" />
                  </IonButton>
                </IonItem>
              ))}
            </IonList>
          </>
        )}

        <IonAlert
          isOpen={!!confirmRemove}
          header={tr('Remove device')}
          message={tr('This device will stop receiving notifications for this account.')}
          buttons={[
            { text: tr('Cancel'), role: 'cancel', handler: () => setConfirmRemove(null) },
            { text: tr('Remove'), role: 'destructive', handler: () => { if (confirmRemove) removeDevice(confirmRemove); setConfirmRemove(null); } },
          ]}
          onDidDismiss={() => setConfirmRemove(null)}
        />
        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2800} onDidDismiss={() => setToast(null)} />

        <VerifyIdentityModal
          isOpen={showVerify}
          onCancel={() => setShowVerify(false)}
          onSuccess={() => {
            setShowVerify(false);
            history.push('/chats/link-device-qr');
          }}
        />
      </IonContent>
    </IonPage>
  );
};

export default LinkedDevices;