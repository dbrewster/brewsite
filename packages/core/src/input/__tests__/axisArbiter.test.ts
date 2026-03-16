// Tests for the sticky axis-lock state machine.

import { describe, it, expect } from 'vitest';
import {
  createAxisArbiterState,
  arbiterFeed,
  arbiterIdleCheck,
  DEFAULT_AXIS_ARBITER_CONFIG,
  type AxisArbiterConfig,
} from '../axisArbiter';

describe('axisArbiter', () => {
  const config = DEFAULT_AXIS_ARBITER_CONFIG;

  describe('arbiterFeed', () => {
    it('starts in none state', () => {
      const state = createAxisArbiterState();
      expect(state.lock).toBe('none');
    });

    it('remains none when cumulative deltas are below threshold', () => {
      const state = createAxisArbiterState();
      const lock = arbiterFeed(state, 1, 2, 100, config);
      expect(lock).toBe('none');
    });

    it('locks to x when cumulative absDx exceeds threshold and is dominant', () => {
      const state = createAxisArbiterState();
      const lock = arbiterFeed(state, 8, 1, 100, config);
      expect(lock).toBe('x');
    });

    it('locks to y when cumulative absDy exceeds threshold and is dominant', () => {
      const state = createAxisArbiterState();
      const lock = arbiterFeed(state, 1, 8, 100, config);
      expect(lock).toBe('y');
    });

    it('locks to x when absDx equals absDy and both exceed threshold', () => {
      const state = createAxisArbiterState();
      const lock = arbiterFeed(state, 7, 7, 100, config);
      expect(lock).toBe('x');
    });

    it('accumulates across multiple events before committing', () => {
      const state = createAxisArbiterState();
      // First event: both below threshold, mostly horizontal (cumulative: dx=2, dy=1)
      expect(arbiterFeed(state, 2, 1, 100, config)).toBe('none');
      // Second event: still accumulating (cumulative: dx=4, dy=2)
      expect(arbiterFeed(state, 2, 1, 105, config)).toBe('none');
      // Third event: cumulative dx=6, dy=3. dx reaches threshold (6) → lock x
      expect(arbiterFeed(state, 2, 1, 110, config)).toBe('x');
    });

    it('accumulation prevents trackpad jitter from locking wrong axis', () => {
      const state = createAxisArbiterState();
      // Simulates trackpad horizontal scroll where first event has jittery deltaY
      expect(arbiterFeed(state, 2, 4, 100, config)).toBe('none'); // jitter: dy > dx
      expect(arbiterFeed(state, 5, 1, 105, config)).toBe('x');    // cumulative: dx=7, dy=5 → x wins
    });

    it('stays locked after initial commit', () => {
      const state = createAxisArbiterState();
      arbiterFeed(state, 8, 1, 100, config);
      // Subsequent event with opposite dominant axis should stay x
      const lock = arbiterFeed(state, 1, 10, 110, config);
      expect(lock).toBe('x');
    });

    it('resets lock after idle period', () => {
      const state = createAxisArbiterState();
      arbiterFeed(state, 8, 1, 100, config);
      expect(state.lock).toBe('x');

      // Feed after idle period exceeds resetIdleMs
      const lock = arbiterFeed(state, 1, 8, 100 + config.resetIdleMs + 1, config);
      expect(lock).toBe('y');
    });

    it('resets accumulator after idle period when undecided', () => {
      const state = createAxisArbiterState();
      // Accumulate some dx but don't commit
      arbiterFeed(state, 3, 0, 100, config);
      expect(state.lock).toBe('none');
      expect(state.accumulatedDx).toBe(3);

      // After idle, accumulator resets
      arbiterFeed(state, 0, 8, 100 + config.resetIdleMs + 1, config);
      expect(state.lock).toBe('y'); // fresh accumulation: dy=8 > dx=0
    });

    it('does not reset if idle time is exactly at threshold', () => {
      const state = createAxisArbiterState();
      arbiterFeed(state, 8, 1, 100, config);

      // Exactly at resetIdleMs: not exceeded
      const lock = arbiterFeed(state, 1, 8, 100 + config.resetIdleMs, config);
      expect(lock).toBe('x');
    });

    it('locks at exact threshold value', () => {
      const state = createAxisArbiterState();
      const lock = arbiterFeed(state, config.lockThreshold, 0, 100, config);
      expect(lock).toBe('x');
    });
  });

  describe('arbiterIdleCheck', () => {
    it('resets lock when idle time exceeds resetIdleMs', () => {
      const state = createAxisArbiterState();
      arbiterFeed(state, 8, 1, 100, config);
      expect(state.lock).toBe('x');

      arbiterIdleCheck(state, 100 + config.resetIdleMs + 1, config);
      expect(state.lock).toBe('none');
      expect(state.accumulatedDx).toBe(0);
      expect(state.accumulatedDy).toBe(0);
    });

    it('does not reset when idle time is within resetIdleMs', () => {
      const state = createAxisArbiterState();
      arbiterFeed(state, 8, 1, 100, config);

      arbiterIdleCheck(state, 100 + config.resetIdleMs - 1, config);
      expect(state.lock).toBe('x');
    });
  });
});
