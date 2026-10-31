import React, { useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent,
  IonIcon, IonButton, IonPopover, IonList, IonItem, IonLabel, IonSpinner, IonToast,
} from '@ionic/react';
import {
  menuOutline, cameraOutline, personCircleOutline, shieldCheckmarkOutline,
  notificationsOutline, lockClosedOutline, languageOutline, logOutOutline,
  phonePortraitOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Account profile — reached from Chats' 3-dot menu → "Settings". This page
 * is the normal view (avatar, name, bio); the actual settings list
 * (J Verify, Notifications, Privacy, etc.) is hidden behind the ≡ icon
 * top-right and only appears in that dropdown, mirroring the same
 * tap-to-reveal pattern used for the Chats 3-dot menu.
 */
const AccountProfile: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const history = useHistory();
  const [menuOpen, setMenuOpen] = useState(false);
  const [popoverEvent, setPopoverEvent] = useState<Event | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickPhoto = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { setToast(tr('Please choose an image file.')); return; }
    if (file.size > MAX_AVATAR_BYTES) { setToast(tr('That image is too large (max 5MB).')); return; }

    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { setUploading(false); setToast(tr('Upload failed. Try a different photo.')); return; }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq('id', user.id);
    setUploading(false);
    if (updateError) { setToast(tr('Photo uploaded, but saving it to your profile failed.')); return; }
    await refreshProfile();
    setToast(tr('Profile photo updated.'));
  };

  const menuItems: Array<{ icon: string; label: string; onClick: () => void }> = [
    { icon: shieldCheckmarkOutline, label: tr('J Verify — Identity Trust'), onClick: () => setMenuOpen(false) },
    { icon: notificationsOutline, label: tr('Notifications'), onClick: () => setMenuOpen(false) },
    { icon: lockClosedOutline, label: tr('Privacy & Security (J Shield)'), onClick: () => setMenuOpen(false) },
    { icon: phonePortraitOutline, label: tr('Linked devices'), onClick: () => { setMenuOpen(false); history.push('/chats/linked-devices'); } },
    { icon: languageOutline, label: tr('Language'), onClick: () => setMenuOpen(false) },
    { icon: personCircleOutline, label: tr('Nextgen Business'), onClick: () => setMenuOpen(false) },
    { icon: logOutOutline, label: tr('Log out'), onClick: () => { setMenuOpen(false); signOut(); } },
  ];

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/chats" text="" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonButtons slot="end">
            <IonButton fill="clear" onClick={(e) => { setPopoverEvent(e.nativeEvent); setMenuOpen(true); }}>
              <IonIcon icon={menuOutline} style={{ fontSize: 24 }} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <div className="ion-text-center" style={{ padding: '12px 16px 24px' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {profile && (
              <TrustBadge
                trustLevel={profile.trust_level}
                avatarUrl={profile.avatar_url}
                initials={(profile.full_name || '?').slice(0, 1).toUpperCase()}
                size={96}
              />
            )}
            <div
              onClick={uploading ? undefined : pickPhoto}
              style={{
                position: 'absolute', bottom: -2, right: -2, width: 32, height: 32,
                borderRadius: '50%', background: 'var(--ng-blue)', display: 'grid',
                placeItems: 'center', cursor: uploading ? 'default' : 'pointer',
                border: '2px solid var(--ion-background-color)',
              }}
            >
              {uploading ? <IonSpinner name="dots" style={{ width: 14, height: 14 }} /> : <IonIcon icon={cameraOutline} style={{ fontSize: 16, color: '#fff' }} />}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelected} style={{ display: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }}>
            <h2 style={{ margin: 0, fontWeight: 700 }}>{profile?.full_name ?? tr('Your name')}</h2>
            <IonButton size="small" fill="outline" shape="round" onClick={() => history.push('/tabs/profile')}>
              {tr('Edit')}
            </IonButton>
          </div>
          <p style={{ color: 'var(--ion-color-medium)', margin: '4px 0 0' }}>
            {profile?.username ? `@${profile.username}` : tr('Set up your username')}
          </p>
          {profile?.bio && (
            <p style={{ margin: '10px auto 0', maxWidth: 300 }}>{profile.bio}</p>
          )}
        </div>

        <IonPopover
          isOpen={menuOpen}
          event={popoverEvent}
          onDidDismiss={() => setMenuOpen(false)}
          side="bottom"
          alignment="end"
          arrow={false}
        >
          <IonList lines="none" style={{ padding: '6px 0', minWidth: 240 }}>
            {menuItems.map((item) => (
              <IonItem key={item.label} button detail={false} onClick={item.onClick}>
                <IonIcon icon={item.icon} slot="start" style={{ fontSize: 18 }} />
                <IonLabel>{item.label}</IonLabel>
              </IonItem>
            ))}
          </IonList>
        </IonPopover>

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default AccountProfile;