import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonIcon, IonButton, IonModal, IonInput, IonToast, IonSpinner,
  IonButtons as IonButtonsModal,
} from '@ionic/react';
import { cardOutline, closeOutline, trashOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { supabase } from '@/lib/supabase';
import { tr } from '@/i18n';

interface SavedCard {
  id: string;
  brand: string | null;
  last4: string;
  exp_month: string | null;
  exp_year: string | null;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

const loadPaystackScript = () =>
  new Promise<void>((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Paystack'));
    document.body.appendChild(script);
  });

const Cards: React.FC = () => {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [amountNaira, setAmountNaira] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadCards = () => {
    supabase.from('saved_cards').select('id,brand,last4,exp_month,exp_year')
      .order('created_at', { ascending: false })
      .then(({ data }) => data && setCards(data as SavedCard[]));
  };

  useEffect(() => { loadCards(); }, []);

  const removeCard = async (id: string) => {
    const { error } = await supabase.from('saved_cards').delete().eq('id', id);
    if (error) setToast(error.message);
    else setCards((prev) => prev.filter((c) => c.id !== id));
  };

  const addCard = async () => {
    const naira = Number(amountNaira);
    if (!naira || naira < 50) {
      setToast(tr('Enter at least ₦50 — this first charge is also how the card gets saved'));
      return;
    }
    if (!PAYSTACK_PUBLIC_KEY) {
      setToast(tr('Payments are not configured yet (missing Paystack public key)'));
      return;
    }

    setBusy(true);
    try {
      await loadPaystackScript();
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email ?? `${sessionData.session?.user?.id}@nextgenpay.user`;

      const handler = window.PaystackPop!.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: Math.round(naira * 100),
        currency: 'NGN',
        channels: ['card'],
        callback: (response: { reference: string }) => {
          void (async () => {
            const token = sessionData.session?.access_token;
            const { data, error } = await supabase.functions.invoke('verify-card', {
              body: { reference: response.reference },
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            setBusy(false);
            if (error || data?.error) {
              setToast(data?.error ?? error?.message ?? 'Could not verify card');
            } else {
              setToast(tr('Card added and wallet topped up'));
              setAddOpen(false);
              setAmountNaira('');
              loadCards();
            }
          })();
        },
        onClose: () => setBusy(false),
      });
      handler.openIframe();
    } catch (e) {
      setBusy(false);
      setToast((e as Error).message);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/pay" /> <BrandMark size={22} className="ng-header-logo" /></IonButtons>
          <IonTitle className="ng-grad-text">{tr('Cards')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList>
          {cards.map((c) => (
            <IonItem key={c.id}>
              <IonIcon icon={cardOutline} slot="start" />
              <IonLabel>
                <h2>{(c.brand ?? 'Card').toUpperCase()} •••• {c.last4}</h2>
                <p>{tr('Expires')} {c.exp_month}/{c.exp_year}</p>
              </IonLabel>
              <IonButton fill="clear" color="danger" slot="end" onClick={() => removeCard(c.id)}>
                <IonIcon icon={trashOutline} />
              </IonButton>
            </IonItem>
          ))}
        </IonList>
        {cards.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('No cards saved yet.')}
          </div>
        )}

        <IonButton expand="block" style={{ marginTop: 16 }} onClick={() => setAddOpen(true)}>
          {tr('Add a card')}
        </IonButton>

        <IonModal isOpen={addOpen} onDidDismiss={() => setAddOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonButtonsModal slot="start">
                <BrandMark size={22} className="ng-header-logo" />
              </IonButtonsModal>
              <IonTitle className="ng-grad-text">{tr('Add a card')}</IonTitle>
              <IonButtonsModal slot="end">
                <IonButton onClick={() => setAddOpen(false)}><IonIcon icon={closeOutline} /></IonButton>
              </IonButtonsModal>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <p style={{ color: 'var(--ion-color-medium)', fontSize: 14 }}>
              Nextgen saves your card the same way most Nigerian apps do: the first charge on a new
              card both tops up your wallet and securely saves it for next time. Your card details
              never touch Nextgen's own servers — Paystack handles them directly.
            </p>
            <IonItem>
              <IonLabel position="stacked">{tr('Amount to top up (₦)')}</IonLabel>
              <IonInput type="number" inputmode="decimal" value={amountNaira} min={50}
                onIonInput={(e) => setAmountNaira(e.detail.value ?? '')} placeholder={tr('e.g. 1000')} />
            </IonItem>
            <IonButton expand="block" style={{ marginTop: 20 }} disabled={busy} onClick={addCard}>
              {busy ? <IonSpinner name="dots" /> : tr('Continue to card details')}
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2600} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default Cards;
