import React, { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/i18n';

interface StoryRow {
  id: string;
  author_id: string;
  author_full_name: string | null;
  author_avatar_url: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | 'text';
  caption: string | null;
  background_color: string | null;
  created_at: string;
  expires_at: string;
  viewed_by_me: boolean;
}

interface AuthorGroup {
  authorId: string;
  name: string;
  avatarUrl: string | null;
  allViewed: boolean;
  storyCount: number;
}

/**
 * The row of circular avatars at the top of Chats — "My Story" first
 * (tap to add, or to view/manage what you've already posted), then
 * everyone else with an active (not yet expired) story, gradient ring if
 * you haven't seen it yet, dim ring once you have — same pattern as
 * Telegram/WhatsApp/Instagram.
 */
const StoriesBar: React.FC = () => {
  const { user, profile } = useAuth();
  const history = useHistory();
  const [stories, setStories] = useState<StoryRow[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('stories_feed')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setStories(data as unknown as StoryRow[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('stories-bar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myStories = stories.filter((s) => s.author_id === user?.id);
  const othersByAuthor: AuthorGroup[] = [];
  const seenAuthors = new Set<string>();
  stories
    .filter((s) => s.author_id !== user?.id)
    .forEach((s) => {
      if (seenAuthors.has(s.author_id)) return;
      seenAuthors.add(s.author_id);
      const group = stories.filter((x) => x.author_id === s.author_id);
      othersByAuthor.push({
        authorId: s.author_id,
        name: s.author_full_name ?? 'Nextgen user',
        avatarUrl: s.author_avatar_url,
        allViewed: group.every((x) => x.viewed_by_me),
        storyCount: group.length,
      });
    });

  const ringStyle = (unviewed: boolean): React.CSSProperties => ({
    padding: 2,
    borderRadius: '50%',
    background: unviewed
      ? 'linear-gradient(135deg, var(--ng-blue), var(--ng-deep-blue) 50%, #E339D6)'
      : 'var(--ion-border-color)',
  });

  const avatarInner = (url: string | null, name: string): React.CSSProperties => ({
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: '2px solid var(--ion-background-color)',
    background: url ? `url(${url}) center/cover` : 'var(--ion-item-background)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 18,
    color: 'var(--ion-text-color)',
  });

  return (
    <div
      style={{
        display: 'flex', gap: 16, padding: '10px 14px 14px', overflowX: 'auto',
        borderBottom: '1px solid var(--ion-border-color)',
      }}
    >
      {/* My Story */}
      <div
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer' }}
        onClick={() => history.push(myStories.length > 0 ? `/chats/story/view/${user?.id}` : '/chats/story/new')}
      >
        <div style={{ position: 'relative' }}>
          <div style={ringStyle(myStories.length > 0 && myStories.some((s) => !s.viewed_by_me))}>
            <div style={avatarInner(profile?.avatar_url ?? null, (profile?.full_name || '?').slice(0, 1))}>
              {!profile?.avatar_url && (profile?.full_name || '?').slice(0, 1).toUpperCase()}
            </div>
          </div>
          <div
            onClick={(e) => { e.stopPropagation(); history.push('/chats/story/new'); }}
            style={{
              position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
              background: 'var(--ng-blue)', display: 'grid', placeItems: 'center',
              border: '2px solid var(--ion-background-color)',
            }}
          >
            <IonIcon icon={add} style={{ fontSize: 13, color: '#fff' }} />
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--ion-color-medium)', maxWidth: 60, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tr('My Story')}
        </span>
      </div>

      {othersByAuthor.map((a) => (
        <div
          key={a.authorId}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer' }}
          onClick={() => history.push(`/chats/story/view/${a.authorId}`)}
        >
          <div style={ringStyle(!a.allViewed)}>
            <div style={avatarInner(a.avatarUrl, a.name)}>
              {!a.avatarUrl && a.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--ion-color-medium)', maxWidth: 60, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.name.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
};

export default StoriesBar;