// Callout box component with variant styling and optional icon.

import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** Props for the CalloutBox component. */
export type CalloutBoxProps = {
  variant?: 'info' | 'warning' | 'success' | 'error' | 'neutral';
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

const variantColors: Record<string, string> = {
  info: 'var(--brewsite-accent-color)',
  warning: 'var(--brewsite-color-warning, #f59e0b)',
  success: 'var(--brewsite-color-success)',
  error: 'var(--brewsite-color-error)',
  neutral: 'var(--brewsite-border-subtle)',
};

/** Displays a styled callout box with variant-colored border. */
export function CalloutBox({
  variant = 'neutral',
  icon,
  title,
  children,
  progress,
  className,
  style,
}: CalloutBoxProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;
  const borderColor = variantColors[variant] ?? variantColors.neutral;

  return (
    <div
      className={className}
      style={{
        background: 'var(--brewsite-surface-elevated)',
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: '4px',
        padding: 'var(--brewsite-spacing-md)',
        boxShadow: 'var(--brewsite-shadow-sm)',
        opacity,
        ...style,
      }}
    >
      {(title || icon) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {icon && <span style={{ color: borderColor }}>{icon}</span>}
          {title && (
            <span style={{ color: 'var(--brewsite-text-primary)', fontWeight: 600 }}>
              {title}
            </span>
          )}
        </div>
      )}
      <div style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.95em' }}>
        {children}
      </div>
    </div>
  );
}
