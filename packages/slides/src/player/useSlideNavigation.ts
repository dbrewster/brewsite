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
 * Computes the normalized scroll-space progress [0, 1] for the start of the slide at `index`.
 *
 * Returns the fraction of total scrollUnits that precede `index`. This is the raw
 * scroll-space value — it is NOT the same as engine-space progress (which is uniform
 * at `index / (n-1)` regardless of scrollUnits). Use this only when working with raw
 * scroll progress (e.g. to sync a custom scroll source). For programmatic navigation
 * via `engine.beginTransition()`, use `index / (totalSlides - 1)` directly.
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
 * Must be used inside an SceneEngine subtree.
 *
 * Navigation uses engine-space progress: `index / (totalSlides - 1)`. Engine space
 * is always uniform — each scene occupies the same fraction of [0, 1] regardless of
 * ProgressManager scrollUnits. The `scrollUnits` parameter is accepted for API
 * compatibility but is not used for navigation.
 *
 * `beginTransition()` is used (not `setProgress()`) so the engine animates through
 * the SceneTrack's dissolve/crossfade zone between scenes. `setProgress()` would
 * jump to the target in one frame (16ms), making the transition imperceptible and
 * the slide change invisible to the user.
 *
 * @param totalSlides - Total number of logical slides in the deck.
 * @param scrollUnits - Unused. Kept for API compatibility.
 */
export function useSlideNavigation(totalSlides: number, scrollUnits: number[]): SlideNavigationState {
  void scrollUnits; // engine-space navigation does not use scroll-unit proportions
  // useCurrentScene returns { id: string; index: number }
  const { index: sceneIndex } = useCurrentScene();
  const engine = useSceneEngineContext();

  // Engine-space progress: scene i starts at exactly i / (n-1).
  // This matches the SceneTrack's engineStart values (see sceneTrackCompiler.ts §298).
  // beginTransition() animates from current progress to the target, passing through the
  // dissolve zone between scenes and making the slide change visually apparent.
  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(totalSlides - 1, index));
    engine.beginTransition(totalSlides > 1 ? clamped / (totalSlides - 1) : 0);
  }, [engine, totalSlides]);

  const next = useCallback(() => {
    if (sceneIndex < totalSlides - 1) {
      engine.beginTransition((sceneIndex + 1) / (totalSlides - 1));
    }
  }, [engine, sceneIndex, totalSlides]);

  const prev = useCallback(() => {
    if (sceneIndex > 0) {
      engine.beginTransition((sceneIndex - 1) / Math.max(1, totalSlides - 1));
    }
  }, [engine, sceneIndex, totalSlides]);

  return { current: sceneIndex, total: totalSlides, goTo, next, prev };
}
