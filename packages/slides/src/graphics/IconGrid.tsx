// Grid of items with icons, labels, and optional descriptions.

import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** Props for the IconGrid component. */
export type IconGridProps = {
  items: Array<{
    icon: ReactNode;
    label: string;
    description?: string;
  }>;
  columns?: 2 | 3 | 4;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays items in a grid layout with icons and labels. */
export function IconGrid({
  items,
  columns = 3,
  progress,
  className,
  style,
}: IconGridProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 'var(--slide-content-gap)',
        opacity,
        ...style,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'center',
            padding: 'var(--brewsite-spacing-md)',
          }}
        >
          <span style={{ color: 'var(--brewsite-accent-color)', fontSize: '1.5em' }}>
            {item.icon}
          </span>
          <span style={{ color: 'var(--brewsite-text-primary)', fontWeight: 600 }}>
            {item.label}
          </span>
          {item.description && (
            <span style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.9em' }}>
              {item.description}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
