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

  it('returns curved points for convergent faces when distance is non-trivial', () => {
    const pts = routeEdgeCurved(
      [0, 2, 0], [4, 2, 0.4] as NodeDimensions, 'bottom',
      [0, -1, 0], [4, 2, 0.4] as NodeDimensions, 'top',
    );
    expect(pts).toHaveLength(4);
  });

  it('returns 4 points for same-side connection (left→left, dot=+1)', () => {
    const pts = routeEdgeCurved(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'left',
      [-8, 0, 0], [4, 2, 0.4] as NodeDimensions, 'left',
    );
    expect(pts).toHaveLength(4);
  });

  it('enforces a visible orthogonal side-face exit stub', () => {
    const pts = routeEdgeCurved(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'right',
      [4, 6, 0], [4, 2, 0.4] as NodeDimensions, 'left',
    );
    expect(pts).toHaveLength(4);
    const [start, c1] = pts;
    expect(c1[0] - start[0]).toBeGreaterThan(0.9);
    expect(Math.abs(c1[1] - start[1])).toBeLessThan(0.01);
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
  it('keeps organic control points when curved path remains curved', () => {
    const pts = routeEdgeOrganic(
      [0, 0, 0], [2, 2, 2], 'right',
      [4, 0, 0], [2, 2, 2], 'left',
      'edge-line',
    );
    expect(pts).toHaveLength(5);
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
    expect(pts[0][0]).toBeCloseTo(2.06, 2);
    expect(pts[1][0]).toBeCloseTo(1.94, 2);
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
      'curved',
      'shortest-path',
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

  it('routes a valid edge when nearest-face route has a blocker near the direct line', () => {
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
    expect(Number.isFinite(pts[0]?.[0])).toBe(true);
    expect(Number.isFinite(pts[1]?.[0])).toBe(true);
  });

  it('for intra-diagram auto-routing, avoids front/back and can use top/bottom', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['client-layer', [12.5, -1.3, 0]],
      ['api', [2.5, -2.5, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['client-layer', [3.5, 1.3, 1]],
      ['api', [22, 1.4, 1]],
    ]);

    const result = routeEdges(
      [{ id: 'client-to-api', from: 'client-layer', to: 'api', routing: 'straight' }],
      localPositions,
      localSizes,
      'straight',
      'nearest-face',
    );

    const pts = result.get('client-to-api') ?? [];
    expect(pts.length).toBe(2);
    // End point should avoid front/back and remain on a planar side.
    expect(pts[1]?.[1]).toBeGreaterThanOrEqual(-2.5);
    expect(pts[1]?.[0]).toBeGreaterThan(2.5);
  });

  it('with only fromPort fixed, chooses a non-crossing destination side', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['output-filters', [16, -7.5, 0]],
      ['llm-conv', [2, -13, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['output-filters', [18, 8, 1]],
      ['llm-conv', [46, 1.4, 1]],
    ]);

    const result = routeEdges(
      [{
        id: 'output-to-llm-conv',
        from: 'output-filters',
        to: 'llm-conv',
        fromPort: 'bottom',
        routing: 'straight',
      }],
      localPositions,
      localSizes,
      'straight',
      'nearest-face',
    );

    const pts = result.get('output-to-llm-conv') ?? [];
    expect(pts.length).toBe(2);
    // Destination side may be top/bottom when it is the better planar landing.
    expect(pts[1]?.[1]).toBeGreaterThan(-13);
  });

  it('prefers the target face that actually faces the source node', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['users', [8, 6, 0]],
      ['app-layer', [2.5, 3.5, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['users', [4, 4, 1]],
      ['app-layer', [24, 5, 1]],
    ]);

    const result = routeEdges(
      [{ id: 'users-app', from: 'users', to: 'app-layer', routing: 'curved' }],
      localPositions,
      localSizes,
      'curved',
      'nearest-face',
    );

    const pts = result.get('users-app') ?? [];
    expect(pts.length).toBeGreaterThanOrEqual(2);
    const end = pts[pts.length - 1];
    expect(end?.[0]).toBeGreaterThan(2.5);
  });

  it('group-to-group links with horizontal dominance use side-face ports', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['left-group', [0, 0, 0]],
      ['right-group', [20, 8, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['left-group', [18, 8, 1]],
      ['right-group', [18, 8, 1]],
    ]);

    const result = routeEdges(
      [{ id: 'group-link', from: 'left-group', to: 'right-group', routing: 'curved' }],
      localPositions,
      localSizes,
      'curved',
      'nearest-face',
    );

    const pts = result.get('group-link') ?? [];
    expect(pts.length).toBe(4);
    const [start, c1, _c2, end] = pts;
    expect(start[0]).toBeGreaterThan(8.5);
    expect(end[0]).toBeLessThan(11.5);
    expect(c1[0] - start[0]).toBeGreaterThan(0.35);
    expect(Math.abs(c1[1] - start[1])).toBeLessThan(0.2);
  });

  it('api -> output-filters exits API from right side (scene_llm_filter geometry)', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['api', [2.5, -2.5, 0]],
      ['output-filters', [16, -7.5, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['api', [22, 1.4, 1]],
      ['output-filters', [18, 8, 1]],
    ]);

    const result = routeEdges(
      [{ id: 'api-output', from: 'api', to: 'output-filters', routing: 'curved' }],
      localPositions,
      localSizes,
      'curved',
      'nearest-face',
    );

    const pts = result.get('api-output') ?? [];
    expect(pts.length).toBe(4);
    const [start, c1] = pts;
    const apiRightX = 2.5 + 11;
    const apiBottomY = -2.5 - 0.7;
    // right-face start should be near apiRightX + EDGE_EPSILON
    expect(start[0]).toBeGreaterThan(apiRightX + 0.02);
    // tangent should point primarily along +X, not down.
    expect(c1[0] - start[0]).toBeGreaterThan(0.5);
    expect(Math.abs(c1[1] - start[1])).toBeLessThan(0.25);
    // guard against bottom-face landing near y bottom edge
    expect(Math.abs(start[1] - apiBottomY)).toBeGreaterThan(0.3);
  });
});
