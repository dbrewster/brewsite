// Shared hook: builds an animejs timeline and scrubs it to the current sceneProgress.
// All preset components in transitions.tsx delegate to this hook.

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import anime from 'animejs';
import { useEngineState } from '@brewsite/core';

/** Function that constructs an autoplay:false animejs timeline for a target element. */
export type TimelineBuilder = (target: HTMLDivElement) => ReturnType<typeof anime.timeline>;

/**
 * Builds an animejs timeline on mount (and when deps change) then seeks it to
 * sceneProgress * totalDuration on every engine tick.
 *
 * @param ref           - ref to the wrapper div owned by the transition component
 * @param build         - constructs the timeline for the target element; rebuilt when deps change
 * @param totalDuration - total timeline length in ms; sceneProgress 0→1 maps to 0→totalDuration
 * @param deps          - values that should trigger a timeline rebuild (mirror what build closes over)
 */
export const useScrollTimeline = (
  ref: RefObject<HTMLDivElement | null>,
  build: TimelineBuilder,
  totalDuration: number,
  deps: readonly unknown[],
): void => {
  // Always-current ref for the build function — prevents stale closure in layout effect
  const buildRef = useRef(build);
  buildRef.current = build;

  const tlRef = useRef<ReturnType<typeof anime.timeline> | null>(null);

  const { sceneProgress } = useEngineState();

  // Always-current ref for sceneProgress — used in layout effect for immediate post-build seek
  const sceneProgressRef = useRef(sceneProgress);
  sceneProgressRef.current = sceneProgress;

  // Build (or rebuild) the timeline synchronously after the DOM is ready.
  // Immediately seek to the current sceneProgress to avoid a one-frame flash on mount.
  useLayoutEffect(() => {
    if (!ref.current) return;
    tlRef.current = buildRef.current(ref.current);
    tlRef.current.seek(sceneProgressRef.current * totalDuration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDuration, ...deps]);

  // Scrub the timeline to the current sceneProgress on every engine tick.
  useEffect(() => {
    tlRef.current?.seek(sceneProgress * totalDuration);
  }, [sceneProgress, totalDuration]);
};
