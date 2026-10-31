import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent,
  IonIcon, IonToast, IonSpinner,
} from '@ionic/react';
import { personCircle, hardwareChipOutline } from 'ionicons/icons';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

import {
  emptyTtt, tttValidMove, tttWinner, tttIsDraw, tttBestMove, type TttState,
} from '@/lib/games/tictactoe';
import {
  emptyConnectFour, c4Drop, c4Winner, c4IsDraw, c4BestMove, c4ValidCols, type ConnectFourState,
} from '@/lib/games/connectFour';
import {
  emptyCheckers, checkersLegalMoves, checkersApplyMove, checkersWinner, checkersBestMove,
  type CheckersState, type CheckersMove,
} from '@/lib/games/checkers';
import {
  initialChessFen, chessTryMove, chessBestMove, chessBoard, chessTurn, type ChessFen,
} from '@/lib/games/chessEngine';
import type { Square } from 'chess.js';

import TicTacToeBoard from '@/pages/games/boards/TicTacToeBoard';
import ConnectFourBoard from '@/pages/games/boards/ConnectFourBoard';
import CheckersBoard from '@/pages/games/boards/CheckersBoard';
import ChessBoard from '@/pages/games/boards/ChessBoard';
import SudokuBoard from '@/pages/games/boards/SudokuBoard';
import WordSearchBoard from '@/pages/games/boards/WordSearchBoard';

export type GameKey = 'tic_tac_toe' | 'connect_four' | 'checkers' | 'chess' | 'sudoku' | 'word_search';

// Sudoku and Word Search are solitaire puzzles — no opponent, no turns,
// no board_state to sync. They don't fit the two-sided turn-based shape
// the rest of this file is built around (see applyBoardState/commitXXX
// below), so they're handled as a short-circuit right where GameRoom
// renders, reusing the same route, header, and back button as every
// other game rather than a separate page/system.
const SOLITAIRE_GAME_KEYS: GameKey[] = ['sudoku', 'word_search'];

interface RoomState {
  mode: 'pvai' | 'local' | 'pvp';
  difficulty?: 'easy' | 'medium' | 'hard';
  peerName?: string;
  peerAvatar?: string | null;
  gameRowId?: string;
}

const GAME_TITLES: Record<GameKey, string> = {
  tic_tac_toe: 'Tic-Tac-Toe',
  connect_four: 'Connect Four',
  checkers: 'Checkers',
  chess: 'Chess',
  sudoku: 'Sudoku',
  word_search: 'Word Search',
};

function seatToSide(gameKey: GameKey, seatIndex: number): string {
  const sides: Record<GameKey, [string, string]> = {
    tic_tac_toe: ['X', 'O'],
    connect_four: ['R', 'Y'],
    checkers: ['r', 'b'],
    chess: ['w', 'b'],
    sudoku: ['-', '-'], // unreachable — see SOLITAIRE_GAME_KEYS guard in the component below
    word_search: ['-', '-'],
  };
  return sides[gameKey][seatIndex] ?? sides[gameKey][0];
}

function otherSide(gameKey: GameKey, side: string): string {
  const pairs: Record<GameKey, [string, string]> = {
    tic_tac_toe: ['X', 'O'],
    connect_four: ['R', 'Y'],
    checkers: ['r', 'b'],
    chess: ['w', 'b'],
    sudoku: ['-', '-'], // unreachable — see SOLITAIRE_GAME_KEYS guard in the component below
    word_search: ['-', '-'],
  };
  const [a, b] = pairs[gameKey];
  return side === a ? b : a;
}

function applyBoardState(
  gameKey: GameKey,
  boardState: any,
  setters: {
    setTtt: (v: TttState) => void;
    setC4: (v: ConnectFourState) => void;
    setCheckers: (v: CheckersState) => void;
    setFen: (v: ChessFen) => void;
  },
) {
  if (!boardState || Object.keys(boardState).length === 0) return;
  if (gameKey === 'tic_tac_toe' && boardState.cells) setters.setTtt(boardState.cells);
  if (gameKey === 'connect_four' && boardState.board) setters.setC4(boardState.board);
  if (gameKey === 'checkers' && boardState.board) setters.setCheckers(boardState.board);
  if (gameKey === 'chess' && boardState.fen) setters.setFen(boardState.fen);
}

const GameRoom: React.FC = () => {
  const { gameKey, matchId } = useParams<{ gameKey: GameKey; matchId?: string }>();
  const location = useLocation<RoomState>();
  const history = useHistory();
  const { user } = useAuth();
  const state = location.state ?? { mode: 'pvai', difficulty: 'medium' };

  const [toast, setToast] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [loading, setLoading] = useState(state.mode === 'pvp');
  const [gameOver, setGameOver] = useState(false);

  const mySideRef = useRef<string | null>(null);
  const opponentIdRef = useRef<string | null>(null);
  const finishedRef = useRef(false);

  const [ttt, setTtt] = useState<TttState>(emptyTtt());
  const [c4, setC4] = useState<ConnectFourState>(emptyConnectFour());
  const [checkers, setCheckers] = useState<CheckersState>(emptyCheckers());
  const [fen, setFen] = useState<ChessFen>(initialChessFen());
  const [turn, setTurn] = useState<string>(
    gameKey === 'tic_tac_toe' ? 'X' : gameKey === 'connect_four' ? 'R' : gameKey === 'checkers' ? 'r' : 'w',
  );

  const isMyTurn = state.mode !== 'pvp' ? true : mySideRef.current === turn;

  useEffect(() => {
    if (state.mode !== 'pvp' || !matchId || !user) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: match } = await supabase
        .from('game_matches')
        .select('board_state, current_turn_player_id, created_by, status')
        .eq('id', matchId)
        .maybeSingle();
      const { data: players } = await supabase
        .from('game_players')
        .select('user_id, seat_index')
        .eq('match_id', matchId);

      if (!match || !players) {
        setToast('Could not load this match.');
        setLoading(false);
        return;
      }
      const me = players.find((p) => p.user_id === user.id);
      const opp = players.find((p) => p.user_id !== user.id);
      opponentIdRef.current = opp?.user_id ?? null;
      mySideRef.current = seatToSide(gameKey, me?.seat_index ?? 0);
      applyBoardState(gameKey, match.board_state, { setTtt, setC4, setCheckers, setFen });
      setTurn(match.current_turn_player_id === me?.user_id ? mySideRef.current! : otherSide(gameKey, mySideRef.current!));
      setLoading(false);

      channel = supabase
        .channel(`match:${matchId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_matches', filter: `id=eq.${matchId}` }, ({ new: row }: any) => {
          applyBoardState(gameKey, row.board_state, { setTtt, setC4, setCheckers, setFen });
          setTurn(row.current_turn_player_id === user.id ? mySideRef.current! : otherSide(gameKey, mySideRef.current!));
          if (row.status === 'completed') setGameOver(true);
        })
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, user]);

  useEffect(() => {
    if (state.mode === 'local') {
      mySideRef.current = null;
    } else if (state.mode === 'pvai') {
      mySideRef.current = gameKey === 'tic_tac_toe' ? 'X' : gameKey === 'connect_four' ? 'R' : gameKey === 'checkers' ? 'r' : 'w';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.mode !== 'pvai' || gameOver) return;
    const aiSide = otherSide(gameKey, mySideRef.current!);
    if (turn !== aiSide) return;
    const difficulty = state.difficulty ?? 'medium';
    const timer = setTimeout(() => {
      if (gameKey === 'tic_tac_toe') {
        const idx = tttBestMove(ttt, aiSide as 'X' | 'O');
        if (idx >= 0) commitTtt(idx);
      } else if (gameKey === 'connect_four') {
        const col = c4BestMove(c4, aiSide as 'R' | 'Y', difficulty);
        if (col >= 0) commitC4(col);
      } else if (gameKey === 'checkers') {
        const move = checkersBestMove(checkers, aiSide as 'r' | 'b', difficulty);
        if (move) commitCheckers(move);
      } else if (gameKey === 'chess') {
        const move = chessBestMove(fen, difficulty);
        if (move) commitChess(move.from, move.to);
      }
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, ttt, c4, checkers, fen, gameOver]);

  const syncPvpMove = async (nextBoardState: unknown, nextTurnUserId: string | null, winnerId: string | null, isDraw: boolean) => {
    if (state.mode !== 'pvp' || !matchId) return;
    await supabase.from('game_matches').update({
      board_state: nextBoardState as any,
      current_turn_player_id: nextTurnUserId,
      status: winnerId || isDraw ? 'completed' : 'active',
    }).eq('id', matchId);
    if ((winnerId || isDraw) && !finishedRef.current) {
      finishedRef.current = true;
      await supabase.rpc('finish_match', { p_match_id: matchId, p_winner_id: winnerId ?? undefined, p_is_draw: isDraw });
    }
  };

  const commitTtt = (index: number) => {
    if (!tttValidMove(ttt, index) || gameOver) return;
    const mover = turn as 'X' | 'O';
    const next = [...ttt];
    next[index] = mover;
    setTtt(next);
    const { winner } = tttWinner(next);
    const draw = !winner && tttIsDraw(next);
    if (winner || draw) { setGameOver(true); setStatusText(winner ? `${winner} wins!` : "It's a draw."); }
    setTurn(mover === 'X' ? 'O' : 'X');
    if (state.mode === 'pvp') {
      syncPvpMove({ cells: next }, winner || draw ? null : opponentIdRef.current, winner ? user!.id : null, draw);
    }
  };

  const commitC4 = (col: number) => {
    if (gameOver) return;
    const mover = turn as 'R' | 'Y';
    const next = c4Drop(c4, col, mover);
    if (!next) return;
    setC4(next);
    const winner = c4Winner(next);
    const draw = !winner && c4IsDraw(next);
    if (winner || draw) { setGameOver(true); setStatusText(winner ? `${winner === 'R' ? 'Red' : 'Yellow'} wins!` : "It's a draw."); }
    setTurn(mover === 'R' ? 'Y' : 'R');
    if (state.mode === 'pvp') {
      syncPvpMove({ board: next }, winner || draw ? null : opponentIdRef.current, winner ? user!.id : null, draw);
    }
  };

  const commitCheckers = (move: CheckersMove) => {
    if (gameOver) return;
    const mover = turn as 'r' | 'b';
    const next = checkersApplyMove(checkers, move);
    setCheckers(next);
    const nextSide = mover === 'r' ? 'b' : 'r';
    const winner = checkersWinner(next, nextSide);
    if (winner) { setGameOver(true); setStatusText(`${winner === 'r' ? 'Red' : 'Black'} wins!`); }
    setTurn(nextSide);
    if (state.mode === 'pvp') {
      syncPvpMove({ board: next }, winner ? null : opponentIdRef.current, winner ? user!.id : null, false);
    }
  };

  const commitChess = (from: Square, to: Square) => {
    if (gameOver) return;
    const mover = turn as 'w' | 'b';
    const result = chessTryMove(fen, from, to);
    if (!result) return;
    setFen(result.fen);
    if (result.isCheckmate) { setGameOver(true); setStatusText(`Checkmate — ${mover === 'w' ? 'White' : 'Black'} wins!`); }
    else if (result.isDraw || result.isStalemate) { setGameOver(true); setStatusText("It's a draw."); }
    setTurn(result.turn);
    if (state.mode === 'pvp') {
      const draw = result.isDraw || result.isStalemate;
      syncPvpMove({ fen: result.fen }, result.isCheckmate || draw ? null : opponentIdRef.current, result.isCheckmate ? user!.id : null, draw);
    }
  };

  const canAct = state.mode === 'local' || isMyTurn;

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding" fullscreen style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IonSpinner name="crescent" />
        </IonContent>
      </IonPage>
    );
  }

  if (SOLITAIRE_GAME_KEYS.includes(gameKey)) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start"><IonBackButton defaultHref="/games" text="" /></IonButtons>
            <IonTitle>{GAME_TITLES[gameKey]}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="ion-padding">
          {gameKey === 'sudoku' && <SudokuBoard />}
          {gameKey === 'word_search' && <WordSearchBoard />}
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/games" text="" /></IonButtons>
          <IonTitle>{GAME_TITLES[gameKey]}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, fontSize: 14, color: 'var(--ion-color-medium)' }}>
          <IonIcon icon={state.mode === 'pvai' ? hardwareChipOutline : personCircle} />
          {gameOver
            ? statusText
            : state.mode === 'local'
              ? `${turn}'s turn`
              : isMyTurn ? 'Your turn' : `Waiting for ${state.peerName ?? 'opponent'}…`}
        </div>

        {gameKey === 'tic_tac_toe' && <TicTacToeBoard board={ttt} disabled={!canAct || gameOver} onPlay={commitTtt} />}
        {gameKey === 'connect_four' && (
          <ConnectFourBoard board={c4} disabled={!canAct || gameOver} validCols={c4ValidCols(c4)} onDrop={commitC4} />
        )}
        {gameKey === 'checkers' && (
          <CheckersBoard
            board={checkers}
            side={turn as 'r' | 'b'}
            legalMoves={checkersLegalMoves(checkers, turn as 'r' | 'b')}
            disabled={!canAct || gameOver}
            onMove={commitCheckers}
          />
        )}
        {gameKey === 'chess' && (
          <ChessBoard fen={fen} board={chessBoard(fen)} turn={chessTurn(fen)} disabled={!canAct || gameOver} onMove={commitChess} />
        )}

        {gameOver && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>{statusText}</div>
            <button
              onClick={() => history.replace('/games')}
              style={{
                background: 'var(--ng-blue)', color: '#fff', border: 'none', borderRadius: 12,
                padding: '10px 20px', fontWeight: 600,
              }}
            >
              Back to Games
            </button>
          </div>
        )}

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default GameRoom;