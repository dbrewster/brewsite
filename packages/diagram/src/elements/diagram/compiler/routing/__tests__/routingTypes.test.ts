// Tests for routingTypes.ts Vec2/Vec3 math utilities and helpers.

import { describe, it, expect } from 'vitest';
import {
  addVec2,
  subVec2,
  scaleVec2,
  lengthVec2,
  dotVec2,
  normalizeVec2,
  clamp,
  distVec2,
  vec3,
  sideToApproach,
  DEFAULT_FLOW_CONFIG,
} from '../routingTypes';
import type { Vec2, SideId } from '../routingTypes';

describe('addVec2', () => {
  it('adds two vectors component-wise', () => {
    expect(addVec2([1, 2], [3, 4])).toEqual([4, 6]);
  });

  it('handles zero vectors', () => {
    expect(addVec2([0, 0], [5, -3])).toEqual([5, -3]);
  });

  it('handles negative components', () => {
    expect(addVec2([-1, -2], [-3, -4])).toEqual([-4, -6]);
  });
});

describe('subVec2', () => {
  it('subtracts two vectors component-wise', () => {
    expect(subVec2([5, 7], [2, 3])).toEqual([3, 4]);
  });

  it('handles zero vectors', () => {
    expect(subVec2([0, 0], [0, 0])).toEqual([0, 0]);
  });

  it('handles subtracting from itself', () => {
    expect(subVec2([3, 4], [3, 4])).toEqual([0, 0]);
  });
});

describe('scaleVec2', () => {
  it('scales a vector by a positive scalar', () => {
    expect(scaleVec2([3, 4], 2)).toEqual([6, 8]);
  });

  it('scales a vector by zero', () => {
    expect(scaleVec2([3, 4], 0)).toEqual([0, 0]);
  });

  it('scales a vector by a negative scalar', () => {
    expect(scaleVec2([3, 4], -1)).toEqual([-3, -4]);
  });

  it('scales the zero vector', () => {
    expect(scaleVec2([0, 0], 100)).toEqual([0, 0]);
  });
});

describe('lengthVec2', () => {
  it('computes length of a 3-4-5 triangle', () => {
    expect(lengthVec2([3, 4])).toBe(5);
  });

  it('returns 0 for the zero vector', () => {
    expect(lengthVec2([0, 0])).toBe(0);
  });

  it('computes length of a unit vector along x', () => {
    expect(lengthVec2([1, 0])).toBe(1);
  });

  it('computes length of a unit vector along y', () => {
    expect(lengthVec2([0, 1])).toBe(1);
  });

  it('handles negative components', () => {
    expect(lengthVec2([-3, -4])).toBe(5);
  });
});

describe('dotVec2', () => {
  it('computes the dot product of two vectors', () => {
    expect(dotVec2([1, 2], [3, 4])).toBe(11);
  });

  it('returns 0 for perpendicular vectors', () => {
    expect(dotVec2([1, 0], [0, 1])).toBe(0);
  });

  it('returns negative for opposite-pointing vectors', () => {
    expect(dotVec2([1, 0], [-1, 0])).toBe(-1);
  });

  it('handles zero vectors', () => {
    expect(dotVec2([0, 0], [5, 7])).toBe(0);
  });
});

describe('normalizeVec2', () => {
  it('normalizes a non-zero vector to unit length', () => {
    const result = normalizeVec2([3, 4]);
    expect(result[0]).toBeCloseTo(0.6);
    expect(result[1]).toBeCloseTo(0.8);
  });

  it('returns [0, 0] for the zero vector', () => {
    expect(normalizeVec2([0, 0])).toEqual([0, 0]);
  });

  it('returns [0, 0] for a tiny vector below epsilon threshold', () => {
    expect(normalizeVec2([1e-10, 1e-10])).toEqual([0, 0]);
  });

  it('normalizes a vector already at unit length', () => {
    const result = normalizeVec2([1, 0]);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(0);
  });

  it('handles very large vectors', () => {
    const result = normalizeVec2([1e10, 0]);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(0);
  });

  it('normalizes negative components correctly', () => {
    const result = normalizeVec2([-3, -4]);
    expect(result[0]).toBeCloseTo(-0.6);
    expect(result[1]).toBeCloseTo(-0.8);
  });
});

describe('clamp', () => {
  it('clamps a value below the range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps a value above the range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns lo when value equals lo', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns hi when value equals hi', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('handles lo === hi', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
  });
});

describe('distVec2', () => {
  it('computes the distance between two points', () => {
    expect(distVec2([0, 0], [3, 4])).toBe(5);
  });

  it('returns 0 for the same point', () => {
    expect(distVec2([2, 3], [2, 3])).toBe(0);
  });

  it('is symmetric', () => {
    const a: Vec2 = [1, 2];
    const b: Vec2 = [4, 6];
    expect(distVec2(a, b)).toBeCloseTo(distVec2(b, a));
  });
});

describe('vec3', () => {
  it('constructs a Vec3 from Vec2 and z', () => {
    expect(vec3([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it('handles zero z', () => {
    expect(vec3([5, 6], 0)).toEqual([5, 6, 0]);
  });

  it('handles negative z', () => {
    expect(vec3([1, 2], -0.5)).toEqual([1, 2, -0.5]);
  });
});

describe('sideToApproach', () => {
  it('maps top to N', () => {
    expect(sideToApproach('top')).toBe('N');
  });

  it('maps bottom to S', () => {
    expect(sideToApproach('bottom')).toBe('S');
  });

  it('maps left to W', () => {
    expect(sideToApproach('left')).toBe('W');
  });

  it('maps right to E', () => {
    expect(sideToApproach('right')).toBe('E');
  });
});

describe('DEFAULT_FLOW_CONFIG', () => {
  it('has all required fields with positive values', () => {
    expect(DEFAULT_FLOW_CONFIG.turnRadius).toBeGreaterThan(0);
    expect(DEFAULT_FLOW_CONFIG.faceStub).toBeGreaterThan(0);
    expect(DEFAULT_FLOW_CONFIG.obstaclePadding).toBeGreaterThan(0);
    expect(DEFAULT_FLOW_CONFIG.turnPenalty).toBeGreaterThan(0);
    expect(DEFAULT_FLOW_CONFIG.punchthroughPenalty).toBeGreaterThan(0);
    expect(DEFAULT_FLOW_CONFIG.bundleStrength).toBeGreaterThan(0);
    expect(DEFAULT_FLOW_CONFIG.organicVariation).toBeGreaterThan(0);
  });
});
