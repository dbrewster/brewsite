// Pure easing functions for per-scene transition control.
// Applied to blockProgress ∈ [0,1] before FunctionalTransitionSpec closures are evaluated.

/** Easing curve identifier used in Scene DSL transition prop. */
export type EasingName =
  | 'linear'
  | 'easeOutCubic'
  | 'easeOutExpo'
  | 'easeInOutSine'
  | 'easeInOutCubic';

type EasingFn = (t: number) => number;

const EASING_FNS: Record<EasingName, EasingFn> = {
  linear:         (t) => t,
  easeOutCubic:   (t) => 1 - Math.pow(1 - t, 3),
  easeOutExpo:    (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutSine:  (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

/**
 * Returns the easing function for the given name.
 * Falls back to linear with a console.warn if name is unrecognised.
 */
export const getEasingFn = (name: EasingName): EasingFn => {
  const fn = EASING_FNS[name];
  if (!fn) {
    console.warn(`[easing] Unknown easing "${name}", using linear.`);
    return EASING_FNS.linear;
  }
  return fn;
};
