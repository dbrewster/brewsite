// Tests for trayPosition.ts — pure position math with mock coordinate service.

import { describe, it, expect } from 'vitest';
import {
  computeTrayPosition,
  computeTrayWorldWidth,
  computeRingRotation,
  type TrayCoordService,
} from '../trayPosition';

/** Simple linear coordinate service for testing. */
const mockCoords: TrayCoordService = {
  toWorld: (x, y, _z) => [x * 10, -y * 10, 0],
  toWorldSize: (w, h) => [w * 10, h * 10],
  visibleWorldHeight: 10,
};

// -- computeTrayPosition ------------------------------------------------------

describe('computeTrayPosition', () => {
  const viewExtent = { x: 0, y: 0, w: 1, h: 0.5 };

  it('positions bottomY at floorY + gap when floor is far below', () => {
    // Floor at -20 is far below topY (~-5.8), so space > trayDepth.
    // bottomY = floorY + gap = -20 + 0.02 = -19.98.
    const result = computeTrayPosition(viewExtent, 0, false, 0.36, 0.02, mockCoords, -20);
    expect(result.bottomY).toBeCloseTo(-20 + 0.02);
  });

  it('falls back to topY - trayDepth when no floor', () => {
    const result = computeTrayPosition(viewExtent, 0, false, 0.36, 0.02, mockCoords, null);
    // topY = viewBottomWorldY - margin = -5 - 0.8 = -5.8
    // bottomY = topY - trayDepth = -5.8 - 0.36 = -6.16
    expect(result.bottomY).toBeCloseTo(result.topY - result.effectiveDepth);
  });

  it('effectiveDepth is never less than trayDepth', () => {
    // Floor very close to topY — available space is small
    const result = computeTrayPosition(viewExtent, 0, false, 2.0, 0.02, mockCoords, -5.0);
    expect(result.effectiveDepth).toBeGreaterThanOrEqual(2.0);
  });

  it('effectiveDepth stretches to fill available space when floor is far', () => {
    // Floor is far below — available space > trayDepth
    const result = computeTrayPosition(viewExtent, 0, false, 0.36, 0.02, mockCoords, -20);
    // topY ≈ -5.8, bottomY = -20 + 0.02 = -19.98, space = 14.18
    expect(result.effectiveDepth).toBeGreaterThan(0.36);
    expect(result.effectiveDepth).toBeCloseTo(result.topY - result.bottomY);
  });

  it('centerZ is -zStep/2 for ring carousels', () => {
    const result = computeTrayPosition(viewExtent, 4, true, 0.36, 0.02, mockCoords, null);
    expect(result.centerZ).toBeCloseTo(-2);
  });

  it('centerZ is 0 for linear carousels', () => {
    const result = computeTrayPosition(viewExtent, 4, false, 0.36, 0.02, mockCoords, null);
    expect(result.centerZ).toBe(0);
  });

  it('centerZ is 0 for ring carousel with zStep=0', () => {
    const result = computeTrayPosition(viewExtent, 0, true, 0.36, 0.02, mockCoords, null);
    expect(result.centerZ).toBe(0);
  });

  it('topY accounts for the 8% visible height margin', () => {
    const result = computeTrayPosition(viewExtent, 0, false, 0.36, 0.02, mockCoords, null);
    // viewExtent bottom in NVS: x=0.5, y=0.5 → world: (5, -5, 0)
    // topMargin = 10 * 0.08 = 0.8
    // topY = -5 - 0.8 = -5.8
    expect(result.topY).toBeCloseTo(-5.8);
  });
});

// -- computeTrayWorldWidth ----------------------------------------------------

describe('computeTrayWorldWidth', () => {
  it('returns view extent width in world + 10% padding', () => {
    const result = computeTrayWorldWidth(1, 0.5, mockCoords);
    // toWorldSize(1, 0.5) = [10, 5]
    // padding = 10 * 0.05 = 0.5
    // total = 10 + 1 = 11
    expect(result).toBeCloseTo(11);
  });

  it('scales proportionally with view extent width', () => {
    const narrow = computeTrayWorldWidth(0.5, 0.3, mockCoords);
    const wide = computeTrayWorldWidth(1.0, 0.3, mockCoords);
    expect(wide).toBeGreaterThan(narrow);
  });
});

// -- computeRingRotation ------------------------------------------------------

describe('computeRingRotation', () => {
  it('returns 0 for index 0', () => {
    expect(computeRingRotation(0, 5)).toBeCloseTo(0);
  });

  it('returns -pi/2 for 1/4 of the ring', () => {
    expect(computeRingRotation(1, 4)).toBeCloseTo(-Math.PI / 2);
  });

  it('returns -pi for halfway around the ring', () => {
    expect(computeRingRotation(2, 4)).toBeCloseTo(-Math.PI);
  });

  it('returns -2*pi for full rotation', () => {
    expect(computeRingRotation(4, 4)).toBeCloseTo(-Math.PI * 2);
  });

  it('returns 0 when childCount is 0', () => {
    expect(computeRingRotation(0, 0)).toBe(0);
  });
});
