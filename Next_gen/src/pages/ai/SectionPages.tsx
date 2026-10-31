/**
 * The three non-chat rail destinations. History is real (it reads the same
 * conversations the rail/chat page shows); Images is a stub until the
 * backend returns image attachments; Settings is account plus sign-out.
 *
 * The upstream Zorah build of this file also shipped its own device-
 * pairing code and in-app APK self-updater (DeviceLinkPanel, DevicesList,
 * AppVersionRow/GetAppRow) — dropped here because Next Gen already has
 * its own device-linking flow (see src/pages/chats/LinkedDevices.tsx,
 * LinkDeviceQR.tsx, LinkDeviceEmail.tsx) and its own APK distribution;
 * bolting on a second, parallel system for both would confuse users and
 * needed backend auth wiring (Bearer tokens against lite-ai-router-backend)
 * that nothing else in this app does yet. Ask if you want that ported in
 * properly instead of just removed.
 */
import type { MouseEvent } from "react";
import { IonPage, IonContent, IonList, IonItem, IonLabel, IonIcon, useIonRouter } from "@ionic/react";
import { imagesOutline, timeOutline, trashOutline } from "ionicons/icons";
import { TopBar } from "./components/TopBar";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "./hooks/useConversations";
import "./ai-theme.css";
import { tr } from '@/i18n';

export function ImagesPage() {
  return (
    <IonPage className="zr-app">
      <TopBar />
      <IonContent className="panel-page">
        <div className="chat-canvas-arcs" aria-hidden="true" />
        <div className="empty-state">
          <IonIcon icon={imagesOutline} />
          <h2>{tr('No images yet')}</h2>
          <p>{tr('Images you share in a chat collect here so you can find them again.')}</p>
        </div>
      </IonContent>
    </IonPage>
  );
}

export function HistoryPage() {
  const router = useIonRouter();
  const { user } = useAuth();
  const { conversations, deleteConversation } = useConversations(user?.id);

  function handleDelete(e: MouseEvent, id: string, title: string) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    deleteConversation(id);
  }

  return (
    <IonPage className="zr-app">
      <TopBar />
      <IonContent className="panel-page">
        {conversations.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={timeOutline} />
            <h2>{tr('Nothing here yet')}</h2>
            <p>{tr('Every chat you start shows up in this list.')}</p>
          </div>
        ) : (
          <IonList className="ion-padding-top">
            {conversations.map((chat) => (
              <IonItem
                key={chat.id}
                button
                lines="none"
                detail={false}
                onClick={() => router.push(`/ai/chat/${chat.id}`, "forward", "push")}
              >
                <IonLabel className="ion-text-nowrap">{chat.title}</IonLabel>
                <IonIcon
                  icon={trashOutline}
                  slot="end"
                  className="chat-delete-icon"
                  aria-label={`Delete ${chat.title}`}
                  onClick={(e) => handleDelete(e, chat.id, chat.title)}
                />
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}

export function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <IonPage className="zr-app">
      <TopBar />
      <IonContent className="panel-page">
        <div className="settings-group">
          <h3>{tr('Account')}</h3>
          <div className="settings-card">
            <div className="settings-row">
              {tr('Signed in as')}
              <span>{user?.email}</span>
            </div>
            <div className="settings-row">
              {tr('Session')}
              <button type="button" onClick={signOut}>
                {tr('Sign out')}
              </button>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
