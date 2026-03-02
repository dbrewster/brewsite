/**
 * Shared pacing curves for website scenes.
 *
 * IMPORTANT: These must be module-level constants (not inline arrow functions).
 * The compiler caches by function reference — inline functions create a new
 * reference on every render, invalidating the cache and causing recompilation.
 */

/**
 * Default per-scene pacing curve for ProgressManager.
 *
 * Keep this identity by default so raw scroll and scene progression stay
 * continuously aligned across the full segment (no plateau at the tail).
 */
export const dwellFn = (t: number): number => t;
