import React from 'react';
import type { TttState } from '@/lib/games/tictactoe';
import { tttWinner } from '@/lib/games/tictactoe';
import '@/pages/games/games.css';

interface Props {
  board: TttState;
  disabled: boolean;
  onPlay: (index: number) => void;
}

const TicTacToeBoard: React.FC<Props> = ({ board, disabled, onPlay }) => {
  const { line } = tttWinner(board);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      maxWidth: 320, margin: '0 auto',
    }}
    >
      {board.map((cell, i) => (
        <button
          key={i}
          onClick={() => onPlay(i)}
          disabled={disabled || cell !== null}
          style={{
            aspectRatio: '1', fontSize: 46, fontWeight: 900, borderRadius: 14,
            border: line?.includes(i) ? '2px solid var(--gm-win)' : '2px solid var(--gm-border)',
            background: line?.includes(i) ? 'var(--gm-win-bg)' : 'var(--gm-panel)',
            color: cell === 'X' ? 'var(--gm-x)' : 'var(--gm-o)',
            cursor: disabled || cell !== null ? 'default' : 'pointer',
          }}
        >
          {cell}
        </button>
      ))}
    </div>
  );
};

export default TicTacToeBoard;