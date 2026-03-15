import { describe, it, expect } from 'vitest';
import {
  createTransitionAnimatorState,
  beginTransition,
  interruptTransition,
  redirectTransition,
  getTransitionProgress,
  easeInOut,
  easeLinear,
  DEFAULT_TRANSITION_DURATION_MS,
} from '../transitionAnimator';

describe('createTransitionAnimatorState', () => {
  it('returns an inactive state', () => {
    const state = createTransitionAnimatorState();
    expect(state.active).toBe(false);
  });

  it('initializes fromProgress and toProgress to 0', () => {
    const state = createTransitionAnimatorState();
    expect(state.fromProgress).toBe(0);
    expect(state.toProgress).toBe(0);
  });

  it('initializes startTime to 0', () => {
    const state = createTransitionAnimatorState();
    expect(state.startTime).toBe(0);
  });

  it('initializes durationMs to DEFAULT_TRANSITION_DURATION_MS', () => {
    const state = createTransitionAnimatorState();
    expect(state.durationMs).toBe(DEFAULT_TRANSITION_DURATION_MS);
  });

  it('initializes easing to a function', () => {
    const state = createTransitionAnimatorState();
    expect(typeof state.easing).toBe('function');
  });
});

describe('getTransitionProgress — inactive state', () => {
  it('returns null when inactive', () => {
    const state = createTransitionAnimatorState();
    expect(getTransitionProgress(state, 1000)).toBeNull();
  });
});

describe('beginTransition + getTransitionProgress', () => {
  it('returns fromProgress at t=0 (elapsed=0)', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.2, 0.8, 1000, 400, easeLinear);
    const progress = getTransitionProgress(state, 1000);
    expect(progress).toBeCloseTo(0.2);
  });

  it('returns toProgress when elapsed equals durationMs', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.2, 0.8, 1000, 400, easeLinear);
    const progress = getTransitionProgress(state, 1400);
    expect(progress).toBeCloseTo(0.8);
  });

  it('sets active=false when elapsed >= durationMs', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.2, 0.8, 1000, 400, easeLinear);
    getTransitionProgress(state, 1400);
    expect(state.active).toBe(false);
  });

  it('returns toProgress when elapsed exceeds durationMs', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 1.0, 1000, 400, easeLinear);
    const progress = getTransitionProgress(state, 2000);
    expect(progress).toBeCloseTo(1.0);
  });

  it('returns midpoint at t=0.5 with easeLinear', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 1.0, 1000, 400, easeLinear);
    const progress = getTransitionProgress(state, 1200); // elapsed = 200ms = 50% of 400ms
    expect(progress).toBeCloseTo(0.5);
  });

  it('returns non-linear midpoint at t=0.5 with easeInOut', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 1.0, 1000, 400, easeInOut);
    const progress = getTransitionProgress(state, 1200); // elapsed = 200ms = 50%
    // easeInOut(0.5) = 0.5 (symmetric), but the curve is non-linear on either side
    expect(progress).toBeCloseTo(0.5, 5);
    // verify it's actually using the cubic function by checking at 25%
    const progress25 = getTransitionProgress(
      { active: true, fromProgress: 0.0, toProgress: 1.0, startTime: 1000, durationMs: 400, easing: easeInOut },
      1100, // elapsed = 100ms = 25% of 400ms
    );
    // easeInOut(0.25) = 4 * 0.25^3 = 4 * 0.015625 = 0.0625 (not 0.25)
    expect(progress25).toBeCloseTo(0.0625, 3);
  });

  it('uses DEFAULT_TRANSITION_DURATION_MS when durationMs is omitted', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 1.0, 1000);
    expect(state.durationMs).toBe(DEFAULT_TRANSITION_DURATION_MS);
  });

  it('state remains active mid-transition', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 1.0, 1000, 400, easeLinear);
    getTransitionProgress(state, 1200); // mid-way
    expect(state.active).toBe(true);
  });
});

describe('interruptTransition', () => {
  it('sets active to false', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 1.0, 1000, 400, easeLinear);
    interruptTransition(state);
    expect(state.active).toBe(false);
  });

  it('makes getTransitionProgress return null after interrupt', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 1.0, 1000, 400, easeLinear);
    interruptTransition(state);
    expect(getTransitionProgress(state, 1200)).toBeNull();
  });
});

describe('redirectTransition', () => {
  it('sets active to true', () => {
    const state = createTransitionAnimatorState();
    redirectTransition(state, 0.3, 0.9, 2000);
    expect(state.active).toBe(true);
  });

  it('updates fromProgress to currentProgress', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 0.5, 1000, 400, easeLinear);
    redirectTransition(state, 0.3, 0.9, 2000);
    expect(state.fromProgress).toBe(0.3);
  });

  it('updates toProgress to newToProgress', () => {
    const state = createTransitionAnimatorState();
    redirectTransition(state, 0.3, 0.9, 2000);
    expect(state.toProgress).toBe(0.9);
  });

  it('resets startTime to nowMs', () => {
    const state = createTransitionAnimatorState();
    redirectTransition(state, 0.3, 0.9, 2000);
    expect(state.startTime).toBe(2000);
  });

  it('reuses existing durationMs when not provided', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 0.5, 1000, 600, easeLinear);
    redirectTransition(state, 0.3, 0.9, 2000);
    expect(state.durationMs).toBe(600);
  });

  it('applies custom durationMs when provided', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 0.5, 1000, 400, easeLinear);
    redirectTransition(state, 0.3, 0.9, 2000, 800);
    expect(state.durationMs).toBe(800);
  });

  it('reuses existing easing when not provided', () => {
    const state = createTransitionAnimatorState();
    beginTransition(state, 0.0, 0.5, 1000, 400, easeLinear);
    redirectTransition(state, 0.3, 0.9, 2000);
    expect(state.easing).toBe(easeLinear);
  });

  it('starts a new transition from inactive state', () => {
    const state = createTransitionAnimatorState(); // inactive
    redirectTransition(state, 0.1, 0.7, 1000);
    expect(state.active).toBe(true);
    expect(state.fromProgress).toBe(0.1);
    expect(state.toProgress).toBe(0.7);
  });

  it('returns correct progress immediately after redirect', () => {
    const state = createTransitionAnimatorState();
    redirectTransition(state, 0.3, 0.9, 2000, 400, easeLinear);
    const progress = getTransitionProgress(state, 2000); // elapsed = 0
    expect(progress).toBeCloseTo(0.3);
  });

  it('reaches new toProgress at end of redirected duration', () => {
    const state = createTransitionAnimatorState();
    redirectTransition(state, 0.3, 0.9, 2000, 400, easeLinear);
    const progress = getTransitionProgress(state, 2400); // elapsed = 400ms = done
    expect(progress).toBeCloseTo(0.9);
  });
});

describe('easeInOut', () => {
  it('returns 0 at t=0', () => {
    expect(easeInOut(0)).toBeCloseTo(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeInOut(1)).toBeCloseTo(1);
  });

  it('returns 0.5 at t=0.5 (symmetric midpoint)', () => {
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });

  it('is slower at the start than linear (t=0.25)', () => {
    expect(easeInOut(0.25)).toBeLessThan(0.25);
  });

  it('is faster than linear in the middle (t=0.75)', () => {
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
  });
});

describe('easeLinear', () => {
  it('returns t unchanged', () => {
    expect(easeLinear(0)).toBe(0);
    expect(easeLinear(0.5)).toBe(0.5);
    expect(easeLinear(1)).toBe(1);
    expect(easeLinear(0.3)).toBe(0.3);
  });
});
