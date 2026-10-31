import React from 'react';
import type { Profile } from '@/context/AuthContext';
import { tr } from '@/i18n';

const RING_COLOR: Record<Profile['trust_level'], string> = {
  verified_identity: '#16A765',
  verified_business: '#2563EB',
  high_assurance: '#F4B400',
  unverified: '#8a8a8a',
  risk_detected: '#D92020',
};

const RING_LABEL: Record<Profile['trust_level'], string> = {
  verified_identity: 'Verified Identity',
  verified_business: 'Verified Business',
  high_assurance: 'High Assurance',
  unverified: 'Unverified',
  risk_detected: 'Risk Detected',
};

interface Props {
  trustLevel: Profile['trust_level'];
  avatarUrl?: string | null;
  initials: string;
  size?: number;
  /** Show a green presence dot in the corner — pass live status from useIsOnline/useOnlinePresence. */
  online?: boolean;
}

/** The "J Trust Ring" — a colored ring around the avatar indicating identity trust level. */
const TrustBadge: React.FC<Props> = ({ trustLevel, avatarUrl, initials, size = 46, online }) => (
  <div style={{ position: 'relative', width: size, height: size }}>
    <div
      title={RING_LABEL[trustLevel]}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        padding: 2,
        background: RING_COLOR[trustLevel],
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'linear-gradient(135deg,#ffb020,#744400)',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: size * 0.34,
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </div>
    </div>
    {online !== undefined && (
      <span
        title={online ? tr('Online') : undefined}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: '50%',
          background: online ? '#2ecc71' : 'transparent',
          border: online ? '2px solid var(--ion-background-color, #121212)' : 'none',
          boxSizing: 'content-box',
        }}
      />
    )}
  </div>
);

export default TrustBadge;