import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonSearchbar, IonInput, IonButton, IonToast, IonModal,
  IonButtons as IonButtonsModal, IonIcon,
} from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import type { Profile } from '@/context/AuthContext';
import { tr } from '@/i18n';

interface ContactRow {
  contact_user_id: string;
  full_name: string;
  avatar_url: string | null;
  trust_level: Profile['trust_level'];
}

const Request: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [amountNaira, setAmountNaira] = useState('');
  const [note, setNote] = useState('');
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
    setNote('');
  };

  const confirmRequest = async () => {
    if (!selected || !user) return;
    const naira = Number(amountNaira);
    if (!naira || naira <= 0) {
      setToast(tr('Enter a valid amount'));
      return;
    }

    setSending(true);
    const { error } = await supabase.from('payment_requests').insert({
      requester_id: user.id,
      payee_id: selected.contact_user_id,
      amount_minor: Math.round(naira * 100),
      description: note.trim() || null,
    });
    setSending(false);

    if (error) {
      setToast(error.message);
    } else {
      setToast(`Requested ₦${naira.toLocaleString()} from ${selected.full_name}`);
      closeModal();
      history.replace('/pay/requests');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/pay/requests" /> <BrandMark size={22} className="ng-header-logo" /></IonButtons>
          <IonTitle className="ng-grad-text">{tr('Request Money')}</IonTitle>
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
              <IonTitle>{tr('Request from')} {selected?.full_name}</IonTitle>
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
              <IonLabel position="stacked">{tr('Note (optional)')}</IonLabel>
              <IonInput value={note} onIonInput={(e) => setNote(e.detail.value ?? '')} placeholder={tr('What\'s it for?')} />
            </IonItem>
            <IonButton expand="block" style={{ marginTop: 20 }} disabled={sending} onClick={confirmRequest}>
              {sending ? tr('Sending request…') : tr('Send Request')}
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2200} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default Request;
