// Stateful inertia integrator, extracted from InputCoordinator.

import { computeInertiaStep, computeUnclampedInertiaStep } from '../player/scrollInertia';

/** Configuration for the inertia accumulator. */
export type InertiaAccumulatorConfig = {
  sensitivity: number;
  decay: number;
};

/** Mutable state for the inertia accumulator. */
export type InertiaAccumulatorState = {
  velocity: number;
  pendingDelta: number;
  progress: number;
};

/** Creates a fresh inertia accumulator state. */
export function createInertiaState(initialProgress?: number): InertiaAccumulatorState {
  return { velocity: 0, pendingDelta: 0, progress: initialProgress ?? 0 };
}

/**
 * Feeds a raw delta (e.g., wheel deltaY or touch dy) into the accumulator.
 * Deltas are batched until tick() is called.
 */
export function feedDelta(state: InertiaAccumulatorState, delta: number): void {
  state.pendingDelta += delta;
}

/**
 * Advances the inertia simulation by one frame.
 * Returns true if progress changed (caller should emit).
 * Clamps progress to [0, 1].
 */
export function tickClamped(
  state: InertiaAccumulatorState,
  config: InertiaAccumulatorConfig,
): boolean {
  const result = computeInertiaStep(
    state.velocity,
    state.pendingDelta,
    config.sensitivity / 1000.0,
    config.decay,
    state.progress,
  );
  state.pendingDelta = 0;
  const changed = result.progress !== state.progress;
  state.velocity = result.velocity;
  state.progress = result.progress;
  return changed;
}

/**
 * Advances the inertia simulation without clamping (for carousel X-axis).
 * Returns the progress delta since last tick.
 */
export function tickUnclamped(
  state: InertiaAccumulatorState,
  config: InertiaAccumulatorConfig,
): number {
  const prev = state.progress;
  const result = computeUnclampedInertiaStep(
    state.velocity,
    state.pendingDelta,
    config.sensitivity,
    config.decay,
    state.progress,
  );
  state.pendingDelta = 0;
  state.velocity = result.velocity;
  state.progress = result.progress;
  return state.progress - prev;
}

/**
 * Resets velocity and pending delta (e.g., on programmatic scrollTo).
 */
export function resetMomentum(state: InertiaAccumulatorState): void {
  state.velocity = 0;
  state.pendingDelta = 0;
}

/**
 * Sets progress directly and resets momentum.
 */
export function setProgress(state: InertiaAccumulatorState, progress: number): void {
  state.progress = progress;
  resetMomentum(state);
}
