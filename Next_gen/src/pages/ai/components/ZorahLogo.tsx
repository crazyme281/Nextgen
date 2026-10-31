/**
 * The Zorah mark, rebuilt as inline SVG so it stays crisp at any size and
 * can inherit the brand gradient from a single place. `variant` controls
 * whether the wordmark rides along under the glyph.
 *
 * Recolored from the original gold gradient to Next Gen's own brand
 * gradient (see --ng-gradient-brand-diag in src/theme/variables.css) so
 * this reads as part of the app rather than a bolted-on third-party tool.
 *
 * The gradient is defined per-instance with a unique id — multiple logos
 * on one page (rail + hero) would otherwise collide on `url(#zorah-brand)`.
 */
import { useId } from 'react';
import { tr } from '@/i18n';

interface ZorahLogoProps {
  size?: number;
  variant?: 'mark' | 'full';
  className?: string;
  /** Renders the mark in a flat colour instead of the gradient — used in the rail. */
  flat?: string;
}

export function ZorahLogo({ size = 96, variant = 'mark', className, flat }: ZorahLogoProps) {
  const uid = useId().replace(/:/g, '');
  const brand = `zorah-brand-${uid}`;
  const brandSoft = `zorah-brand-soft-${uid}`;
  const fill = flat ?? `url(#${brand})`;

  return (
    <div className={`zorah-logo zorah-logo--${variant} ${className ?? ''}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        role="img"
        aria-label={tr('Zorah AI')}
        className="zorah-logo__glyph"
      >
        <defs>
          {/* Same stops as --ng-gradient-brand-diag: blue -> violet -> magenta */}
          <linearGradient id={brand} x1="12%" y1="0%" x2="88%" y2="100%">
            <stop offset="0%" stopColor="#17C9FF" />
            <stop offset="38%" stopColor="#3D6BFF" />
            <stop offset="66%" stopColor="#8A3DFF" />
            <stop offset="100%" stopColor="#E339D6" />
          </linearGradient>
          <linearGradient id={brandSoft} x1="0%" y1="10%" x2="100%" y2="90%">
            <stop offset="0%" stopColor="#6FE0FF" />
            <stop offset="45%" stopColor="#5A7DFF" />
            <stop offset="100%" stopColor="#B25CE8" />
          </linearGradient>
        </defs>

        {/* Orbit swoosh, drawn behind the Z. The dash gap opens on the
            lower-right so the ring reads as passing behind the letter. */}
        <g transform="rotate(-21 100 106)">
          <ellipse
            cx="100"
            cy="106"
            rx="92"
            ry="41"
            fill="none"
            stroke={flat ?? `url(#${brandSoft})`}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray="300 148"
            strokeDashoffset="74"
          />
        </g>

        {/* The Z itself, slightly raked forward for motion. */}
        <g transform="skewX(-7) translate(11 0)">
          <polygon
            points="40,24 166,24 166,56 96,140 166,140 166,174 32,174 32,142 102,58 40,58"
            fill={fill}
          />
        </g>

        {/* Four-point sparkle at the shoulder of the Z. */}
        <path
          d="M171 18 C173.5 34 178 38.5 194 41 C178 43.5 173.5 48 171 64 C168.5 48 164 43.5 148 41 C164 38.5 168.5 34 171 18 Z"
          fill={fill}
        />
      </svg>

      {variant === 'full' && (
        <div className="zorah-logo__word">
          <span className="zorah-logo__name">{tr('Zorah')}</span>
          <span className="zorah-logo__rule">
            <i />
            {tr('AI')}
            <i />
          </span>
        </div>
      )}
    </div>
  );
}
