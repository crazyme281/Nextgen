export type Cell = 'X' | 'O' | null;
export type TttState = Cell[]; // length 9, row-major

export const emptyTtt = (): TttState => Array(9).fill(null);

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function tttWinner(board: TttState): { winner: Cell; line: number[] | null } {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

export function tttIsDraw(board: TttState): boolean {
  return board.every((c) => c !== null) && !tttWinner(board).winner;
}

export function tttValidMove(board: TttState, index: number): boolean {
  return index >= 0 && index < 9 && board[index] === null && !tttWinner(board).winner;
}

/** Perfect-play minimax — Tic-Tac-Toe's search space is tiny (≤9! states). */
export function tttBestMove(board: TttState, ai: 'X' | 'O'): number {
  const human = ai === 'X' ? 'O' : 'X';

  const minimax = (state: TttState, player: 'X' | 'O'): number => {
    const { winner } = tttWinner(state);
    if (winner === ai) return 10;
    if (winner === human) return -10;
    if (tttIsDraw(state)) return 0;

    const scores: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      if (state[i] === null) {
        const next = [...state];
        next[i] = player;
        scores.push(minimax(next, player === 'X' ? 'O' : 'X'));
      }
    }
    return player === ai ? Math.max(...scores) : Math.min(...scores);
  };

  let bestScore = -Infinity;
  let bestIndex = -1;
  for (let i = 0; i < 9; i += 1) {
    if (board[i] === null) {
      const next = [...board];
      next[i] = ai;
      const score = minimax(next, human);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }
  return bestIndex;
}