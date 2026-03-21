// CSS entrance animation props driven by scene progress.

import { type CSSProperties } from 'react';
import { useSceneProgress } from '@brewsite/core';
import { easeOutCubic } from './easings';
import type { EntranceType } from '../types';

export function useEntrance(
  type: EntranceType,
  options?: {
    delay?: number;
    duration?: number;
    distance?: string;
    easing?: (t: number) => number;
  },
): CSSProperties {
  const progress = useSceneProgress();
  if (type === 'none') return {};

  const delay = options?.delay ?? 0;
  const duration = options?.duration ?? 0.3;
  const distance = options?.distance ?? '24px';
  const easing = options?.easing ?? easeOutCubic;

  if (progress <= delay) return entranceStart(type, distance);
  if (progress >= delay + duration) return {};

  const t = easing((progress - delay) / duration);
  return entranceInterpolate(type, distance, t);
}

function entranceStart(type: EntranceType, distance: string): CSSProperties {
  switch (type) {
    case 'fadeIn': return { opacity: 0 };
    case 'slideUp': return { opacity: 0, transform: `translateY(${distance})` };
    case 'slideDown': return { opacity: 0, transform: `translateY(-${distance})` };
    case 'slideLeft': return { opacity: 0, transform: `translateX(${distance})` };
    case 'slideRight': return { opacity: 0, transform: `translateX(-${distance})` };
    case 'grow': return { opacity: 0, transform: 'scale(0.8)' };
    default: return {};
  }
}

function entranceInterpolate(type: EntranceType, distance: string, t: number): CSSProperties {
  const opacity = t;
  const px = parseFloat(distance) * (1 - t);
  switch (type) {
    case 'fadeIn': return { opacity };
    case 'slideUp': return { opacity, transform: `translateY(${px}px)` };
    case 'slideDown': return { opacity, transform: `translateY(-${px}px)` };
    case 'slideLeft': return { opacity, transform: `translateX(${px}px)` };
    case 'slideRight': return { opacity, transform: `translateX(-${px}px)` };
    case 'grow': return { opacity, transform: `scale(${0.8 + 0.2 * t})` };
    default: return {};
  }
}
