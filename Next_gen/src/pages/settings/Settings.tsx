import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonIcon, IonButton, IonButtons, IonToggle, IonSelect, IonSelectOption,
} from '@ionic/react';
import {
  personCircleOutline, shieldCheckmarkOutline, notificationsOutline, lockClosedOutline,
  languageOutline, logOutOutline, addOutline, shareSocialOutline, menuOutline, pencilOutline, fingerPrint,
} from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import BrandMark from '@/components/BrandMark';
import {
  isBiometricAvailable, isFingerprintEnabledFor, setFingerprintEnabled, verifyFingerprint,
} from '@/lib/biometric';
import { tr, LANGUAGES, useI18n } from '@/i18n';

/** Language chooser: switches the whole app immediately and is remembered. */
const LanguageItem: React.FC = () => {
  const { lang, setLang } = useI18n();
  return (
    <IonItem>
      <IonIcon icon={languageOutline} slot="start" />
      <IonLabel>{tr('Language')}</IonLabel>
      <IonSelect value={lang} interface="popover" onIonChange={(e) => setLang(e.detail.value)}>
        {LANGUAGES.map((l) => <IonSelectOption key={l.code} value={l.code}>{l.label}</IonSelectOption>)}
      </IonSelect>
    </IonItem>
  );
};

/** Only rendered on devices that actually have an enrolled fingerprint (hidden on web / no biometrics). */
const FingerprintToggle: React.FC = () => {
  const { user } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(isFingerprintEnabledFor(user?.id));

  useEffect(() => { isBiometricAvailable().then(setAvailable); }, []);

  if (!available || !user) return null;

  const onToggle = async (on: boolean) => {
    if (on === enabled) return;
    if (on) {
      // Prove it works before turning the lock on, so nobody locks themselves out.
      const ok = await verifyFingerprint('Confirm your fingerprint');
      if (!ok) return;
      setFingerprintEnabled(user.id, true);
      setEnabled(true);
    } else {
      setFingerprintEnabled(user.id, false);
      setEnabled(false);
    }
  };

  return (
    <IonItem>
      <IonIcon icon={fingerPrint} slot="start" />
      <IonLabel>{tr('Fingerprint unlock')}</IonLabel>
      <IonToggle checked={enabled} onIonChange={(e) => onToggle(e.detail.checked)} />
    </IonItem>
  );
};

// The reference image is a TikTok-style profile page (avatar ring,
// name/handle, Following/Followers/Likes, bio, content grid). This app
// doesn't have a follow-based social graph, so those three specific
// stats don't map onto real data here — substituted with figures this
// app actually tracks (contacts, groups, trust level) rather than
// showing fabricated numbers. Layout/structure otherwise matches: avatar
// with ring, name + edit button, handle, stat row, bio, icon toolbar.
const Settings: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [groupsCount, setGroupsCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', profile.id)
      .then(({ count }) => setContactsCount(count ?? 0));

    supabase
      .from('conversation_participants')
      .select('conversation_id, conversations!inner(kind)', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('conversations.kind', 'group')
      .then(({ count }) => setGroupsCount(count ?? 0));
  }, [profile]);

  const trustLabel: Record<string, string> = {
    unverified: 'Unverified',
    verified_identity: 'Verified',
    verified_business: 'Business',
    high_assurance: 'High assurance',
    risk_detected: 'Flagged',
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonButtons slot="end">
            <IonIcon icon={addOutline} style={{ fontSize: 22, marginRight: 16, cursor: 'pointer' }} />
            <IonIcon icon={shareSocialOutline} style={{ fontSize: 20, marginRight: 16, cursor: 'pointer' }} />
            <IonIcon icon={menuOutline} style={{ fontSize: 22, marginRight: 8, cursor: 'pointer' }} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px 20px' }}>
          {profile && (
            <TrustBadge
              trustLevel={profile.trust_level}
              avatarUrl={profile.avatar_url}
              initials={(profile.full_name || '?').slice(0, 1).toUpperCase()}
              size={88}
            />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{profile?.full_name ?? tr('Your profile')}</div>
            <IonButton size="small" fill="outline" routerLink="/tabs/profile" style={{ '--border-radius': '16px', height: 28 } as React.CSSProperties}>
              <IonIcon icon={pencilOutline} slot="start" style={{ fontSize: 13 }} />
              {tr('Edit')}
            </IonButton>
          </div>
          {profile?.username && <div style={{ color: 'var(--ion-color-medium)', fontSize: 13 }}>@{profile.username}</div>}

          <div style={{ display: 'flex', gap: 28, marginTop: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{contactsCount ?? '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>{tr('Contacts')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{groupsCount ?? '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>{tr('Groups')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{profile ? trustLabel[profile.trust_level] : '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>{tr('Trust level')}</div>
            </div>
          </div>

          {profile?.bio && (
            <div style={{ marginTop: 14, fontSize: 13, textAlign: 'center', color: 'var(--ion-text-color)', maxWidth: 280 }}>
              {profile.bio}
            </div>
          )}
        </div>

        <IonList inset>
          <FingerprintToggle />
          <IonItem button><IonIcon icon={shieldCheckmarkOutline} slot="start" color="success" /><IonLabel>{tr('J Verify — Identity Trust')}</IonLabel></IonItem>
          <IonItem button><IonIcon icon={notificationsOutline} slot="start" /><IonLabel>{tr('Notifications')}</IonLabel></IonItem>
          <IonItem button><IonIcon icon={lockClosedOutline} slot="start" /><IonLabel>{tr('Privacy & Security (J Shield)')}</IonLabel></IonItem>
          <LanguageItem />
          <IonItem button><IonIcon icon={personCircleOutline} slot="start" /><IonLabel>{tr('Nextgen Business')}</IonLabel></IonItem>
        </IonList>

        <div className="ion-padding">
          <IonButton expand="block" color="danger" fill="outline" onClick={signOut}>
            <IonIcon icon={logOutOutline} slot="start" />
            {tr('Log out')}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Settings;