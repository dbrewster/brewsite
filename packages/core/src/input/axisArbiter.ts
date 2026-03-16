// Sticky axis-lock state machine for wheel/touch arbitration.

/** The currently locked axis, or 'none' if undecided. */
export type AxisLock = 'none' | 'x' | 'y';

/** Mutable state for the axis arbiter. */
export type AxisArbiterState = {
  lock: AxisLock;
  lastEventTimestamp: number;
  /** Accumulated absolute X displacement since last reset (used before commit). */
  accumulatedDx: number;
  /** Accumulated absolute Y displacement since last reset (used before commit). */
  accumulatedDy: number;
};

/** Configuration for the axis arbiter. */
export type AxisArbiterConfig = {
  /** Minimum cumulative pixel delta before committing to an axis. */
  lockThreshold: number;
  /** Idle time in ms before axis lock resets. */
  resetIdleMs: number;
};

/** Default configuration for the axis arbiter. */
export const DEFAULT_AXIS_ARBITER_CONFIG: AxisArbiterConfig = {
  lockThreshold: 6,
  resetIdleMs: 200,
};

/** Creates a fresh axis arbiter state. */
export function createAxisArbiterState(): AxisArbiterState {
  return { lock: 'none', lastEventTimestamp: 0, accumulatedDx: 0, accumulatedDy: 0 };
}

/**
 * Feeds a delta pair into the arbiter. Returns the current axis lock.
 *
 * When unlocked, accumulates both axes across multiple events before committing.
 * This prevents trackpad jitter (small deltaY during horizontal swipes) from
 * locking to the wrong axis on the first event. The dominant cumulative axis
 * wins once either exceeds the threshold.
 *
 * If the arbiter has been idle for longer than resetIdleMs, resets first.
 */
export function arbiterFeed(
  state: AxisArbiterState,
  absDx: number,
  absDy: number,
  timestamp: number,
  config: AxisArbiterConfig,
): AxisLock {
  // Reset if idle
  if (state.lock !== 'none' && (timestamp - state.lastEventTimestamp) > config.resetIdleMs) {
    state.lock = 'none';
    state.accumulatedDx = 0;
    state.accumulatedDy = 0;
  }
  // Also reset accumulator if undecided and idle
  if (state.lock === 'none' && (timestamp - state.lastEventTimestamp) > config.resetIdleMs) {
    state.accumulatedDx = 0;
    state.accumulatedDy = 0;
  }
  state.lastEventTimestamp = timestamp;

  // If already locked, return immediately.
  if (state.lock !== 'none') return state.lock;

  // Accumulate across events before committing.
  state.accumulatedDx += absDx;
  state.accumulatedDy += absDy;

  // Commit when either cumulative axis exceeds threshold.
  // Choose the dominant cumulative direction.
  if (state.accumulatedDx >= config.lockThreshold || state.accumulatedDy >= config.lockThreshold) {
    state.lock = state.accumulatedDx >= state.accumulatedDy ? 'x' : 'y';
  }

  return state.lock;
}

/**
 * Checks if the arbiter should be reset due to idle time, without feeding new deltas.
 * Called from the RAF loop to ensure locks expire even without new events.
 */
export function arbiterIdleCheck(
  state: AxisArbiterState,
  timestamp: number,
  config: AxisArbiterConfig,
): void {
  if (state.lock !== 'none' && (timestamp - state.lastEventTimestamp) > config.resetIdleMs) {
    state.lock = 'none';
    state.accumulatedDx = 0;
    state.accumulatedDy = 0;
  }
}
