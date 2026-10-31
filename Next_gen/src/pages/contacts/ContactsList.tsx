import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonSearchbar, IonFab, IonFabButton, IonIcon, IonButtons,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

interface ContactRow {
  contact_user_id: string;
  full_name: string;
  avatar_url: string | null;
  trust_level: any;
  phone: string | null;
}

const ContactsList: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('contacts_view')
      .select('*')
      .eq('owner_id', user.id)
      .order('full_name');
    if (data) setContacts(data as unknown as ContactRow[]);
  };

  useEffect(() => { load(); }, [user]);

  const startChat = async (otherUserId: string) => {
    if (!user) return;
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
      p_user_a: user.id,
      p_user_b: otherUserId,
    });
    if (!error && data) history.push(`/chats/${data}`);
  };

  const filtered = contacts.filter((c) => c.full_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <BrandMark size={26} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Contacts')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar value={search} onIonInput={(e) => setSearch(e.detail.value ?? '')} />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList>
          {filtered.map((c) => (
            <IonItem key={c.contact_user_id} button detail={false} onClick={() => startChat(c.contact_user_id)}>
              <div slot="start">
                <TrustBadge trustLevel={c.trust_level} avatarUrl={c.avatar_url} initials={(c.full_name || '?').slice(0, 1).toUpperCase()} />
              </div>
              <IonLabel>
                <h2>{c.full_name}</h2>
                <p>{c.phone}</p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
        {filtered.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('No contacts yet. Tap + to add someone by phone number.')}
          </div>
        )}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => history.push('/chats/add-contact')} color="primary">
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>
      </IonContent>
    </IonPage>
  );
};

export default ContactsList;