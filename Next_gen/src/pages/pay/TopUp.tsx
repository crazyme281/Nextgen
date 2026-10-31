import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonCard, IonCardContent, IonSpinner, IonButton, IonIcon, IonToast, IonText,
} from '@ionic/react';
import { copyOutline, businessOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { supabase } from '@/lib/supabase';
import { tr } from '@/i18n';

interface VirtualAccount {
  account_number: string;
  bank_name: string;
  account_name: string;
}

const TopUp: React.FC = () => {
  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      // Already provisioned?
      const { data: existing } = await supabase
        .from('virtual_accounts')
        .select('account_number,bank_name,account_name')
        .maybeSingle();

      if (existing) {
        if (active) setAccount(existing as VirtualAccount);
        if (active) setLoading(false);
        return;
      }

      // Not yet provisioned — call the edge function to create one.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data, error: fnError } = await supabase.functions.invoke('create-virtual-account', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!active) return;
      if (fnError || !data?.virtualAccount) {
        setError(data?.error ?? fnError?.message ?? 'Could not create a top-up account. Try again.');
      } else {
        setAccount(data.virtualAccount as VirtualAccount);
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setToast(tr('Account number copied'));
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/pay" /> <BrandMark size={22} className="ng-header-logo" /></IonButtons>
          <IonTitle className="ng-grad-text">{tr('Top Up')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && (
          <div className="ion-text-center ion-padding">
            <IonSpinner />
            <p style={{ color: 'var(--ion-color-medium)' }}>{tr('Setting up your top-up account…')}</p>
          </div>
        )}

        {!loading && error && (
          <div className="ion-text-center ion-padding">
            <IonText color="danger">{error}</IonText>
          </div>
        )}

        {!loading && account && (
          <>
            <IonText color="medium">
              <p>
                {tr('Transfer any amount from any bank app to the account below. Your Nextgen wallet is credited automatically, usually within seconds of the transfer landing.')}
              </p>
            </IonText>

            <IonCard style={{ background: 'linear-gradient(135deg, var(--ng-deep-blue), var(--ng-blue))' }}>
              <IonCardContent>
                <div style={{ color: '#fff9f3cc', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IonIcon icon={businessOutline} /> {account.bank_name}
                </div>
                <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: 1, marginTop: 6 }}>
                  {account.account_number}
                </div>
                <div style={{ color: '#fff9f3cc', fontSize: 14, marginTop: 4 }}>{account.account_name}</div>
                <IonButton
                  fill="clear"
                  style={{ '--color': '#fff', marginTop: 8 } as React.CSSProperties}
                  onClick={() => copy(account.account_number)}
                >
                  <IonIcon icon={copyOutline} slot="start" />
                  {tr('Copy account number')}
                </IonButton>
              </IonCardContent>
            </IonCard>

            <IonText color="medium">
              <p style={{ fontSize: 12, marginTop: 16 }}>
                {tr('This account number is permanently yours — you can reuse it any time you want to top up, no need to come back to this screen except to copy the number again.')}
              </p>
            </IonText>
          </>
        )}

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={1800} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default TopUp;