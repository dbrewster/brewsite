// Staggered item visibility driven by scene progress.

import { type CSSProperties } from 'react';
import { useSceneProgress } from '@brewsite/core';

export function useStaggeredReveal(
  index: number,
  total: number,
  options?: {
    staggerDelay?: number;
    fadeInDuration?: number;
    startAfter?: number;
  },
): { visible: boolean; style: CSSProperties } {
  const progress = useSceneProgress();
  const stagger = options?.staggerDelay ?? (total > 1 ? 0.6 / total : 0);
  const fade = options?.fadeInDuration ?? 0.15;
  const startAfter = options?.startAfter ?? 0;

  const itemStart = startAfter + index * stagger;
  const itemEnd = itemStart + fade;

  if (progress < itemStart) {
    return { visible: false, style: { opacity: 0, transform: 'translateY(8px)' } };
  }
  if (progress >= itemEnd) {
    return { visible: true, style: { opacity: 1, transform: 'translateY(0)' } };
  }

  const t = (progress - itemStart) / fade;
  return {
    visible: true,
    style: {
      opacity: t,
      transform: `translateY(${(1 - t) * 8}px)`,
      transition: 'none',
    },
  };
}
