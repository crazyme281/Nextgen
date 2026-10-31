import React from 'react';
import type { TttState } from '@/lib/games/tictactoe';
import { tttWinner } from '@/lib/games/tictactoe';

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
            aspectRatio: '1', fontSize: 40, fontWeight: 800, borderRadius: 14, border: 'none',
            background: line?.includes(i) ? 'var(--ng-verified-green)' : 'var(--ion-item-background)',
            color: cell === 'X' ? 'var(--ng-blue)' : '#F4B400',
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