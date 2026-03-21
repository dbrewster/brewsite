// Animated number counting driven by scene progress.

import { useSceneProgress } from '@brewsite/core';
import { easeOutCubic } from './easings';

export function useCountUp(
  target: number,
  options?: {
    start?: number;
    delay?: number;
    duration?: number;
    easing?: (t: number) => number;
    decimals?: number;
  },
): number {
  const progress = useSceneProgress();
  const start = options?.start ?? 0;
  const delay = options?.delay ?? 0;
  const duration = options?.duration ?? 0.6;
  const decimals = options?.decimals ?? 0;
  const easing = options?.easing ?? easeOutCubic;

  if (progress <= delay) return round(start, decimals);
  if (progress >= delay + duration) return round(target, decimals);

  const t = (progress - delay) / duration;
  const eased = easing(t);
  const value = start + (target - start) * eased;
  return round(value, decimals);
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
