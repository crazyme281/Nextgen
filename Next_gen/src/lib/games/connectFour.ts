export type Disc = 'R' | 'Y' | null;
/** 6 rows x 7 cols, row 0 = top. */
export type ConnectFourState = Disc[][];

export const ROWS = 6;
export const COLS = 7;

export const emptyConnectFour = (): ConnectFourState =>
  Array.from({ length: ROWS }, () => Array<Disc>(COLS).fill(null));

export function c4ValidCols(board: ConnectFourState): number[] {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c += 1) if (board[0][c] === null) cols.push(c);
  return cols;
}

/** Returns the row the disc lands in, or -1 if the column is full. */
export function c4DropRow(board: ConnectFourState, col: number): number {
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (board[r][col] === null) return r;
  }
  return -1;
}

export function c4Drop(board: ConnectFourState, col: number, disc: 'R' | 'Y'): ConnectFourState | null {
  const row = c4DropRow(board, col);
  if (row === -1) return null;
  const next = board.map((r) => [...r]);
  next[row][col] = disc;
  return next;
}

function countDir(board: ConnectFourState, r: number, c: number, dr: number, dc: number, disc: Disc): number {
  let count = 0;
  let rr = r + dr;
  let cc = c + dc;
  while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === disc) {
    count += 1;
    rr += dr;
    cc += dc;
  }
  return count;
}

export function c4Winner(board: ConnectFourState): Disc {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const disc = board[r][c];
      if (!disc) continue;
      for (const [dr, dc] of dirs) {
        if (1 + countDir(board, r, c, dr, dc, disc) + countDir(board, r, c, -dr, -dc, disc) >= 4) {
          return disc;
        }
      }
    }
  }
  return null;
}

export function c4IsDraw(board: ConnectFourState): boolean {
  return c4ValidCols(board).length === 0 && !c4Winner(board);
}

function scorePosition(board: ConnectFourState, disc: 'R' | 'Y'): number {
  // Center-column control is the single strongest simple heuristic for C4.
  let score = 0;
  for (let r = 0; r < ROWS; r += 1) {
    if (board[r][3] === disc) score += 3;
  }
  return score;
}

function minimax(
  board: ConnectFourState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  ai: 'R' | 'Y',
): number {
  const human = ai === 'R' ? 'Y' : 'R';
  const winner = c4Winner(board);
  if (winner === ai) return 1000000 - depth;
  if (winner === human) return -1000000 + depth;
  if (c4IsDraw(board) || depth === 0) return scorePosition(board, ai) - scorePosition(board, human);

  const cols = c4ValidCols(board);
  if (maximizing) {
    let value = -Infinity;
    for (const col of cols) {
      const next = c4Drop(board, col, ai)!;
      value = Math.max(value, minimax(next, depth - 1, alpha, beta, false, ai));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  let value = Infinity;
  for (const col of cols) {
    const next = c4Drop(board, col, human)!;
    value = Math.min(value, minimax(next, depth - 1, alpha, beta, true, ai));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

export function c4BestMove(board: ConnectFourState, ai: 'R' | 'Y', difficulty: 'easy' | 'medium' | 'hard' = 'medium'): number {
  const cols = c4ValidCols(board);
  if (cols.length === 0) return -1;

  if (difficulty === 'easy') {
    return cols[Math.floor(Math.random() * cols.length)];
  }

  const depth = difficulty === 'hard' ? 5 : 3;
  let bestScore = -Infinity;
  let bestCol = cols[0];
  for (const col of cols) {
    const next = c4Drop(board, col, ai)!;
    const score = minimax(next, depth - 1, -Infinity, Infinity, false, ai);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  return bestCol;
}