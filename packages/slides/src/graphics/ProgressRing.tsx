// Circular progress ring with label.

import React, { type CSSProperties, type ReactElement } from 'react';

/** Props for the ProgressRing component. */
export type ProgressRingProps = {
  value: number;
  label?: string;
  size?: string;
  thickness?: string;
  color?: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays a circular progress indicator with optional center label. */
export function ProgressRing({
  value,
  label,
  size,
  thickness,
  color,
  progress,
  className,
  style,
}: ProgressRingProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;
  const ringSize = size ?? 'var(--slide-progress-ring-size)';
  const strokeWidth = thickness ?? 'var(--slide-progress-ring-thickness)';
  const strokeColor = color ?? 'var(--brewsite-accent-color)';

  const clamped = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        opacity,
        ...style,
      }}
    >
      <div style={{ width: ringSize, height: ringSize, position: 'relative' }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--brewsite-border-subtle)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brewsite-text-primary)',
            fontWeight: 700,
            fontSize: '1.2em',
          }}
        >
          {Math.round(clamped)}%
        </div>
      </div>
      {label && (
        <span style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.9em' }}>
          {label}
        </span>
      )}
    </div>
  );
}
