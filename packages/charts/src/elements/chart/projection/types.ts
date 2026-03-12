// Projection beam type contracts — no Three.js, no React, no runtime imports.

/**
 * Animation state for the Y-axis projection beam entrance/exit lifecycle.
 * Used by ChartProjectionRenderer to track the current animation phase.
 */
export type ProjectionAnimState = 'idle' | 'entering' | 'holding' | 'exiting';
