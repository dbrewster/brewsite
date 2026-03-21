// Small badge component with variant styling.

import React, { type CSSProperties, type ReactElement } from 'react';

/** Props for the Badge component. */
export type BadgeProps = {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
  style?: CSSProperties;
};

const badgeColors: Record<string, { bg: string; fg: string }> = {
  default: { bg: 'var(--brewsite-surface-elevated)', fg: 'var(--brewsite-text-secondary)' },
  success: { bg: 'var(--brewsite-color-success)', fg: 'white' },
  warning: { bg: 'var(--brewsite-color-warning, #f59e0b)', fg: 'white' },
  error: { bg: 'var(--brewsite-color-error)', fg: 'white' },
  info: { bg: 'var(--brewsite-accent-color)', fg: 'white' },
};

/** Displays a small pill-shaped badge. */
export function Badge({
  label,
  variant = 'default',
  className,
  style,
}: BadgeProps): ReactElement {
  const colors = badgeColors[variant] ?? badgeColors.default;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '0.8em',
        fontWeight: 600,
        background: colors.bg,
        color: colors.fg,
        border: variant === 'default'
          ? `var(--slide-card-border-width) solid var(--brewsite-border-subtle)`
          : 'none',
        ...style,
      }}
    >
      {label}
    </span>
  );
}
