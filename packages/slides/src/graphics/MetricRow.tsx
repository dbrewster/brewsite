// Horizontal row of metric items.

import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** Props for the MetricRow component. */
export type MetricRowProps = {
  items: Array<{
    value: string | number;
    label: string;
    icon?: ReactNode;
  }>;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays a horizontal row of metrics with values and labels. */
export function MetricRow({
  items,
  progress,
  className,
  style,
}: MetricRowProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-around',
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
            gap: '4px',
            textAlign: 'center',
          }}
        >
          {item.icon && (
            <span style={{ color: 'var(--brewsite-accent-color)', fontSize: '1.2em' }}>
              {item.icon}
            </span>
          )}
          <span
            style={{
              color: 'var(--brewsite-text-primary)',
              fontWeight: 700,
              fontSize: '1.5em',
            }}
          >
            {item.value}
          </span>
          <span style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.85em' }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
