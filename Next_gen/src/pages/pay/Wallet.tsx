import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonNote, IonCard, IonCardContent, IonIcon, IonGrid, IonRow, IonCol, IonButton, IonButtons,
} from '@ionic/react';
import { arrowUpCircleOutline, arrowDownCircleOutline, addCircleOutline, cardOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

interface WalletRow { id: string; balance_minor: number; currency: string; }
interface TxRow {
  id: string;
  type: 'credit' | 'debit';
  amount_minor: number;
  currency: string;
  description: string | null;
  created_at: string;
}

const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(minor / 100);

const Wallet: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);

  const loadWallet = () => {
    if (!user) return;
    supabase.from('wallets').select('*').eq('user_id', user.id).single()
      .then(({ data }) => data && setWallet(data as unknown as WalletRow));
    supabase.from('wallet_transactions').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => data && setTxs(data as unknown as TxRow[]));
  };

  useEffect(() => {
    loadWallet();
    if (!user) return;
    // Live-update the balance the moment a top-up webhook (or a transfer) lands —
    // same realtime pattern already used in ChatRoom.tsx.
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        () => loadWallet()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.id}` },
        () => loadWallet()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <BrandMark size={26} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('J Pay')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonCard style={{ background: 'linear-gradient(135deg, var(--ng-deep-blue), var(--ng-blue))' }}>
          <IonCardContent>
            <div style={{ color: '#fff9f3cc', fontSize: 13 }}>{tr('Balance')}</div>
            <div style={{ color: '#fff', fontSize: 32, fontWeight: 800 }}>
              {wallet ? formatMoney(wallet.balance_minor, wallet.currency) : '—'}
            </div>
            <IonGrid>
              <IonRow>
                <IonCol className="ion-text-center">
                  <IonButton fill="clear" style={{ color: '#fff' }} onClick={() => history.push('/pay/send')}>
                    <div><IonIcon icon={arrowUpCircleOutline} style={{ fontSize: 26 }} /><div style={{ fontSize: 11 }}>{tr('Send')}</div></div>
                  </IonButton>
                </IonCol>
                <IonCol className="ion-text-center">
                  <IonButton fill="clear" style={{ color: '#fff' }} onClick={() => history.push('/pay/requests')}>
                    <div><IonIcon icon={arrowDownCircleOutline} style={{ fontSize: 26 }} /><div style={{ fontSize: 11 }}>{tr('Request')}</div></div>
                  </IonButton>
                </IonCol>
                <IonCol className="ion-text-center">
                  <IonButton fill="clear" style={{ color: '#fff' }} onClick={() => history.push('/pay/topup')}>
                    <div><IonIcon icon={addCircleOutline} style={{ fontSize: 26 }} /><div style={{ fontSize: 11 }}>{tr('Top up')}</div></div>
                  </IonButton>
                </IonCol>
                <IonCol className="ion-text-center">
                  <IonButton fill="clear" style={{ color: '#fff' }} onClick={() => history.push('/pay/cards')}>
                    <div><IonIcon icon={cardOutline} style={{ fontSize: 26 }} /><div style={{ fontSize: 11 }}>{tr('Cards')}</div></div>
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonGrid>
          </IonCardContent>
        </IonCard>

        <h3 style={{ marginTop: 20 }}>{tr('Recent transactions')}</h3>
        <IonList>
          {txs.map((t) => (
            <IonItem key={t.id}>
              <IonIcon
                icon={t.type === 'credit' ? arrowDownCircleOutline : arrowUpCircleOutline}
                color={t.type === 'credit' ? 'success' : 'danger'}
                slot="start"
              />
              <IonLabel>
                <h2>{t.description ?? (t.type === 'credit' ? tr('Money received') : tr('Money sent'))}</h2>
                <p>{new Date(t.created_at).toLocaleString()}</p>
              </IonLabel>
              <IonNote slot="end" color={t.type === 'credit' ? 'success' : 'danger'}>
                {t.type === 'credit' ? '+' : '-'}{formatMoney(t.amount_minor, t.currency)}
              </IonNote>
            </IonItem>
          ))}
        </IonList>
        {txs.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('No transactions yet.')}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Wallet;
