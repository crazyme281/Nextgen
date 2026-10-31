import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { refreshOutline, checkmarkCircle, trashOutline } from 'ionicons/icons';
import {
  generateSudoku, isValidPlacement, isSudokuComplete,
  type SudokuGrid, type Difficulty,
} from '@/lib/games/sudoku';

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
              padding: '6px 14px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 700,
              textTransform: 'capitalize', cursor: 'pointer',
              background: d === difficulty ? 'var(--ng-blue)' : 'var(--ion-item-background)',
              color: d === difficulty ? '#fff' : 'var(--ion-text-color)',
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', width: '100%', maxWidth: 360,
          border: '2px solid var(--ion-text-color)', borderRadius: 8, overflow: 'hidden',
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
                fontSize: 16, fontWeight: isGiven ? 700 : 500, cursor: won ? 'default' : 'pointer',
                background: isSelected
                  ? 'rgba(61,107,255,0.35)'
                  : sameRowCol
                    ? 'rgba(61,107,255,0.1)'
                    : 'var(--ion-background-color)',
                color: isConflict ? '#ff5566' : isGiven ? 'var(--ion-text-color)' : 'var(--ng-blue-2, var(--ng-blue))',
                borderRight: (c + 1) % 3 === 0 && c !== 8 ? '2px solid var(--ion-text-color)' : '1px solid var(--ion-border-color)',
                borderBottom: (r + 1) % 3 === 0 && r !== 8 ? '2px solid var(--ion-text-color)' : '1px solid var(--ion-border-color)',
              }}
            >
              {val ?? ''}
            </div>
          );
        }))}
      </div>

      {won ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: 'var(--ng-verified-green)' }}>
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
                  padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 17, fontWeight: 700,
                  background: 'var(--ion-item-background)', color: 'var(--ion-text-color)',
                  cursor: selected ? 'pointer' : 'default', opacity: selected ? 1 : 0.5,
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
                padding: '10px 0', borderRadius: 10, border: 'none',
                background: 'var(--ion-item-background)', color: 'var(--ion-text-color)',
                cursor: selected ? 'pointer' : 'default', opacity: selected ? 1 : 0.5,
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
              color: 'var(--ion-color-medium)', fontSize: 13, cursor: 'pointer', padding: 8,
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
