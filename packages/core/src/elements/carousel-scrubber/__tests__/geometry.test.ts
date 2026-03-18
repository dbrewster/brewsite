// Tests for geometry.ts — pure shape generators and geometry math.

import { describe, it, expect } from 'vitest';
import {
  resolveTrayShapeKind,
  generateEllipsePoints,
  generateRoundedRectPoints,
  generateParabolicPoints,
  computeParabolicBandWidth,
  computeLinearMaxDepth,
  computeTrayZDepth,
  computeBevelRadius,
  computeGeometryKey,
  type TrayGeometryParams,
} from '../geometry';

// -- resolveTrayShapeKind -----------------------------------------------------

describe('resolveTrayShapeKind', () => {
  it('returns ellipse for ring carousels', () => {
    expect(resolveTrayShapeKind(true, 2)).toBe('ellipse');
  });

  it('returns ellipse for ring carousels even with zStep=0', () => {
    expect(resolveTrayShapeKind(true, 0)).toBe('ellipse');
  });

  it('returns parabolic for linear carousels with positive zStep', () => {
    expect(resolveTrayShapeKind(false, 1.5)).toBe('parabolic');
  });

  it('returns roundedRect for flat linear carousels (zStep=0)', () => {
    expect(resolveTrayShapeKind(false, 0)).toBe('roundedRect');
  });
});

// -- generateEllipsePoints ----------------------------------------------------

describe('generateEllipsePoints', () => {
  it('returns segments+1 points (closed loop)', () => {
    const points = generateEllipsePoints(5, 3, 32);
    expect(points).toHaveLength(33);
  });

  it('starts at (semiX, 0)', () => {
    const points = generateEllipsePoints(4, 2);
    expect(points[0].x).toBeCloseTo(4);
    expect(points[0].y).toBeCloseTo(0);
  });

  it('closes the loop — last point matches first', () => {
    const points = generateEllipsePoints(4, 2, 64);
    expect(points[points.length - 1].x).toBeCloseTo(points[0].x, 5);
    expect(points[points.length - 1].y).toBeCloseTo(points[0].y, 5);
  });

  it('all points lie within semi-axis bounds', () => {
    const semiX = 5;
    const semiY = 3;
    const points = generateEllipsePoints(semiX, semiY);
    for (const p of points) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(semiX + 0.001);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(semiY + 0.001);
    }
  });

  it('uses default 64 segments when not specified', () => {
    const points = generateEllipsePoints(3, 2);
    expect(points).toHaveLength(65);
  });
});

// -- generateRoundedRectPoints ------------------------------------------------

describe('generateRoundedRectPoints', () => {
  it('returns points within [-halfW, halfW] x [-halfZ, halfZ]', () => {
    const halfW = 4;
    const halfZ = 2;
    const points = generateRoundedRectPoints(halfW, halfZ);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(-halfW - 0.001);
      expect(p.x).toBeLessThanOrEqual(halfW + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(-halfZ - 0.001);
      expect(p.y).toBeLessThanOrEqual(halfZ + 0.001);
    }
  });

  it('closes the path — last point matches first', () => {
    const points = generateRoundedRectPoints(3, 1.5);
    expect(points[points.length - 1].x).toBeCloseTo(points[0].x, 5);
    expect(points[points.length - 1].y).toBeCloseTo(points[0].y, 5);
  });

  it('returns more than 4 points (corners are rounded)', () => {
    const points = generateRoundedRectPoints(3, 1.5);
    // 8 boundary points + 1 closing point = 9
    expect(points.length).toBeGreaterThan(4);
  });
});

// -- computeLinearMaxDepth -----------------------------------------------------

describe('computeLinearMaxDepth', () => {
  it('returns 0 for single item', () => {
    expect(computeLinearMaxDepth(1, 8)).toBe(0);
  });

  it('returns 0 for zStep=0', () => {
    expect(computeLinearMaxDepth(5, 0)).toBe(0);
  });

  it('caps at zStep * 2.5 for large carousels', () => {
    // 5 items, zStep=8: raw = ceil(4/2)*8 = 16, cap = 8*2.5 = 20 → 16 (uncapped)
    expect(computeLinearMaxDepth(5, 8)).toBe(16);
  });

  it('caps when raw exceeds 2.5 * zStep', () => {
    // 10 items, zStep=4: raw = ceil(9/2)*4 = 20, cap = 4*2.5 = 10 → 10 (capped)
    expect(computeLinearMaxDepth(10, 4)).toBe(10);
  });

  it('returns uncapped for small carousels', () => {
    // 3 items, zStep=10: raw = ceil(2/2)*10 = 10, cap = 10*2.5 = 25 → 10 (uncapped)
    expect(computeLinearMaxDepth(3, 10)).toBe(10);
  });

  it('returns zStep for 2 items', () => {
    // 2 items: raw = ceil(1/2)*5 = 5, cap = 5*2.5 = 12.5 → 5
    expect(computeLinearMaxDepth(2, 5)).toBe(5);
  });
});

// -- generateParabolicPoints --------------------------------------------------

describe('generateParabolicPoints', () => {
  // Layout: front edge (segments+1) + 1 right corner +
  //         back edge (segments+1) + closing point
  // Total: 2*segments + 4

  /** Index of the right corner point (between front edge end and back edge start). */
  const rightCornerIdx = (segments: number): number => segments + 1;
  /** Index of the first back edge point (right-to-left). */
  const backEdgeStart = (segments: number): number => segments + 2;

  it('front edge uses cubic curve, back edge is flat at max depth', () => {
    const halfWidth = 5;
    const maxDepth = 8;
    const bandWidth = 1.5;
    const frontOffset = bandWidth * 0.5;
    const segments = 32;
    const points = generateParabolicPoints(halfWidth, maxDepth, bandWidth, segments);

    // Front center (x=0): y = 0^3 * maxDepth - frontOffset = -frontOffset
    const frontCenter = points[segments / 2];
    expect(frontCenter.y).toBeCloseTo(-frontOffset, 3);

    // Back edge: flat at maxDepth + frontOffset
    const backStart = backEdgeStart(segments);
    const backCenter = points[backStart + (segments - segments / 2)];
    expect(backCenter.y).toBeCloseTo(maxDepth + frontOffset, 3);

    // Front is closer to camera than back — shape is filled
    expect(frontCenter.y).toBeLessThan(backCenter.y);
  });

  it('front edge is cubic (|x|³) — flatter than x² but rounder than x⁴', () => {
    const halfWidth = 5;
    const maxDepth = 8;
    const bandWidth = 1.5;
    const frontOffset = bandWidth * 0.5;
    const segments = 32;
    const points = generateParabolicPoints(halfWidth, maxDepth, bandWidth, segments);

    // At x=hw/2 (quarter width), cubic = (0.5)^3 = 0.125
    // vs parabola (0.5)^2 = 0.25 — cubic is half as deep at the same x
    const quarterIdx = segments * 3 / 4; // 3/4 of the way from -hw to +hw = hw/2
    const quarterPt = points[quarterIdx];
    const expectedY = maxDepth * Math.pow(0.5, 3) - frontOffset;
    expect(quarterPt.y).toBeCloseTo(expectedY, 3);
  });

  it('back edge is flat — all back edge points have the same y', () => {
    const halfWidth = 5;
    const maxDepth = 8;
    const bandWidth = 1.5;
    const segments = 32;
    const points = generateParabolicPoints(halfWidth, maxDepth, bandWidth, segments);

    const backStart = backEdgeStart(segments);
    const backY = points[backStart].y;
    for (let i = 0; i <= segments; i++) {
      expect(points[backStart + i].y).toBeCloseTo(backY, 5);
    }
  });

  it('no outward nubs — right side is a straight vertical at x=halfWidth', () => {
    const halfWidth = 5;
    const maxDepth = 8;
    const bandWidth = 1.5;
    const segments = 32;
    const points = generateParabolicPoints(halfWidth, maxDepth, bandWidth, segments);

    // Front edge last point is at x=halfWidth
    expect(points[segments].x).toBeCloseTo(halfWidth, 5);
    // Right corner point is also at x=halfWidth
    expect(points[rightCornerIdx(segments)].x).toBeCloseTo(halfWidth, 5);
    // No points exceed halfWidth in x
    for (const p of points) {
      expect(p.x).toBeLessThanOrEqual(halfWidth + 0.001);
      expect(p.x).toBeGreaterThanOrEqual(-halfWidth - 0.001);
    }
  });

  it('at center (x=0), shape is deep — closed in the middle', () => {
    const halfWidth = 5;
    const maxDepth = 8;
    const bandWidth = 1.5;
    const frontOffset = bandWidth * 0.5;
    const segments = 32;
    const points = generateParabolicPoints(halfWidth, maxDepth, bandWidth, segments);

    const frontCenter = points[segments / 2];
    const backCenter = points[backEdgeStart(segments) + (segments - segments / 2)];
    const centerGap = backCenter.y - frontCenter.y;
    // Center gap = (maxDepth + frontOffset) - (-frontOffset) = maxDepth + 2*frontOffset
    expect(centerGap).toBeCloseTo(maxDepth + 2 * frontOffset, 3);
  });

  it('with maxDepth=0, creates a thin flat platform', () => {
    const halfWidth = 4;
    const bandWidth = 1.0;
    const frontOffset = bandWidth * 0.5;
    const points = generateParabolicPoints(halfWidth, 0, bandWidth, 16);

    const frontCenter = points[8];
    expect(frontCenter.y).toBeCloseTo(-frontOffset, 3);

    const backStart = backEdgeStart(16);
    expect(points[backStart].y).toBeCloseTo(frontOffset, 3);
  });

  it('returns 2*segments + 4 points total (no cap segments)', () => {
    const segments = 32;
    const points = generateParabolicPoints(5, 8, 1.5, segments);
    // front (33) + right corner (1) + back (33) + close (1) = 68
    expect(points).toHaveLength(2 * segments + 4);
  });

  it('closes the shape — first point matches last point', () => {
    const points = generateParabolicPoints(5, 8, 1.5, 32);
    const first = points[0];
    const last = points[points.length - 1];
    expect(last.x).toBeCloseTo(first.x, 5);
    expect(last.y).toBeCloseTo(first.y, 5);
  });
});

// -- computeParabolicBandWidth ------------------------------------------------

describe('computeParabolicBandWidth', () => {
  it('returns zStep * 0.25 when it is the maximum', () => {
    // zStep=20, worldWidth=1 → terms: 5, 0.1, 1.0
    expect(computeParabolicBandWidth(20, 1)).toBe(5);
  });

  it('returns worldWidth * 0.10 when it is the maximum', () => {
    // zStep=1, worldWidth=40 → terms: 0.25, 4, 1.0
    expect(computeParabolicBandWidth(1, 40)).toBe(4);
  });

  it('returns 1.0 floor when other terms are smaller', () => {
    // zStep=1, worldWidth=1 → terms: 0.25, 0.1, 1.0
    expect(computeParabolicBandWidth(1, 1)).toBe(1.0);
  });
});

// -- computeTrayZDepth --------------------------------------------------------

describe('computeTrayZDepth', () => {
  it('ring carousel returns zStep * 1.15', () => {
    const result = computeTrayZDepth(true, 4, 10, 5);
    expect(result).toBeCloseTo(4 + 4 * 0.15);
  });

  it('linear with zStep returns maxDepth + bandWidth', () => {
    const worldWidth = 10;
    const zStep = 2;
    const childCount = 5;
    // maxDepth = ceil((5-1)/2) * 2 = 4
    const expectedMaxDepth = computeLinearMaxDepth(childCount, zStep);
    const expectedBandWidth = computeParabolicBandWidth(zStep, worldWidth);
    expect(computeTrayZDepth(false, zStep, worldWidth, childCount)).toBeCloseTo(expectedMaxDepth + expectedBandWidth);
  });

  it('flat linear returns max(worldWidth * 0.25, 2.0)', () => {
    expect(computeTrayZDepth(false, 0, 12, 5)).toBe(3); // 12 * 0.25 = 3
    expect(computeTrayZDepth(false, 0, 4, 5)).toBe(2.0); // 4 * 0.25 = 1 < 2
  });

  it('ring with zStep=0 falls to flat branch', () => {
    expect(computeTrayZDepth(true, 0, 10, 5)).toBe(Math.max(10 * 0.25, 2.0));
  });
});

// -- computeBevelRadius -------------------------------------------------------

describe('computeBevelRadius', () => {
  it('returns trayDepth * 0.25 when small', () => {
    expect(computeBevelRadius(0.1)).toBeCloseTo(0.025);
  });

  it('clamps to 0.06 for large tray depths', () => {
    expect(computeBevelRadius(1.0)).toBe(0.06);
  });

  it('returns 0.06 when trayDepth * 0.25 equals 0.06', () => {
    expect(computeBevelRadius(0.24)).toBe(0.06);
  });
});

// -- computeGeometryKey -------------------------------------------------------

describe('computeGeometryKey', () => {
  const baseParams: TrayGeometryParams = {
    shapeKind: 'ellipse',
    worldWidth: 10,
    zDepth: 5,
    trayDepth: 0.36,
    zStep: 2,
    childCount: 5,
    bevelRadius: 0.06,
    bevelSegments: 5,
  };

  it('same params produce same key', () => {
    expect(computeGeometryKey(baseParams)).toBe(computeGeometryKey({ ...baseParams }));
  });

  it('different shapeKind produces different key', () => {
    expect(computeGeometryKey(baseParams)).not.toBe(
      computeGeometryKey({ ...baseParams, shapeKind: 'parabolic' }),
    );
  });

  it('different worldWidth produces different key', () => {
    expect(computeGeometryKey(baseParams)).not.toBe(
      computeGeometryKey({ ...baseParams, worldWidth: 12 }),
    );
  });

  it('different trayDepth produces different key', () => {
    expect(computeGeometryKey(baseParams)).not.toBe(
      computeGeometryKey({ ...baseParams, trayDepth: 0.5 }),
    );
  });

  it('different zStep produces different key', () => {
    expect(computeGeometryKey(baseParams)).not.toBe(
      computeGeometryKey({ ...baseParams, zStep: 3 }),
    );
  });
});
