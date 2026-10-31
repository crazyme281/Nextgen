import React, { useState } from 'react';
import { IonIcon, IonPopover, IonList, IonItem, IonLabel } from '@ionic/react';
import { chevronDownOutline, checkmark } from 'ionicons/icons';
import { LANGUAGES, useI18n } from '@/i18n';

/**
 * Language control on the auth screens. Choosing a language switches the whole app at once
 * (menus, buttons, placeholders, messages, settings) and is remembered on the device — see src/i18n.
 */
const LanguagePicker: React.FC = () => {
  const { lang, label, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [popoverEvent, setPopoverEvent] = useState<Event | undefined>(undefined);

  return (
    <>
      <button
        type="button"
        className="ng-lang"
        onClick={(e) => { setPopoverEvent(e.nativeEvent); setOpen(true); }}
      >
        {label} <IonIcon icon={chevronDownOutline} style={{ fontSize: 14 }} />
      </button>
      <IonPopover isOpen={open} event={popoverEvent} onDidDismiss={() => setOpen(false)} side="bottom" alignment="start">
        <IonList lines="none" style={{ minWidth: 200 }}>
          {LANGUAGES.map((l) => (
            <IonItem key={l.code} button detail={false} onClick={() => { setLang(l.code); setOpen(false); }}>
              <IonLabel>{l.label}</IonLabel>
              {lang === l.code && <IonIcon icon={checkmark} slot="end" color="primary" />}
            </IonItem>
          ))}
        </IonList>
      </IonPopover>
    </>
  );
};

export default LanguagePicker;
