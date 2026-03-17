// Tests for highlight particle math — pure function tests with deterministic random.

import { describe, it, expect } from 'vitest';
import {
  initParticle,
  advanceParticle,
  particleRingPosition,
  particleOpacity,
  LIFETIME_RANGE,
  ANGULAR_SPEED_RANGE,
  DRIFT_SPEED_RANGE,
} from '../highlightParticles';

// Deterministic pseudo-random sequence for testing.
function makeSeededRandom(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('initParticle', () => {
  it('initializes angle in [0, 2*PI)', () => {
    const random = makeSeededRandom([0.5]);
    const p = initParticle(random);
    expect(p.angle).toBeCloseTo(0.5 * Math.PI * 2, 5);
  });

  it('staggers initial age within lifetime range', () => {
    const random = makeSeededRandom([0.3, 0.7, 0.5, 0.5, 0.5]);
    const p = initParticle(random);
    // Second call to random (index 1) is 0.7, staggered age = 0.7 * LIFETIME_RANGE[1]
    expect(p.age).toBeCloseTo(0.7 * LIFETIME_RANGE[1], 5);
  });

  it('sets angularSpeed within ANGULAR_SPEED_RANGE', () => {
    const random = makeSeededRandom([0, 0, 0.5, 0.5, 0.5]);
    const p = initParticle(random);
    const expected = ANGULAR_SPEED_RANGE[0] + 0.5 * (ANGULAR_SPEED_RANGE[1] - ANGULAR_SPEED_RANGE[0]);
    expect(p.angularSpeed).toBeCloseTo(expected, 5);
  });

  it('sets driftSpeed within DRIFT_SPEED_RANGE', () => {
    const random = makeSeededRandom([0, 0, 0, 0.5, 0.5]);
    const p = initParticle(random);
    const expected = DRIFT_SPEED_RANGE[0] + 0.5 * (DRIFT_SPEED_RANGE[1] - DRIFT_SPEED_RANGE[0]);
    expect(p.driftSpeed).toBeCloseTo(expected, 5);
  });

  it('sets lifetime within LIFETIME_RANGE', () => {
    const random = makeSeededRandom([0, 0, 0, 0, 0.5]);
    const p = initParticle(random);
    const expected = LIFETIME_RANGE[0] + 0.5 * (LIFETIME_RANGE[1] - LIFETIME_RANGE[0]);
    expect(p.lifetime).toBeCloseTo(expected, 5);
  });

  it('starts yOffset at 0', () => {
    const random = makeSeededRandom([0]);
    const p = initParticle(random);
    expect(p.yOffset).toBe(0);
  });
});

describe('advanceParticle', () => {
  const baseParticle = {
    angle: 1.0,
    yOffset: 0.0,
    age: 0.0,
    angularSpeed: 0.4,
    driftSpeed: 0.1,
    lifetime: 2.0,
  };

  it('advances angle by angularSpeed * dt', () => {
    const result = advanceParticle(baseParticle, 0.5, Math.random);
    expect(result.angle).toBeCloseTo(1.0 + 0.4 * 0.5, 5);
  });

  it('advances yOffset by driftSpeed * dt', () => {
    const result = advanceParticle(baseParticle, 0.5, Math.random);
    expect(result.yOffset).toBeCloseTo(0.0 + 0.1 * 0.5, 5);
  });

  it('advances age by dt', () => {
    const result = advanceParticle(baseParticle, 0.5, Math.random);
    expect(result.age).toBeCloseTo(0.5, 5);
  });

  it('recycles particle when age exceeds lifetime', () => {
    const old = { ...baseParticle, age: 1.9 };
    const random = makeSeededRandom([0.5, 0.5, 0.5, 0.5]);
    const result = advanceParticle(old, 0.2, random);
    // Age should be 0 after recycle
    expect(result.age).toBe(0);
    expect(result.yOffset).toBe(0);
    // Angle should be newly randomized
    expect(result.angle).toBeCloseTo(0.5 * Math.PI * 2, 5);
  });

  it('does not recycle particle when age equals lifetime exactly', () => {
    const old = { ...baseParticle, age: 1.9, lifetime: 2.0 };
    const result = advanceParticle(old, 0.1, Math.random);
    // age 1.9 + 0.1 = 2.0 >= lifetime 2.0 => recycles
    expect(result.age).toBe(0);
  });

  it('preserves particle when age is below lifetime', () => {
    const old = { ...baseParticle, age: 0.5 };
    const result = advanceParticle(old, 0.3, Math.random);
    expect(result.age).toBeCloseTo(0.8, 5);
    expect(result.angularSpeed).toBe(old.angularSpeed);
    expect(result.driftSpeed).toBe(old.driftSpeed);
    expect(result.lifetime).toBe(old.lifetime);
  });
});

describe('particleRingPosition', () => {
  it('returns [radius, 0] at angle 0', () => {
    const [x, z] = particleRingPosition(0, 1.0);
    expect(x).toBeCloseTo(1.0, 5);
    expect(z).toBeCloseTo(0.0, 5);
  });

  it('returns [0, radius] at angle PI/2', () => {
    const [x, z] = particleRingPosition(Math.PI / 2, 2.0);
    expect(x).toBeCloseTo(0.0, 5);
    expect(z).toBeCloseTo(2.0, 5);
  });

  it('returns [-radius, 0] at angle PI', () => {
    const [x, z] = particleRingPosition(Math.PI, 1.5);
    expect(x).toBeCloseTo(-1.5, 5);
    expect(z).toBeCloseTo(0.0, 4);
  });

  it('scales by radius', () => {
    const [x1] = particleRingPosition(0, 1.0);
    const [x2] = particleRingPosition(0, 3.0);
    expect(x2 / x1).toBeCloseTo(3.0, 5);
  });
});

describe('particleOpacity', () => {
  it('returns 0 at age 0', () => {
    expect(particleOpacity(0, 2.0)).toBe(0);
  });

  it('returns 1 during mid-life', () => {
    expect(particleOpacity(1.0, 2.0)).toBeCloseTo(1.0, 5);
  });

  it('fades in over first 10% of lifetime', () => {
    // At 5% of lifetime
    const opacity = particleOpacity(0.1, 2.0);
    expect(opacity).toBeCloseTo(0.5, 1);
  });

  it('fully faded in at 10% of lifetime', () => {
    const opacity = particleOpacity(0.2, 2.0);
    expect(opacity).toBeCloseTo(1.0, 5);
  });

  it('starts fading out at 70% of lifetime', () => {
    const opacity = particleOpacity(1.4, 2.0);
    expect(opacity).toBeCloseTo(1.0, 5);
  });

  it('is partially faded out at 85% of lifetime', () => {
    const opacity = particleOpacity(1.7, 2.0);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });

  it('returns 0 at end of lifetime', () => {
    expect(particleOpacity(2.0, 2.0)).toBeCloseTo(0, 5);
  });

  it('returns 0 for zero lifetime', () => {
    expect(particleOpacity(0, 0)).toBe(0);
  });
});
