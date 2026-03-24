// Tip / warning / note callout box.

import { type ReactElement, type ReactNode } from 'react';

export type CalloutType = 'note' | 'warning' | 'tip';

export interface CalloutProps {
  type: CalloutType;
  children: ReactNode;
}

const LABEL: Record<CalloutType, string> = {
  note: 'Note',
  warning: 'Warning',
  tip: 'Tip',
};

/**
 * Callout box for note / warning / tip content.
 *
 * CSS class surface:
 * - `.callout` — root
 * - `.callout--note` / `.callout--warning` / `.callout--tip` — type modifier
 * - `.callout__label` — type label (e.g. "Note")
 * - `.callout__body` — content wrapper
 */
export function Callout({ type, children }: CalloutProps): ReactElement {
  return (
    <aside
      className={`callout callout--${type}`}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
        background: 'var(--bg-elevated, #1e1e28)',
        margin: '16px 0',
      }}
    >
      <span
        className="callout__label"
        style={{ fontWeight: 600, fontSize: 13, flexShrink: 0, color: 'var(--text-secondary, #8888aa)' }}
      >
        {LABEL[type]}
      </span>
      <div className="callout__body">{children}</div>
    </aside>
  );
}
