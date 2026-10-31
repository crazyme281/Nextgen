import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonContent, IonIcon, IonAlert } from '@ionic/react';
import { close, trashOutline, heart, heartOutline, chatbubbleOutline, send } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
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
  viewed_by_me: boolean;
  loved_by_me: boolean;
  love_count: number;
  comment_count: number;
}

interface StoryComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

const TEXT_DURATION_MS = 5000;
const IMAGE_DURATION_MS = 5000;

/** Full-screen story viewer for one author's stack of active stories —
 * segmented progress bar, tap sides to move between them, auto-advance,
 * marks each story viewed the moment it's shown. */
const StoryViewer: React.FC = () => {
  const { authorId } = useParams<{ authorId: string }>();
  const { user } = useAuth();
  const history = useHistory();
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [reacting, setReacting] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const pausedRef = useRef(false);

  const isMine = authorId === user?.id;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('stories_feed')
        .select('*')
        .eq('author_id', authorId)
        .order('created_at', { ascending: true });
      if (data) setStories(data as unknown as StoryRow[]);
    })();
  }, [authorId]);

  const current = stories[index];

  const duration = (s: StoryRow | undefined) => {
    if (!s) return IMAGE_DURATION_MS;
    if (s.media_type === 'video') return null; // driven by video's own timeupdate instead
    return s.media_type === 'text' ? TEXT_DURATION_MS : IMAGE_DURATION_MS;
  };

  const goNext = () => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
      setProgress(0);
    } else {
      history.goBack();
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgress(0);
    }
  };

  // Mark current story as viewed once it's shown.
  useEffect(() => {
    if (!current || !user || current.viewed_by_me) return;
    supabase.from('story_views').insert({ story_id: current.id, viewer_id: user.id }).then(() => {});
  }, [current, user]);

  // Pause auto-advance while replying or reading comments — getting
  // yanked to the next story mid-sentence was the obvious failure mode
  // otherwise. Resumes the instant either closes.
  useEffect(() => {
    pausedRef.current = showComments;
  }, [showComments]);

  useEffect(() => {
    if (!current || !showComments) return;
    let active = true;
    supabase
      .from('story_comments')
      .select('id, user_id, body, created_at, profiles(full_name, avatar_url)')
      .eq('story_id', current.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (active && data) setComments(data as unknown as StoryComment[]);
      });
    return () => {
      active = false;
    };
  }, [current, showComments]);

  async function toggleLove() {
    if (!current || !user || reacting) return;
    setReacting(true);
    const wasLoved = current.loved_by_me;
    // Optimistic — this is a one-tap "like", it should feel instant.
    setStories((prev) =>
      prev.map((s) =>
        s.id === current.id
          ? { ...s, loved_by_me: !wasLoved, love_count: s.love_count + (wasLoved ? -1 : 1) }
          : s,
      ),
    );
    if (wasLoved) {
      await supabase.from('story_reactions').delete().eq('story_id', current.id).eq('user_id', user.id);
    } else {
      await supabase.from('story_reactions').insert({ story_id: current.id, user_id: user.id });
    }
    setReacting(false);
  }

  async function submitComment() {
    const body = commentDraft.trim();
    if (!body || !current || !user) return;
    setCommentDraft('');
    const { data } = await supabase
      .from('story_comments')
      .insert({ story_id: current.id, body })
      .select('id, user_id, body, created_at, profiles(full_name, avatar_url)')
      .single();
    if (data) {
      setComments((prev) => [...prev, data as unknown as StoryComment]);
      setStories((prev) =>
        prev.map((s) => (s.id === current.id ? { ...s, comment_count: s.comment_count + 1 } : s)),
      );
    }
  }

  // Progress/auto-advance loop for text & image stories (video drives itself).
  useEffect(() => {
    const total = duration(current);
    if (total === null) return undefined; // video-driven
    startRef.current = performance.now() - progress * total;
    const tick = (now: number) => {
      if (pausedRef.current) {
        startRef.current = now - progress * total;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startRef.current;
      const pct = Math.min(elapsed / total, 1);
      setProgress(pct);
      if (pct >= 1) {
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stories.length]);

  const handleDelete = async () => {
    if (!current) return;
    await supabase.from('stories').delete().eq('id', current.id);
    setConfirmDelete(false);
    if (stories.length <= 1) {
      history.goBack();
    } else {
      const remaining = stories.filter((s) => s.id !== current.id);
      setStories(remaining);
      setIndex((i) => Math.min(i, remaining.length - 1));
      setProgress(0);
    }
  };

  if (!current) {
    return (
      <IonPage><IonContent fullscreen className="ion-padding ion-text-center">
        <p style={{ marginTop: 100, color: 'var(--ion-color-medium)' }}>{tr('No active stories.')}</p>
      </IonContent></IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div
          style={{
            height: '100%', position: 'relative', background: current.media_type === 'text' ? current.background_color ?? '#111' : '#000',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Segmented progress bar */}
          <div style={{ display: 'flex', gap: 4, padding: '10px 10px 0' }}>
            {stories.map((s, i) => (
              <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%', background: '#fff',
                    width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: current.author_avatar_url ? `url(${current.author_avatar_url}) center/cover` : 'var(--ion-item-background)',
              }}
              />
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{current.author_full_name ?? tr('Nextgen user')}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {isMine && (
                <IonIcon icon={trashOutline} style={{ color: '#fff', fontSize: 20, cursor: 'pointer' }} onClick={() => setConfirmDelete(true)} />
              )}
              <IonIcon icon={close} style={{ color: '#fff', fontSize: 26, cursor: 'pointer' }} onClick={() => history.goBack()} />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {current.media_type === 'text' && (
              <p style={{ color: '#fff', fontSize: 26, fontWeight: 700, textAlign: 'center', padding: 32 }}>{current.caption}</p>
            )}
            {current.media_type === 'image' && (
              <img src={current.media_url ?? ''} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            )}
            {current.media_type === 'video' && (
              <video
                src={current.media_url ?? ''}
                autoPlay
                playsInline
                style={{ maxWidth: '100%', maxHeight: '100%' }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setProgress(v.currentTime / v.duration);
                }}
                onEnded={goNext}
              />
            )}

            {/* Tap zones */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              <div style={{ flex: 1 }} onClick={goPrev} />
              <div style={{ flex: 1 }} onClick={goNext} />
            </div>
          </div>

          {current.media_type === 'image' && current.caption && (
            <div style={{ padding: 16, textAlign: 'center', color: '#fff', background: 'rgba(0,0,0,0.35)' }}>
              {current.caption}
            </div>
          )}

          {/* Love + comment bar. Hidden for the author's own story — you
              can't react to yourself — but they still see the counts and
              can open the list to see who said what. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            {!isMine && (
              <button
                type="button"
                onClick={toggleLove}
                aria-label={current.loved_by_me ? tr('Remove love') : tr('Love this story')}
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', padding: 0 }}
              >
                <IonIcon
                  icon={current.loved_by_me ? heart : heartOutline}
                  style={{ fontSize: 24, color: current.loved_by_me ? '#ff3b6f' : '#fff' }}
                />
                {current.love_count > 0 && <span style={{ fontSize: 13 }}>{current.love_count}</span>}
              </button>
            )}
            {isMine && current.love_count > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontSize: 13 }}>
                <IonIcon icon={heart} style={{ fontSize: 20, color: '#ff3b6f' }} />
                {current.love_count}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowComments(true)}
              aria-label={tr('View comments')}
              style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', padding: 0 }}
            >
              <IonIcon icon={chatbubbleOutline} style={{ fontSize: 22 }} />
              {current.comment_count > 0 && <span style={{ fontSize: 13 }}>{current.comment_count}</span>}
            </button>

            {!isMine && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onFocus={() => { pausedRef.current = true; }}
                  onBlur={() => { pausedRef.current = showComments; }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitComment();
                  }}
                  placeholder={tr('Reply to story…')}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.12)',
                    border: 'none',
                    borderRadius: 18,
                    padding: '8px 14px',
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
                {commentDraft.trim() && (
                  <button
                    type="button"
                    onClick={submitComment}
                    aria-label={tr('Send comment')}
                    style={{ background: 'none', border: 'none', color: '#fff', padding: 0 }}
                  >
                    <IonIcon icon={send} style={{ fontSize: 20 }} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {showComments && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              zIndex: 20,
            }}
            onClick={() => setShowComments(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--ion-background-color)',
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                maxHeight: '55%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--ion-text-color)' }}>{tr('Comments')}</span>
                <IonIcon icon={close} style={{ fontSize: 22, cursor: 'pointer', color: 'var(--ion-text-color)' }} onClick={() => setShowComments(false)} />
              </div>
              <div style={{ overflowY: 'auto', padding: '0 16px 16px' }}>
                {comments.length === 0 && (
                  <p style={{ opacity: 0.6, fontSize: 13, color: 'var(--ion-text-color)' }}>{tr('No comments yet.')}</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: c.profiles?.avatar_url
                          ? `url(${c.profiles.avatar_url}) center/cover`
                          : 'var(--ion-item-background)',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ion-text-color)' }}>
                        {c.profiles?.full_name ?? tr('Nextgen user')}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ion-text-color)' }}>{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <IonAlert
          isOpen={confirmDelete}
          header={tr('Delete story?')}
          buttons={[
            { text: tr('Cancel'), role: 'cancel', handler: () => setConfirmDelete(false) },
            { text: tr('Delete'), role: 'destructive', handler: handleDelete },
          ]}
          onDidDismiss={() => setConfirmDelete(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default StoryViewer;