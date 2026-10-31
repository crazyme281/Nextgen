import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonSearchbar, IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption,
  IonLabel, IonIcon, IonFab, IonFabButton, IonActionSheet,
} from '@ionic/react';
import { add, ellipsisVertical, star, chevronForward, heart } from 'ionicons/icons';
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
  is_favorite: boolean;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * "Search your contacts" page — this is what opens when + is tapped from
 * Chats. Only tapping + on THIS page opens the New Contact form.
 */
const ContactsBrowse: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    if (!error && data) history.push(`/chats/room/${data}`);
  };

  const toggleFavorite = async (contactUserId: string, next: boolean) => {
    if (!user) return;
    setContacts((prev) => prev.map((c) => (
      c.contact_user_id === contactUserId ? { ...c, is_favorite: next } : c
    )));
    await supabase
      .from('contacts')
      .update({ is_favorite: next })
      .eq('owner_id', user.id)
      .eq('contact_user_id', contactUserId);
  };

  const filtered = useMemo(
    () => contacts.filter((c) => c.full_name?.toLowerCase().includes(search.toLowerCase())),
    [contacts, search]
  );

  const favorites = filtered.filter((c) => c.is_favorite);

  const grouped = useMemo(() => {
    const map: Record<string, ContactRow[]> = {};
    filtered.forEach((c) => {
      const letter = (c.full_name?.[0] ?? '#').toUpperCase();
      const key = ALPHABET.includes(letter) ? letter : '#';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [filtered]);

  const scrollToSection = (key: string) => {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/chats" text="" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Contacts')}</IonTitle>
          <IonButtons slot="end">
            <IonIcon
              icon={ellipsisVertical}
              style={{ fontSize: 20, padding: 12, cursor: 'pointer' }}
              onClick={() => setShowMenu(true)}
            />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ '--padding-end': '28px' } as React.CSSProperties}>
        <div style={{ padding: '12px 16px 0' }}>
          <IonSearchbar
            placeholder={`${contacts.length} contacts`}
            value={search}
            onIonInput={(e) => setSearch(e.detail.value ?? '')}
            style={{ '--border-radius': '24px', padding: 0 }}
          />
        </div>

        <IonList lines="none">
          <IonItem button detail={false} onClick={() => history.push('/tabs/profile')}>
            <IonLabel>{tr('My profile')}</IonLabel>
          </IonItem>
          <IonItem button detail={false} onClick={() => history.push('/tabs/chats')}>
            <IonLabel>{tr('My groups')}</IonLabel>
            <IonIcon icon={chevronForward} slot="end" color="medium" />
          </IonItem>
        </IonList>

        {favorites.length > 0 && (
          <>
            <div style={{
              padding: '16px 16px 4px', fontSize: 12, fontWeight: 600,
              letterSpacing: 0.5, color: 'var(--ion-color-medium)',
            }}
            >
              {tr('FAVORITES')}
            </div>
            <IonList lines="none">
              {favorites.map((c) => (
                <IonItemSliding key={`fav-${c.contact_user_id}`}>
                  <IonItem button detail={false} onClick={() => startChat(c.contact_user_id)}>
                    <div slot="start">
                      <TrustBadge
                        trustLevel={c.trust_level}
                        avatarUrl={c.avatar_url}
                        initials={(c.full_name || '?').slice(0, 1).toUpperCase()}
                      />
                    </div>
                    <IonLabel>{c.full_name}</IonLabel>
                  </IonItem>
                  <IonItemOptions side="end">
                    <IonItemOption color="medium" onClick={() => toggleFavorite(c.contact_user_id, false)}>
                      <IonIcon icon={star} slot="icon-only" />
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              ))}
            </IonList>
          </>
        )}

        {ALPHABET.concat('#').map((letter) => (
          grouped[letter]?.length ? (
            <div key={letter} ref={(el) => { sectionRefs.current[letter] = el; }}>
              <div style={{
                padding: '10px 16px 2px', fontSize: 12, fontWeight: 600, color: 'var(--ion-color-medium)',
              }}
              >
                {letter}
              </div>
              <IonList lines="none">
                {grouped[letter].map((c) => (
                  <IonItemSliding key={c.contact_user_id}>
                    <IonItem button detail={false} onClick={() => startChat(c.contact_user_id)}>
                      <div slot="start">
                        <TrustBadge
                          trustLevel={c.trust_level}
                          avatarUrl={c.avatar_url}
                          initials={(c.full_name || '?').slice(0, 1).toUpperCase()}
                        />
                      </div>
                      <IonLabel>
                        <h2>{c.full_name}</h2>
                        <p>{c.phone}</p>
                      </IonLabel>
                    </IonItem>
                    <IonItemOptions side="end">
                      <IonItemOption
                        color="warning"
                        onClick={() => toggleFavorite(c.contact_user_id, !c.is_favorite)}
                      >
                        <IonIcon icon={c.is_favorite ? star : heart} slot="icon-only" />
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                ))}
              </IonList>
            </div>
          ) : null
        ))}

        {filtered.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('No contacts yet. Tap + to add someone by phone number.')}
          </div>
        )}

        {/* A-Z side index */}
        <div
          style={{
            position: 'fixed', top: '30%', right: 4, display: 'flex', flexDirection: 'column',
            alignItems: 'center', fontSize: 10, color: 'var(--ion-color-medium)', zIndex: 5,
          }}
        >
          <IonIcon icon={heart} style={{ fontSize: 12, color: 'var(--ng-security-red)', marginBottom: 2 }} />
          {ALPHABET.concat('#').map((letter) => (
            <div
              key={letter}
              onClick={() => grouped[letter]?.length && scrollToSection(letter)}
              style={{
                padding: '1px 4px', cursor: grouped[letter]?.length ? 'pointer' : 'default',
                opacity: grouped[letter]?.length ? 1 : 0.4,
              }}
            >
              {letter}
            </div>
          ))}
        </div>

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => history.push('/chats/add-contact')} color="primary">
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>
      </IonContent>

      <IonActionSheet
        isOpen={showMenu}
        onDidDismiss={() => setShowMenu(false)}
        buttons={[
          { text: tr('Refresh'), handler: () => load() },
          { text: tr('Cancel'), role: 'cancel' },
        ]}
      />
    </IonPage>
  );
};

export default ContactsBrowse;