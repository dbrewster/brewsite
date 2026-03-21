// Styled quote block with attribution.

import React, { type CSSProperties, type ReactElement } from 'react';

/** Props for the QuoteBlock component. */
export type QuoteBlockProps = {
  quote: string;
  attribution: string;
  role?: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays a styled blockquote with attribution line. */
export function QuoteBlock({
  quote,
  attribution,
  role,
  progress,
  className,
  style,
}: QuoteBlockProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;

  return (
    <blockquote
      className={className}
      style={{
        borderLeft: `3px solid var(--brewsite-accent-color)`,
        padding: 'var(--brewsite-spacing-md)',
        margin: 0,
        opacity,
        ...style,
      }}
    >
      <p
        style={{
          color: 'var(--brewsite-text-primary)',
          fontSize: '1.1em',
          fontStyle: 'italic',
          margin: '0 0 12px 0',
          lineHeight: 1.6,
        }}
      >
        &ldquo;{quote}&rdquo;
      </p>
      <footer style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.9em' }}>
        — {attribution}
        {role && <span style={{ opacity: 0.8 }}>, {role}</span>}
      </footer>
    </blockquote>
  );
}
