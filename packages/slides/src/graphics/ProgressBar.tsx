// Horizontal progress bar with label.

import React, { type CSSProperties, type ReactElement } from 'react';

/** Props for the ProgressBar component. */
export type ProgressBarProps = {
  value: number;
  label?: string;
  color?: string;
  height?: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays a horizontal progress bar with optional label. */
export function ProgressBar({
  value,
  label,
  color,
  height = '8px',
  progress,
  className,
  style,
}: ProgressBarProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;
  const barColor = color ?? 'var(--brewsite-accent-color)';
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        opacity,
        ...style,
      }}
    >
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.9em' }}>
            {label}
          </span>
          <span style={{ color: 'var(--brewsite-text-primary)', fontWeight: 600, fontSize: '0.9em' }}>
            {Math.round(clamped)}%
          </span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height,
          background: 'var(--brewsite-border-subtle)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: barColor,
            borderRadius: '999px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
