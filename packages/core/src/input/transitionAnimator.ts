// transitionAnimator.ts — Pure functions for programmatic scene-transition animation.

/**
 * Easing function type.
 * Accepts t ∈ [0, 1], returns eased value ∈ [0, 1].
 */
export type TransitionEasing = (t: number) => number;

/** Built-in easing: cubic ease-in-out. */
export function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Built-in easing: linear (identity). */
export function easeLinear(t: number): number {
  return t;
}

/**
 * Mutable state for a single in-flight transition.
 * Owned by the engine layer (useSceneEngine) via a React ref.
 * TransitionAnimator functions read and write this state.
 */
export type TransitionAnimatorState = {
  /** True when a transition animation is actively running. */
  active: boolean;
  /** Engine progress at transition start. */
  fromProgress: number;
  /** Engine progress at transition end. */
  toProgress: number;
  /** Wall-clock timestamp (ms) when the transition started. */
  startTime: number;
  /** Duration in ms. */
  durationMs: number;
  /** Easing function. */
  easing: TransitionEasing;
};

/** Default transition duration in milliseconds. */
export const DEFAULT_TRANSITION_DURATION_MS = 400;

/** Default transition easing function. */
export const DEFAULT_TRANSITION_EASING: TransitionEasing = easeInOut;

/**
 * Creates an initial (inactive) TransitionAnimatorState.
 */
export function createTransitionAnimatorState(): TransitionAnimatorState {
  return {
    active: false,
    fromProgress: 0,
    toProgress: 0,
    startTime: 0,
    durationMs: DEFAULT_TRANSITION_DURATION_MS,
    easing: DEFAULT_TRANSITION_EASING,
  };
}

/**
 * Begins a new transition animation.
 * Mutates `state` in place. If a transition is already active, it is interrupted
 * and the new transition starts from the current interpolated progress.
 *
 * @param state — Mutable TransitionAnimatorState ref.
 * @param fromProgress — Current engine progress (used as start).
 * @param toProgress — Target engine progress.
 * @param nowMs — Current wall-clock time (performance.now()).
 * @param durationMs — Transition duration. Uses DEFAULT_TRANSITION_DURATION_MS if omitted.
 * @param easing — Easing function. Uses DEFAULT_TRANSITION_EASING if omitted.
 */
export function beginTransition(
  state: TransitionAnimatorState,
  fromProgress: number,
  toProgress: number,
  nowMs: number,
  durationMs?: number,
  easing?: TransitionEasing,
): void {
  state.active = true;
  state.fromProgress = fromProgress;
  state.toProgress = toProgress;
  state.startTime = nowMs;
  state.durationMs = durationMs ?? DEFAULT_TRANSITION_DURATION_MS;
  state.easing = easing ?? DEFAULT_TRANSITION_EASING;
}

/**
 * Interrupts an active transition.
 * The engine progress stays at whatever value getTransitionProgress() last returned.
 * Mutates `state` in place.
 */
export function interruptTransition(state: TransitionAnimatorState): void {
  state.active = false;
}

/**
 * Redirects an active transition to a new target without restarting the easing curve.
 * If no transition is active, this starts a new transition from `currentProgress`.
 *
 * Use case: User presses ArrowDown twice quickly — the first transition is in-flight,
 * the second redirect extends the target by one more scene boundary.
 *
 * @param state — Mutable TransitionAnimatorState ref.
 * @param currentProgress — Current interpolated progress (from last getTransitionProgress).
 * @param newToProgress — New target progress.
 * @param nowMs — Current wall-clock time.
 * @param durationMs — Duration for the remaining transition. Reuses state.durationMs if omitted.
 * @param easing — Easing for the remaining transition. Reuses state.easing if omitted.
 */
export function redirectTransition(
  state: TransitionAnimatorState,
  currentProgress: number,
  newToProgress: number,
  nowMs: number,
  durationMs?: number,
  easing?: TransitionEasing,
): void {
  state.active = true;
  state.fromProgress = currentProgress;
  state.toProgress = newToProgress;
  state.startTime = nowMs;
  state.durationMs = durationMs ?? state.durationMs;
  state.easing = easing ?? state.easing;
}

/**
 * Evaluates the current transition progress at the given wall-clock time.
 * Returns the interpolated engine progress, or null if no transition is active.
 *
 * When the transition completes (elapsed >= durationMs), this returns toProgress
 * and sets state.active = false.
 *
 * @param state — Mutable TransitionAnimatorState ref.
 * @param nowMs — Current wall-clock time (performance.now()).
 * @returns Interpolated engine progress ∈ [0, 1], or null if inactive.
 */
export function getTransitionProgress(
  state: TransitionAnimatorState,
  nowMs: number,
): number | null {
  if (!state.active) return null;

  const elapsed = nowMs - state.startTime;
  if (elapsed >= state.durationMs) {
    state.active = false;
    return state.toProgress;
  }

  const rawT = elapsed / state.durationMs;
  const easedT = state.easing(rawT);
  return state.fromProgress + (state.toProgress - state.fromProgress) * easedT;
}
