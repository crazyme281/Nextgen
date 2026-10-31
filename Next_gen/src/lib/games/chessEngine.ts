import { Chess, type Square, type Move } from 'chess.js';

export type ChessFen = string;

export const initialChessFen = (): ChessFen => new Chess().fen();

export interface ChessMoveResult {
  fen: ChessFen;
  san: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  turn: 'w' | 'b';
}

export function chessLegalMovesFrom(fen: ChessFen, square: Square): Square[] {
  const chess = new Chess(fen);
  const moves = chess.moves({ square, verbose: true }) as Move[];
  return moves.map((m) => m.to as Square);
}

export function chessTryMove(fen: ChessFen, from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): ChessMoveResult | null {
  const chess = new Chess(fen);
  try {
    const move = chess.move({ from, to, promotion: promotion ?? 'q' });
    if (!move) return null;
    return {
      fen: chess.fen(),
      san: move.san,
      isCheck: chess.isCheck(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw(),
      isStalemate: chess.isStalemate(),
      turn: chess.turn(),
    };
  } catch {
    return null;
  }
}

export function chessBoard(fen: ChessFen) {
  return new Chess(fen).board();
}

export function chessTurn(fen: ChessFen): 'w' | 'b' {
  return new Chess(fen).turn();
}

export function chessIsGameOver(fen: ChessFen): boolean {
  return new Chess(fen).isGameOver();
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function materialScore(chess: Chess, forColor: 'w' | 'b'): number {
  let score = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const value = PIECE_VALUE[sq.type] ?? 0;
      score += sq.color === forColor ? value : -value;
    }
  }
  return score;
}

/**
 * Not a full engine — one-ply lookahead by material with a shallow search on
 * "hard". Good enough for a casual in-app opponent; not competition-grade.
 */
export function chessBestMove(
  fen: ChessFen,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): { from: Square; to: Square; promotion?: 'q' } | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { from: m.from as Square, to: m.to as Square, promotion: 'q' };
  }

  const color = chess.turn();
  const depth = difficulty === 'hard' ? 2 : 1;

  const search = (position: Chess, d: number, maximizing: boolean): number => {
    if (d === 0 || position.isGameOver()) {
      if (position.isCheckmate()) return maximizing ? -100000 : 100000;
      return materialScore(position, color);
    }
    const legal = position.moves({ verbose: true });
    let best = maximizing ? -Infinity : Infinity;
    for (const mv of legal) {
      position.move(mv);
      const score = search(position, d - 1, !maximizing);
      position.undo();
      best = maximizing ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
  };

  let bestScore = -Infinity;
  let bestMove = moves[0];
  for (const m of moves) {
    chess.move(m);
    const score = search(chess, depth * 2 - 1, false);
    chess.undo();
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return { from: bestMove.from as Square, to: bestMove.to as Square, promotion: 'q' };
}