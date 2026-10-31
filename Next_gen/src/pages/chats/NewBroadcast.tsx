import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonCheckbox, IonSearchbar, IonTextarea, IonIcon, IonToast, IonSpinner,
} from '@ionic/react';
import { megaphoneOutline, send } from 'ionicons/icons';
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
}

/**
 * A broadcast is NOT a group. Selected contacts each receive the message as
 * an individual, private 1:1 message — they never see each other, and
 * replies go back to the sender privately through that existing direct
 * conversation. No new messaging pipe is needed: this just fans the same
 * body out across get_or_create_direct_conversation + messages inserts.
 */
const NewBroadcast: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [step, setStep] = useState<'pick' | 'compose'>('pick');
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('contacts_view')
        .select('*')
        .eq('owner_id', user.id)
        .order('full_name');
      if (data) setContacts(data as unknown as ContactRow[]);
    };
    load();
  }, [user]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = contacts.filter((c) => c.full_name?.toLowerCase().includes(search.toLowerCase()));

  const send_ = async () => {
    if (!user || !body.trim() || selected.size === 0) return;
    setSending(true);
    try {
      const recipientIds = Array.from(selected);
      for (const recipientId of recipientIds) {
        const { data: convId, error: convErr } = await supabase.rpc('get_or_create_direct_conversation', {
          p_user_a: user.id,
          p_user_b: recipientId,
        });
        if (convErr || !convId) throw convErr ?? new Error('Could not open conversation');
        const { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: convId,
          sender_id: user.id,
          body: body.trim(),
        });
        if (msgErr) throw msgErr;
      }
      setToast(`Sent to ${recipientIds.length} contact${recipientIds.length === 1 ? '' : 's'}.`);
      setTimeout(() => history.replace('/tabs/chats'), 900);
    } catch (err) {
      setToast(err instanceof Error ? err.message : tr('Failed to send broadcast.'));
    } finally {
      setSending(false);
    }
  };

  if (step === 'compose') {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setStep('pick')}>{tr('Back')}</IonButton>
              <BrandMark size={22} className="ng-header-logo" />
            </IonButtons>
            <IonTitle className="ng-grad-text">{tr('New broadcast')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--ion-color-medium)' }}>
            <IonIcon icon={megaphoneOutline} style={{ color: 'var(--ng-blue)', fontSize: 22 }} />
            <span>{tr('Sending to')} {selected.size} {tr('contact')}{selected.size === 1 ? '' : tr('s')} {tr('— each receives this privately.')}</span>
          </div>
          <IonTextarea
            autoGrow
            placeholder={tr('Type your broadcast message')}
            value={body}
            onIonInput={(e) => setBody(e.detail.value ?? '')}
            style={{ background: 'var(--ion-item-background)', borderRadius: 12, padding: 12 }}
          />
          <IonButton expand="block" onClick={send_} disabled={!body.trim() || sending} style={{ marginTop: 20 }}>
            {sending ? <IonSpinner name="dots" /> : (<><IonIcon icon={send} slot="start" />{tr('Send broadcast')}</>)}
          </IonButton>
          <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/chats" text="Back" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Select contacts')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar value={search} onIonInput={(e) => setSearch(e.detail.value ?? '')} placeholder={tr('Search contacts')} />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList lines="none">
          {filtered.map((c) => {
            const isSelected = selected.has(c.contact_user_id);
            return (
              <IonItem
                key={c.contact_user_id}
                button
                detail={false}
                onClick={() => toggle(c.contact_user_id)}
                style={{
                  '--background': isSelected ? 'rgba(255, 121, 0, 0.12)' : undefined,
                  borderLeft: isSelected ? '3px solid var(--ng-blue)' : '3px solid transparent',
                } as React.CSSProperties}
              >
                <div slot="start">
                  <TrustBadge trustLevel={c.trust_level} avatarUrl={c.avatar_url} initials={(c.full_name || '?').slice(0, 1).toUpperCase()} size={40} />
                </div>
                <IonLabel style={{ fontWeight: isSelected ? 600 : 400 }}>{c.full_name}</IonLabel>
                <IonCheckbox slot="end" checked={isSelected} onIonChange={() => toggle(c.contact_user_id)} />
              </IonItem>
            );
          })}
        </IonList>
        {filtered.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('No contacts found.')}
          </div>
        )}
      </IonContent>
      {selected.size > 0 && (
        <IonButton
          onClick={() => setStep('compose')}
          shape="round"
          style={{
            position: 'fixed', bottom: 24, right: 24, width: 56, height: 56,
            '--background': 'var(--ng-blue)', margin: 0,
          } as React.CSSProperties}
        >
          <IonIcon icon={send} slot="icon-only" />
        </IonButton>
      )}
    </IonPage>
  );
};

export default NewBroadcast;