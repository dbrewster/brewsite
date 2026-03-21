// Process steps component displaying ordered steps with active state.

import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** Props for the ProcessSteps component. */
export type ProcessStepsProps = {
  steps: Array<{
    title: string;
    description?: string;
    icon?: ReactNode;
  }>;
  activeStep?: number;
  progress?: number;
  className?: string;
  style?: CSSProperties;
};

/** Displays an ordered list of process steps with an active indicator. */
export function ProcessSteps({
  steps,
  activeStep = 0,
  progress,
  className,
  style,
}: ProcessStepsProps): ReactElement {
  const opacity = progress !== undefined ? progress : 1;

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--slide-content-gap)',
        opacity,
        ...style,
      }}
    >
      {steps.map((step, i) => {
        const isActive = i === activeStep;
        const isCompleted = i < activeStep;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive || isCompleted
                  ? 'var(--brewsite-accent-color)'
                  : 'var(--brewsite-surface-elevated)',
                color: isActive || isCompleted
                  ? 'white'
                  : 'var(--brewsite-text-secondary)',
                fontWeight: 600,
                fontSize: '0.85em',
                flexShrink: 0,
                border: `var(--slide-card-border-width) solid ${
                  isActive || isCompleted ? 'transparent' : 'var(--brewsite-border-subtle)'
                }`,
              }}
            >
              {step.icon ?? (isCompleted ? '✓' : i + 1)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  color: isActive ? 'var(--brewsite-accent-color)' : 'var(--brewsite-text-primary)',
                  fontWeight: 600,
                }}
              >
                {step.title}
              </span>
              {step.description && (
                <span style={{ color: 'var(--brewsite-text-secondary)', fontSize: '0.9em' }}>
                  {step.description}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
