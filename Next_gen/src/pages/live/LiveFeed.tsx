import React, { useEffect, useRef, useState } from 'react';
import { IonPage, IonContent, IonIcon, IonToggle } from '@ionic/react';
import {
  radioOutline, closeOutline, syncOutline, flashOutline, sparklesOutline, globeOutline,
  chevronDownOutline, checkmarkCircle,
} from 'ionicons/icons';
import { supabase, ensureRealtimeAuth } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

// Matches the rest of the app's own brand color — Live previously used a
// one-off orange "broadcast mode" accent, which read as a different app
// bolted on rather than a Next Gen feature. ACCENT_SOFT is the same color
// at ~13% opacity, for the couple of spots that used a hex+alpha shorthand
// (that trick doesn't work once this is a CSS var instead of a hex literal).
const ORANGE = 'var(--ng-blue)';
const ORANGE_SOFT = 'rgba(61, 107, 255, 0.13)';

type Screen = 'landing-golive' | 'landing-upcoming' | 'setup' | 'settings' | 'starting' | 'active' | 'ended';
type Audience = 'everyone' | 'contacts';

interface Comment {
  id: string;
  user_id: string;
  full_name: string;
  body: string;
}

interface EndedStats {
  durationSeconds: number;
  peakViewers: number;
  totalViewers: number;
  commentCount: number;
}

const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const LiveFeed: React.FC = () => {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>('landing-golive');

  // setup/settings form state
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<Audience>('everyone');
  const [allowComments, setAllowComments] = useState(true);
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // active broadcast state
  const [streamId, setStreamId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [endedStats, setEndedStats] = useState<EndedStats | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const commentsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peakViewersRef = useRef(0);
  const totalViewerIdsRef = useRef<Set<string>>(new Set());

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const openCamera = async (mode: 'user' | 'environment' = facingMode) => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      // Camera denied/unavailable — the setup screen still works for
      // filling in the title/audience, it just won't show a live preview.
    }
  };

  const goToSetup = async () => {
    setScreen('setup');
    await openCamera();
  };

  const flipCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    openCamera(next);
  };

  const startPresenceAndComments = (id: string) => {
    const presence = supabase.channel(`live:${id}`, { config: { private: true, presence: { key: user!.id } } });
    presence
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState();
        const ids = Object.keys(state);
        ids.forEach((uid) => totalViewerIdsRef.current.add(uid));
        setViewerCount(ids.length);
        if (ids.length > peakViewersRef.current) peakViewersRef.current = ids.length;
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presence.track({ online_at: new Date().toISOString() });
      });
    presenceChannelRef.current = presence;

    const commentsCh = supabase
      .channel(`live-comments:${id}`, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_stream_comments', filter: `stream_id=eq.${id}` }, async (payload) => {
        const row = payload.new as { id: string; user_id: string; body: string };
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', row.user_id).maybeSingle();
        setComments((prev) => [...prev, { id: row.id, user_id: row.user_id, full_name: p?.full_name ?? 'Someone', body: row.body }]);
      })
      .subscribe();
    commentsChannelRef.current = commentsCh;
  };

  const stopPresenceAndComments = () => {
    if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
    if (commentsChannelRef.current) supabase.removeChannel(commentsChannelRef.current);
    presenceChannelRef.current = null;
    commentsChannelRef.current = null;
  };

  const goLive = async () => {
    if (!title.trim() || !user) return;
    setScreen('starting');
    await ensureRealtimeAuth();

    const { data, error } = await supabase
      .from('live_streams')
      .insert({
        host_id: user.id,
        title: title.trim(),
        audience,
        allow_comments: allowComments,
        notify_followers: notifyFollowers,
        status: 'live',
      })
      .select('id')
      .single();

    if (error || !data) {
      setScreen('settings');
      return;
    }

    setStreamId(data.id);
    peakViewersRef.current = 0;
    totalViewerIdsRef.current = new Set();
    startPresenceAndComments(data.id);

    setTimeout(() => {
      setScreen('active');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }, 1400);
  };

  const sendComment = async () => {
    const body = commentDraft.trim();
    if (!body || !streamId || !user) return;
    setCommentDraft('');
    await supabase.from('live_stream_comments').insert({ stream_id: streamId, user_id: user.id, body });
  };

  const endLive = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const finalSeconds = seconds;
    const finalComments = comments.length;
    const finalPeak = peakViewersRef.current;
    const finalTotal = totalViewerIdsRef.current.size;

    if (streamId) {
      await supabase.from('live_streams').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        peak_viewers: finalPeak,
      }).eq('id', streamId);
    }
    stopPresenceAndComments();
    stopCamera();

    setEndedStats({ durationSeconds: finalSeconds, peakViewers: finalPeak, totalViewers: finalTotal, commentCount: finalComments });
    setScreen('ended');
  };

  const reset = () => {
    setScreen('landing-golive');
    setTitle('');
    setAudience('everyone');
    setAllowComments(true);
    setNotifyFollowers(true);
    setStreamId(null);
    setComments([]);
    setCommentDraft('');
    setEndedStats(null);
  };

  useEffect(() => () => {
    stopCamera();
    stopPresenceAndComments();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ---- Landing (Go Live / Upcoming tabs) ----
  if (screen === 'landing-golive' || screen === 'landing-upcoming') {
    return (
      <IonPage>
        <IonContent fullscreen style={{ '--background': 'var(--ion-background-color)' } as React.CSSProperties}>
          <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BrandMark size={22} />
            <h1 style={{ color: ORANGE, fontSize: 26, fontWeight: 800, margin: 0, flex: 1 }}>{tr('Live')}</h1>
          </div>

          <div style={{ display: 'flex', gap: 24, padding: '18px 16px 0', borderBottom: '1px solid #222' }}>
            <div
              onClick={() => setScreen('landing-golive')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, cursor: 'pointer',
                color: screen === 'landing-golive' ? ORANGE : '#888',
                borderBottom: screen === 'landing-golive' ? `2px solid ${ORANGE}` : '2px solid transparent',
                fontWeight: 600, fontSize: 14,
              }}
            >
              <IonIcon icon={radioOutline} /> {tr('Go Live')}
            </div>
            <div
              onClick={() => setScreen('landing-upcoming')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, cursor: 'pointer',
                color: screen === 'landing-upcoming' ? ORANGE : '#888',
                borderBottom: screen === 'landing-upcoming' ? `2px solid ${ORANGE}` : '2px solid transparent',
                fontWeight: 600, fontSize: 14,
              }}
            >
              {tr('Upcoming')}
            </div>
          </div>

          {screen === 'landing-golive' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 28px', color: '#fff' }}>
              <div style={{
                width: 96, height: 96, borderRadius: '50%', background: ORANGE_SOFT,
                display: 'grid', placeItems: 'center', marginBottom: 24,
              }}>
                <IonIcon icon={radioOutline} style={{ fontSize: 44, color: ORANGE }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
                {tr('Go live and connect in real time')}
              </div>
              <div style={{ fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 32 }}>
                {tr('Share your moments, engage your audience and build your community.')}
              </div>
              <button
                onClick={goToSetup}
                style={{
                  width: '100%', maxWidth: 320, padding: '14px', borderRadius: 12, border: 'none',
                  background: ORANGE, color: '#fff', fontWeight: 700, fontSize: 15, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginBottom: 12,
                }}
              >
                <IonIcon icon={radioOutline} /> {tr('Go Live')}
              </button>
              <button
                style={{
                  width: '100%', maxWidth: 320, padding: '14px', borderRadius: 12,
                  border: '1px solid #444', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
                }}
              >
                {tr('Learn more')}
              </button>
            </div>
          ) : (
            <div className="ion-text-center" style={{ padding: '60px 24px', color: '#888' }}>
              {tr('No upcoming lives scheduled.')}
            </div>
          )}
        </IonContent>
      </IonPage>
    );
  }

  // ---- Setup (camera preview + title + audience) ----
  if (screen === 'setup') {
    return (
      <IonPage>
        <IonContent fullscreen style={{ '--background': '#000' } as React.CSSProperties}>
          <div style={{ position: 'relative', height: '55%', background: '#222' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 16, left: 16 }}>
              <IonIcon icon={closeOutline} onClick={reset} style={{ fontSize: 26, color: '#fff', cursor: 'pointer' }} />
            </div>
            <div style={{ position: 'absolute', top: 16, right: 16 }}>
              <IonIcon icon={syncOutline} onClick={flipCamera} style={{ fontSize: 24, color: '#fff', cursor: 'pointer' }} />
            </div>
            <div style={{ position: 'absolute', right: 16, top: 60, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <IonIcon icon={flashOutline} style={{ fontSize: 20, color: '#fff' }} />
              <IonIcon icon={sparklesOutline} style={{ fontSize: 20, color: '#fff' }} />
              <IonIcon icon={globeOutline} style={{ fontSize: 20, color: '#fff' }} />
            </div>
          </div>

          <div style={{ padding: 20, color: '#fff' }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>{tr('Title (required)')}</span><span>{title.length}/100</span>
            </div>
            <input
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr('What\'s your live about?')}
              style={{
                width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10,
                padding: '12px 14px', color: '#fff', fontSize: 15, marginBottom: 20,
              }}
            />

            <div style={{ fontSize: 13, color: '#999', marginBottom: 6 }}>{tr('Go Live With')}</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 10, padding: '12px 14px', marginBottom: 24,
            }}>
              <IonIcon icon={globeOutline} style={{ fontSize: 18 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{audience === 'everyone' ? tr('Public') : tr('Contacts')}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {audience === 'everyone' ? tr('Anyone can watch and join') : tr('Only your contacts can watch')}
                </div>
              </div>
            </div>

            <button
              disabled={!title.trim()}
              onClick={() => setScreen('settings')}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: title.trim() ? ORANGE : '#4a3624', color: '#fff', fontWeight: 700, fontSize: 15, cursor: title.trim() ? 'pointer' : 'default',
              }}
            >
              {tr('Next')}
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ---- Settings (audience / comments / notify) ----
  if (screen === 'settings') {
    return (
      <IonPage>
        <IonContent fullscreen style={{ '--background': '#000' } as React.CSSProperties}>
          <div style={{ position: 'relative', height: '45%', background: '#222' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 16, left: 16 }}>
              <IonIcon icon={closeOutline} onClick={() => setScreen('setup')} style={{ fontSize: 26, color: '#fff', cursor: 'pointer' }} />
            </div>
            <div style={{ position: 'absolute', top: 16, right: 16 }}>
              <IonIcon icon={syncOutline} onClick={flipCamera} style={{ fontSize: 24, color: '#fff', cursor: 'pointer' }} />
            </div>
          </div>

          <div style={{ padding: 20, color: '#fff' }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>{tr('Audience')}</div>
            <div
              onClick={() => setAudience(audience === 'everyone' ? 'contacts' : 'everyone')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, cursor: 'pointer' }}
            >
              <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                {audience === 'everyone' ? tr('Everyone') : tr('Contacts')}
                <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
                  {audience === 'everyone' ? tr('Suitable for all audiences') : tr('Only people in your contacts')}
                </div>
              </div>
              <IonIcon icon={chevronDownOutline} style={{ fontSize: 16, color: '#888' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tr('Allow Comments')}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{tr('Viewers can comment')}</div>
              </div>
              <IonToggle checked={allowComments} onIonChange={(e) => setAllowComments(e.detail.checked)} style={{ '--background-checked': ORANGE } as React.CSSProperties} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tr('Notify Followers')}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{tr('Send a notification when you go live')}</div>
              </div>
              <IonToggle checked={notifyFollowers} onIonChange={(e) => setNotifyFollowers(e.detail.checked)} style={{ '--background-checked': ORANGE } as React.CSSProperties} />
            </div>

            <button
              onClick={goLive}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: ORANGE, color: '#fff', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
              }}
            >
              <IonIcon icon={radioOutline} /> {tr('Go Live')}
            </button>
            <div style={{ textAlign: 'center', fontSize: 12, color: '#777', marginTop: 10 }}>
              {tr('You can preview your live stream before going live.')}
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ---- Starting transition ----
  if (screen === 'starting') {
    return (
      <IonPage>
        <IonContent fullscreen style={{ '--background': '#000' } as React.CSSProperties}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: ORANGE_SOFT, display: 'grid', placeItems: 'center', marginBottom: 20 }}>
              <IonIcon icon={radioOutline} style={{ fontSize: 40, color: ORANGE }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{tr('Going live…')}</div>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>{tr('We\'re setting things up for you.')}</div>
            <div style={{ width: 160, height: 3, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', background: ORANGE }} />
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ---- Active broadcast ----
  if (screen === 'active') {
    return (
      <IonPage>
        <IonContent fullscreen scrollY={false} style={{ '--background': '#000' } as React.CSSProperties}>
          <div style={{ position: 'relative', height: '100%' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

            <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ background: '#e0262d', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <IonIcon icon={radioOutline} style={{ fontSize: 11 }} /> {tr('LIVE')}
              </div>
              <div style={{ color: '#fff', fontSize: 12, background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: 4 }}>{fmtDuration(seconds)}</div>
            </div>
            <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.5)', padding: '3px 8px', borderRadius: 4, color: '#fff', fontSize: 12 }}>
              👁 {viewerCount}
            </div>

            <div style={{
              position: 'absolute', left: 12, right: 90, bottom: 76, maxHeight: '35%', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {comments.slice(-20).map((c) => (
                <div key={c.id} style={{ color: '#fff', fontSize: 13, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                  <b>{c.full_name}</b> {c.body}
                </div>
              ))}
            </div>

            <div style={{ position: 'absolute', bottom: 16, left: 12, right: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              {allowComments && (
                <input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                  placeholder={tr('Add a comment…')}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20,
                    padding: '10px 16px', color: '#fff', fontSize: 14,
                  }}
                />
              )}
              <button
                onClick={endLive}
                style={{ background: '#e0262d', color: '#fff', border: 'none', borderRadius: 20, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                {tr('End')}
              </button>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ---- Ended summary ----
  return (
    <IonPage>
      <IonContent fullscreen style={{ '--background': 'var(--ion-background-color)' } as React.CSSProperties}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', color: '#fff' }}>
          <IonIcon icon={checkmarkCircle} style={{ fontSize: 64, color: ORANGE, marginBottom: 16 }} />
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{tr('Live Ended')}</div>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 32 }}>{tr('Your live stream has ended.')}</div>

          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 36 }}>
            <div>
              <div style={{ fontSize: 12, color: '#888' }}>{tr('Live duration')}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{endedStats ? fmtDuration(endedStats.durationSeconds) : '00:00'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888' }}>{tr('Peak viewers')}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{endedStats?.peakViewers ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888' }}>{tr('Total viewers')}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{endedStats?.totalViewers ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888' }}>{tr('Comments')}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{endedStats?.commentCount ?? 0}</div>
            </div>
          </div>

          <button
            onClick={reset}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: '1px solid #444',
              background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
            }}
          >
            {tr('Done')}
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LiveFeed;