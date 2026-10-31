import React, { useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { refreshOutline, checkmarkCircle } from 'ionicons/icons';
import { generateWordSearch, matchWord, type WordSearchPuzzle } from '@/lib/games/wordSearch';

type Cell = [number, number];

function cellKey(r: number, c: number) {
  return `${r}-${c}`;
}

/** Every cell strictly between start and end on the straight line
 * connecting them (inclusive) — lets a drag from A to B select the whole
 * run in one gesture, the way a real word-search works, rather than
 * requiring every intermediate cell to be individually touched. */
function lineBetween(start: Cell, end: Cell): Cell[] {
  const [r1, c1] = start;
  const [r2, c2] = end;
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  // Only a straight line (horizontal/vertical/diagonal) is a valid
  // selection — anything else just snaps back to the start cell.
  if (dr !== 0 && dc !== 0 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return [start];
  const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
  return Array.from({ length: len }, (_, i) => [r1 + dr * i, c1 + dc * i] as Cell);
}

const WordSearchBoard: React.FC = () => {
  const [puzzle, setPuzzle] = useState<WordSearchPuzzle>(() => generateWordSearch());
  const [found, setFound] = useState<Set<string>>(new Set());
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [dragStart, setDragStart] = useState<Cell | null>(null);
  const [dragPath, setDragPath] = useState<Cell[]>([]);
  const draggingRef = useRef(false);

  const allFound = puzzle.words.length > 0 && found.size === puzzle.words.length;

  function newGame() {
    const next = generateWordSearch();
    setPuzzle(next);
    setFound(new Set());
    setFoundCells(new Set());
    setDragStart(null);
    setDragPath([]);
  }

  function beginSelect(cell: Cell) {
    if (allFound) return;
    draggingRef.current = true;
    setDragStart(cell);
    setDragPath([cell]);
  }

  function extendSelect(cell: Cell) {
    if (!draggingRef.current || !dragStart) return;
    setDragPath(lineBetween(dragStart, cell));
  }

  function endSelect() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const match = matchWord(puzzle, dragPath);
    if (match && !found.has(match.word)) {
      setFound((prev) => new Set(prev).add(match.word));
      setFoundCells((prev) => {
        const next = new Set(prev);
        match.cells.forEach(([r, c]) => next.add(cellKey(r, c)));
        return next;
      });
    }
    setDragStart(null);
    setDragPath([]);
  }

  const dragKeys = new Set(dragPath.map(([r, c]) => cellKey(r, c)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ng-blue)' }}>
          Theme
        </span>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{puzzle.theme}</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${puzzle.size}, 1fr)`,
          width: '100%', maxWidth: 380, userSelect: 'none', touchAction: 'none',
          border: '2px solid var(--ion-border-color)', borderRadius: 10, overflow: 'hidden',
        }}
        onMouseUp={endSelect}
        onTouchEnd={endSelect}
      >
        {puzzle.grid.map((row, r) => row.map((letter, c) => {
          const key = cellKey(r, c);
          const isFound = foundCells.has(key);
          const isDragging = dragKeys.has(key);
          return (
            <div
              key={key}
              onMouseDown={() => beginSelect([r, c])}
              onMouseEnter={() => extendSelect([r, c])}
              onTouchStart={() => beginSelect([r, c])}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                const cellAttr = el?.getAttribute('data-cell');
                if (cellAttr) {
                  const [rr, cc] = cellAttr.split(',').map(Number);
                  extendSelect([rr, cc]);
                }
              }}
              data-cell={`${r},${c}`}
              style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, cursor: allFound ? 'default' : 'pointer',
                background: isFound
                  ? 'rgba(45,196,120,0.35)'
                  : isDragging
                    ? 'rgba(61,107,255,0.4)'
                    : 'var(--ion-background-color)',
                color: isFound ? 'var(--ng-verified-green)' : 'var(--ion-text-color)',
                border: '1px solid var(--ion-border-color)',
              }}
            >
              {letter}
            </div>
          );
        }))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 380 }}>
        {puzzle.words.map((pw) => (
          <span
            key={pw.word}
            style={{
              padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: found.has(pw.word) ? 'rgba(45,196,120,0.18)' : 'var(--ion-item-background)',
              color: found.has(pw.word) ? 'var(--ng-verified-green)' : 'var(--ion-text-color)',
              textDecoration: found.has(pw.word) ? 'line-through' : 'none',
            }}
          >
            {pw.word}
          </span>
        ))}
      </div>

      {allFound ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--ng-verified-green)' }}>
            <IonIcon icon={checkmarkCircle} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            All words found!
          </div>
          <button
            onClick={newGame}
            style={{
              background: 'var(--ng-blue)', color: '#fff', border: 'none', borderRadius: 12,
              padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            New Puzzle
          </button>
        </div>
      ) : (
        <button
          onClick={newGame}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            color: 'var(--ion-color-medium)', fontSize: 13, cursor: 'pointer', padding: 8,
          }}
        >
          <IonIcon icon={refreshOutline} /> New puzzle
        </button>
      )}
    </div>
  );
};

export default WordSearchBoard;
