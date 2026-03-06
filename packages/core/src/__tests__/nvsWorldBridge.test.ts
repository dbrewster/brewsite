// Tests for the NVS ↔ world-space bridge utilities.
import { describe, it, expect } from 'vitest';
import { nvsToWorldAnalytic, worldToNvsAnalytic, computeWorldDimensions } from '../layout/nvsWorldBridge';

describe('nvsToWorldAnalytic', () => {
  it('maps center [0.5, 0.5] to world origin [0, 0, 0]', () => {
    const result = nvsToWorldAnalytic(0.5, 0.5, 0, 0, 10, 45, 16 / 9, 0);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[2]).toBe(0);
  });

  it('maps top-left [0, 0] to negative-X, positive-Y world', () => {
    const result = nvsToWorldAnalytic(0, 0, 0, 0, 10, 45, 16 / 9, 0);
    expect(result[0]).toBeLessThan(0);      // left → negative world X
    expect(result[1]).toBeGreaterThan(0);   // top → positive world Y
  });

  it('maps bottom-right [1, 1] to positive-X, negative-Y world', () => {
    const result = nvsToWorldAnalytic(1, 1, 0, 0, 10, 45, 16 / 9, 0);
    expect(result[0]).toBeGreaterThan(0);
    expect(result[1]).toBeLessThan(0);
  });

  it('is the exact inverse of worldToNvsAnalytic', () => {
    const nvs = { x: 0.3, y: 0.7 };
    const world = nvsToWorldAnalytic(nvs.x, nvs.y, 0, 0, 12, 45, 16 / 9, 0);
    const backToNvs = worldToNvsAnalytic(world[0], world[1], 0, 0, 12, 45, 16 / 9);
    expect(backToNvs.x).toBeCloseTo(nvs.x, 5);
    expect(backToNvs.y).toBeCloseTo(nvs.y, 5);
  });

  it('applies correct Y-flip (NVS y=0 top → world positive Y)', () => {
    const top = nvsToWorldAnalytic(0.5, 0, 0, 0, 10, 45, 1, 0);
    const bottom = nvsToWorldAnalytic(0.5, 1, 0, 0, 10, 45, 1, 0);
    expect(top[1]).toBeGreaterThan(0);       // top → positive world Y
    expect(bottom[1]).toBeLessThan(0);       // bottom → negative world Y
    expect(top[1]).toBeCloseTo(-bottom[1], 5); // symmetric
  });
});

describe('computeWorldDimensions', () => {
  it('returns correct world height at d=12.07, fov=45', () => {
    const { worldHeight } = computeWorldDimensions(12.07, 45, 1);
    expect(worldHeight).toBeCloseTo(10.0, 1);
  });
});
