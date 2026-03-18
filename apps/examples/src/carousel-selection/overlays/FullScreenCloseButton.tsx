import type { JSX } from 'react';

type Props = { onClick: () => void };

export const FullScreenCloseButton = ({ onClick }: Props): JSX.Element => (
  <button
    onClick={onClick}
    style={{
      position: 'absolute', top: 16, right: 16, zIndex: 110,
      width: 40, height: 40, borderRadius: '50%',
      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)',
      color: '#fff', fontSize: 18, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', transition: 'background 0.2s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,60,60,0.7)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}
    aria-label="Close full-screen view"
  >
    ✕
  </button>
);
