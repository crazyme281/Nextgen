import React, { useCallback, useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonContent, IonList, IonItem, IonLabel,
  IonAvatar, IonSpinner, IonToast,
} from '@ionic/react';
import { arrowBack, checkmarkCircle, personAddOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/i18n';
import {
  type MatchedContact, canReadPhoneContacts, matchDeviceContacts, readDeviceContacts,
} from '@/lib/Phonecontacts';

type Stage = 'loading' | 'denied' | 'unsupported' | 'error' | 'ready';

/**
 * "Import from phone contacts": asks permission to read the phone's address book, finds which of those
 * people already have a Nextgen account, and lets the user add them with one tap — no typing of numbers.
 * Adding someone also adds you to their contacts (database trigger), so it works both ways.
 */
const PhoneContacts: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [stage, setStage] = useState<Stage>('loading');
  const [matches, setMatches] = useState<MatchedContact[]>([]);
  const [deviceTotal, setDeviceTotal] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setStage('loading');
    if (!canReadPhoneContacts()) {
      setStage('unsupported');
      return;
    }
    const result = await readDeviceContacts(); // shows the system permission prompt if needed
    if (result.status !== 'granted') {
      setStage(result.status);
      return;
    }
    try {
      setDeviceTotal(result.contacts.length);
      const found: MatchedContact[] = await matchDeviceContacts(result.contacts);
      const { data: existing } = await supabase.from('contacts').select('contact_user_id').eq('owner_id', user.id);
      const already = new Set<string>((existing ?? []).map((r: { contact_user_id: string }) => r.contact_user_id));
      setAdded(already);
      setMatches([...found].sort((a: MatchedContact, b: MatchedContact) => a.deviceName.localeCompare(b.deviceName)));
      setStage('ready');
    } catch {
      setStage('error');
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const addOne = async (m: MatchedContact): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('contacts').insert({
      owner_id: user.id,
      contact_user_id: m.id,
      display_name: m.deviceName || m.full_name || null,
      details: {},
    });
    // 23505 = already in contacts, which is fine.
    if (error && error.code !== '23505') return false;
    setAdded((prev) => new Set(prev).add(m.id));
    return true;
  };

  const handleAdd = async (m: MatchedContact) => {
    setBusyId(m.id);
    const ok = await addOne(m);
    setBusyId(null);
    if (!ok) setToast(tr('Failed to add contact.'));
  };

  const handleAddAll = async () => {
    setBusyId('all');
    let failed = 0;
    for (const m of matches) {
      if (!added.has(m.id) && !(await addOne(m))) failed += 1;
    }
    setBusyId(null);
    if (failed) setToast(tr('Failed to add contact.'));
    else history.replace('/tabs/contacts');
  };

  const remaining = matches.filter((m: MatchedContact) => !added.has(m.id));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => (history.length > 1 ? history.goBack() : history.replace('/tabs/contacts'))} aria-label={tr('Back')}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <div className="ng-grad-text" style={{ textAlign: 'center', fontWeight: 500 }}>{tr('Phone contacts')}</div>
          <IonButtons slot="end">
            {remaining.length > 1 && (
              <IonButton onClick={handleAddAll} disabled={busyId !== null}>
                {busyId === 'all' ? <IonSpinner name="dots" /> : tr('Add all')}
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {stage === 'loading' && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <IonSpinner />
            <div style={{ marginTop: 12, opacity: 0.7 }}>{tr('Checking your phone contacts…')}</div>
          </div>
        )}

        {stage === 'denied' && (
          <div style={{ padding: 28, textAlign: 'center' }}>
            <p style={{ fontWeight: 600 }}>{tr('Contacts permission is off')}</p>
            <p style={{ opacity: 0.7, fontSize: 14 }}>
              {tr('Allow Nextgen to read your contacts to find friends who are already here. If no prompt appears, turn it on in your phone\'s Settings > Apps > Nextgen > Permissions. You can still add people by email.')}
            </p>
            <IonButton onClick={load}>{tr('Try again')}</IonButton>
          </div>
        )}

        {stage === 'unsupported' && (
          <div style={{ padding: 28, textAlign: 'center', opacity: 0.8 }}>
            {tr('This browser can\'t read phone contacts. Use the Nextgen mobile app, or add people by email.')}
          </div>
        )}

        {stage === 'error' && (
          <div style={{ padding: 28, textAlign: 'center' }}>
            <p>{tr('Couldn\'t check your contacts. Check your connection and try again.')}</p>
            <IonButton onClick={load}>{tr('Try again')}</IonButton>
          </div>
        )}

        {stage === 'ready' && (
          <>
            <div style={{ padding: '14px 16px 4px', fontSize: 13, opacity: 0.7 }}>
              {matches.length === 0
                ? tr('None of your phone contacts are on Nextgen yet.')
                : tr('{n} of your {total} phone contacts are on Nextgen', { n: matches.length, total: deviceTotal })}
            </div>
            <IonList lines="full">
              {matches.map((m: MatchedContact) => {
                const isAdded = added.has(m.id);
                return (
                  <IonItem key={m.id}>
                    <IonAvatar slot="start" style={{ width: 40, height: 40 }}>
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt="" />
                        : (
                          <div style={{
                            width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', background: 'var(--ion-color-primary)', color: '#fff', fontWeight: 700,
                          }}
                          >
                            {(m.deviceName || m.full_name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                    </IonAvatar>
                    <IonLabel>
                      <h3>{m.deviceName || m.full_name}</h3>
                      {m.full_name && m.full_name !== m.deviceName && <p>{m.full_name}</p>}
                    </IonLabel>
                    {isAdded
                      ? <IonIcon icon={checkmarkCircle} color="success" slot="end" aria-label={tr('Added')} />
                      : (
                        <IonButton slot="end" fill="clear" disabled={busyId !== null} onClick={() => handleAdd(m)} aria-label={tr('Add')}>
                          {busyId === m.id ? <IonSpinner name="dots" /> : <IonIcon icon={personAddOutline} />}
                        </IonButton>
                      )}
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default PhoneContacts;