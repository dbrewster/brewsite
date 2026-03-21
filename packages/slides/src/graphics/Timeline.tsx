// Timeline component displaying a sequence of labeled milestones.

import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** Props for the Timeline component. */
export type TimelineProps = {
  items: Array<{
    label: string;
    description?: string;
    date?: string;
    icon?: ReactNode;
    active?: boolean;
  }>;
  orientation?: 'horizontal' | 'vertical';
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays a sequence of milestones connected by a line. */
export function Timeline({
  items,
  orientation = 'vertical',
  progress,
  className,
  style,
}: TimelineProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
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
            flexDirection: isVertical ? 'row' : 'column',
            alignItems: isVertical ? 'flex-start' : 'center',
            gap: '12px',
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: isVertical ? 'column' : 'row',
              alignItems: 'center',
              gap: 0,
            }}
          >
            <div
              style={{
                width: 'var(--slide-timeline-dot-size)',
                height: 'var(--slide-timeline-dot-size)',
                borderRadius: '50%',
                background: item.active
                  ? 'var(--brewsite-accent-color)'
                  : 'var(--brewsite-border-subtle)',
                flexShrink: 0,
              }}
            />
            {i < items.length - 1 && (
              <div
                style={{
                  [isVertical ? 'width' : 'height']: 'var(--slide-timeline-connector-width)',
                  [isVertical ? 'height' : 'width']: '100%',
                  background: 'var(--brewsite-border-subtle)',
                  [isVertical ? 'minHeight' : 'minWidth']: '24px',
                  alignSelf: 'center',
                }}
              />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {item.date && (
              <span style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.8em' }}>
                {item.date}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {item.icon && <span style={{ color: 'var(--brewsite-accent-color)' }}>{item.icon}</span>}
              <span style={{ color: 'var(--brewsite-text-primary)', fontWeight: 600 }}>
                {item.label}
              </span>
            </div>
            {item.description && (
              <span style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.9em' }}>
                {item.description}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
