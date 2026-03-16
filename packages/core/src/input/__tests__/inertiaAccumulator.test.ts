// Tests for the stateful inertia integrator.

import { describe, it, expect } from 'vitest';
import {
  createInertiaState,
  feedDelta,
  tickClamped,
  tickUnclamped,
  resetMomentum,
  setProgress,
  type InertiaAccumulatorConfig,
} from '../inertiaAccumulator';

describe('inertiaAccumulator', () => {
  const config: InertiaAccumulatorConfig = {
    sensitivity: 60, // matches typical scene config
    decay: 0.9,
  };

  describe('createInertiaState', () => {
    it('creates state with zero velocity and progress', () => {
      const state = createInertiaState();
      expect(state.velocity).toBe(0);
      expect(state.pendingDelta).toBe(0);
      expect(state.progress).toBe(0);
    });

    it('accepts an initial progress value', () => {
      const state = createInertiaState(0.5);
      expect(state.progress).toBe(0.5);
    });
  });

  describe('feedDelta', () => {
    it('accumulates deltas', () => {
      const state = createInertiaState();
      feedDelta(state, 10);
      feedDelta(state, 20);
      expect(state.pendingDelta).toBe(30);
    });

    it('accumulates negative deltas', () => {
      const state = createInertiaState();
      feedDelta(state, -5);
      feedDelta(state, -3);
      expect(state.pendingDelta).toBe(-8);
    });
  });

  describe('tickClamped', () => {
    it('returns false when no delta has been fed and velocity is zero', () => {
      const state = createInertiaState();
      const changed = tickClamped(state, config);
      expect(changed).toBe(false);
      expect(state.progress).toBe(0);
    });

    it('advances progress after feeding a positive delta', () => {
      const state = createInertiaState();
      feedDelta(state, 100);
      const changed = tickClamped(state, config);
      expect(changed).toBe(true);
      expect(state.progress).toBeGreaterThan(0);
    });

    it('clears pending delta after tick', () => {
      const state = createInertiaState();
      feedDelta(state, 100);
      tickClamped(state, config);
      expect(state.pendingDelta).toBe(0);
    });

    it('clamps progress to 1', () => {
      const state = createInertiaState(0.99);
      feedDelta(state, 10000);
      tickClamped(state, config);
      expect(state.progress).toBeLessThanOrEqual(1);
    });

    it('clamps progress to 0', () => {
      const state = createInertiaState(0.01);
      feedDelta(state, -10000);
      tickClamped(state, config);
      expect(state.progress).toBeGreaterThanOrEqual(0);
    });

    it('velocity decays over multiple ticks with no new input', () => {
      const state = createInertiaState();
      // Use a small delta so progress stays well within (0, 1) and velocity isn't zeroed at boundary
      feedDelta(state, 1);
      tickClamped(state, config);
      const velocityAfterFirst = state.velocity;
      expect(velocityAfterFirst).toBeGreaterThan(0);

      tickClamped(state, config);
      const velocityAfterSecond = state.velocity;

      // Velocity should decay (closer to zero) each tick
      expect(Math.abs(velocityAfterSecond)).toBeLessThan(Math.abs(velocityAfterFirst));
    });

    it('velocity zeroes at boundary to prevent stuck accumulation', () => {
      const state = createInertiaState(0);
      feedDelta(state, -1000);
      tickClamped(state, config);
      // Progress clamped to 0, velocity should be zeroed
      expect(state.progress).toBe(0);
      expect(state.velocity).toBe(0);
    });

    it('eventually stops changing after many ticks with no input', () => {
      const state = createInertiaState();
      feedDelta(state, 50);
      // Run many ticks to let velocity decay to dead zone
      for (let i = 0; i < 200; i++) {
        tickClamped(state, config);
      }
      const progressBefore = state.progress;
      const changed = tickClamped(state, config);
      expect(changed).toBe(false);
      expect(state.progress).toBe(progressBefore);
    });
  });

  describe('tickUnclamped', () => {
    it('returns zero delta when no input and no velocity', () => {
      const state = createInertiaState();
      const delta = tickUnclamped(state, config);
      expect(delta).toBe(0);
    });

    it('returns progress delta after feeding input', () => {
      const state = createInertiaState();
      feedDelta(state, 100);
      const delta = tickUnclamped(state, config);
      expect(delta).not.toBe(0);
    });

    it('does not clamp progress below 0', () => {
      const state = createInertiaState(0);
      feedDelta(state, -1000);
      tickUnclamped(state, config);
      expect(state.progress).toBeLessThan(0);
    });

    it('does not clamp progress above 1', () => {
      const state = createInertiaState(1);
      feedDelta(state, 1000);
      tickUnclamped(state, config);
      expect(state.progress).toBeGreaterThan(1);
    });
  });

  describe('resetMomentum', () => {
    it('zeroes velocity and pending delta but preserves progress', () => {
      const state = createInertiaState(0.5);
      feedDelta(state, 100);
      tickClamped(state, config);
      const progressBefore = state.progress;

      resetMomentum(state);
      expect(state.velocity).toBe(0);
      expect(state.pendingDelta).toBe(0);
      expect(state.progress).toBe(progressBefore);
    });
  });

  describe('setProgress', () => {
    it('sets progress and resets momentum', () => {
      const state = createInertiaState();
      feedDelta(state, 100);
      tickClamped(state, config);

      setProgress(state, 0.75);
      expect(state.progress).toBe(0.75);
      expect(state.velocity).toBe(0);
      expect(state.pendingDelta).toBe(0);
    });
  });
});
