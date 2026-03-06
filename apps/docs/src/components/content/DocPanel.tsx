import { JSX, ReactNode, CSSProperties } from 'react';
import { useEngineState } from '@brewsite/core';

interface DocPanelProps {
  /**
   * What fraction [0..1] of the scene's scroll budget is spent sliding up.
   * Default 0.25 — panel fully visible by the time the user has scrolled
   * 25% of the scene's scroll window.
   */
  slideInBy?: number;
  children: ReactNode;
}

/**
 * DocPanel — the core overlay panel used in every content scene.
 *
 * Reads sceneProgress (local [0..1]) from the engine and translates
 * the panel vertically: starts 80vh below the viewport, slides up to 0
 * as the user scrolls through the first `slideInBy` fraction.
 *
 * After that point the panel is fully visible and the remaining scroll
 * budget can be used for demo playback via DemoProgressProvider.
 */
export function DocPanel({ slideInBy = 0.25, children }: DocPanelProps): JSX.Element {
  const { sceneProgress: p } = useEngineState();

  // Phase: 0 → slideInBy maps translateY 80vh → 0
  const slideT = Math.min(1, p / slideInBy);
  const translateY = (1 - slideT) * 80;

  const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 276,   // sidebar clearance: 260px sidebar + 16px gap
    right: 0,
    overflowY: 'hidden',
    transform: `translateY(${translateY}vh)`,
    padding: '32px 48px 48px',
    background: 'rgba(10, 12, 22, 0.90)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    // Disable pointer events until panel is mostly visible (avoids accidental
    // clicks while the panel is still sliding in from below the viewport)
    pointerEvents: translateY > 50 ? 'none' : 'auto',
    // Ensure text is readable
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
  };

  return <div style={style}>{children}</div>;
}
