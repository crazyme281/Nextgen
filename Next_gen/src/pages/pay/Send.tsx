import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonSearchbar, IonInput, IonButton, IonToast, IonModal,
  IonButtons as IonButtonsModal, IonIcon,
} from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { supabase } from '@/lib/supabase';
import TrustBadge from '@/components/TrustBadge';
import type { Profile } from '@/context/AuthContext';
import { tr } from '@/i18n';

interface ContactRow {
  contact_user_id: string;
  full_name: string;
  avatar_url: string | null;
  trust_level: Profile['trust_level'];
}

const Send: React.FC = () => {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [amountNaira, setAmountNaira] = useState('');
  const [pin, setPin] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.from('contacts_view').select('contact_user_id,full_name,avatar_url,trust_level')
      .then(({ data }) => data && setContacts(data as unknown as ContactRow[]));
  }, []);

  const filtered = contacts.filter((c) => c.full_name?.toLowerCase().includes(search.toLowerCase()));

  const closeModal = () => {
    setSelected(null);
    setAmountNaira('');
    setPin('');
  };

  const confirmSend = async () => {
    if (!selected) return;
    const naira = Number(amountNaira);
    if (!naira || naira <= 0) {
      setToast(tr('Enter a valid amount'));
      return;
    }
    if (pin.length !== 4) {
      setToast(tr('Enter your 4-digit transaction PIN'));
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const fromId = userData.user?.id;
    if (!fromId) {
      setToast(tr('Session expired — please log in again'));
      return;
    }

    setSending(true);
    const { data: pinOk, error: pinErr } = await supabase.rpc('verify_transaction_pin', { p_pin: pin });
    if (pinErr || !pinOk) {
      setSending(false);
      setToast(tr('Incorrect PIN'));
      return;
    }

    const { error } = await supabase.rpc('transfer_funds', {
      p_from: fromId,
      p_to: selected.contact_user_id,
      p_amount_minor: Math.round(naira * 100),
      p_description: `To ${selected.full_name}`,
    });
    setSending(false);

    if (error) {
      setToast(error.message);
    } else {
      setToast(`Sent ₦${naira.toLocaleString()} to ${selected.full_name}`);
      closeModal();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/pay" /> <BrandMark size={22} className="ng-header-logo" /></IonButtons>
          <IonTitle className="ng-grad-text">{tr('Send Money')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar value={search} onIonInput={(e) => setSearch(e.detail.value ?? '')} placeholder={tr('Search contacts')} />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          {filtered.map((c) => (
            <IonItem key={c.contact_user_id} button onClick={() => setSelected(c)}>
              <div slot="start"><TrustBadge trustLevel={c.trust_level} avatarUrl={c.avatar_url} initials={(c.full_name ?? '?').charAt(0)} size={38} /></div>
              <IonLabel>{c.full_name}</IonLabel>
            </IonItem>
          ))}
        </IonList>
        {filtered.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('No contacts found.')}
          </div>
        )}

        <IonModal isOpen={!!selected} onDidDismiss={closeModal}>
          <IonHeader>
            <IonToolbar>
              <IonButtonsModal slot="start">
                <BrandMark size={22} className="ng-header-logo" />
              </IonButtonsModal>
              <IonTitle>{tr('Send to')} {selected?.full_name}</IonTitle>
              <IonButtonsModal slot="end">
                <IonButton onClick={closeModal}><IonIcon icon={closeOutline} /></IonButton>
              </IonButtonsModal>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">{tr('Amount (₦)')}</IonLabel>
              <IonInput type="number" inputmode="decimal" value={amountNaira}
                onIonInput={(e) => setAmountNaira(e.detail.value ?? '')} placeholder="0.00" />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">{tr('Transaction PIN')}</IonLabel>
              <IonInput type="password" inputmode="numeric" maxlength={4} value={pin}
                onIonInput={(e) => setPin(e.detail.value ?? '')} placeholder="••••" />
            </IonItem>
            <IonButton expand="block" style={{ marginTop: 20 }} disabled={sending} onClick={confirmSend}>
              {sending ? tr('Sending…') : tr('Confirm & Send')}
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2200} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default Send;