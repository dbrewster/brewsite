// scrollInertia.test.ts — Unit tests for the pure spring-inertia math functions.
import { describe, it, expect } from 'vitest';
import { computeInertiaStep, computeUnclampedInertiaStep } from '../scrollInertia';

describe('computeInertiaStep', () => {
  const DECAY = 0.88;
  const SENSITIVITY = 0.0003;

  it('decays velocity by inertiaDecay factor each step', () => {
    // Small velocity at interior progress — no boundary hit
    const { velocity } = computeInertiaStep(0.01, 0, SENSITIVITY, DECAY, 0.5);
    expect(velocity).toBeCloseTo(0.01 * DECAY, 10);
  });

  it('applies pendingDelta to velocity before decay', () => {
    // velocity=0, pendingDelta=100, sensitivity=0.001, decay=0.88, progress=0.5
    // newVelocity = (0 + 100 * 0.001) * 0.88 = 0.088 (small enough to stay interior)
    const { velocity } = computeInertiaStep(0, 100, 0.001, DECAY, 0.5);
    expect(velocity).toBeCloseTo(0.1 * DECAY, 10);
  });

  it('clamps progress at 0 and zeroes velocity at lower boundary', () => {
    // Large negative velocity pushes progress below 0
    const { velocity, progress } = computeInertiaStep(-10, 0, SENSITIVITY, DECAY, 0.001);
    expect(progress).toBe(0);
    expect(velocity).toBe(0);
  });

  it('clamps progress at 1 and zeroes velocity at upper boundary', () => {
    // Large positive velocity pushes progress above 1
    const { velocity, progress } = computeInertiaStep(10, 0, SENSITIVITY, DECAY, 0.999);
    expect(progress).toBe(1);
    expect(velocity).toBe(0);
  });

  it('does not zero velocity when progress is interior', () => {
    const { velocity, progress } = computeInertiaStep(0.005, 0, SENSITIVITY, DECAY, 0.5);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
    expect(velocity).not.toBe(0);
  });

  it('velocity halves in approximately 5.5 steps at decay=0.88', () => {
    // 0.88^5 ≈ 0.527 — verify the decay math holds at small interior velocities
    let v = 0.01;
    for (let i = 0; i < 5; i++) {
      const result = computeInertiaStep(v, 0, SENSITIVITY, DECAY, 0.5);
      v = result.velocity;
    }
    expect(v).toBeCloseTo(0.01 * Math.pow(DECAY, 5), 10);
  });

  it('pendingDelta is applied once — caller is responsible for clearing it', () => {
    // Two calls: first uses pendingDelta, second passes 0
    const step1 = computeInertiaStep(0, 50, 0.001, DECAY, 0.5);
    const step2 = computeInertiaStep(step1.velocity, 0, SENSITIVITY, DECAY, step1.progress);
    // step2 velocity = step1.velocity * decay (pendingDelta is 0)
    expect(step2.velocity).toBeCloseTo(step1.velocity * DECAY, 10);
  });

  it('returns progress clamped to [0, 1]', () => {
    const { progress: pLow } = computeInertiaStep(-1000, 0, SENSITIVITY, DECAY, 0.5);
    const { progress: pHigh } = computeInertiaStep(1000, 0, SENSITIVITY, DECAY, 0.5);
    expect(pLow).toBeGreaterThanOrEqual(0);
    expect(pHigh).toBeLessThanOrEqual(1);
  });
});

describe('computeUnclampedInertiaStep', () => {
  const DECAY = 0.88;
  const SENSITIVITY = 0.003;

  it('allows progress to go negative', () => {
    // Large negative delta from progress=0 should produce negative progress
    const { progress, velocity } = computeUnclampedInertiaStep(0, -200, SENSITIVITY, DECAY, 0);
    expect(progress).toBeLessThan(0);
    expect(velocity).toBeLessThan(0);
  });

  it('allows progress to exceed 1', () => {
    const { progress } = computeUnclampedInertiaStep(0, 500, SENSITIVITY, DECAY, 0.9);
    expect(progress).toBeGreaterThan(1);
  });

  it('does not zero velocity at boundaries', () => {
    // At progress=0, negative velocity should persist
    const { velocity } = computeUnclampedInertiaStep(-0.1, 0, SENSITIVITY, DECAY, 0);
    expect(velocity).not.toBe(0);
    expect(velocity).toBeCloseTo(-0.1 * DECAY, 10);
  });

  it('decays velocity the same as the clamped version', () => {
    const { velocity: clamped } = computeInertiaStep(0.01, 0, SENSITIVITY, DECAY, 0.5);
    const { velocity: unclamped } = computeUnclampedInertiaStep(0.01, 0, SENSITIVITY, DECAY, 0.5);
    expect(unclamped).toBeCloseTo(clamped, 10);
  });

  it('snaps micro-velocities to zero (dead zone)', () => {
    const { velocity } = computeUnclampedInertiaStep(1e-7, 0, SENSITIVITY, DECAY, 0);
    expect(velocity).toBe(0);
  });
});
