import React, { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonIcon, IonContent,
  IonInput, IonToast, IonSpinner, IonActionSheet,
} from '@ionic/react';
import {
  close, checkmark, personCircleOutline, chevronDown,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

type ExtraFieldKey =
  | 'phonetic_name' | 'address' | 'nickname' | 'website'
  | 'internet_call' | 'birthday' | 'relationship' | 'notes';

const EXTRA_FIELD_LABELS: Record<ExtraFieldKey, string> = {
  phonetic_name: 'Phonetic name',
  address: 'Address',
  nickname: 'Nickname',
  website: 'Website',
  internet_call: 'Internet call',
  birthday: 'Birthday',
  relationship: 'Relationship',
  notes: 'Notes',
};

const fieldStyle: React.CSSProperties = {
  '--background': 'var(--ion-item-background)',
  '--padding-start': '16px',
  '--padding-end': '16px',
} as React.CSSProperties;

/**
 * "New contact" page — this is what the + button opens. Styled after the
 * native Save-to-Google contact editor: grouped rounded cards, a
 * Name/Company/Title block, labeled Mobile/Work rows, and an
 * "Add another field" sheet for anything else.
 */
const AddContact: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [mobile, setMobile] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [extraFields, setExtraFields] = useState<ExtraFieldKey[]>([]);
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [showFieldSheet, setShowFieldSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const addExtraField = (key: ExtraFieldKey) => {
    setExtraFields((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setShowFieldSheet(false);
  };

  const availableExtraFields = (Object.keys(EXTRA_FIELD_LABELS) as ExtraFieldKey[])
    .filter((k) => !extraFields.includes(k));

  const handleSave = async () => {
    if (!user) return;
    const cleanMobile = mobile.trim();
    if (!name.trim() && !cleanMobile) {
      setToast(tr('Add at least a name or phone number.'));
      return;
    }

    setSaving(true);

    let contactUserId: string | null = null;
    if (cleanMobile) {
      const { data: matchedUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', cleanMobile)
        .maybeSingle();
      if (matchedUser) contactUserId = matchedUser.id;
    }

    if (!contactUserId) {
      setSaving(false);
      setToast(tr('No Nextgen user found with that phone number yet.'));
      return;
    }
    if (contactUserId === user.id) {
      setSaving(false);
      setToast(tr('That\'s your own number.'));
      return;
    }

    const details: Record<string, string> = {};
    if (company.trim()) details.company = company.trim();
    if (title.trim()) details.title = title.trim();
    if (workEmail.trim()) details.work_email = workEmail.trim();
    extraFields.forEach((key) => {
      const val = extraValues[key]?.trim();
      if (val) details[key] = val;
    });

    const { error } = await supabase.from('contacts').insert({
      owner_id: user.id,
      contact_user_id: contactUserId,
      display_name: name.trim() || null,
      details,
    });

    setSaving(false);
    if (error) {
      setToast(error.message.includes('duplicate') ? tr('Already in your contacts.') : tr('Failed to add contact.'));
      return;
    }
    history.replace('/tabs/contacts');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonIcon
              icon={close}
              style={{ fontSize: 24, padding: 12, cursor: 'pointer' }}
              onClick={() => history.goBack()}
            />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <div className="ng-grad-text" style={{ textAlign: 'center', fontWeight: 500 }}>{tr('New contact')}</div>
          <IonButtons slot="end">
            {saving
              ? <IonSpinner name="dots" style={{ margin: '0 16px' }} />
              : (
                <IonIcon
                  icon={checkmark}
                  style={{ fontSize: 24, padding: 12, cursor: 'pointer' }}
                  onClick={handleSave}
                />
              )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
            <IonIcon
              icon={personCircleOutline}
              style={{ fontSize: 84, color: 'var(--ion-color-medium)' }}
            />
          </div>

          {/* Name */}
          <div style={{
            background: 'var(--ion-item-background)', borderRadius: 14,
            padding: '4px 4px 4px 16px', marginBottom: 12,
            display: 'flex', alignItems: 'center',
          }}
          >
            <IonInput
              placeholder={tr('Name')}
              value={name}
              onIonInput={(e) => setName(e.detail.value ?? '')}
              style={{ '--padding-start': '0' } as React.CSSProperties}
            />
            <IonIcon icon={chevronDown} style={{ fontSize: 20, color: 'var(--ion-color-medium)', marginRight: 8 }} />
          </div>

          {/* Company / Title */}
          <div style={{
            background: 'var(--ion-item-background)', borderRadius: 14,
            padding: '4px 16px', marginBottom: 12,
          }}
          >
            <IonInput
              placeholder={tr('Company')}
              value={company}
              onIonInput={(e) => setCompany(e.detail.value ?? '')}
              style={{ '--padding-start': '0' } as React.CSSProperties}
            />
            <div style={{ height: 1, background: 'var(--ion-border-color)' }} />
            <IonInput
              placeholder={tr('Title')}
              value={title}
              onIonInput={(e) => setTitle(e.detail.value ?? '')}
              style={{ '--padding-start': '0' } as React.CSSProperties}
            />
          </div>

          {/* Mobile */}
          <div style={{
            background: 'var(--ion-item-background)', borderRadius: 14,
            padding: '4px 16px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}
          >
            <span style={{ fontWeight: 600, minWidth: 64 }}>{tr('Mobile')}</span>
            <IonInput
              placeholder={tr('Phone')}
              type="tel"
              value={mobile}
              onIonInput={(e) => setMobile(e.detail.value ?? '')}
              style={{ '--padding-start': '0' } as React.CSSProperties}
            />
          </div>

          {/* Work email */}
          <div style={{
            background: 'var(--ion-item-background)', borderRadius: 14,
            padding: '4px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
          }}
          >
            <span style={{ fontWeight: 600, minWidth: 64 }}>{tr('Work')}</span>
            <IonInput
              placeholder={tr('Email')}
              type="email"
              value={workEmail}
              onIonInput={(e) => setWorkEmail(e.detail.value ?? '')}
              style={{ '--padding-start': '0' } as React.CSSProperties}
            />
          </div>

          {/* Dynamically added extra fields */}
          {extraFields.map((key) => (
            <div
              key={key}
              style={{
                background: 'var(--ion-item-background)', borderRadius: 14,
                padding: '4px 16px', marginBottom: 12,
              }}
            >
              <IonInput
                placeholder={EXTRA_FIELD_LABELS[key]}
                value={extraValues[key] ?? ''}
                onIonInput={(e) => setExtraValues((prev) => ({ ...prev, [key]: e.detail.value ?? '' }))}
                style={{ '--padding-start': '0' } as React.CSSProperties}
              />
            </div>
          ))}

          <div
            onClick={() => availableExtraFields.length > 0 && setShowFieldSheet(true)}
            style={{
              color: availableExtraFields.length > 0 ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)',
              padding: '8px 4px', cursor: availableExtraFields.length > 0 ? 'pointer' : 'default',
            }}
          >
            {tr('Add another field')}
          </div>
        </div>

        <IonActionSheet
          isOpen={showFieldSheet}
          header={tr('Add another field')}
          onDidDismiss={() => setShowFieldSheet(false)}
          buttons={[
            ...availableExtraFields.map((key) => ({
              text: EXTRA_FIELD_LABELS[key],
              handler: () => addExtraField(key),
            })),
            { text: tr('Cancel'), role: 'cancel' },
          ]}
        />

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default AddContact;