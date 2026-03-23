// useAutoPlay.ts — RAF-based wall-clock progress driver for auto-playing embeds.

import { useEffect, useRef } from 'react';
import { useSceneEngineContext } from './EngineContext';

/**
 * Options for the useAutoPlay hook.
 * Controls RAF-based wall-clock progress advancement.
 */
export interface UseAutoPlayOptions {
  /** Total seconds from progress 0 → 1. Default: 6. */
  duration: number;
  /** Loop back to 0 when reaching 1. Default: true. */
  loop: boolean;
  /** Whether auto-play is currently active (not paused by visibility). */
  active: boolean;
}

/**
 * Drives engine progress via wall-clock time.
 * Must be called inside a SceneEngine context.
 *
 * When active:
 * - Runs a requestAnimationFrame loop.
 * - Computes delta from elapsed wall time.
 * - Advances engine.setProgress() each frame.
 * - Loops or stops at progress = 1 per options.
 *
 * When not active:
 * - RAF loop is cancelled.
 * - Timestamp is reset (no time jump on resume).
 *
 * When prefers-reduced-motion matches:
 * - Hook is a complete no-op regardless of `active`.
 */
export function useAutoPlay(options: UseAutoPlayOptions): void {
  const engine = useSceneEngineContext();

  // Capture duration and loop in refs so mid-play changes don't restart the effect.
  const durationRef = useRef(options.duration);
  const loopRef = useRef(options.loop);
  durationRef.current = options.duration;
  loopRef.current = options.loop;

  // Reset lastTimestamp when active transitions false→true (effect re-runs).
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!options.active) {
      lastTimestampRef.current = null;
      return;
    }

    // Check prefers-reduced-motion inside the effect (not before hooks).
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Reset timestamp on activation to prevent time jumps.
    lastTimestampRef.current = null;

    let rafId = 0;

    const tick = (ts: number): void => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = ts;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = (ts - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = ts;

      const safeDuration = Math.max(0.001, durationRef.current);
      const delta = elapsed / safeDuration;
      const current = engine.frameState.progress;

      let next = current + delta;

      if (next >= 1) {
        if (loopRef.current) {
          next = next % 1;
        } else {
          next = 1;
        }
      }

      engine.setProgress(Math.max(0, Math.min(1, next)));
      rafId = requestAnimationFrame(tick);
    };

    // Only start RAF if reduced motion is not active.
    if (!motionQuery.matches) {
      rafId = requestAnimationFrame(tick);
    }

    // Listen for reduced-motion changes at runtime. Always registered
    // so that if motion preference changes mid-play (either direction),
    // the RAF loop starts or stops accordingly.
    const onMotionChange = (e: MediaQueryListEvent): void => {
      if (e.matches) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      } else {
        // Re-start RAF — motion is no longer reduced.
        lastTimestampRef.current = null;
        rafId = requestAnimationFrame(tick);
      }
    };

    motionQuery.addEventListener('change', onMotionChange);

    return () => {
      cancelAnimationFrame(rafId);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, [options.active, engine]);
}
