import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel,
  IonRefresher, IonRefresherContent, IonFab, IonFabButton, IonIcon, IonButtons, IonButton,
  IonPopover,
} from '@ionic/react';
import {
  addOutline, createOutline, ellipsisHorizontal, searchOutline, optionsOutline, peopleOutline,
  star, starOutline, peopleCircleOutline, megaphoneOutline, laptopOutline, checkmarkDoneOutline,
  settingsOutline, sparkles,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import TrustBadge from '@/components/TrustBadge';
import BrandMark from '@/components/BrandMark';
import StoriesBar from '@/components/StoriesBar';
import { useOnlinePresence } from '@/lib/presence';
import { getMeta, setMeta, localEvents } from '@/lib/localDb';
import { tr } from '@/i18n';

interface ConversationRow {
  conversation_id: string;
  other_user_id: string;
  other_full_name: string;
  other_avatar_url: string | null;
  other_trust_level: any;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_favorite: boolean;
}

interface GroupRow {
  conversation_id: string;
  title: string;
  member_count: number;
  last_message: string | null;
  last_message_media_type: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_favorite: boolean;
}

/** Unified shape so direct chats and groups can share one sorted list, like the mockup. */
interface UnifiedRow {
  id: string;
  kind: 'direct' | 'group';
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  trustLevel: any;
  online: boolean;
  lastMessageAt: string | null;
  unreadCount: number;
  isFavorite: boolean;
  otherUserId?: string;
}

const GROUP_COLORS = ['#3a3a3a', '#5c3b1e', '#8a4b0f', '#3d2b1f'];
const groupColor = (id: string) => GROUP_COLORS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % GROUP_COLORS.length];

type Filter = 'all' | 'unread' | 'favorites' | 'groups';

const ChatsList: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  // ⋯ opens a dropdown menu (WhatsApp-style compose menu).
  const [menuOpen, setMenuOpen] = useState(false);
  const [popoverEvent, setPopoverEvent] = useState<Event | undefined>(undefined);
  const onlineIds = useOnlinePresence(user?.id);

  const load = useCallback(async () => {
    if (!user) return;
    // conversation_summaries / group_conversation_summaries are views — see supabase/migrations
    const [direct, group] = await Promise.all([
      supabase.from('conversation_summaries').select('*').eq('viewer_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      supabase.from('group_conversation_summaries').select('*').eq('viewer_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
    ]);
    if (!direct.error && direct.data) {
      setRows(direct.data as unknown as ConversationRow[]);
      setMeta(user.id, 'list:direct', direct.data); // saved on the device for offline use
    }
    if (!group.error && group.data) {
      setGroups(group.data as unknown as GroupRow[]);
      setMeta(user.id, 'list:group', group.data);
    }
  }, [user]);

  // Show the last saved chat list instantly (and when there's no internet); the network refresh below replaces it.
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      getMeta<ConversationRow[]>(user.id, 'list:direct'),
      getMeta<GroupRow[]>(user.id, 'list:group'),
    ]).then(([d, g]) => {
      if (!active) return;
      // Functional updates: never overwrite fresher data that already arrived from the server.
      if (d) setRows((prev) => (prev.length === 0 ? d : prev));
      if (g) setGroups((prev) => (prev.length === 0 ? g : prev));
    });
    return () => { active = false; };
  }, [user]);

  // After a background sync (reconnect / app reopened) refresh previews and unread counts.
  useEffect(() => localEvents.on((e) => { if (e.type === 'synced') load(); }), [load]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel('chats-list-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const unified: UnifiedRow[] = useMemo(() => {
    const directRows: UnifiedRow[] = rows.map((r) => ({
      id: r.conversation_id,
      kind: 'direct',
      title: r.other_full_name,
      subtitle: r.last_message ?? 'Say hello 👋',
      avatarUrl: r.other_avatar_url,
      trustLevel: r.other_trust_level,
      online: onlineIds.has(r.other_user_id),
      lastMessageAt: r.last_message_at,
      unreadCount: r.unread_count,
      isFavorite: r.is_favorite,
      otherUserId: r.other_user_id,
    }));
    const groupRows: UnifiedRow[] = groups.map((g) => ({
      id: g.conversation_id,
      kind: 'group',
      title: g.title,
      subtitle: g.last_message ?? `${g.member_count} members`,
      avatarUrl: null,
      trustLevel: 'unverified',
      online: false,
      lastMessageAt: g.last_message_at,
      unreadCount: g.unread_count,
      isFavorite: g.is_favorite,
    }));
    return [...directRows, ...groupRows].sort((a, b) => {
      const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bt - at;
    });
  }, [rows, groups, onlineIds]);

  const filtered = unified.filter((r) => {
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'unread') return r.unreadCount > 0;
    if (filter === 'favorites') return r.isFavorite;
    if (filter === 'groups') return r.kind === 'group';
    return true;
  });

  const toggleFavorite = async (row: UnifiedRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const next = !row.isFavorite;
    // optimistic update
    if (row.kind === 'direct') {
      setRows((prev) => prev.map((r) => (r.conversation_id === row.id ? { ...r, is_favorite: next } : r)));
    } else {
      setGroups((prev) => prev.map((g) => (g.conversation_id === row.id ? { ...g, is_favorite: next } : g)));
    }
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_favorite: next })
      .eq('conversation_id', row.id)
      .eq('user_id', user.id);
    if (error) {
      // revert on failure
      await load();
    }
  };

  const timeLabel = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short' });
  };

  // + opens the contacts browse page first ("Search your contacts"). The
  // New Contact form only opens from the + on THAT page. Never leads to
  // group creation — that's 3-dot menu → New group only.
  const handleFabClick = () => {
    history.push('/chats/contacts-browse');
  };

  const markAllRead = async () => {
    setMenuOpen(false);
    const unreadIds = unified.filter((r) => r.unreadCount > 0).map((r) => r.id);
    await Promise.all(
      unreadIds.map((id) => supabase.rpc('mark_conversation_read', { p_conversation_id: id }))
    );
    await load();
  };

  const menuItems: Array<{ icon: string; label: string; onClick: () => void }> = [
    { icon: peopleCircleOutline, label: tr('New group'), onClick: () => { setMenuOpen(false); history.push('/chats/new-group'); } },
    { icon: megaphoneOutline, label: tr('New broadcast'), onClick: () => { setMenuOpen(false); history.push('/chats/new-broadcast'); } },
    { icon: laptopOutline, label: tr('Linked devices'), onClick: () => { setMenuOpen(false); history.push('/chats/linked-devices'); } },
    { icon: star, label: tr('Starred'), onClick: () => { setMenuOpen(false); history.push('/chats/starred'); } },
    { icon: checkmarkDoneOutline, label: tr('Read all'), onClick: markAllRead },
    { icon: settingsOutline, label: tr('Settings'), onClick: () => { setMenuOpen(false); history.push('/tabs/account'); } },
  ];

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <BrandMark size={26} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text" style={{ fontWeight: 700, fontSize: 22 }}>{tr('Chats')}</IonTitle>
          <IonButtons slot="end">
            <IonButton fill="clear" routerLink="/tabs/contacts">
              <IonIcon icon={createOutline} slot="icon-only" />
            </IonButton>
            <IonButton fill="clear" onClick={(e) => { setPopoverEvent(e.nativeEvent); setMenuOpen(true); }}>
              <IonIcon icon={ellipsisHorizontal} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>

        <div style={{ padding: '4px 12px 10px' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--ion-item-background)', borderRadius: 12, padding: '8px 12px',
            }}
          >
            <IonIcon icon={searchOutline} style={{ opacity: 0.6 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('Search or start a new chat')}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ion-text-color)', fontSize: 14,
              }}
            />
            <IonIcon icon={optionsOutline} style={{ opacity: 0.6 }} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto' }}>
            {(['all', 'unread', 'favorites', 'groups'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  background: filter === f ? 'var(--ng-blue)' : 'var(--ion-item-background)',
                  color: filter === f ? '#fff' : 'var(--ion-text-color)',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </IonHeader>

      <IonContent fullscreen>
        <StoriesBar />
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await load(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {filter === 'groups' && (
          <IonItem button detail={false} routerLink="/chats/new-group" style={{ '--padding-start': '12px' } as React.CSSProperties}>
            <div slot="start" style={{
              width: 46, height: 46, borderRadius: '50%', background: 'var(--ng-blue)',
              display: 'grid', placeItems: 'center', color: '#fff',
            }}>
              <IonIcon icon={addOutline} style={{ fontSize: 22 }} />
            </div>
            <IonLabel>
              <h2 style={{ fontWeight: 600 }}>{tr('New group')}</h2>
              <p style={{ opacity: 0.75 }}>{tr('Create a group with your contacts')}</p>
            </IonLabel>
          </IonItem>
        )}

        <IonList lines="none">
          {filtered.map((row) => (
            <IonItem
              key={row.id}
              button
              detail={false}
              onClick={() => history.push(`/chats/room/${row.id}`)}
              style={{ '--padding-start': '12px', '--inner-padding-end': '12px' } as React.CSSProperties}
            >
              <div slot="start">
                {row.kind === 'direct' ? (
                  <TrustBadge
                    trustLevel={row.trustLevel}
                    avatarUrl={row.avatarUrl}
                    initials={(row.title || '?').slice(0, 1).toUpperCase()}
                    online={row.online}
                  />
                ) : (
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', background: groupColor(row.id),
                    display: 'grid', placeItems: 'center', color: '#fff',
                  }}>
                    <IonIcon icon={peopleOutline} />
                  </div>
                )}
              </div>
              <IonLabel>
                <h2 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {row.title}
                  {row.isFavorite && <IonIcon icon={star} style={{ fontSize: 12, color: 'var(--ng-blue)' }} />}
                </h2>
                <p style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.75 }}>
                  {row.subtitle}
                </p>
              </IonLabel>
              <div slot="end" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{timeLabel(row.lastMessageAt)}</div>
                  <IonIcon
                    icon={row.isFavorite ? star : starOutline}
                    style={{ fontSize: 16, color: row.isFavorite ? 'var(--ng-blue)' : 'var(--ion-color-medium)' }}
                    onClick={(e) => toggleFavorite(row, e)}
                  />
                </div>
                {row.unreadCount > 0 && (
                  <div style={{
                    background: 'var(--ng-blue)', color: '#fff', borderRadius: 999,
                    fontSize: 11, minWidth: 18, height: 18, display: 'inline-grid', placeItems: 'center', padding: '0 5px',
                  }}>
                    {row.unreadCount}
                  </div>
                )}
              </div>
            </IonItem>
          ))}
        </IonList>

        {filtered.length === 0 && filter !== 'groups' && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {filter === 'favorites' ? tr('No favorites yet — tap the star on a chat to pin it here.') : tr('No conversations yet.')}
          </div>
        )}
        {filtered.length === 0 && filter === 'groups' && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('No other groups yet.')}
          </div>
        )}

        {/* Entry point into the AI assistant (/ai) — positioned above the
            existing + FAB, same circular treatment, using the app's own
            brand gradient rather than a new color. */}
        <div
          onClick={() => history.push('/ai')}
          role="button"
          aria-label={tr('Open AI assistant')}
          style={{
            position: 'fixed',
            right: 20,
            bottom: 156,
            zIndex: 10,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--ng-gradient-brand-diag)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 6px 18px rgba(122, 61, 255, 0.4)',
            cursor: 'pointer',
          }}
        >
          <IonIcon icon={sparkles} style={{ fontSize: 20 }} />
          <span style={{ fontSize: 10, fontWeight: 700, marginTop: 1, letterSpacing: '0.03em' }}>{tr('AI')}</span>
        </div>

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={handleFabClick}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
        <IonPopover
          isOpen={menuOpen}
          event={popoverEvent}
          onDidDismiss={() => setMenuOpen(false)}
          side="bottom"
          alignment="end"
          arrow={false}
        >
          <IonList lines="none" style={{ padding: '6px 0', minWidth: 200 }}>
            {menuItems.map((item) => (
              <IonItem key={item.label} button detail={false} onClick={item.onClick}>
                <IonIcon icon={item.icon} slot="start" style={{ fontSize: 18 }} />
                <IonLabel>{item.label}</IonLabel>
              </IonItem>
            ))}
          </IonList>
        </IonPopover>
      </IonContent>
    </IonPage>
  );
};

export default ChatsList;