// Horizontal divider with variant styling.

import React, { type CSSProperties, type ReactElement } from 'react';

/** Props for the Divider component. */
export type DividerProps = {
  variant?: 'solid' | 'dashed' | 'gradient';
  className?: string;
  style?: CSSProperties;
};

/** Displays a horizontal divider line. */
export function Divider({
  variant = 'solid',
  className,
  style,
}: DividerProps): ReactElement {
  const baseStyle: CSSProperties =
    variant === 'gradient'
      ? {
          height: '1px',
          border: 'none',
          background: `linear-gradient(to right, transparent, var(--brewsite-border-subtle), transparent)`,
        }
      : {
          height: 0,
          border: 'none',
          borderTop: `1px ${variant} var(--brewsite-border-subtle)`,
        };

  return (
    <hr
      className={className}
      style={{
        width: '100%',
        margin: '0',
        ...baseStyle,
        ...style,
      }}
    />
  );
}
