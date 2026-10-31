import React, { useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonInput, IonTextarea, IonButton, IonToast, IonIcon, IonSpinner,
} from '@ionic/react';
import { cameraOutline } from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

const Profile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, username, bio })
      .eq('id', profile.id);
    setToast(error ? error.message : tr('Profile updated'));
    if (!error) await refreshProfile();
  };

  const pickPhoto = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setToast(tr('Please choose an image file.'));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setToast(tr('That image is too large (max 5MB).'));
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setUploading(false);
      setToast(tr('Upload failed. Try a different photo.'));
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq('id', user.id);

    setUploading(false);
    if (updateError) {
      setToast(tr('Photo uploaded, but saving it to your profile failed.'));
      return;
    }
    await refreshProfile();
    setToast(tr('Profile photo updated.'));
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/account" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Profile')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div className="ion-text-center" style={{ marginBottom: 20 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {profile && (
              <TrustBadge
                trustLevel={profile.trust_level}
                avatarUrl={profile.avatar_url}
                initials={(profile.full_name || '?').slice(0, 1).toUpperCase()}
                size={84}
              />
            )}
            <div
              onClick={uploading ? undefined : pickPhoto}
              style={{
                position: 'absolute', bottom: -2, right: -2, width: 30, height: 30,
                borderRadius: '50%', background: 'var(--ng-blue)', display: 'grid',
                placeItems: 'center', cursor: uploading ? 'default' : 'pointer',
                border: '2px solid var(--ion-background-color)',
              }}
            >
              {uploading ? <IonSpinner name="dots" style={{ width: 14, height: 14 }} /> : <IonIcon icon={cameraOutline} style={{ fontSize: 15, color: '#fff' }} />}
            </div>
          </div>
          <div>
            <IonButton fill="clear" size="small" onClick={pickPhoto} disabled={uploading}>
              {tr('Change photo')}
            </IonButton>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelected}
            style={{ display: 'none' }}
          />
        </div>

        <IonInput label={tr('Full name')} labelPlacement="stacked" fill="outline" value={fullName}
          onIonInput={(e) => setFullName(e.detail.value ?? '')} style={{ marginBottom: 12 }} />
        <IonInput label={tr('Username')} labelPlacement="stacked" fill="outline" value={username}
          onIonInput={(e) => setUsername(e.detail.value ?? '')} style={{ marginBottom: 12 }} />
        <IonTextarea label={tr('Bio')} labelPlacement="stacked" fill="outline" value={bio} autoGrow
          placeholder={tr('Tell people a little about yourself')}
          onIonInput={(e) => setBio(e.detail.value ?? '')} style={{ marginBottom: 20 }} />
        <IonButton expand="block" onClick={save}>{tr('Save')}</IonButton>
        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default Profile;