/**
 * Dwell pacing function for content scenes.
 *
 * Maps local scroll progress 0→1 such that 3D elements animate quickly
 * (first 25% of scroll budget), then hold the final pose for the remaining 75%.
 * This lets the camera settle into reading position while the user dwells.
 *
 * Constraints satisfied: fn(0) === 0, fn(1) === 1, monotonically non-decreasing.
 *
 * IMPORTANT: Keep this at module level — never inline in JSX.
 * ProgressManager detects fn identity; a new function reference on every render
 * would invalidate the compiled SceneTrack cache.
 */
export const DWELL_FN = (t: number): number => Math.min(1, t * 4);

/**
 * Linear pacing — equivalent to omitting the fn prop.
 * Use for act header scenes and the hero scene where linear traversal is wanted.
 */
export const LINEAR_FN = (t: number): number => t;
