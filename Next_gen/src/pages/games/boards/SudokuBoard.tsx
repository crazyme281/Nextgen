import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { refreshOutline, checkmarkCircle, trashOutline } from 'ionicons/icons';
import {
  generateSudoku, isValidPlacement, isSudokuComplete,
  type SudokuGrid, type Difficulty,
} from '@/lib/games/sudoku';
import '@/pages/games/games.css';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const SudokuBoard: React.FC = () => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [{ puzzle }, setPuzzleState] = useState(() => generateSudoku('medium'));
  const [grid, setGrid] = useState<SudokuGrid>(() => puzzle.map((r) => [...r]));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [won, setWon] = useState(false);

  const givens = useMemo(
    () => puzzle.map((row) => row.map((v) => v !== null)),
    [puzzle],
  );

  const conflicts = useMemo(() => {
    const bad = Array.from({ length: 9 }, () => Array(9).fill(false));
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const val = grid[r][c];
        if (val !== null && !isValidPlacement(grid, r, c, val)) bad[r][c] = true;
      }
    }
    return bad;
  }, [grid]);

  function newGame(nextDifficulty: Difficulty = difficulty) {
    const next = generateSudoku(nextDifficulty);
    setPuzzleState(next);
    setGrid(next.puzzle.map((r) => [...r]));
    setSelected(null);
    setWon(false);
  }

  function placeDigit(val: number | null) {
    if (!selected || won) return;
    const [r, c] = selected;
    if (givens[r][c]) return; // can't overwrite a starting clue
    const next = grid.map((row) => [...row]);
    next[r][c] = val;
    setGrid(next);
    if (val !== null && isSudokuComplete(next)) setWon(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <button
            key={d}
            onClick={() => { setDifficulty(d); newGame(d); }}
            style={{
              padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              textTransform: 'capitalize', cursor: 'pointer',
              border: d === difficulty ? '2px solid var(--gm-accent)' : '2px solid var(--gm-border)',
              background: d === difficulty ? 'var(--gm-accent)' : 'var(--gm-panel)',
              color: d === difficulty ? '#fff' : 'var(--gm-text)',
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', width: '100%', maxWidth: 360,
          border: '2px solid var(--gm-grid-strong)', borderRadius: 8, overflow: 'hidden', background: 'var(--gm-panel)',
        }}
      >
        {grid.map((row, r) => row.map((val, c) => {
          const isGiven = givens[r][c];
          const isSelected = selected?.[0] === r && selected?.[1] === c;
          const sameRowCol = selected && (selected[0] === r || selected[1] === c);
          const isConflict = conflicts[r][c];
          return (
            <div
              key={`${r}-${c}`}
              onClick={() => !won && setSelected([r, c])}
              style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: isGiven ? 800 : 700, cursor: won ? 'default' : 'pointer',
                background: isSelected
                  ? 'var(--gm-accent-bg)'
                  : sameRowCol
                    ? 'var(--gm-accent-bg-soft)'
                    : 'var(--gm-panel)',
                color: isConflict ? 'var(--gm-conflict)' : isGiven ? 'var(--gm-text)' : 'var(--gm-accent)',
                borderRight: (c + 1) % 3 === 0 && c !== 8 ? '2px solid var(--gm-grid-strong)' : '1px solid var(--gm-grid-line)',
                borderBottom: (r + 1) % 3 === 0 && r !== 8 ? '2px solid var(--gm-grid-strong)' : '1px solid var(--gm-grid-line)',
              }}
            >
              {val ?? ''}
            </div>
          );
        }))}
      </div>

      {won ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--gm-win)' }}>
            <IonIcon icon={checkmarkCircle} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Solved it!
          </div>
          <button
            onClick={() => newGame()}
            style={{
              background: 'var(--ng-blue)', color: '#fff', border: 'none', borderRadius: 12,
              padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            New Puzzle
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, width: '100%', maxWidth: 360 }}>
            {DIGITS.map((d) => (
              <button
                key={d}
                onClick={() => placeDigit(d)}
                disabled={!selected}
                style={{
                  padding: '11px 0', borderRadius: 10, border: '2px solid var(--gm-border)', fontSize: 18, fontWeight: 800,
                  background: 'var(--gm-panel)', color: 'var(--gm-text)',
                  cursor: selected ? 'pointer' : 'default', opacity: selected ? 1 : 0.6,
                }}
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => placeDigit(null)}
              disabled={!selected}
              aria-label="Clear cell"
              style={{
                padding: '11px 0', borderRadius: 10, border: '2px solid var(--gm-border)',
                background: 'var(--gm-panel)', color: 'var(--gm-text)',
                cursor: selected ? 'pointer' : 'default', opacity: selected ? 1 : 0.6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IonIcon icon={trashOutline} />
            </button>
          </div>
          <button
            onClick={() => newGame()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              color: 'var(--gm-muted)', fontSize: 14, cursor: 'pointer', padding: 8,
            }}
          >
            <IonIcon icon={refreshOutline} /> New puzzle
          </button>
        </>
      )}
    </div>
  );
};

export default SudokuBoard;