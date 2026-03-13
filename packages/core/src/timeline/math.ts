import { clamp01, lerp } from '../math';

export type EaseFn = (t: number) => number;

export { clamp01, lerp } from '../math';

export const invLerp = (value: number, start: number, end: number) => {
  if (start === end) return value >= end ? 1 : 0;
  return (value - start) / (end - start);
};

export const rangeProgress = (value: number, start: number, end: number) => clamp01(invLerp(value, start, end));

export const smoothstep: EaseFn = (t) => t * t * (3 - 2 * t);

export const createRangeTransition = (options: {
  start: number;
  end: number;
  from?: number;
  to?: number;
  ease?: EaseFn;
}) => {
  const { start, end, from = 0, to = 1, ease = (t) => t } = options;
  return (progress: number) => {
    const t = ease(rangeProgress(progress, start, end));
    return lerp(from, to, t);
  };
};

export const createFadeTransition = (options: {
  inStart: number;
  inEnd: number;
  outStart: number;
  outEnd: number;
  easeIn?: EaseFn;
  easeOut?: EaseFn;
}) => {
  const {
    inStart,
    inEnd,
    outStart,
    outEnd,
    easeIn = (t) => t,
    easeOut = (t) => t,
  } = options;
  return (progress: number) => {
    if (progress <= inStart) return 0;
    if (progress < inEnd) return easeIn(rangeProgress(progress, inStart, inEnd));
    if (progress < outStart) return 1;
    if (progress < outEnd) return 1 - easeOut(rangeProgress(progress, outStart, outEnd));
    return 0;
  };
};
