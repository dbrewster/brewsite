import { describe, it, expect } from 'vitest';
import {
  getFacePortAnchor,
  nearestFace,
  resolveFaces,
  routeEdgeCurved,
  routeEdgeStraight,
  routeEdgeOrganic,
  routeEdgeOrthogonal,
  routeEdges,
} from '../edgeRouter';
import type { NodeDimensions } from '../edgeRouter';

describe('nearestFace', () => {
  it('selects bottom when target is below-left at ~39° from horizontal', () => {
    expect(nearestFace([0, -4, 0], [-5, -8, 0])).toBe('bottom');
  });

  it('selects top when target is above-left at ~39°', () => {
    expect(nearestFace([0, -4, 0], [-5, 0, 0])).toBe('top');
  });

  it('selects left when target is directly left', () => {
    expect(nearestFace([0, 0, 0], [-5, 0, 0])).toBe('left');
  });

  it('selects top/bottom for steep diagonals (>45°)', () => {
    expect(nearestFace([0, 0, 0], [-3, -5, 0])).toBe('bottom');
  });
});

describe('routeEdgeCurved — anti-parallel arc fix', () => {
  it('returns 4 points for left→right face connection (anti-parallel)', () => {
    const pts = routeEdgeCurved(
      [0, -4, 0], [4, 2, 0.4] as NodeDimensions, 'left',
      [-5, -8, 0], [4, 2, 0.4] as NodeDimensions, 'right',
    );
    expect(pts).toHaveLength(4);
    const [start, c1, c2, end] = pts;
    const directMidX = (start[0] + end[0]) / 2;
    const directMidY = (start[1] + end[1]) / 2;
    expect(Math.abs(c1[0] - directMidX) + Math.abs(c1[1] - directMidY)).toBeGreaterThan(0.1);
    expect(Math.abs(c2[0] - directMidX) + Math.abs(c2[1] - directMidY)).toBeGreaterThan(0.1);
  });

  it('returns 2 points for convergent faces (bottom→top, anti-parallel)', () => {
    const pts = routeEdgeCurved(
      [0, 2, 0], [4, 2, 0.4] as NodeDimensions, 'bottom',
      [0, -1, 0], [4, 2, 0.4] as NodeDimensions, 'top',
    );
    expect(pts).toHaveLength(2);
  });

  it('returns 4 points for same-side connection (left→left, dot=+1)', () => {
    const pts = routeEdgeCurved(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'left',
      [-8, 0, 0], [4, 2, 0.4] as NodeDimensions, 'left',
    );
    expect(pts).toHaveLength(4);
  });
});

describe('routeEdgeOrthogonal', () => {
  it('routes H→H as Z-shape via midY', () => {
    const pts = routeEdgeOrthogonal(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'right',
      [6, 4, 0], [4, 2, 0.4] as NodeDimensions, 'left',
    );
    expect(pts.length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const dx = Math.abs(pts[i + 1][0] - pts[i][0]);
      const dy = Math.abs(pts[i + 1][1] - pts[i][1]);
      expect(Math.min(dx, dy)).toBeLessThan(0.01);
    }
  });

  it('routes V→V as Z-shape via midX', () => {
    const pts = routeEdgeOrthogonal(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'top',
      [2, 6, 0], [4, 2, 0.4] as NodeDimensions, 'bottom',
    );
    expect(pts.length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const dx = Math.abs(pts[i + 1][0] - pts[i][0]);
      const dy = Math.abs(pts[i + 1][1] - pts[i][1]);
      expect(Math.min(dx, dy)).toBeLessThan(0.01);
    }
  });

  it('falls back to curved when a face is non-orthogonal', () => {
    const pts = routeEdgeOrthogonal(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'front',
      [4, 0, 0], [4, 2, 0.4] as NodeDimensions, 'right',
    );
    expect(pts.length).toBeGreaterThanOrEqual(4);
  });

  it('falls back when destination face is non-orthogonal', () => {
    const pts = routeEdgeOrthogonal(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'left',
      [0, 0, 5], [4, 2, 0.4] as NodeDimensions, 'front',
    );
    expect(pts.length).toBeGreaterThanOrEqual(4);
  });

  it('routes mixed H→V as L-shape', () => {
    const pts = routeEdgeOrthogonal(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'right',
      [4, 4, 0], [4, 2, 0.4] as NodeDimensions, 'top',
    );
    expect(pts.length).toBe(7);
  });
});

describe('resolveFaces', () => {
  const srcPos: [number, number, number] = [0, 0, 0];
  const dstPos: [number, number, number] = [6, 0, 0];
  const size: NodeDimensions = [2, 2, 2];

  it('uses explicit ports when both are provided', () => {
    expect(resolveFaces(srcPos, size, dstPos, size, 'nearest-face', 'left', 'right'))
      .toEqual({ srcFace: 'left', dstFace: 'right' });
  });

  it('uses provided fromPort and nearest face for destination', () => {
    const { srcFace, dstFace } = resolveFaces(srcPos, size, dstPos, size, 'nearest-face', 'top');
    expect(srcFace).toBe('top');
    expect(dstFace).toBe('left');
  });

  it('uses shortest-path landing when requested', () => {
    const { srcFace, dstFace } = resolveFaces(srcPos, size, dstPos, size, 'shortest-path');
    expect(srcFace).toBe('right');
    expect(dstFace).toBe('left');
  });

  it('uses center landing when requested', () => {
    const { srcFace, dstFace } = resolveFaces(srcPos, size, dstPos, size, 'center');
    expect(srcFace).toBe('right');
    expect(dstFace).toBe('left');
  });
});

describe('getFacePortAnchor', () => {
  it('offsets front ports horizontally and vertically when target is off-axis', () => {
    const anchor = getFacePortAnchor(
      [0, 0, 0],
      [4, 2, 2],
      'front',
      0,
      2,
      [10, 5, 0],
    );
    expect(anchor[0]).toBeLessThan(0);
    expect(anchor[1]).toBeGreaterThan(0);
    expect(anchor[2]).toBeCloseTo(1);
  });

  it('returns centered anchor when only one port is available', () => {
    const anchor = getFacePortAnchor(
      [0, 0, 0],
      [4, 2, 2],
      'back',
      0,
      1,
      [-1, -5, 0],
    );
    expect(anchor[0]).toBeCloseTo(0);
    expect(anchor[2]).toBeCloseTo(-1);
  });

  it('places top/bottom anchors using horizontal offsets', () => {
    const top = getFacePortAnchor(
      [0, 0, 0],
      [4, 2, 2],
      'top',
      0,
      3,
      [10, 0, 0],
    );
    const bottom = getFacePortAnchor(
      [0, 0, 0],
      [4, 2, 2],
      'bottom',
      2,
      3,
      [-10, 0, 0],
    );
    expect(top[0]).not.toBe(0);
    expect(bottom[0]).not.toBe(0);
  });

  it('falls back to face center for unknown face values', () => {
    const anchor = getFacePortAnchor(
      [1, 2, 3],
      [4, 2, 2],
      'unknown' as unknown as 'front',
      0,
      1,
      [0, 0, 0],
    );
    expect(anchor).toBeUndefined();
  });
});

describe('routeEdgeOrganic', () => {
  it('returns base points when curved path collapses to a line', () => {
    const pts = routeEdgeOrganic(
      [0, 0, 0], [2, 2, 2], 'right',
      [4, 0, 0], [2, 2, 2], 'left',
      'edge-line',
    );
    expect(pts).toHaveLength(2);
  });

  it('inserts an organic mid-point for curved paths', () => {
    const pts = routeEdgeOrganic(
      [0, 0, 0], [2, 2, 2], 'right',
      [8, 4, 0], [2, 2, 2], 'left',
      'edge-curve',
    );
    expect(pts).toHaveLength(5);
  });
});

describe('routeEdgeStraight', () => {
  it('returns start/end using face normals and anchors', () => {
    const pts = routeEdgeStraight(
      [0, 0, 0], [4, 2, 2], 'right',
      [4, 0, 0], [4, 2, 2], 'left',
      [2, 1, 0],
      [2, -1, 0],
    );
    expect(pts).toHaveLength(2);
    expect(pts[0][0]).toBeCloseTo(2.1, 2);
    expect(pts[1][0]).toBeCloseTo(1.9, 2);
  });
});

describe('routeEdges', () => {
  const positions = new Map<string, [number, number, number]>([
    ['a', [0, 0, 0]],
    ['b', [6, 2, 0]],
    ['c', [6, -2, 0]],
  ]);
  const sizes = new Map<string, NodeDimensions>([
    ['a', [10, 4, 1]],
    ['b', [4, 2, 1]],
    ['c', [4, 2, 1]],
  ]);

  it('returns empty control points for self-loops', () => {
    const result = routeEdges(
      [{ id: 'loop', from: 'a', to: 'a' }],
      positions,
      sizes,
    );
    expect(result.get('loop')).toEqual([]);
  });

  it('supports center landing for straight routing', () => {
    const result = routeEdges(
      [{ id: 'center', from: 'a', to: 'b', routing: 'straight' }],
      positions,
      sizes,
      'straight',
      'center',
    );
    expect(result.get('center')?.length).toBe(2);
  });

  it('assigns distinct port anchors for multiple edges on same face', () => {
    const result = routeEdges(
      [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'ac', from: 'a', to: 'c' },
      ],
      positions,
      sizes,
    );
    const ab = result.get('ab') ?? [];
    const ac = result.get('ac') ?? [];
    expect(ab[0]?.[1]).not.toBe(ac[0]?.[1]);
  });

  it('uses center landing to produce stubbed curved edges', () => {
    const result = routeEdges(
      [{ id: 'center-curved', from: 'a', to: 'b', routing: 'curved' }],
      positions,
      sizes,
      'curved',
      'center',
    );
    expect(result.get('center-curved')?.length).toBe(4);
  });

  it('supports explicit ports and skips anchor generation', () => {
    const result = routeEdges(
      [{
        id: 'ported',
        from: 'a',
        to: 'b',
        fromPort: 'front',
        toPort: 'back',
        routing: 'straight',
      }],
      positions,
      sizes,
      'straight',
      'nearest-face',
    );
    expect(result.get('ported')?.length).toBe(2);
  });

  it('handles front/back face port counts with narrow and wide nodes', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['wide', [0, 0, 0]],
      ['w1', [5, 0, 6]],
      ['w2', [-5, 0, 6]],
      ['narrow', [0, 0, 0]],
      ['n1', [5, 0, 6]],
      ['n2', [-5, 0, 6]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['wide', [1, 2, 1]],
      ['w1', [1, 2, 1]],
      ['w2', [1, 2, 1]],
      ['narrow', [0.5, 2, 1]],
      ['n1', [1, 2, 1]],
      ['n2', [1, 2, 1]],
    ]);
    const result = routeEdges(
      [
        { id: 'wide-a', from: 'wide', to: 'w1' },
        { id: 'wide-b', from: 'wide', to: 'w2' },
        { id: 'narrow-a', from: 'narrow', to: 'n1' },
        { id: 'narrow-b', from: 'narrow', to: 'n2' },
      ],
      localPositions,
      localSizes,
    );
    const wideA = result.get('wide-a') ?? [];
    const wideB = result.get('wide-b') ?? [];
    const narrowA = result.get('narrow-a') ?? [];
    const narrowB = result.get('narrow-b') ?? [];
    expect(wideA[0]?.[0]).not.toBe(wideB[0]?.[0]);
    expect(narrowA[0]?.[0]).toBe(narrowB[0]?.[0]);
  });

  it('routes with explicit ports using straight routing', () => {
    const result = routeEdges(
      [{
        id: 'ported-straight',
        from: 'a',
        to: 'b',
        fromPort: 'left',
        toPort: 'right',
        routing: 'straight',
      }],
      positions,
      sizes,
    );
    expect(result.get('ported-straight')?.length).toBe(2);
  });

  it('falls back from side faces when nearest-face route intersects an obstacle', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['src', [0, 0, 0]],
      ['dst', [7, -3, 0]],
      ['blocker', [2.6, 0, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['src', [4, 2, 1]],
      ['dst', [6, 2, 1]],
      ['blocker', [1, 2, 1]],
    ]);

    const result = routeEdges(
      [{ id: 'e', from: 'src', to: 'dst', routing: 'straight' }],
      localPositions,
      localSizes,
      'straight',
      'nearest-face',
    );

    const pts = result.get('e') ?? [];
    expect(pts.length).toBe(2);
    // Without fallback nearest-face starts from src right face (x≈+2.1), which
    // intersects the blocker. Fallback should switch to a non-right source face.
    expect(pts[0]?.[0]).toBeLessThan(2.0);
  });
});
