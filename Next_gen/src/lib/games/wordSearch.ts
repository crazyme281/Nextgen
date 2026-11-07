/**
 * Word Search: places a themed list of 11 words into a rows x cols letter grid in any of 8 directions
 * (overlaps and backwards allowed, like a real word-search), then fills the rest with random letters.
 * Pure logic, no UI — WordSearchBoard consumes this.
 */

export interface PlacedWord {
  word: string;
  cells: [number, number][]; // in order from start to end letter
}

export interface WordSearchPuzzle {
  grid: string[][];
  words: PlacedWord[];
  rows: number;
  cols: number;
  theme: string; // banner title, e.g. "ABOUT THE OCEAN"
}

export interface WordSearchTheme {
  title: string;
  words: string[]; // exactly 11
}

export const GRID_ROWS = 10;
export const GRID_COLS = 9;

export const THEMES: WordSearchTheme[] = [
  { title: 'ABOUT THE OCEAN', words: ['CURRENT', 'WAVE', 'KELP', 'DRIFT', 'TRENCH', 'DEPTH', 'REEF', 'FISH', 'THERMAL', 'CORAL', 'TIDE'] },
  { title: 'ABOUT SPACE', words: ['GALAXY', 'PLANET', 'ORBIT', 'COMET', 'METEOR', 'ROCKET', 'NEBULA', 'SATURN', 'ECLIPSE', 'COSMOS', 'LUNAR'] },
  { title: 'ABOUT NATURE', words: ['FOREST', 'CANYON', 'MEADOW', 'GLACIER', 'RIVER', 'SUMMIT', 'VALLEY', 'BLOSSOM', 'STREAM', 'CLIFF', 'DESERT'] },
  { title: 'IN THE KITCHEN', words: ['SKILLET', 'BLENDER', 'PANTRY', 'RECIPE', 'SIMMER', 'SPATULA', 'KETTLE', 'GRIDDLE', 'WHISK', 'SEASON', 'OVEN'] },
  { title: 'ABOUT TECHNOLOGY', words: ['CAMERA', 'SIGNAL', 'MESSAGE', 'CONTACT', 'PROFILE', 'WALLET', 'STREAM', 'BROWSER', 'NETWORK', 'DISPLAY', 'SERVER'] },
  { title: 'ABOUT ANIMALS', words: ['TIGER', 'ZEBRA', 'ELEPHANT', 'GIRAFFE', 'DOLPHIN', 'MONKEY', 'PARROT', 'RABBIT', 'FALCON', 'PANDA', 'KOALA'] },
  { title: 'ABOUT SPORTS', words: ['SOCCER', 'TENNIS', 'HOCKEY', 'RUGBY', 'GOLF', 'BOXING', 'CRICKET', 'ARCHERY', 'SKIING', 'DIVING', 'CYCLING'] },
];

// [dRow, dCol] for all 8 compass directions.
const DIRECTIONS: [number, number][] = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function canPlace(grid: string[][], word: string, row: number, col: number, dr: number, dc: number, rows: number, cols: number): boolean {
  for (let i = 0; i < word.length; i += 1) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const existing = grid[r][c];
    if (existing !== '' && existing !== word[i]) return false;
  }
  return true;
}

function tryBuild(theme: WordSearchTheme, rows: number, cols: number): { grid: string[][]; placed: PlacedWord[] } {
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill(''));
  const placed: PlacedWord[] = [];
  // Longest first: they have the fewest legal positions.
  const words = [...theme.words].sort((a, b) => b.length - a.length);
  for (const word of words) {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row = Math.floor(Math.random() * rows);
      const col = Math.floor(Math.random() * cols);
      if (!canPlace(grid, word, row, col, dr, dc, rows, cols)) continue;
      const cells: [number, number][] = [];
      for (let i = 0; i < word.length; i += 1) {
        const r = row + dr * i;
        const c = col + dc * i;
        grid[r][c] = word[i];
        cells.push([r, c]);
      }
      placed.push({ word, cells });
      break;
    }
  }
  return { grid, placed };
}

/** Level n uses theme (n-1) mod themes, so levels cycle through the categories. */
export function generateWordSearch(level = 1, rows = GRID_ROWS, cols = GRID_COLS): WordSearchPuzzle {
  const theme = THEMES[(Math.max(1, level) - 1) % THEMES.length];

  // Retry the whole layout until every word fits, so a level always shows its full list.
  let best = tryBuild(theme, rows, cols);
  for (let i = 0; i < 30 && best.placed.length < theme.words.length; i += 1) {
    const next = tryBuild(theme, rows, cols);
    if (next.placed.length > best.placed.length) best = next;
  }

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (best.grid[r][c] === '') best.grid[r][c] = randomLetter();
    }
  }

  // Keep the list in the theme's own order (as in the word panel), not placement order.
  const order = new Map(theme.words.map((w, i) => [w, i]));
  best.placed.sort((a, b) => (order.get(a.word) ?? 0) - (order.get(b.word) ?? 0));

  return { grid: best.grid, words: best.placed, rows, cols, theme: theme.title };
}

/** True if the cells form a straight line matching one of the placed
 * words exactly (forwards or backwards), and returns which one. */
export function matchWord(puzzle: WordSearchPuzzle, path: [number, number][]): PlacedWord | null {
  if (path.length < 2) return null;
  for (const pw of puzzle.words) {
    const forward = pw.cells;
    const backward = [...pw.cells].reverse();
    const sameCells = (a: [number, number][], b: [number, number][]) =>
      a.length === b.length && a.every(([r, c], i) => r === b[i][0] && c === b[i][1]);
    if (sameCells(path, forward) || sameCells(path, backward)) return pw;
  }
  return null;
}