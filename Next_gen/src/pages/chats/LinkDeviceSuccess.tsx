import React from 'react';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

const LinkDeviceSuccess: React.FC = () => (
  <IonPage>
    <IonContent className="ion-padding" fullscreen>
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 12,
      }}
      >
        <BrandMark size={56} />
        <IonIcon icon={checkmarkCircle} style={{ fontSize: 72, color: 'var(--ng-verified-green)' }} />
        <h2 style={{ margin: 0 }}>{tr('Successfully Linked')}</h2>
        <p style={{ color: 'var(--ion-color-medium)', maxWidth: 280 }}>
          {tr('Your devices are now linked to this account.')}
        </p>
        <LinkedDevicesButton />
      </div>
    </IonContent>
  </IonPage>
);

const LinkedDevicesButton: React.FC = () => {
  const history = useHistory();
  return (
    <IonButton
      shape="round"
      style={{ marginTop: 16 }}
      onClick={() => history.replace('/chats/linked-devices')}
    >
      {tr('Done')}
    </IonButton>
  );
};

export default LinkDeviceSuccess;