import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonCheckbox, IonInput, IonFab, IonFabButton, IonIcon,
  IonToggle, IonToast,
} from '@ionic/react';
import {
  arrowForward, arrowBack, checkmark, cameraOutline, searchOutline,
  radioButtonOn, radioButtonOff,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import BrandMark from '@/components/BrandMark';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import { tr } from '@/i18n';

interface ContactRow {
  contact_user_id: string;
  full_name: string;
  avatar_url: string | null;
  trust_level: any;
}

type PermissionLevel = 'all' | 'admins';

interface GroupPermissionsState {
  edit_settings: PermissionLevel;
  send_messages: PermissionLevel;
  add_members: PermissionLevel;
  invite_via_link: PermissionLevel;
  approve_new_members: boolean;
}

const DEFAULT_PERMISSIONS: GroupPermissionsState = {
  edit_settings: 'admins',
  send_messages: 'all',
  add_members: 'admins',
  invite_via_link: 'admins',
  approve_new_members: false,
};

const PERMISSION_ROWS: Array<{ key: keyof Omit<GroupPermissionsState, 'approve_new_members'>; label: string }> = [
  { key: 'edit_settings', label: tr('Edit group settings') },
  { key: 'send_messages', label: tr('Send messages') },
  { key: 'add_members', label: tr('Add other members') },
  { key: 'invite_via_link', label: tr('Invite via link') },
];

const levelLabel = (l: PermissionLevel) => (l === 'all' ? 'All participants' : 'Only admins');

type Step = 'pick' | 'details' | 'permissions';

const NewGroup: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [step, setStep] = useState<Step>('pick');

  // Step 1: pick contacts
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Step 2: details
  const [title, setTitle] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Step 3: permissions
  const [permissions, setPermissions] = useState<GroupPermissionsState>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from('contacts_view')
        .select('*')
        .eq('owner_id', user.id)
        .order('full_name');
      if (data) setContacts(data as unknown as ContactRow[]);
    })();
  }, [user]);

  const toggleContact = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredContacts = contacts.filter((c) =>
    c.full_name?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const createGroup = async () => {
    if (!title.trim() || selected.size === 0 || !user) return;
    setCreating(true);
    try {
      const { data: conversationId, error } = await supabase.rpc('create_group_conversation', {
        p_title: title.trim(),
        p_member_ids: Array.from(selected),
      });
      if (error || !conversationId) throw error ?? new Error('Group creation failed');

      // Upload avatar (if chosen) now that the group — and this user's
      // participant row — exists, since storage RLS checks membership.
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'jpg';
        const path = `${conversationId}/group-avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(path, avatarFile, { contentType: avatarFile.type || undefined, upsert: true });
        if (!uploadError) {
          const { data: signed } = await supabase.storage
            .from('chat-media')
            .createSignedUrl(path, 60 * 60 * 24 * 365);
          if (signed?.signedUrl) {
            await supabase.from('conversations').update({ avatar_url: signed.signedUrl }).eq('id', conversationId as string);
          }
        }
      }

      // Apply any non-default permission choices.
      await supabase.from('group_permissions').update(permissions).eq('conversation_id', conversationId as string);

      history.replace(`/chats/room/${conversationId}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : tr('Failed to create group. Please try again.'));
    } finally {
      setCreating(false);
    }
  };

  // ---- Step 3: permissions screen ----
  if (step === 'permissions') {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setStep('details')}>
                <IonIcon icon={arrowBack} slot="icon-only" />
              </IonButton>
              <BrandMark size={22} className="ng-header-logo" />
            </IonButtons>
            <IonTitle className="ng-grad-text">{tr('Group permissions')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="ion-padding-horizontal ion-padding-top" style={{ color: 'var(--ion-color-medium)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {tr('Group members can:')}
          </div>
          <IonList lines="full" inset={false}>
            {PERMISSION_ROWS.map((row) => (
              <IonItem key={row.key} lines="full">
                <IonLabel>
                  <h2 style={{ fontWeight: 600 }}>{row.label}</h2>
                </IonLabel>
                <div slot="end" style={{ display: 'flex', gap: 6 }}>
                  {(['all', 'admins'] as PermissionLevel[]).map((level) => {
                    const active = permissions[row.key] === level;
                    return (
                      <button
                        key={level}
                        onClick={() => setPermissions((p) => ({ ...p, [row.key]: level }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          border: 'none', borderRadius: 999, cursor: 'pointer',
                          padding: '6px 10px', fontSize: 12, fontWeight: 600,
                          background: active ? 'var(--ng-blue)' : 'var(--ion-item-background)',
                          color: active ? '#fff' : 'var(--ion-text-color)',
                        }}
                      >
                        <IonIcon icon={active ? radioButtonOn : radioButtonOff} style={{ fontSize: 14 }} />
                        {levelLabel(level)}
                      </button>
                    );
                  })}
                </div>
              </IonItem>
            ))}
          </IonList>

          <div className="ion-padding-horizontal ion-padding-top" style={{ color: 'var(--ion-color-medium)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {tr('Admins can:')}
          </div>
          <IonList lines="full">
            <IonItem>
              <IonLabel>
                <h2 style={{ fontWeight: 600 }}>{tr('Approve new members')}</h2>
              </IonLabel>
              <IonToggle
                slot="end"
                checked={permissions.approve_new_members}
                onIonChange={(e) => setPermissions((p) => ({ ...p, approve_new_members: e.detail.checked }))}
                style={{ '--background-checked': 'var(--ng-blue)', '--handle-background-checked': '#fff' } as React.CSSProperties}
              />
            </IonItem>
          </IonList>
        </IonContent>
      </IonPage>
    );
  }

  // ---- Step 2: group details (photo + name) ----
  if (step === 'details') {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setStep('pick')}>
                <IonIcon icon={arrowBack} slot="icon-only" />
              </IonButton>
              <BrandMark size={22} className="ng-header-logo" />
            </IonButtons>
            <IonTitle className="ng-grad-text">{tr('New group')}</IonTitle>
            <IonButtons slot="end">
              <IonButton disabled={!title.trim() || creating} onClick={createGroup}>
                <IonIcon icon={checkmark} slot="icon-only" />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="ion-padding" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div
              onClick={() => avatarInputRef.current?.click()}
              style={{
                width: 96, height: 96, borderRadius: '50%', background: 'var(--ion-item-background)',
                display: 'grid', placeItems: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden',
              }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <IonIcon icon={cameraOutline} style={{ fontSize: 30, opacity: 0.6 }} />
              )}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarPick} />

            <IonInput
              placeholder={tr('Group name')}
              value={title}
              onIonInput={(e) => setTitle(e.detail.value ?? '')}
              style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }}
            />
          </div>

          <IonList inset={false}>
            <IonItem button detail onClick={() => setStep('permissions')}>
              <IonLabel>{tr('Group permissions')}</IonLabel>
            </IonItem>
          </IonList>

          <div className="ion-padding-horizontal" style={{ color: 'var(--ion-color-medium)', fontSize: 13 }}>
            {selected.size} {tr('participant')}{selected.size === 1 ? '' : tr('s')}
          </div>
        </IonContent>
        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
      </IonPage>
    );
  }

  // ---- Step 1: pick contacts ----
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/chats" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Select contacts')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <div style={{ padding: '0 12px 10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--ion-item-background)', borderRadius: 12, padding: '8px 12px',
            }}>
              <IonIcon icon={searchOutline} style={{ opacity: 0.6 }} />
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder={tr('Search contacts')}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ion-text-color)', fontSize: 14 }}
              />
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {selected.size > 0 && (
          <div className="ion-padding-horizontal" style={{ color: 'var(--ion-color-medium)', fontSize: 13 }}>
            {selected.size} {tr('selected')}
          </div>
        )}
        <IonList lines="none">
          {filteredContacts.map((c) => {
            const isSelected = selected.has(c.contact_user_id);
            return (
              <IonItem
                key={c.contact_user_id}
                button
                detail={false}
                onClick={() => toggleContact(c.contact_user_id)}
                style={{
                  '--background': isSelected ? 'rgba(255, 121, 0, 0.12)' : undefined,
                  '--border-color': isSelected ? 'var(--ng-blue)' : undefined,
                  borderLeft: isSelected ? '3px solid var(--ng-blue)' : '3px solid transparent',
                } as React.CSSProperties}
              >
                <div slot="start">
                  <TrustBadge
                    trustLevel={c.trust_level}
                    avatarUrl={c.avatar_url}
                    initials={(c.full_name || '?').slice(0, 1).toUpperCase()}
                    size={40}
                  />
                </div>
                <IonLabel style={{ fontWeight: isSelected ? 600 : 400 }}>{c.full_name}</IonLabel>
                <IonCheckbox
                  slot="end"
                  checked={isSelected}
                  onIonChange={() => toggleContact(c.contact_user_id)}
                  style={{ '--checkbox-background-checked': 'var(--ng-blue)', '--border-color-checked': 'var(--ng-blue)' } as React.CSSProperties}
                />
              </IonItem>
            );
          })}
          {filteredContacts.length === 0 && (
            <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
              {tr('No contacts found.')}
            </div>
          )}
        </IonList>
      </IonContent>
      {selected.size > 0 && (
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setStep('details')}>
            <IonIcon icon={arrowForward} />
          </IonFabButton>
        </IonFab>
      )}
    </IonPage>
  );
};

export default NewGroup;