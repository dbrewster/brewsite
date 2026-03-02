/**
 * Shared pacing curves for website scenes.
 *
 * IMPORTANT: These must be module-level constants (not inline arrow functions).
 * The compiler caches by function reference — inline functions create a new
 * reference on every render, invalidating the cache and causing recompilation.
 */

/**
 * Standard dwell curve: animation completes in the first 40% of a scene's
 * scroll budget, then holds the final pose for the remaining 60%.
 *
 * fn constraints satisfied: fn(0)=0, fn(1)=1, monotonically non-decreasing.
 */
export const dwellFn = (t: number): number => Math.min(1, t * 2.5);
