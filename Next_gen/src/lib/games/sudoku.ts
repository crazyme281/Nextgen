/**
 * Sudoku: generation (via backtracking solve of an empty grid, then
 * digging holes while checking the result still has exactly one
 * solution), validation, and completion checking. Pure logic, no UI —
 * mirrors how the other games/*.ts files in this folder are structured
 * (chessEngine.ts, connectFour.ts, etc.), just for a single-player puzzle
 * instead of a two-sided board.
 */

export type SudokuCell = number | null; // null = empty
export type SudokuGrid = SudokuCell[][]; // 9x9, rows then columns
export type Difficulty = 'easy' | 'medium' | 'hard';

const SIZE = 9;
const BOX = 3;

function emptyGrid(): number[][] {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isSafe(grid: number[][], row: number, col: number, val: number): boolean {
  for (let i = 0; i < SIZE; i += 1) {
    if (grid[row][i] === val || grid[i][col] === val) return false;
  }
  const br = row - (row % BOX);
  const bc = col - (col % BOX);
  for (let r = 0; r < BOX; r += 1) {
    for (let c = 0; c < BOX; c += 1) {
      if (grid[br + r][bc + c] === val) return false;
    }
  }
  return true;
}

/** Fills `grid` in place via randomized backtracking. Returns false if
 * (in theory) no solution exists from the current partial state. */
function fillGrid(grid: number[][]): boolean {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (grid[row][col] !== 0) continue;
      for (const val of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (isSafe(grid, row, col, val)) {
          grid[row][col] = val;
          if (fillGrid(grid)) return true;
          grid[row][col] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

/** Counts solutions up to `cap` (we only ever need to know 1 vs more-than-1). */
function countSolutions(grid: number[][], cap = 2): number {
  let count = 0;
  const solve = (g: number[][]): boolean => {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (g[row][col] !== 0) continue;
        for (let val = 1; val <= 9; val += 1) {
          if (isSafe(g, row, col, val)) {
            g[row][col] = val;
            if (solve(g)) return true; // bubble up early once cap hit
            g[row][col] = 0;
          }
        }
        return false;
      }
    }
    count += 1;
    return count >= cap;
  };
  solve(grid.map((r) => [...r]));
  return count;
}

const HOLES_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 36,
  medium: 46,
  hard: 54,
};

export function generateSudoku(difficulty: Difficulty = 'medium'): { puzzle: SudokuGrid; solution: SudokuGrid } {
  const solved = emptyGrid();
  fillGrid(solved);
  const solution: SudokuGrid = solved.map((r) => r.map((v) => v));

  const puzzle = solved.map((r) => [...r]);
  const cells = shuffled(
    Array.from({ length: SIZE * SIZE }, (_, i) => [Math.floor(i / SIZE), i % SIZE] as const),
  );

  let holes = 0;
  const target = HOLES_BY_DIFFICULTY[difficulty];
  for (const [r, c] of cells) {
    if (holes >= target) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    // Only keep the hole if the puzzle still has a single unique
    // solution — otherwise a real player could get stuck guessing
    // between two valid completions, which isn't a fair puzzle.
    if (countSolutions(puzzle) !== 1) {
      puzzle[r][c] = backup;
    } else {
      holes += 1;
    }
  }

  return {
    puzzle: puzzle.map((r) => r.map((v) => (v === 0 ? null : v))),
    solution: solution.map((r) => r.map((v) => v)),
  };
}

/** True if `val` doesn't conflict with anything currently in the grid at row/col/box. */
export function isValidPlacement(grid: SudokuGrid, row: number, col: number, val: number): boolean {
  for (let i = 0; i < SIZE; i += 1) {
    if (i !== col && grid[row][i] === val) return false;
    if (i !== row && grid[i][col] === val) return false;
  }
  const br = row - (row % BOX);
  const bc = col - (col % BOX);
  for (let r = 0; r < BOX; r += 1) {
    for (let c = 0; c < BOX; c += 1) {
      if ((br + r !== row || bc + c !== col) && grid[br + r][bc + c] === val) return false;
    }
  }
  return true;
}

export function isSudokuComplete(grid: SudokuGrid): boolean {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const val = grid[row][col];
      if (val === null) return false;
      if (!isValidPlacement(grid, row, col, val)) return false;
    }
  }
  return true;
}
