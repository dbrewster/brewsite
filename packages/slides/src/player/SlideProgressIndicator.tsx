// packages/slides/src/player/SlideProgressIndicator.tsx
// Visual slide progress indicator: dots, bar, or numbers.

import React, { type CSSProperties, type ReactElement } from 'react';
import type { SlideNavigationState } from './useSlideNavigation';
// ProgressStyle is defined in types.ts (single source of truth).
// Do NOT re-export or re-define it here.
import type { ProgressStyle } from '../types';

/** Props for SlideProgressIndicator. */
type SlideProgressIndicatorProps = {
  /** Navigation state providing current slide index, total, and goTo. */
  nav: SlideNavigationState;
  /** Visual style of the indicator. */
  style: ProgressStyle;
};

/**
 * Renders a slide progress indicator in one of four visual styles:
 * 'dots', 'bar', 'numbers', or 'none'.
 *
 * Positioned absolutely within its nearest positioned ancestor (the engine container).
 * Consumes nav state from useSlideNavigation — does not call the hook directly.
 */
export const SlideProgressIndicator = ({ nav, style }: SlideProgressIndicatorProps): ReactElement | null => {
  if (style === 'none') return null;

  const { current, total, goTo } = nav;

  if (style === 'dots') {
    return (
      <div style={{ position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.5rem', zIndex: 20 }}>
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === current ? '1.25rem' : '0.625rem',
              height: '0.625rem',
              borderRadius: '0.3125rem',
              border: 'none',
              background: i === current
                ? 'var(--brewsite-accent-color, #2563eb)'
                : 'rgba(128,128,128,0.4)',
              cursor: 'pointer',
              padding: 0,
              transition: 'width 0.2s ease, background 0.2s ease',
            } as CSSProperties}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    );
  }

  if (style === 'numbers') {
    return (
      <div style={{ position: 'absolute', bottom: '2%', right: '3%', zIndex: 20, fontFamily: 'var(--brewsite-font-family)', fontSize: '0.875rem', color: 'var(--slide-color-muted, rgba(128,128,128,0.7))' }}>
        {current + 1} / {total}
      </div>
    );
  }

  if (style === 'bar') {
    const pct = total > 1 ? ((current + 1) / total) * 100 : 100;
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', zIndex: 20, background: 'rgba(128,128,128,0.2)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brewsite-accent-color, #2563eb)', transition: 'width 0.2s ease' }} />
      </div>
    );
  }

  return null;
};
