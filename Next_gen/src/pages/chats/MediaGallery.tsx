import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonIcon,
} from '@ionic/react';
import { documentOutline, playCircleOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { tr } from '@/i18n';

interface MediaRow {
  id: string;
  media_url: string;
  media_type: 'image' | 'video' | 'audio' | 'document';
  created_at: string;
}

const MediaGallery: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [items, setItems] = useState<MediaRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, media_url, media_type, created_at')
        .eq('conversation_id', conversationId)
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false });
      if (data) setItems(data as unknown as MediaRow[]);
    })();
  }, [conversationId]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/chats/room/${conversationId}`} text="" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Media, links and docs')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        {items.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('Nothing shared in this chat yet.')}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {items.map((m) => (
            <a
              key={m.id}
              href={m.media_url}
              target="_blank"
              rel="noreferrer"
              style={{
                aspectRatio: '1', background: 'var(--ion-item-background)', borderRadius: 6,
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'inherit', position: 'relative',
              }}
            >
              {m.media_type === 'image' && <img src={m.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              {m.media_type === 'video' && (
                <>
                  <video src={m.media_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <IonIcon icon={playCircleOutline} style={{ position: 'absolute', fontSize: 28, color: '#fff' }} />
                </>
              )}
              {(m.media_type === 'document' || m.media_type === 'audio') && (
                <IonIcon icon={documentOutline} style={{ fontSize: 30, color: 'var(--ion-color-medium)' }} />
              )}
            </a>
          ))}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MediaGallery;