import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IonActionSheet, IonIcon, IonToast } from '@ionic/react';
import { chevronBack, settingsSharp, star, add } from 'ionicons/icons';
import { generateWordSearch, matchWord, type WordSearchPuzzle } from '@/lib/games/wordSearch';

/**
 * Word Search screen — a full-screen game layout: top bar (back, settings, level, coins), themed title
 * banner with progress, the word list, and the letter board with rounded highlight capsules.
 *
 * The board and its panels use fixed light-lavender surfaces with dark navy letters, so the puzzle has the
 * same strong contrast in both the app's dark and light modes. Level and coins are saved on the device.
 */

type Cell = [number, number];

const STORE_KEY = 'ng.wordsearch.v1';
const HINT_COST = 50;
const COINS_PER_WORD = 10;
const LEVEL_BONUS = 50;
const PACK_SIZE = 20;

// Capsule colours for found words (translucent so the letters stay readable).
const FOUND_COLORS = ['#FF7BAC', '#58D68D', '#5DADE2', '#F5B041', '#AF7AC5', '#48C9B0', '#EC7063', '#F4D03F', '#7FB3FF', '#F1948A', '#82E0AA'];

const FONT = "'Nunito','Montserrat',ui-rounded,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

interface Saved { level: number; coins: number }

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Saved;
      if (Number.isFinite(parsed.level) && Number.isFinite(parsed.coins)) return parsed;
    }
  } catch { /* fall through */ }
  return { level: 1, coins: 100 }; // a little starting balance so hints are usable straight away
}

function save(s: Saved) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

/** Straight line (horizontal / vertical / diagonal) from start to end, inclusive. */
function lineBetween(start: Cell, end: Cell): Cell[] {
  const [r1, c1] = start;
  const [r2, c2] = end;
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  if (dr !== 0 && dc !== 0 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return [start];
  const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
  return Array.from({ length: len }, (_, i) => [r1 + dr * i, c1 + dc * i] as Cell);
}

interface Props {
  onBack: () => void;
}

const WordSearchBoard: React.FC<Props> = ({ onBack }) => {
  const [saved, setSaved] = useState<Saved>(loadSaved);
  const [puzzle, setPuzzle] = useState<WordSearchPuzzle>(() => generateWordSearch(saved.level));
  const [found, setFound] = useState<Map<string, number>>(new Map()); // word -> colour index
  const [dragStart, setDragStart] = useState<Cell | null>(null);
  const [dragPath, setDragPath] = useState<Cell[]>([]);
  const [hintCell, setHintCell] = useState<Cell | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [justWon, setJustWon] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { rows, cols } = puzzle;
  const allFound = puzzle.words.length > 0 && found.size === puzzle.words.length;
  const packIndex = ((saved.level - 1) % PACK_SIZE) + 1;

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);

  const updateSaved = (next: Saved) => {
    setSaved(next);
    save(next);
  };

  const startLevel = (level: number) => {
    setPuzzle(generateWordSearch(level));
    setFound(new Map());
    setDragStart(null);
    setDragPath([]);
    setHintCell(null);
    setJustWon(false);
  };

  /** Which cell is under this screen point? Computed from the board's own geometry, so dragging stays
   *  accurate however the board is scaled. */
  const cellAt = (clientX: number, clientY: number): Cell | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const c = Math.floor(((clientX - rect.left) / rect.width) * cols);
    const r = Math.floor(((clientY - rect.top) / rect.height) * rows);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    return [r, c];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (allFound) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragStart(cell);
    setDragPath([cell]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !dragStart) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (cell) setDragPath(lineBetween(dragStart, cell));
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const match = matchWord(puzzle, dragPath);
    if (match && !found.has(match.word)) {
      const next = new Map(found).set(match.word, found.size % FOUND_COLORS.length);
      setFound(next);
      setHintCell(null);
      const completed = next.size === puzzle.words.length;
      if (completed) setJustWon(true);
      // 10 coins per word, plus a bonus for finishing the level.
      updateSaved({ level: saved.level, coins: saved.coins + COINS_PER_WORD + (completed ? LEVEL_BONUS : 0) });
    }
    setDragStart(null);
    setDragPath([]);
  };

  const spendHint = () => {
    setHintOpen(false);
    const target = puzzle.words.find((w) => !found.has(w.word));
    if (!target) return;
    if (saved.coins < HINT_COST) {
      setToast(`You need ${HINT_COST} coins for a hint. Find words to earn more.`);
      return;
    }
    updateSaved({ ...saved, coins: saved.coins - HINT_COST });
    setHintCell(target.cells[0] as Cell);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintCell(null), 4000);
  };

  const nextLevel = () => {
    const level = saved.level + 1;
    updateSaved({ ...saved, level });
    startLevel(level);
  };

  const foundSegments = useMemo(
    () => puzzle.words
      .filter((w) => found.has(w.word))
      .map((w) => ({ word: w.word, a: w.cells[0], b: w.cells[w.cells.length - 1], color: FOUND_COLORS[(found.get(w.word) ?? 0) % FOUND_COLORS.length] })),
    [puzzle, found],
  );

  const dragSegment = dragPath.length > 0 ? { a: dragPath[0], b: dragPath[dragPath.length - 1] } : null;
  const circleBtn: React.CSSProperties = {
    width: 46, height: 46, borderRadius: 14, border: '2px solid rgba(255,255,255,0.55)',
    background: '#7D8DDB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, padding: 0, cursor: 'pointer', boxShadow: '0 3px 0 rgba(40,50,120,0.45)',
  };

  const capsule = (a: number[], b: number[], color: string, opacity: number, key: string) => (
    <line
      key={key}
      x1={a[1] + 0.5}
      y1={a[0] + 0.5}
      x2={b[1] + 0.5}
      y2={b[0] + 0.5}
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={0.8}
      strokeLinecap="round"
    />
  );

  return (
    <div
      style={{
        minHeight: '100%', boxSizing: 'border-box', padding: '10px 12px 24px', fontFamily: FONT,
        background: 'radial-gradient(circle at 85% 4%, rgba(255,170,90,0.75) 0%, rgba(255,170,90,0) 38%), linear-gradient(180deg, #4D86D8 0%, #3563BF 45%, #25449A 100%)',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" style={circleBtn} onClick={onBack} aria-label="Back">
          <IonIcon icon={chevronBack} />
        </button>
        <button type="button" style={circleBtn} onClick={() => setMenuOpen(true)} aria-label="Settings">
          <IonIcon icon={settingsSharp} />
        </button>
        <div
          style={{
            flex: 1, textAlign: 'center', background: '#F1F2F7', color: '#4A4A58', fontWeight: 800,
            fontSize: 20, borderRadius: 999, padding: '9px 8px', boxShadow: '0 3px 0 rgba(40,50,120,0.35)',
          }}
        >
          Level {saved.level}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            aria-hidden="true"
            style={{
              width: 34, height: 34, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FFE680, #F5B800)',
              border: '2px solid #C98F00', marginRight: -12, zIndex: 1,
            }}
          />
          <div
            style={{
              background: '#3E50B5', color: '#fff', fontWeight: 800, fontSize: 18, padding: '7px 12px 7px 18px',
              borderRadius: '6px 0 0 6px', minWidth: 62, textAlign: 'center',
            }}
          >
            {saved.coins}
          </div>
          <button
            type="button"
            onClick={() => setHintOpen(true)}
            aria-label="Get a hint"
            style={{
              width: 36, height: 36, border: 'none', borderRadius: '0 8px 8px 0', background: '#4CC96A', color: '#fff',
              fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer',
            }}
          >
            <IonIcon icon={add} />
          </button>
        </div>
      </div>

      {/* Title banner with progress */}
      <div
        style={{
          position: 'relative', background: 'linear-gradient(180deg, #F6CB56 0%, #E8AE35 100%)', borderRadius: 14,
          padding: '9px 14px 9px 56px', marginBottom: 10, boxShadow: '0 3px 0 rgba(150,100,10,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40,
        }}
      >
        <div
          style={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <IonIcon icon={star} style={{ fontSize: 30, color: '#FFE27A', filter: 'drop-shadow(0 1px 0 #B07C00)' }} />
          <span style={{ fontWeight: 800, fontSize: 14, color: '#fff', textShadow: '0 1px 2px rgba(120,80,0,0.9)' }}>
            {packIndex}/{PACK_SIZE}
          </span>
        </div>
        <span
          style={{
            fontWeight: 900, fontSize: 21, letterSpacing: '0.02em', color: '#FFFFFF',
            textShadow: '0 2px 0 #B07C00, 0 0 3px rgba(120,80,0,0.8)', textAlign: 'center',
          }}
        >
          {puzzle.theme}
        </span>
      </div>

      {/* Word list */}
      <div
        style={{
          background: '#C9D0F2', borderRadius: 16, padding: '10px 10px 12px', marginBottom: 12,
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 22, rowGap: 6,
          boxShadow: '0 3px 0 rgba(40,50,120,0.3)',
        }}
      >
        {puzzle.words.map((pw) => {
          const isFound = found.has(pw.word);
          return (
            <span
              key={pw.word}
              style={{
                fontWeight: 800, fontSize: 18, letterSpacing: '0.01em',
                color: isFound ? '#6E7595' : '#232A45',
                textDecoration: isFound ? 'line-through' : 'none',
                textDecorationThickness: '2px',
              }}
            >
              {pw.word}
            </span>
          );
        })}
      </div>

      {/* Board */}
      <div
        style={{
          background: '#C9D0F2', borderRadius: 24, padding: '14px 12px', boxShadow: '0 4px 0 rgba(40,50,120,0.35)',
          maxWidth: 520, margin: '0 auto',
        }}
      >
        <div
          ref={gridRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: 'relative', width: '100%', aspectRatio: `${cols} / ${rows}`, userSelect: 'none',
            touchAction: 'none', WebkitUserSelect: 'none', cursor: allFound ? 'default' : 'pointer',
          }}
        >
          {/* highlight capsules (under the letters) */}
          <svg
            viewBox={`0 0 ${cols} ${rows}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            {foundSegments.map((s) => capsule(s.a, s.b, s.color, 0.62, `f-${s.word}`))}
            {dragSegment && capsule(dragSegment.a, dragSegment.b, '#3D6BFF', 0.45, 'drag')}
            {hintCell && (
              <circle cx={hintCell[1] + 0.5} cy={hintCell[0] + 0.5} r={0.46} fill="none" stroke="#FF7A00" strokeWidth={0.12} />
            )}
          </svg>

          <div
            style={{
              position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`, pointerEvents: 'none',
            }}
          >
            {puzzle.grid.map((row, r) => row.map((letter, c) => (
              <div
                key={`${r}-${c}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15203F',
                  fontWeight: 900, fontSize: 'clamp(20px, 6.4vw, 32px)', lineHeight: 1,
                }}
              >
                {letter}
              </div>
            )))}
          </div>
        </div>
      </div>

      {/* Level complete */}
      {(allFound || justWon) && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(10,15,45,0.72)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            style={{
              background: '#F1F2F7', borderRadius: 24, padding: '26px 24px', textAlign: 'center', maxWidth: 320, width: '100%',
              boxShadow: '0 6px 0 rgba(40,50,120,0.45)', color: '#232A45',
            }}
          >
            <IonIcon icon={star} style={{ fontSize: 56, color: '#F5B800', filter: 'drop-shadow(0 2px 0 #B07C00)' }} />
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>Level {saved.level} complete!</div>
            <div style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 18px', color: '#3E4A78' }}>
              All {puzzle.words.length} words found · +{LEVEL_BONUS} bonus coins
            </div>
            <button
              type="button"
              onClick={nextLevel}
              style={{
                background: '#4CC96A', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 28px',
                fontSize: 18, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 0 #2E9A49', fontFamily: FONT,
              }}
            >
              Next level
            </button>
          </div>
        </div>
      )}

      <IonActionSheet
        isOpen={menuOpen}
        onDidDismiss={() => setMenuOpen(false)}
        header="Word Search"
        buttons={[
          { text: 'Restart this level', handler: () => startLevel(saved.level) },
          { text: 'Close', role: 'cancel' },
        ]}
      />
      <IonActionSheet
        isOpen={hintOpen}
        onDidDismiss={() => setHintOpen(false)}
        header={`Hint: ${HINT_COST} coins`}
        subHeader="Circles the first letter of a word you haven't found"
        buttons={[
          { text: `Use a hint (${HINT_COST} coins)`, handler: spendHint },
          { text: 'Cancel', role: 'cancel' },
        ]}
      />
      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
    </div>
  );
};

export default WordSearchBoard;