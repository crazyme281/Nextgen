import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonIcon,
} from '@ionic/react';
import { star, imageOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/i18n';

interface StarredRow {
  starred_id: string;
  message_id: string;
  conversation_id: string;
  body: string | null; // already plaintext — starred_messages_view decrypts server-side
  media_type: string | null;
  message_created_at: string;
  sender_id: string;
  sender_full_name: string | null;
  conversation_title: string | null;
}

const Starred: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [rows, setRows] = useState<StarredRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('starred_messages_view')
        .select('*')
        .eq('user_id', user.id)
        .order('starred_at', { ascending: false });
      if (data) setRows(data as unknown as StarredRow[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const timeLabel = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/chats" text="Back" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Starred messages')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList lines="full">
          {rows.map((r) => {
            const preview = r.body || (r.media_type ? 'Attachment' : '');
            return (
              <IonItem
                key={r.starred_id}
                button
                detail={false}
                onClick={() => history.push(`/chats/room/${r.conversation_id}`, { highlightMessageId: r.message_id })}
              >
                <IonIcon icon={star} slot="start" style={{ color: 'var(--ng-blue)' }} />
                <IonLabel>
                  <h2 style={{ fontWeight: 600 }}>{r.sender_full_name} · {r.conversation_title}</h2>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {r.media_type && <IonIcon icon={imageOutline} style={{ fontSize: 14 }} />}
                    {preview}
                  </p>
                </IonLabel>
                <div slot="end" style={{ fontSize: 12, opacity: 0.6 }}>{timeLabel(r.message_created_at)}</div>
              </IonItem>
            );
          })}
        </IonList>
        {!loading && rows.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)', marginTop: 40 }}>
            <IonIcon icon={star} style={{ fontSize: 40, opacity: 0.4 }} />
            <p>{tr('No starred messages yet. Star a message from any chat to find it here.')}</p>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Starred;