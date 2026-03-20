import type { JSX } from 'react';

type Props = { onClick: () => void };

export const FullScreenCloseButton = ({ onClick }: Props): JSX.Element => (
  <button
    onClick={onClick}
    className="ex-close-btn"
    aria-label="Close full-screen view"
  >
    ✕
  </button>
);
