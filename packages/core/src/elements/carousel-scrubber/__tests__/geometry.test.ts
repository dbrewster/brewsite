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
  it('front edge y < back edge y at center (x=0)', () => {
    const halfWidth = 5;
    const maxDepth = 8; // e.g., 2 items * 4 zStep
    const bandWidth = 1.5;
    const segments = 32;
    const points = generateParabolicPoints(halfWidth, maxDepth, bandWidth, segments);

    // Front edge center is at index segments/2 (middle of front edge)
    const frontCenter = points[segments / 2];
    // Back edge center is at index segments + 1 + segments/2
    const backCenter = points[segments + 1 + (segments - segments / 2)];

    // At x=0, front y = k*0 - bw/2 = -bw/2, back y = k*0 + bw/2 = +bw/2
    // Front should be less than back (front is camera-side = negative shape Y)
    expect(frontCenter.y).toBeLessThan(backCenter.y);
  });

  it('at edges (x=+-halfWidth), front edge reaches maxDepth with tapered band', () => {
    const halfWidth = 5;
    const maxDepth = 8;
    const bandWidth = 1.5;
    const points = generateParabolicPoints(halfWidth, maxDepth, bandWidth, 32);

    // At edge, band = bandWidth * (0.8 + 0.8) = bandWidth * 1.6
    // Front edge at x=-halfWidth: y = maxDepth - (bandWidth*1.6)/2
    const edgeBand = bandWidth * 1.6;
    const frontLeft = points[0];
    expect(frontLeft.y).toBeCloseTo(maxDepth - edgeBand / 2, 3);

    // At center, band = bandWidth * 0.8
    // Front edge at x=0: y = 0 - (bandWidth*0.8)/2
    const centerBand = bandWidth * 0.8;
    const frontCenter = points[16]; // segments/2
    expect(frontCenter.y).toBeCloseTo(-centerBand / 2, 3);

    // Edges recede more than center
    expect(frontLeft.y).toBeGreaterThan(frontCenter.y);
  });

  it('band width tapers: moderate at center, wider at edges', () => {
    const halfWidth = 5;
    const maxDepth = 8;
    const bandWidth = 1.5;
    const segments = 32;
    const points = generateParabolicPoints(halfWidth, maxDepth, bandWidth, segments);

    // At center (x=0), band = bandWidth * 0.8
    const frontCenter = points[segments / 2];
    const backCenterIdx = (segments + 1) + (segments - segments / 2);
    const backCenter = points[backCenterIdx];
    expect(backCenter.x).toBeCloseTo(frontCenter.x, 5);
    expect(backCenter.y - frontCenter.y).toBeCloseTo(bandWidth * 0.8, 3);

    // At edge (x=halfWidth), band = bandWidth * (0.8 + 0.8) = bandWidth * 1.6
    const frontEdge = points[segments]; // rightmost point of front edge
    const backEdgeIdx = (segments + 1); // leftmost point of back edge (right-to-left, so first = rightmost)
    const backEdge = points[backEdgeIdx];
    expect(backEdge.x).toBeCloseTo(frontEdge.x, 5);
    expect(backEdge.y - frontEdge.y).toBeCloseTo(bandWidth * 1.6, 3);
  });

  it('with maxDepth=0, parabola is flat but band still tapers', () => {
    const halfWidth = 4;
    const bandWidth = 1.0;
    const points = generateParabolicPoints(halfWidth, 0, bandWidth, 16);

    // At center (x=0), band = 0.8 * bandWidth
    const frontCenter = points[8]; // middle of front edge
    expect(frontCenter.y).toBeCloseTo(-bandWidth * 0.8 / 2, 3);

    // At edge (x=halfWidth), band = 1.6 * bandWidth
    const frontEdge = points[16];
    expect(frontEdge.y).toBeCloseTo(-bandWidth * 1.6 / 2, 3);
  });

  it('returns (2 * segments + 2) points total', () => {
    const points = generateParabolicPoints(5, 8, 1.5, 32);
    expect(points).toHaveLength(2 * 32 + 2);
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
