import React from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonButtons,
} from '@ionic/react';
import BrandMark from '@/components/BrandMark';
import { useHistory } from 'react-router-dom';
import {
  storefrontOutline, gameControllerOutline, chevronForwardOutline, walletOutline,
} from 'ionicons/icons';
import { tr } from '@/i18n';

/**
 * Activities Hub — entry point into the modules the spec requires to be
 * kept as distinct products (separate tables, separate RLS, separate
 * RPCs): Shopping, Games, Pay. This page itself only routes; it
 * holds none of their business logic.
 */
const MODULES = [
  {
    key: 'shop',
    title: 'Marketplace',
    subtitle: 'Buy and sell with other Next Gen users',
    icon: storefrontOutline,
    gradient: 'linear-gradient(135deg, var(--ng-deep-blue), var(--ng-blue))',
    path: '/market/shop',
  },
  {
    key: 'games',
    title: 'Games',
    subtitle: 'Tic-Tac-Toe, Connect Four, Checkers and Chess — PvP or vs AI',
    icon: gameControllerOutline,
    gradient: 'linear-gradient(135deg, #2A0E6B, #7A3DFF)',
    path: '/games',
  },
  {
    key: 'pay',
    title: 'Pay',
    subtitle: 'Send money, top up, and manage your wallet',
    icon: walletOutline,
    gradient: 'linear-gradient(135deg, #0E6B4B, #2ECC71)',
    path: '/tabs/pay',
  },
];

const MarketplaceHub: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><BrandMark size={26} className="ng-header-logo" /></IonButtons>
          <IonTitle>{tr('Activities')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <p style={{ color: 'var(--ion-color-medium)', marginTop: 0 }}>
          {tr('Shopping, Games and Pay — everything else you can do, one hub.')}
        </p>

        {MODULES.map((m) => (
          <div
            key={m.key}
            onClick={() => history.push(m.path)}
            role="button"
            style={{
              background: m.gradient,
              borderRadius: 18,
              padding: '20px 18px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.16)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <IonIcon icon={m.icon} style={{ fontSize: 26, color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>{m.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>{m.subtitle}</div>
            </div>
            <IonIcon icon={chevronForwardOutline} style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }} />
          </div>
        ))}
      </IonContent>
    </IonPage>
  );
};

export default MarketplaceHub;