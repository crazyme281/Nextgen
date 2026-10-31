export type Piece = 'r' | 'R' | 'b' | 'B' | null; // r/b = red/black men, R/B = kings
export type CheckersState = Piece[][]; // 8x8, [row][col]

export interface CheckersMove {
  from: [number, number];
  to: [number, number];
  captures: [number, number][];
}

export const emptyCheckers = (): CheckersState => {
  const board: CheckersState = Array.from({ length: 8 }, () => Array<Piece>(8).fill(null));
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if ((r + c) % 2 === 1) board[r][c] = 'b';
    }
  }
  for (let r = 5; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if ((r + c) % 2 === 1) board[r][c] = 'r';
    }
  }
  return board;
};

const isRed = (p: Piece) => p === 'r' || p === 'R';
const isBlack = (p: Piece) => p === 'b' || p === 'B';
const isKing = (p: Piece) => p === 'R' || p === 'B';
const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function directionsFor(piece: Piece): [number, number][] {
  if (isKing(piece)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  if (piece === 'r') return [[-1, -1], [-1, 1]]; // red moves up the board
  return [[1, -1], [1, 1]]; // black moves down
}

function findCapturesFrom(board: CheckersState, r: number, c: number, path: [number, number][] = []): CheckersMove[] {
  const piece = board[r][c];
  if (!piece) return [];
  const moves: CheckersMove[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const midR = r + dr;
    const midC = c + dc;
    const landR = r + dr * 2;
    const landC = c + dc * 2;
    if (!inBounds(landR, landC)) continue;
    const midPiece = board[midR]?.[midC];
    const isEnemy = midPiece && (isRed(piece) ? isBlack(midPiece) : isRed(midPiece));
    if (isEnemy && board[landR][landC] === null && !path.some(([pr, pc]) => pr === midR && pc === midC)) {
      const captured: [number, number] = [midR, midC];
      const nextPath = [...path, captured];
      const sim = board.map((row) => [...row]);
      sim[r][c] = null;
      sim[midR][midC] = null;
      const promoted = (isRed(piece) && landR === 0) || (isBlack(piece) && landR === 7) ? (isRed(piece) ? 'R' : 'B') : piece;
      sim[landR][landC] = promoted;
      const chained = findCapturesFrom(sim, landR, landC, nextPath);
      if (chained.length > 0) {
        moves.push(...chained.map((m) => ({ from: [r, c] as [number, number], to: m.to, captures: [captured, ...m.captures] })));
      } else {
        moves.push({ from: [r, c], to: [landR, landC], captures: nextPath });
      }
    }
  }
  return moves;
}

function findSimpleMovesFrom(board: CheckersState, r: number, c: number): CheckersMove[] {
  const piece = board[r][c];
  if (!piece) return [];
  const moves: CheckersMove[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === null) {
      moves.push({ from: [r, c], to: [nr, nc], captures: [] });
    }
  }
  return moves;
}

/** Standard rule: if any capture is available for the side to move, it's mandatory. */
export function checkersLegalMoves(board: CheckersState, side: 'r' | 'b'): CheckersMove[] {
  const captures: CheckersMove[] = [];
  const simples: CheckersMove[] = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = board[r][c];
      if (!piece) continue;
      if ((side === 'r' && !isRed(piece)) || (side === 'b' && !isBlack(piece))) continue;
      captures.push(...findCapturesFrom(board, r, c));
      simples.push(...findSimpleMovesFrom(board, r, c));
    }
  }
  return captures.length > 0 ? captures : simples;
}

export function checkersApplyMove(board: CheckersState, move: CheckersMove): CheckersState {
  const next = board.map((row) => [...row]);
  const piece = next[move.from[0]][move.from[1]];
  next[move.from[0]][move.from[1]] = null;
  for (const [cr, cc] of move.captures) next[cr][cc] = null;
  const promoted = piece === 'r' && move.to[0] === 0 ? 'R' : piece === 'b' && move.to[0] === 7 ? 'B' : piece;
  next[move.to[0]][move.to[1]] = promoted;
  return next;
}

export function checkersWinner(board: CheckersState, sideToMove: 'r' | 'b'): 'r' | 'b' | null {
  const redLeft = board.some((row) => row.some(isRed));
  const blackLeft = board.some((row) => row.some(isBlack));
  if (!redLeft) return 'b';
  if (!blackLeft) return 'r';
  if (checkersLegalMoves(board, sideToMove).length === 0) return sideToMove === 'r' ? 'b' : 'r';
  return null;
}

function evaluate(board: CheckersState, ai: 'r' | 'b'): number {
  let score = 0;
  for (const row of board) {
    for (const p of row) {
      if (!p) continue;
      const side = isRed(p) ? 'r' : 'b';
      const value = isKing(p) ? 3 : 1;
      score += side === ai ? value : -value;
    }
  }
  return score;
}

function minimax(board: CheckersState, side: 'r' | 'b', depth: number, alpha: number, beta: number, ai: 'r' | 'b'): number {
  const opp: 'r' | 'b' = side === 'r' ? 'b' : 'r';
  const winner = checkersWinner(board, side);
  if (winner) return winner === ai ? 100000 : -100000;
  if (depth === 0) return evaluate(board, ai);

  const moves = checkersLegalMoves(board, side);
  if (moves.length === 0) return side === ai ? -100000 : 100000;

  if (side === ai) {
    let best = -Infinity;
    for (const m of moves) {
      const next = checkersApplyMove(board, m);
      best = Math.max(best, minimax(next, opp, depth - 1, alpha, beta, ai));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    const next = checkersApplyMove(board, m);
    best = Math.min(best, minimax(next, opp, depth - 1, alpha, beta, ai));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

export function checkersBestMove(
  board: CheckersState,
  ai: 'r' | 'b',
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): CheckersMove | null {
  const moves = checkersLegalMoves(board, ai);
  if (moves.length === 0) return null;
  if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)];

  const depth = difficulty === 'hard' ? 5 : 3;
  const opp: 'r' | 'b' = ai === 'r' ? 'b' : 'r';
  let bestScore = -Infinity;
  let bestMove = moves[0];
  for (const m of moves) {
    const next = checkersApplyMove(board, m);
    const score = minimax(next, opp, depth - 1, -Infinity, Infinity, ai);
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return bestMove;
}