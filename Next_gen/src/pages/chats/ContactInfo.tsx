import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonIcon, IonToggle,
} from '@ionic/react';
import { call, notificationsOffOutline, imagesOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

interface PeerInfo {
  full_name: string;
  avatar_url: string | null;
  trust_level: any;
  phone: string | null;
}

const ContactInfo: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const history = useHistory();
  const [peer, setPeer] = useState<PeerInfo | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('conversation_summaries')
        .select('other_full_name, other_avatar_url, other_trust_level, other_user_id')
        .eq('conversation_id', conversationId)
        .eq('viewer_id', user.id)
        .maybeSingle();
      if (data) {
        setPeer({
          full_name: (data as any).other_full_name,
          avatar_url: (data as any).other_avatar_url,
          trust_level: (data as any).other_trust_level,
          phone: null,
        });
        const { data: prof } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', (data as any).other_user_id)
          .maybeSingle();
        if (prof) setPeer((p) => (p ? { ...p, phone: (prof as any).phone } : p));
      }
      const { data: cp } = await supabase
        .from('conversation_participants')
        .select('is_muted')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cp) setMuted((cp as any).is_muted ?? false);
    })();
  }, [conversationId, user]);

  const toggleMute = async (next: boolean) => {
    if (!user) return;
    setMuted(next);
    await supabase
      .from('conversation_participants')
      .update({ is_muted: next })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/chats/room/${conversationId}`} text="" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('Contact info')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
          <TrustBadge
            trustLevel={peer?.trust_level ?? 'unverified'}
            avatarUrl={peer?.avatar_url ?? null}
            initials={(peer?.full_name || '?').slice(0, 1).toUpperCase()}
            size={96}
          />
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>{peer?.full_name ?? '—'}</div>
          {peer?.phone && <div style={{ fontSize: 13, color: 'var(--ion-color-medium)' }}>{peer.phone}</div>}
        </div>
        <IonList inset>
          <IonItem button detail={false} onClick={() => history.push(`/chats/room/${conversationId}/media`)}>
            <IonIcon icon={imagesOutline} slot="start" />
            <IonLabel>{tr('Media, links and docs')}</IonLabel>
          </IonItem>
          <IonItem>
            <IonIcon icon={notificationsOffOutline} slot="start" />
            <IonLabel>{tr('Mute notifications')}</IonLabel>
            <IonToggle checked={muted} onIonChange={(e) => toggleMute(e.detail.checked)} slot="end" />
          </IonItem>
          <IonItem button detail={false} disabled>
            <IonIcon icon={call} slot="start" />
            <IonLabel>{tr('Call history')}</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default ContactInfo;