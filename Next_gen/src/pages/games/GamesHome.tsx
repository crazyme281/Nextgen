import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonButton,
  IonModal, IonList, IonItem, IonLabel, IonToast, IonBackButton, IonButtons,
  IonSpinner,
} from '@ionic/react';
import BrandMark from '@/components/BrandMark';
import {
  mailOutline, timeOutline, trophyOutline, statsChartOutline,
  closeOutline, checkmarkCircleOutline,
} from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useHistory } from 'react-router-dom';
import TrustBadge from '@/components/TrustBadge';
import { acceptGameInvitation, declineGameInvitation } from '@/lib/gameInvitations';

const IMPLEMENTED_GAME_KEYS = ['tic_tac_toe', 'connect_four', 'checkers', 'chess', 'sudoku', 'word_search'];

interface GameRow {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  supports_ai: boolean;
  supports_multiplayer: boolean;
  min_players: number;
  max_players: number;
}

interface InvitationRow {
  id: string;
  status: string;
  created_at: string;
  game_id: string;
  sender_id: string;
  match_id: string | null;
}

interface ContactRow {
  contact_user_id: string;
  full_name: string;
  avatar_url: string | null;
  trust_level: any;
}

interface StatsRow {
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  win_percentage: number | null;
  favorite_game_id: string | null;
}

interface LeaderboardRow {
  user_id: string;
  game_id: string;
  rating: number;
}

interface RecentMatchRow {
  id: string;
  game_id: string;
  status: string;
  result: string | null;
  ended_at: string | null;
}

const GamesHome: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [games, setGames] = useState<GameRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [stats, setStats] = useState<StatsRow | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatchRow[]>([]);
  const [activeMatches, setActiveMatches] = useState<RecentMatchRow[]>([]);

  const [inviteGame, setInviteGame] = useState<GameRow | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const gameById = (id: string) => games.find((g) => g.id === id);

  const load = async () => {
    const { data: gamesData } = await supabase
      .from('games').select('id,key,name,icon,supports_ai,supports_multiplayer,min_players,max_players')
      .eq('is_active', true).order('sort_order');
    if (gamesData) setGames(gamesData as unknown as GameRow[]);

    if (!user) return;

    const { data: invData } = await supabase
      .from('game_invitations').select('id,status,created_at,game_id,sender_id,match_id')
      .eq('recipient_id', user.id).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(10);
    if (invData) setInvitations(invData as unknown as InvitationRow[]);

    const { data: statsData } = await supabase
      .from('game_statistics_view').select('*').eq('user_id', user.id).maybeSingle();
    if (statsData) setStats(statsData as unknown as StatsRow);

    const { data: lbData } = await supabase
      .from('game_ratings').select('user_id,game_id,rating')
      .order('rating', { ascending: false }).limit(5);
    if (lbData) setLeaderboard(lbData as unknown as LeaderboardRow[]);

    const { data: myPlayerRows } = await supabase
      .from('game_players').select('match_id').eq('user_id', user.id);
    const matchIds = (myPlayerRows ?? []).map((r: any) => r.match_id);
    if (matchIds.length) {
      const { data: matchesData } = await supabase
        .from('game_matches').select('id,game_id,status,result,ended_at')
        .in('id', matchIds).eq('status', 'completed')
        .order('ended_at', { ascending: false }).limit(5);
      if (matchesData) setRecentMatches(matchesData as unknown as RecentMatchRow[]);

      const { data: activeData } = await supabase
        .from('game_matches').select('id,game_id,status,result,ended_at')
        .in('id', matchIds).eq('status', 'active')
        .order('id', { ascending: false }).limit(5);
      if (activeData) setActiveMatches(activeData as unknown as RecentMatchRow[]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const openInvite = async (game: GameRow) => {
    setInviteGame(game);
    if (!user) return;
    const { data } = await supabase
      .from('contacts_view').select('*').eq('owner_id', user.id).order('full_name');
    if (data) setContacts(data as unknown as ContactRow[]);
  };

  const sendInvite = async (contact: ContactRow) => {
    if (!inviteGame) return;
    setSending(contact.contact_user_id);
    const { error } = await supabase.rpc('create_game_invitation', {
      p_game_key: inviteGame.key,
      p_recipient_id: contact.contact_user_id,
    });
    setSending(null);
    if (error) {
      setToast(error.message);
      return;
    }
    setToast(`Invitation sent to ${contact.full_name}.`);
    setInviteGame(null);
  };

  const acceptInvite = async (inv: InvitationRow) => {
    const game = gameById(inv.game_id);
    const result = await acceptGameInvitation(inv.id, inv.match_id, game?.key ?? null);
    setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
    if (!result.ok) { setToast(result.error ?? 'Could not accept invitation.'); return; }
    if (result.playUrl) history.push(result.playUrl, { mode: 'pvp' });
    else setToast('Invitation accepted.');
  };

  const declineInvite = async (id: string) => {
    const result = await declineGameInvitation(id);
    if (!result.ok) { setToast(result.error ?? 'Could not decline invitation.'); return; }
    setInvitations((prev) => prev.filter((i) => i.id !== id));
    setToast('Invitation declined.');
  };

  // Playable games first, "coming soon" stubs after — otherwise a game
  // that's actually ready to play (like Sudoku/Word Search, added after
  // the earlier games and so sorted to the end) could silently never
  // appear in a 6-item slice at all, which is exactly what happened here.
  const featuredGames = [...games].sort((a, b) => {
    const aReady = IMPLEMENTED_GAME_KEYS.includes(a.key) ? 0 : 1;
    const bReady = IMPLEMENTED_GAME_KEYS.includes(b.key) ? 0 : 1;
    return aReady - bReady;
  });

  const quickPlayKeys = ['chess', 'sudoku', 'word_search', 'tic_tac_toe', 'connect_four', 'checkers', 'ludo'];
  const quickPlay = quickPlayKeys
    .map((k) => games.find((g) => g.key === k))
    .filter((g): g is GameRow => !!g);

  const startQuickPlay = (game: GameRow) => {
    if (!IMPLEMENTED_GAME_KEYS.includes(game.key)) {
      setToast(`${game.name} is coming soon — the board games above are ready to play now.`);
      return;
    }
    history.push(`/games/play/${game.key}`, { mode: 'pvai', difficulty: 'medium' });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/market" text="" /> <BrandMark size={22} className="ng-header-logo" /></IonButtons>
          <IonTitle>Games</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">

        {/* Featured */}
        <h3 style={{ marginTop: 0 }}>Featured Games</h3>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {featuredGames.slice(0, 6).map((g) => (
            <div
              key={g.id}
              onClick={() => startQuickPlay(g)}
              style={{
                minWidth: 140, background: 'var(--ion-item-background)', borderRadius: 16,
                padding: 16, flexShrink: 0, cursor: 'pointer', position: 'relative',
              }}
            >
              {!IMPLEMENTED_GAME_KEYS.includes(g.key) && (
                <div style={{
                  position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 700,
                  background: 'rgba(0,0,0,0.35)', color: '#fff', borderRadius: 6, padding: '2px 6px',
                }}
                >
                  SOON
                </div>
              )}
              <div style={{ fontSize: 30 }}>{g.icon}</div>
              <div style={{ fontWeight: 700, marginTop: 8 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ion-color-medium)' }}>
                {g.supports_ai ? 'PvP · AI' : 'PvP'}
              </div>
            </div>
          ))}
        </div>

        {/* Quick play */}
        <h3>Quick Play</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {quickPlay.map((g) => (
            <div
              key={g.id}
              onClick={() => startQuickPlay(g)}
              style={{
                background: 'var(--ion-item-background)', borderRadius: 14, padding: '12px 4px',
                textAlign: 'center', cursor: 'pointer', position: 'relative',
              }}
            >
              {!IMPLEMENTED_GAME_KEYS.includes(g.key) && (
                <div style={{
                  position: 'absolute', top: 4, right: 4, fontSize: 7, fontWeight: 700,
                  background: 'rgba(0,0,0,0.35)', color: '#fff', borderRadius: 4, padding: '1px 4px',
                }}
                >
                  SOON
                </div>
              )}
              <div style={{ fontSize: 22 }}>{g.icon}</div>
              <div style={{ fontSize: 10, marginTop: 4 }}>{g.name}</div>
            </div>
          ))}
        </div>

        {/* Play with friends */}
        <h3>Play With Friends</h3>
        <p style={{ color: 'var(--ion-color-medium)', fontSize: 13, marginTop: -6 }}>
          Pick a game above, then invite a Next Gen contact.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {games.filter((g) => IMPLEMENTED_GAME_KEYS.includes(g.key) && g.supports_multiplayer).map((g) => (
            <IonButton key={g.id} size="small" fill="outline" onClick={() => openInvite(g)}>
              Invite · {g.name}
            </IonButton>
          ))}
        </div>

        {/* Invitations */}
        <h3>Invitations</h3>
        {invitations.length === 0 && (
          <p style={{ color: 'var(--ion-color-medium)', fontSize: 13 }}>No pending invitations.</p>
        )}
        <IonList lines="none">
          {invitations.map((inv) => (
            <IonItem key={inv.id} style={{ '--background': 'var(--ion-item-background)', borderRadius: 12, marginBottom: 8 }}>
              <IonIcon icon={mailOutline} slot="start" />
              <IonLabel>
                <h2>{gameById(inv.game_id)?.name ?? 'Game'} invitation</h2>
                <p>{new Date(inv.created_at).toLocaleString()}</p>
              </IonLabel>
              <IonButton slot="end" size="small" fill="clear" color="danger" onClick={() => declineInvite(inv.id)}>Decline</IonButton>
              <IonButton slot="end" size="small" onClick={() => acceptInvite(inv)}>Accept</IonButton>
            </IonItem>
          ))}
        </IonList>

        {/* Active matches */}
        <h3>Active Matches</h3>
        {activeMatches.length === 0 && (
          <p style={{ color: 'var(--ion-color-medium)', fontSize: 13 }}>No matches in progress.</p>
        )}
        <IonList lines="none">
          {activeMatches.map((m) => {
            const game = gameById(m.game_id);
            return (
              <IonItem key={m.id} style={{ '--background': 'var(--ion-item-background)', borderRadius: 12, marginBottom: 8 }}>
                <IonLabel>
                  <h2>{game?.name ?? 'Game'}</h2>
                  <p>In progress</p>
                </IonLabel>
                <IonButton
                  slot="end"
                  size="small"
                  disabled={!game || !IMPLEMENTED_GAME_KEYS.includes(game.key)}
                  onClick={() => game && history.push(`/games/play/${game.key}/${m.id}`, { mode: 'pvp' })}
                >
                  Resume
                </IonButton>
              </IonItem>
            );
          })}
        </IonList>

        {/* Recent games */}
        <h3>Recent Games</h3>
        {recentMatches.length === 0 && (
          <p style={{ color: 'var(--ion-color-medium)', fontSize: 13 }}>No completed matches yet.</p>
        )}
        <IonList lines="none">
          {recentMatches.map((m) => (
            <IonItem key={m.id} style={{ '--background': 'var(--ion-item-background)', borderRadius: 12, marginBottom: 8 }}>
              <IonIcon icon={timeOutline} slot="start" />
              <IonLabel>
                <h2>{gameById(m.game_id)?.name ?? 'Game'}</h2>
                <p>{m.result ?? m.status} · {m.ended_at ? new Date(m.ended_at).toLocaleDateString() : ''}</p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>

        {/* Leaderboard */}
        <h3><IonIcon icon={trophyOutline} style={{ verticalAlign: 'middle', marginRight: 6 }} />Leaderboard</h3>
        {leaderboard.length === 0 && (
          <p style={{ color: 'var(--ion-color-medium)', fontSize: 13 }}>No ranked players yet.</p>
        )}
        <IonList lines="none">
          {leaderboard.map((row, i) => (
            <IonItem key={`${row.user_id}-${row.game_id}`} style={{ '--background': 'var(--ion-item-background)', borderRadius: 12, marginBottom: 8 }}>
              <div slot="start" style={{ fontWeight: 700, width: 20 }}>{i + 1}</div>
              <IonLabel>
                <h2>{gameById(row.game_id)?.name ?? 'Game'}</h2>
              </IonLabel>
              <div slot="end" style={{ fontWeight: 700, color: 'var(--ng-blue-2)' }}>{row.rating}</div>
            </IonItem>
          ))}
        </IonList>

        {/* My stats */}
        <h3><IonIcon icon={statsChartOutline} style={{ verticalAlign: 'middle', marginRight: 6 }} />My Game Statistics</h3>
        <div style={{
          background: 'var(--ion-item-background)', borderRadius: 16, padding: 16,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center',
        }}
        >
          <div><div style={{ fontSize: 20, fontWeight: 700 }}>{stats?.games_played ?? 0}</div><div style={{ fontSize: 11, color: 'var(--ion-color-medium)' }}>Played</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ng-verified-green)' }}>{stats?.wins ?? 0}</div><div style={{ fontSize: 11, color: 'var(--ion-color-medium)' }}>Wins</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ng-security-red)' }}>{stats?.losses ?? 0}</div><div style={{ fontSize: 11, color: 'var(--ion-color-medium)' }}>Losses</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700 }}>{stats?.win_percentage ?? 0}%</div><div style={{ fontSize: 11, color: 'var(--ion-color-medium)' }}>Win rate</div></div>
        </div>

        {/* Invite modal */}
        <IonModal isOpen={!!inviteGame} onDidDismiss={() => setInviteGame(null)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Invite to {inviteGame?.name}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setInviteGame(null)}><IonIcon icon={closeOutline} /></IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonList>
              {contacts.map((c) => (
                <IonItem key={c.contact_user_id} button detail={false} onClick={() => sendInvite(c)}>
                  <div slot="start">
                    <TrustBadge trustLevel={c.trust_level} avatarUrl={c.avatar_url} initials={(c.full_name || '?').slice(0, 1).toUpperCase()} />
                  </div>
                  <IonLabel>{c.full_name}</IonLabel>
                  {sending === c.contact_user_id
                    ? <IonSpinner slot="end" name="dots" />
                    : <IonIcon icon={checkmarkCircleOutline} slot="end" color="medium" />}
                </IonItem>
              ))}
            </IonList>
            {contacts.length === 0 && (
              <p style={{ color: 'var(--ion-color-medium)' }}>
                No contacts yet. Add a Next Gen contact first, or share the app with someone by email from Chats.
              </p>
            )}
          </IonContent>
        </IonModal>

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2800} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default GamesHome;