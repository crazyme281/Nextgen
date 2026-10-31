import React from 'react';
import type { ConnectFourState } from '@/lib/games/connectFour';

interface Props {
  board: ConnectFourState;
  disabled: boolean;
  validCols: number[];
  onDrop: (col: number) => void;
}

const ConnectFourBoard: React.FC<Props> = ({ board, disabled, validCols, onDrop }) => (
  <div style={{ maxWidth: 360, margin: '0 auto' }}>
    <div style={{
      background: '#1B4FA0', borderRadius: 14, padding: 8,
      display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
    }}
    >
      {board.map((row, r) => row.map((cell, c) => (
        <button
          key={`${r}-${c}`}
          onClick={() => onDrop(c)}
          disabled={disabled || !validCols.includes(c)}
          style={{
            aspectRatio: '1', borderRadius: '50%', border: 'none',
            background: cell === 'R' ? '#E4483A' : cell === 'Y' ? '#F4B400' : 'rgba(255,255,255,0.9)',
            cursor: disabled || !validCols.includes(c) ? 'default' : 'pointer',
          }}
        />
      )))}
    </div>
  </div>
);

export default ConnectFourBoard;