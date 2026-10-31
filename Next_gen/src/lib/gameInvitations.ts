/**
 * Accept/decline a game invitation. Pulled out into one place so
 * GamesHome's own Invitations list and ChatRoom's in-conversation invite
 * card both drive the exact same backend calls — not two copies of the
 * same logic that could quietly drift apart.
 */
import { supabase } from '@/lib/supabase';

const IMPLEMENTED_GAME_KEYS = ['tic_tac_toe', 'connect_four', 'checkers', 'chess', 'sudoku', 'word_search'];

export interface GameInvitationResult {
  ok: boolean;
  error?: string;
  /** Set on successful accept of an implemented game — where to send the player. */
  playUrl?: string;
}

export async function acceptGameInvitation(
  invitationId: string,
  matchId: string | null,
  gameKey: string | null,
): Promise<GameInvitationResult> {
  const { error: updErr } = await supabase
    .from('game_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitationId);
  if (updErr) return { ok: false, error: updErr.message };

  if (!matchId || !gameKey) return { ok: true };

  const { error: joinErr } = await supabase.rpc('join_match', { p_match_id: matchId });
  if (joinErr) return { ok: false, error: joinErr.message };

  if (!IMPLEMENTED_GAME_KEYS.includes(gameKey)) {
    return { ok: false, error: `That game isn't playable yet.` };
  }
  return { ok: true, playUrl: `/games/play/${gameKey}/${matchId}` };
}

export async function declineGameInvitation(invitationId: string): Promise<GameInvitationResult> {
  const { error } = await supabase
    .from('game_invitations')
    .update({ status: 'declined', declined_at: new Date().toISOString() })
    .eq('id', invitationId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
