import React from 'react';
import { tr } from '@/i18n';

/**
 * Nextgen brand mark: gradient ribbon "N" with two chat-bubble accents.
 * Same artwork as the login screen (src/pages/auth/Login.tsx), extracted
 * here so every other page can reuse the identical, theme-safe vector
 * instead of a raster copy. Rendered inline so it always tracks the
 * current gradient with no extra asset request.
 */
const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 28, className }) => (
  <svg
    viewBox="0 0 220 220"
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label={tr('Nextgen')}
    role="img"
  >
    <defs>
      <linearGradient id="ngHdrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#17C9FF" />
        <stop offset="38%" stopColor="#3D6BFF" />
        <stop offset="66%" stopColor="#8A3DFF" />
        <stop offset="100%" stopColor="#E339D6" />
      </linearGradient>
      <linearGradient id="ngHdrGradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22D2FF" />
        <stop offset="100%" stopColor="#2A5CFF" />
      </linearGradient>
      <linearGradient id="ngHdrGradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9A3DFF" />
        <stop offset="100%" stopColor="#FF3ED2" />
      </linearGradient>
    </defs>

    <path
      d="M50 40 C50 34 54 30 60 30 L74 30 C80 30 84 34 84 40 L84 170 C84 176 80 180 74 180 L60 180 C54 180 50 176 50 170 Z"
      fill="url(#ngHdrGradBlue)"
    />
    <path
      d="M50 155 L84 140 L84 170 C84 176 80 180 74 180 L60 180 C54 180 50 176 50 170 Z"
      fill="#1442B8"
      opacity="0.35"
    />
    <path
      d="M50 40 C50 34 54 30 60 30 C66 30 71 33 74 38 L168 172 C171 177 169 184 163 187 C157 190 150 188 147 183 L54 50 C51 47 50 43 50 40 Z"
      fill="url(#ngHdrGrad)"
    />
    <path
      d="M136 60 C136 54 140 50 146 50 L160 50 C166 50 170 54 170 60 L170 150 C170 156 166 160 160 160 L146 160 C140 160 136 156 136 150 Z"
      fill="url(#ngHdrGradPurple)"
    />
    <path
      d="M136 135 L170 120 L170 150 C170 156 166 160 160 160 L146 160 C140 160 136 156 136 150 Z"
      fill="#7A0FBE"
      opacity="0.3"
    />

    <path
      d="M28 145 h44 a10 10 0 0 1 10 10 v22 a10 10 0 0 1 -10 10 h-22 l-12 12 v-12 h-10 a10 10 0 0 1 -10 -10 v-22 a10 10 0 0 1 10 -10 Z"
      fill="url(#ngHdrGradBlue)"
    />
    <circle cx="40" cy="171" r="3" fill="#ffffff" />
    <circle cx="50" cy="171" r="3" fill="#ffffff" />
    <circle cx="60" cy="171" r="3" fill="#ffffff" />

    <path
      d="M148 26 h38 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-8 v10 l-12 -10 h-18 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10 Z"
      fill="url(#ngHdrGradPurple)"
    />
    <circle cx="160" cy="45" r="3" fill="#ffffff" />
    <circle cx="170" cy="45" r="3" fill="#ffffff" />
    <circle cx="180" cy="45" r="3" fill="#ffffff" />

    <g strokeLinecap="round">
      <line x1="196" y1="60" x2="216" y2="60" stroke="#FF3ED2" strokeWidth="4" opacity="0.9" />
      <line x1="196" y1="72" x2="212" y2="72" stroke="#FF3ED2" strokeWidth="4" opacity="0.65" />
      <line x1="196" y1="84" x2="206" y2="84" stroke="#FF3ED2" strokeWidth="4" opacity="0.4" />
      <circle cx="196" cy="96" r="2.5" fill="#FF3ED2" opacity="0.5" />
      <circle cx="203" cy="103" r="2" fill="#FF3ED2" opacity="0.3" />
    </g>
  </svg>
);

export default BrandMark;
