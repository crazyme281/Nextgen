import React, { useState } from 'react';
import type { Square } from 'chess.js';
import { chessLegalMovesFrom, type ChessFen } from '@/lib/games/chessEngine';
import { ChessPiece } from './ChessPiece';

interface Props {
  fen: ChessFen;
  board: ({ type: string; color: 'w' | 'b' } | null)[][];
  turn: 'w' | 'b';
  disabled: boolean;
  onMove: (from: Square, to: Square) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function toSquare(r: number, c: number): Square {
  return `${FILES[c]}${8 - r}` as Square;
}

const ChessBoard: React.FC<Props> = ({ fen, board, turn, disabled, onMove }) => {
  const [selected, setSelected] = useState<Square | null>(null);
  const destinations = selected ? chessLegalMovesFrom(fen, selected) : [];

  const handleClick = (r: number, c: number) => {
    if (disabled) return;
    const sq = toSquare(r, c);
    const piece = board[r][c];

    if (selected && destinations.includes(sq)) {
      onMove(selected, sq);
      setSelected(null);
      return;
    }
    if (piece && piece.color === turn) {
      setSelected(sq);
    } else {
      setSelected(null);
    }
  };

  return (
    <div style={{
      maxWidth: 360, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
      border: '3px solid #2a2a2a', borderRadius: 8, overflow: 'hidden',
    }}
    >
      {board.map((row, r) => row.map((piece, c) => {
        const dark = (r + c) % 2 === 1;
        const sq = toSquare(r, c);
        const isSelected = selected === sq;
        const isDest = destinations.includes(sq);
        return (
          <div
            key={sq}
            onClick={() => handleClick(r, c)}
            style={{
              aspectRatio: '1', background: dark ? '#7a8a9a' : '#eef1f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', fontSize: 30, cursor: disabled ? 'default' : 'pointer',
              outline: isSelected ? '3px solid var(--ng-blue)' : 'none',
            }}
          >
            {isDest && (
              <div style={{ position: 'absolute', width: '28%', height: '28%', borderRadius: '50%', background: 'rgba(58,150,255,0.55)' }} />
            )}
            {piece && <ChessPiece type={piece.type as 'p' | 'n' | 'b' | 'r' | 'q' | 'k'} color={piece.color} size={34} />}
          </div>
        );
      }))}
    </div>
  );
};

export default ChessBoard;