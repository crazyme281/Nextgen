import React, { useState } from 'react';
import type { CheckersState, CheckersMove } from '@/lib/games/checkers';

interface Props {
  board: CheckersState;
  side: 'r' | 'b';
  legalMoves: CheckersMove[];
  disabled: boolean;
  onMove: (move: CheckersMove) => void;
}

const CheckersBoard: React.FC<Props> = ({ board, legalMoves, disabled, onMove }) => {
  const [selected, setSelected] = useState<[number, number] | null>(null);

  const movesFromSelected = selected
    ? legalMoves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : [];
  const destSet = new Set(movesFromSelected.map((m) => `${m.to[0]},${m.to[1]}`));
  const squaresWithMoves = new Set(legalMoves.map((m) => `${m.from[0]},${m.from[1]}`));

  const handleClick = (r: number, c: number) => {
    if (disabled) return;
    const key = `${r},${c}`;
    if (selected && destSet.has(key)) {
      const move = movesFromSelected.find((m) => m.to[0] === r && m.to[1] === c)!;
      onMove(move);
      setSelected(null);
      return;
    }
    if (squaresWithMoves.has(key)) {
      setSelected([r, c]);
    } else {
      setSelected(null);
    }
  };

  return (
    <div style={{
      maxWidth: 360, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
      border: '3px solid #3a2a1a', borderRadius: 8, overflow: 'hidden',
    }}
    >
      {board.map((row, r) => row.map((piece, c) => {
        const dark = (r + c) % 2 === 1;
        const isSelected = selected?.[0] === r && selected?.[1] === c;
        const isDest = destSet.has(`${r},${c}`);
        const canSelect = squaresWithMoves.has(`${r},${c}`);
        return (
          <div
            key={`${r}-${c}`}
            onClick={() => handleClick(r, c)}
            style={{
              aspectRatio: '1', background: dark ? '#7a4b2e' : '#e8d4b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', cursor: canSelect || isDest ? 'pointer' : 'default',
              outline: isSelected ? '3px solid var(--ng-blue)' : 'none',
            }}
          >
            {isDest && (
              <div style={{ position: 'absolute', width: '30%', height: '30%', borderRadius: '50%', background: 'rgba(58,150,255,0.6)' }} />
            )}
            {piece && (
              <div
                style={{
                  width: '76%', height: '76%', borderRadius: '50%',
                  background: piece.toLowerCase() === 'r' ? '#E4483A' : '#222',
                  border: canSelect ? '3px solid var(--ng-blue)' : '3px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#F4B400', fontWeight: 800, fontSize: 14,
                }}
              >
                {(piece === 'R' || piece === 'B') && 'K'}
              </div>
            )}
          </div>
        );
      }))}
    </div>
  );
};

export default CheckersBoard;