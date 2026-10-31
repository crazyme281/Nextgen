/**
 * Word Search: places a word list into an NxN letter grid in one of 8
 * directions (allowing overlaps/backwards, like a real word-search
 * puzzle), filling remaining cells with random letters. Pure logic, no
 * UI — the board component consumes this.
 */

export interface PlacedWord {
  word: string;
  cells: [number, number][]; // in order from start to end letter
}

export interface WordSearchPuzzle {
  grid: string[][];
  words: PlacedWord[];
  size: number;
  theme: string;
}

// Grouped into themes rather than one flat pool — a new puzzle picks one
// theme at random and uses its words together, the way a real word-search
// app presents a coherent set (e.g. all "space" words, all "ocean" words)
// rather than an arbitrary grab-bag every time.
const THEMES: Record<string, string[]> = {
  Space: ['GALAXY', 'PLANET', 'ORBIT', 'COMET', 'METEOR', 'ROCKET', 'NEBULA', 'ASTEROID', 'SATELLITE', 'ECLIPSE'],
  Ocean: ['CORAL', 'DOLPHIN', 'CURRENT', 'ISLAND', 'HARBOR', 'TIDE', 'ANCHOR', 'LAGOON', 'STARFISH', 'VOYAGE'],
  Kitchen: ['SKILLET', 'BLENDER', 'PANTRY', 'RECIPE', 'SIMMER', 'SPATULA', 'KETTLE', 'GRIDDLE', 'WHISK', 'SEASON'],
  Nature: ['FOREST', 'CANYON', 'MEADOW', 'GLACIER', 'BOULDER', 'THUNDER', 'HARVEST', 'BLOSSOM', 'RIVER', 'SUMMIT'],
  Technology: ['CAMERA', 'SIGNAL', 'MESSAGE', 'CONTACT', 'PROFILE', 'WALLET', 'STREAM', 'BROWSER', 'NETWORK', 'DISPLAY'],
};

function pickTheme(): { name: string; words: string[] } {
  const names = Object.keys(THEMES);
  const name = names[Math.floor(Math.random() * names.length)];
  return { name, words: THEMES[name] };
}

// [dRow, dCol] for all 8 compass directions.
const DIRECTIONS: [number, number][] = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function canPlace(grid: string[][], word: string, row: number, col: number, dr: number, dc: number, size: number): boolean {
  for (let i = 0; i < word.length; i += 1) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    const existing = grid[r][c];
    if (existing !== '' && existing !== word[i]) return false;
  }
  return true;
}

export function generateWordSearch(wordCount = 8, size = 12): WordSearchPuzzle {
  const theme = pickTheme();
  const words = [...theme.words]
    .sort(() => Math.random() - 0.5)
    .slice(0, wordCount)
    .filter((w) => w.length <= size);

  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placed: PlacedWord[] = [];

  for (const word of words) {
    let success = false;
    for (let attempt = 0; attempt < 200 && !success; attempt += 1) {
      const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      if (!canPlace(grid, word, row, col, dr, dc, size)) continue;
      const cells: [number, number][] = [];
      for (let i = 0; i < word.length; i += 1) {
        const r = row + dr * i;
        const c = col + dc * i;
        grid[r][c] = word[i];
        cells.push([r, c]);
      }
      placed.push({ word, cells });
      success = true;
    }
    // If a word genuinely couldn't fit after many attempts (crowded
    // grid), it's simply skipped rather than failing the whole puzzle.
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r][c] === '') grid[r][c] = randomLetter();
    }
  }

  return { grid, words: placed, size, theme: theme.name };
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
