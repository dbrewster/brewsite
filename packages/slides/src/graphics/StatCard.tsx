// Stat card component displaying a value, label, and optional trend indicator.

import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** Props for the StatCard component. */
export type StatCardProps = {
  value: string | number;
  label: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays a metric value with label and optional trend. */
export function StatCard({
  value,
  label,
  trend,
  trendDirection = 'neutral',
  icon,
  progress,
  className,
  style,
}: StatCardProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;

  const trendColor =
    trendDirection === 'up'
      ? 'var(--brewsite-color-success)'
      : trendDirection === 'down'
        ? 'var(--brewsite-color-error)'
        : 'var(--brewsite-text-secondary)';

  return (
    <div
      className={className}
      style={{
        background: 'var(--brewsite-surface-elevated)',
        border: `var(--slide-card-border-width) solid var(--brewsite-border-subtle)`,
        borderRadius: '8px',
        padding: 'var(--brewsite-spacing-md)',
        boxShadow: 'var(--brewsite-shadow-sm)',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '2em',
            fontWeight: 700,
            color: 'var(--brewsite-text-primary)',
          }}
        >
          {value}
        </span>
        {icon && <span style={{ color: 'var(--brewsite-accent-color)' }}>{icon}</span>}
      </div>
      <span style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.9em' }}>
        {label}
      </span>
      {trend && (
        <span style={{ color: trendColor, fontSize: '0.85em' }}>
          {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '–'} {trend}
        </span>
      )}
    </div>
  );
}
