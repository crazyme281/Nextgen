import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonButtons,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  callOutline, videocamOutline, searchOutline, ellipsisVerticalOutline,
  calendarOutline, keypadOutline, heartOutline, arrowUpOutline, arrowDownOutline,
  personAddOutline,
} from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import BrandMark from '@/components/BrandMark';
import TrustBadge from '@/components/TrustBadge';
import type { Profile } from '@/context/AuthContext';
import { tr } from '@/i18n';

interface CallRow {
  id: string;
  peer_id: string;
  peer_full_name: string;
  peer_avatar_url: string | null;
  peer_trust_level: Profile['trust_level'];
  direction: 'incoming' | 'outgoing';
  status: 'answered' | 'missed' | 'declined';
  call_type: string; // 'audio' | 'video' — plain text column with a check constraint, not a DB enum
  duration_seconds: number;
  created_at: string;
}

// Same relative/absolute time shape WhatsApp uses in this list: "N minutes
// ago" for anything very recent, "Yesterday, h:mm a" for yesterday, and a
// short date beyond that.
const formatCallTime = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return time;
  if (isYesterday) return `Yesterday, ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const CallsList: React.FC = () => {
  const { user } = useAuth();
  const { startCall } = useCall();
  const history = useHistory();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('call_log_view')
      .select('*')
      .eq('viewer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setCalls(data as unknown as CallRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  // Tapping a row (or its trailing call-type icon) redials that person
  // using the same call type they last used — the whole point of a
  // recent-calls list is one-tap redial.
  const redial = async (c: CallRow) => {
    if (!user) return;
    const { data: conversationId, error } = await supabase.rpc('get_or_create_direct_conversation', {
      p_user_a: user.id,
      p_user_b: c.peer_id,
    });
    if (error || !conversationId) return;
    startCall({
      peerId: c.peer_id,
      peerName: c.peer_full_name,
      peerAvatar: c.peer_avatar_url,
      conversationId,
      type: c.call_type === 'video' ? 'video' : 'audio',
    });
  };

  const quickActions = [
    { icon: callOutline, label: tr('Call'), onClick: () => history.push('/chats/contacts-browse') },
    { icon: calendarOutline, label: tr('Schedule'), onClick: () => {} },
    { icon: keypadOutline, label: tr('Keypad'), onClick: () => {} },
    { icon: heartOutline, label: tr('Favorites'), onClick: () => history.push('/chats/contacts-browse') },
  ];

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle size="large" style={{ fontWeight: 700 }}>{tr('Calls')}</IonTitle>
          <IonButtons slot="end">
            <IonIcon icon={searchOutline} style={{ fontSize: 22, marginRight: 18, cursor: 'pointer' }} />
            <IonIcon icon={ellipsisVerticalOutline} style={{ fontSize: 20, marginRight: 8, cursor: 'pointer' }} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {/* Quick actions row */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '18px 8px 12px' }}>
          {quickActions.map((a) => (
            <div
              key={a.label}
              onClick={a.onClick}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--ion-item-background)',
                display: 'grid', placeItems: 'center',
              }}>
                <IonIcon icon={a.icon} style={{ fontSize: 22, color: 'var(--ion-text-color)' }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>{a.label}</span>
            </div>
          ))}
        </div>

        {calls.length > 0 && (
          <div style={{ fontWeight: 700, fontSize: 15, padding: '10px 16px 2px' }}>{tr('Recent')}</div>
        )}

        <div>
          {calls.map((c) => {
            const isMissedIncoming = c.direction === 'incoming' && c.status === 'missed';
            const statusLabel =
              c.status === 'missed' ? (c.direction === 'incoming' ? 'Missed' : 'Not answered')
              : c.status === 'declined' ? 'Declined'
              : c.direction === 'incoming' ? 'Incoming' : 'Outgoing';
            return (
              <div
                key={c.id}
                onClick={() => redial(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', cursor: 'pointer' }}
              >
                <TrustBadge
                  trustLevel={c.peer_trust_level}
                  avatarUrl={c.peer_avatar_url}
                  initials={(c.peer_full_name || '?').slice(0, 1).toUpperCase()}
                  size={46}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 16,
                    color: isMissedIncoming ? 'var(--ng-security-red, #eb445a)' : 'var(--ion-text-color)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {c.peer_full_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--ion-color-medium)' }}>
                    <IonIcon
                      icon={c.direction === 'outgoing' ? arrowUpOutline : arrowDownOutline}
                      style={{
                        fontSize: 13,
                        color: isMissedIncoming ? 'var(--ng-security-red, #eb445a)' : 'var(--ng-verified-green, #16A765)',
                        transform: c.direction === 'outgoing' ? 'rotate(45deg)' : 'rotate(-45deg)',
                      }}
                    />
                    {statusLabel} · {formatCallTime(c.created_at)}
                  </div>
                </div>
                <IonIcon
                  icon={c.call_type === 'video' ? videocamOutline : callOutline}
                  onClick={(e) => { e.stopPropagation(); redial(c); }}
                  style={{ fontSize: 22, color: 'var(--ng-blue)', cursor: 'pointer', flexShrink: 0 }}
                />
              </div>
            );
          })}
        </div>

        {!loading && calls.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)', marginTop: 40 }}>
            <IonIcon icon={callOutline} style={{ fontSize: 40, opacity: 0.4 }} />
            <p>{tr('No calls yet. Tap Call above to reach out to someone.')}</p>
          </div>
        )}
      </IonContent>

      <div
        onClick={() => history.push('/chats/contacts-browse')}
        style={{
          position: 'fixed', bottom: 24, right: 20,
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--ng-blue)', display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)', cursor: 'pointer',
        }}
      >
        <IonIcon icon={personAddOutline} style={{ fontSize: 24, color: '#fff' }} />
      </div>
    </IonPage>
  );
};

export default CallsList;