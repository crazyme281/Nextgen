import React from 'react';
import type { ConnectFourState } from '@/lib/games/connectFour';
import '@/pages/games/games.css';

interface Props {
  board: ConnectFourState;
  disabled: boolean;
  validCols: number[];
  onDrop: (col: number) => void;
}

const ConnectFourBoard: React.FC<Props> = ({ board, disabled, validCols, onDrop }) => (
  <div style={{ maxWidth: 360, margin: '0 auto' }}>
    <div style={{
      background: '#1B4FA0', borderRadius: 14, padding: 8, border: '2px solid #0E2E66',
      display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
    }}
    >
      {board.map((row, r) => row.map((cell, c) => (
        <button
          key={`${r}-${c}`}
          onClick={() => onDrop(c)}
          disabled={disabled || !validCols.includes(c)}
          style={{
            aspectRatio: '1', borderRadius: '50%',
            border: cell === 'R' ? '2px solid #7A0F08' : cell === 'Y' ? '2px solid #8A6400' : '2px solid #0A1F4D',
            background: cell === 'R' ? '#FF4A3D' : cell === 'Y' ? '#FFD21F' : '#0B1F4D',
            cursor: disabled || !validCols.includes(c) ? 'default' : 'pointer',
          }}
        />
      )))}
    </div>
  </div>
);

export default ConnectFourBoard;