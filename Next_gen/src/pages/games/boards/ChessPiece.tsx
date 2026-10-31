import React from 'react';

/**
 * Chess pieces as inline SVG rather than Unicode glyphs (♔♕♖♗♘♙...).
 * Unicode chess symbols depend on the device's font having those specific
 * codepoints (U+2654–U+265F) — plenty of Android WebView font
 * configurations don't, and render them as blank boxes or nothing at all.
 * That's consistent with "pieces are missing" showing up on a real device
 * while looking fine in a desktop browser during development. SVG paths
 * render identically everywhere, so this removes the dependency on font
 * glyph coverage entirely.
 *
 * Simplified flat-icon silhouettes rather than ornate Staunton artwork —
 * clean, unambiguous shapes at small board-square sizes, no external
 * image assets or licensing to worry about.
 */

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

interface ChessPieceProps {
  type: PieceType;
  color: PieceColor;
  size?: number;
}

const PATHS: Record<PieceType, string> = {
  p: 'M12 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9.8 10.2c-.4 1.1-.2 2.3.5 3.2-1.6.9-2.6 2.6-2.6 4.5v1.1h8.6v-1.1c0-1.9-1-3.6-2.6-4.5.7-.9.9-2.1.5-3.2h-4.4z',
  n: 'M17 19H7v-1.3c0-1.7 1-2.9 2.3-3.6-.8-.5-1.3-1.1-1.3-1.9 0-.6.3-1.1.7-1.5-.6-.2-1-.5-1-1 0-1.4 2.6-2.2 3.7-3.9.6-.9 1.6-1.3 2.6-1.1 1.6.3 2.6 1.8 2.4 3.4-.1 1-.6 3-.9 4.3-.2.9.1 1.6.7 2.1.9.8 1.5 1.9 1.5 3.2V19h-.7zM8.3 9.6c.3.2.8.2 1-.1',
  b: 'M12 4.3c-1 .9-1 2.1-.2 3-1.6.7-2.8 2.1-2.8 3.9 0 1.3.7 2.4 1.7 3.1-.9.5-1.7 1.4-1.7 2.6V18h10.4v-1.1c0-1.2-.8-2.1-1.7-2.6 1-.7 1.7-1.8 1.7-3.1 0-1.8-1.2-3.2-2.8-3.9.8-.9.8-2.1-.2-3-.3.3-.7.5-1.2.5s-.9-.2-1.2-.5z',
  r: 'M8 5h2v1.6H8V5zm3 0h2v1.6h-2V5zm3 0h2v1.6h-2V5zM7.5 7h9v3l-1.3 1.3V16h1.3v2h-9v-2h1.3v-4.7L7.5 10V7z',
  q: 'M6.5 8.2l1.6.8 1-3 1.9 2.4 1-3.2 1 3.2 1.9-2.4 1 3 1.6-.8-1 5.8H7.5l-1-5.8zM7.8 15h8.4v1.4H7.8V15zm-.3 2.3h9v1.4h-9v-1.4z',
  k: 'M11.3 3.5h1.4v1.8h1.8v1.4h-1.8v1.8h-1.4V6.7H9.5V5.3h1.8V3.5zM8 9.3c-1.2.8-1.9 2-1.9 3.4 0 1.3.7 2.4 1.7 3.1-.9.5-1.7 1.4-1.7 2.6V19h11.8v-.6c0-1.2-.8-2.1-1.7-2.6 1-.7 1.7-1.8 1.7-3.1 0-1.4-.7-2.6-1.9-3.4-.6-.4-1.3-.6-2-.6H10c-.7 0-1.4.2-2 .6z',
};

export const ChessPiece: React.FC<ChessPieceProps> = ({ type, color, size = 30 }) => {
  const fill = color === 'w' ? '#f5f5f0' : '#2a2a2e';
  const stroke = color === 'w' ? '#3a3a3a' : '#0a0a0a';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[type]} fill={fill} stroke={stroke} strokeWidth={0.7} strokeLinejoin="round" />
    </svg>
  );
};

export default ChessPiece;
