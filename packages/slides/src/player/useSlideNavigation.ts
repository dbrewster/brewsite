// packages/slides/src/player/useSlideNavigation.ts
// Hook for reading and controlling slide navigation state.

import { useCallback } from 'react';
import { useCurrentScene, useSceneEngineContext } from '@brewsite/core';

/**
 * Reactive navigation state returned by useSlideNavigation.
 */
export type SlideNavigationState = {
  /** 0-based current logical slide index. */
  current: number;
  /** Total logical slide count. */
  total: number;
  /** Navigate to the slide at the given 0-based index. */
  goTo: (index: number) => void;
  /** Navigate to the next slide. No-op on last slide. */
  next: () => void;
  /** Navigate to the previous slide. No-op on first slide. */
  prev: () => void;
};

/**
 * Computes the normalized global progress [0, 1] for the start of the slide at `index`.
 *
 * Uses cumulative ProgressManager scrollUnits rather than i/(n-1) so that non-uniform
 * scroll budgets (e.g. a title slide with scrollUnits=100 vs body slides with 400) produce
 * correct progress values. The mapping is exact because ProgressManager allocates ticks
 * proportionally to scrollUnits, making global progress piecewise-linear in scrollUnits.
 *
 * @param scrollUnits - Array of scrollUnits per slide (one entry per slide, same order).
 * @param index - 0-based target slide index.
 */
export function computeSlideStartProgress(scrollUnits: number[], index: number): number {
  if (scrollUnits.length === 0) return 0;
  if (scrollUnits.length === 1) return 0;
  const clamped = Math.max(0, Math.min(scrollUnits.length - 1, index));
  const total = scrollUnits.reduce((s, u) => s + u, 0);
  if (total === 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < clamped; i++) {
    cumulative += scrollUnits[i] ?? 0;
  }
  return cumulative / total;
}

/**
 * Reads the current slide index and provides navigation actions.
 * Must be used inside an EngineProvider subtree.
 *
 * With Decision A = Option C, sceneIndex equals logical slide index always
 * (one scene per slide). If multi-scene expansion were ever used (Option A),
 * this hook would need to read from VariableStore instead.
 *
 * @param totalSlides - Total number of logical slides in the deck.
 * @param scrollUnits - Array of scrollUnits per slide (for correct progress mapping).
 */
export function useSlideNavigation(totalSlides: number, scrollUnits: number[]): SlideNavigationState {
  // useCurrentScene returns { id: string; index: number }
  const { index: sceneIndex } = useCurrentScene();
  const engine = useSceneEngineContext();

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(totalSlides - 1, index));
    // scrollToProgress is the correct API on UseSceneEngineResult.
    // Navigate by seeking to the global progress value corresponding to the
    // start of the target slide's scroll window.
    engine.setProgress(computeSlideStartProgress(scrollUnits, clamped));
  }, [engine, totalSlides, scrollUnits]);

  const next = useCallback(() => {
    if (sceneIndex < totalSlides - 1) {
      engine.setProgress(computeSlideStartProgress(scrollUnits, sceneIndex + 1));
    }
  }, [engine, sceneIndex, totalSlides, scrollUnits]);

  const prev = useCallback(() => {
    if (sceneIndex > 0) {
      engine.setProgress(computeSlideStartProgress(scrollUnits, sceneIndex - 1));
    }
  }, [engine, sceneIndex, scrollUnits]);

  return { current: sceneIndex, total: totalSlides, goTo, next, prev };
}
