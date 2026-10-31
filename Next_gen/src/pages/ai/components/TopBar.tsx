/**
 * Shared header across every AI section page so the brand sits in the same
 * place regardless of where you are. Deliberately minimal — matches the
 * back-button + brand pattern GamesHome and other section headers already
 * use elsewhere in the app, rather than introducing a different shape
 * here. Settings is reached through the rail only now (it used to also
 * have its own shortcut button here, which just meant two different
 * buttons did the same thing), and the "Online" pill was decorative —
 * always true, so it told the person here nothing they didn't already
 * assume — dropped along with it.
 */
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  useIonRouter,
} from '@ionic/react';
import { chevronBackOutline } from 'ionicons/icons';
import { ZorahLogo } from './ZorahLogo';
import { tr } from '@/i18n';

export function TopBar() {
  const router = useIonRouter();

  // Follow the app's real navigation history (AI home, History, a chat...), exactly like the hardware
  // back button does. Falls back to the chat list only if there is nothing to go back to (e.g. the app
  // was opened straight into this screen). Conversations are saved as they go, so leaving never loses one.
  const goBack = () => {
    if (router.canGoBack()) router.goBack();
    else router.push('/tabs/chats', 'back', 'replace');
  };

  return (
    <IonHeader className="ion-no-border">
      <IonToolbar className="zr-toolbar">
        <IonButtons slot="start">
          {/* The AI section lives outside Next Gen's own tab bar, so this
              is the only way back once you're a level deep (History,
              Settings, a specific chat). The rail (always visible,
              including on phones) is the only other nav surface. */}
          <IonButton fill="clear" onClick={goBack} aria-label={tr('Back')}>
            <IonIcon icon={chevronBackOutline} slot="icon-only" />
          </IonButton>
        </IonButtons>
        <div className="topbar-brand">
          <ZorahLogo size={24} />
          <span className="topbar-brand__name">{tr('Zorah')}</span>
        </div>
      </IonToolbar>
    </IonHeader>
  );
}
