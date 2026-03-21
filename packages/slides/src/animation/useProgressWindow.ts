// Returns progress [0,1] clamped and eased within a sub-window of scene progress.

import { useSceneProgress } from '@brewsite/core';

/**
 * Returns progress [0,1] clamped and eased within a sub-window of scene progress.
 */
export function useProgressWindow(
  start: number,
  end: number,
  options?: { easing?: (t: number) => number },
): number {
  const progress = useSceneProgress();
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  const raw = (progress - start) / (end - start);
  return options?.easing ? options.easing(raw) : raw;
}
