import React from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonIcon, IonButton, IonButtons,
} from '@ionic/react';
import {
  personCircleOutline, shieldCheckmarkOutline, notificationsOutline, lockClosedOutline,
  languageOutline, logOutOutline, phonePortraitOutline,
} from 'ionicons/icons';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

const Settings: React.FC = () => {
  const { profile, signOut } = useAuth();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><BrandMark size={26} className="ng-header-logo" /></IonButtons>
          <IonTitle>{tr('Settings')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonItem button routerLink="/tabs/profile" lines="full">
          <div slot="start">
            {profile && (
              <TrustBadge trustLevel={profile.trust_level} avatarUrl={profile.avatar_url} initials={(profile.full_name || '?').slice(0, 1).toUpperCase()} />
            )}
          </div>
          <IonLabel>
            <h2>{profile?.full_name ?? tr('Your profile')}</h2>
            <p>{profile?.username ? `@${profile.username}` : tr('Set up your profile')}</p>
          </IonLabel>
        </IonItem>

        <IonList inset>
          <IonItem button><IonIcon icon={shieldCheckmarkOutline} slot="start" color="success" /><IonLabel>{tr('J Verify — Identity Trust')}</IonLabel></IonItem>
          <IonItem button><IonIcon icon={notificationsOutline} slot="start" /><IonLabel>{tr('Notifications')}</IonLabel></IonItem>
          <IonItem button><IonIcon icon={lockClosedOutline} slot="start" /><IonLabel>{tr('Privacy & Security (J Shield)')}</IonLabel></IonItem>
          <IonItem button routerLink="/chats/linked-devices"><IonIcon icon={phonePortraitOutline} slot="start" /><IonLabel>{tr('Linked devices')}</IonLabel></IonItem>
          <IonItem button><IonIcon icon={languageOutline} slot="start" /><IonLabel>{tr('Language')}</IonLabel></IonItem>
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