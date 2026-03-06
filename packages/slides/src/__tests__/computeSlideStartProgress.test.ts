// Tests for computeSlideStartProgress pure helper.
// No mocks — pure function with real inputs and real output assertions.

import { describe, it, expect } from 'vitest';
import { computeSlideStartProgress } from '../player/useSlideNavigation';

describe('computeSlideStartProgress', () => {
  // ─── Uniform scrollUnits ─────────────────────────────────────────────────────

  it('returns 0 for the first slide regardless of scrollUnits', () => {
    expect(computeSlideStartProgress([400, 400, 400], 0)).toBe(0);
  });

  it('distributes progress evenly for uniform scrollUnits (3 slides, index 1)', () => {
    expect(computeSlideStartProgress([400, 400, 400], 1)).toBeCloseTo(1 / 3);
  });

  it('distributes progress evenly for uniform scrollUnits (3 slides, index 2)', () => {
    expect(computeSlideStartProgress([400, 400, 400], 2)).toBeCloseTo(2 / 3);
  });

  it('clamps index to last slide when index exceeds bounds', () => {
    const result = computeSlideStartProgress([400, 400, 400], 10);
    expect(result).toBeCloseTo(2 / 3);
  });

  it('clamps index to 0 when index is negative', () => {
    const result = computeSlideStartProgress([400, 400, 400], -1);
    expect(result).toBe(0);
  });

  // ─── Non-uniform scrollUnits ──────────────────────────────────────────────────

  it('correctly weights non-uniform scrollUnits (title=100, body=400, body=400)', () => {
    const units = [100, 400, 400];
    expect(computeSlideStartProgress(units, 0)).toBe(0);
    expect(computeSlideStartProgress(units, 1)).toBeCloseTo(100 / 900);
    expect(computeSlideStartProgress(units, 2)).toBeCloseTo(500 / 900);
  });

  it('correctly handles two unequal slides', () => {
    const units = [200, 800];
    expect(computeSlideStartProgress(units, 0)).toBe(0);
    expect(computeSlideStartProgress(units, 1)).toBeCloseTo(200 / 1000);
  });

  it('handles four slides with mixed weights', () => {
    const units = [100, 400, 400, 100];
    const total = 1000;
    expect(computeSlideStartProgress(units, 0)).toBe(0);
    expect(computeSlideStartProgress(units, 1)).toBeCloseTo(100 / total);
    expect(computeSlideStartProgress(units, 2)).toBeCloseTo(500 / total);
    expect(computeSlideStartProgress(units, 3)).toBeCloseTo(900 / total);
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────────

  it('returns 0 for a single-slide deck (any index)', () => {
    expect(computeSlideStartProgress([100], 0)).toBe(0);
    expect(computeSlideStartProgress([100], 1)).toBe(0);
  });

  it('returns 0 for an empty scrollUnits array', () => {
    expect(computeSlideStartProgress([], 0)).toBe(0);
  });

  it('returns 0 when all scrollUnits are 0 (degenerate case)', () => {
    expect(computeSlideStartProgress([0, 0, 0], 1)).toBe(0);
  });

  it('exact equality for first slide always returns 0 (no rounding error)', () => {
    const result = computeSlideStartProgress([100, 200, 300], 0);
    expect(result).toBe(0);  // strict equality, not toBeCloseTo
  });
});
