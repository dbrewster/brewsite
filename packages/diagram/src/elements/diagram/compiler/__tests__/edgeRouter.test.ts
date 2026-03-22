import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FLOW_ROUTING_CONFIG,
  getFacePortAnchor,
  nearestFace,
  resolveFaces,
  routeEdges,
} from '../edgeRouter';
import type { NodeDimensions } from '../edgeRouter';

const routePoints = (
  result: ReturnType<typeof routeEdges>,
  id: string,
): ReadonlyArray<readonly [number, number, number]> => result.get(id)?.controlPoints ?? [];

const routePath = (
  result: ReturnType<typeof routeEdges>,
  id: string,
) => result.get(id)?.path;

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

  it('places left/right anchors using vertical offsets', () => {
    const left = getFacePortAnchor(
      [0, 0, 0],
      [4, 2, 2],
      'left',
      0,
      3,
      [0, 10, 0],
    );
    const right = getFacePortAnchor(
      [0, 0, 0],
      [4, 2, 2],
      'right',
      2,
      3,
      [0, -10, 0],
    );
    expect(left[0]).toBeCloseTo(-2); // x - w/2
    expect(left[1]).not.toBe(0);
    expect(right[0]).toBeCloseTo(2); // x + w/2
    expect(right[1]).not.toBe(0);
  });
});


describe('routeEdges', () => {
  // Positions are in Y-down NVS space (routeEdges applies Y-mirror internally).
  const positions = new Map<string, [number, number, number]>([
    ['a', [0, 0, 0]],
    ['b', [6, -2, 0]],
    ['c', [6, 2, 0]],
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
    expect(routePoints(result, 'loop')).toEqual([]);
  });

  it('supports center landing for straight routing', () => {
    const result = routeEdges(
      [{ id: 'center', from: 'a', to: 'b', routing: 'straight' }],
      positions,
      sizes,
      'straight',
      'center',
    );
    expect(routePoints(result, 'center')).toHaveLength(2);
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
    const ab = routePoints(result, 'ab');
    const ac = routePoints(result, 'ac');
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
    expect(routePoints(result, 'center-curved')).toHaveLength(4);
  });

  it('supports explicit ports and skips anchor generation', () => {
    const result = routeEdges(
      [{
        id: 'ported',
        from: 'a',
        to: 'b',
        fromPort: 'right',
        toPort: 'left',
        routing: 'straight',
      }],
      positions,
      sizes,
      'straight',
      'nearest-face',
    );
    expect(routePoints(result, 'ported')).toHaveLength(2);
  });

  it('handles port counts with narrow and wide nodes', () => {
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
    const wideA = routePoints(result, 'wide-a');
    const wideB = routePoints(result, 'wide-b');
    const narrowA = routePoints(result, 'narrow-a');
    const narrowB = routePoints(result, 'narrow-b');
    expect(wideA[0]?.[0]).not.toBe(wideB[0]?.[0]);
    // With MIN_PORT_PITCH=0.05, narrow nodes (width 0.5) can now fit multiple ports on side faces,
    // so both narrow edges exit the node (they may use the same or different faces).
    expect(narrowA.length).toBeGreaterThan(0);
    expect(narrowB.length).toBeGreaterThan(0);
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
    expect(routePoints(result, 'ported-straight')).toHaveLength(2);
  });

  it('routes a valid edge when nearest-face route has a blocker near the direct line', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['src', [0, 0, 0]],
      ['dst', [7, 3, 0]],
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

    const pts = routePoints(result, 'e');
    expect(pts.length).toBe(2);
    expect(Number.isFinite(pts[0]?.[0])).toBe(true);
    expect(Number.isFinite(pts[1]?.[0])).toBe(true);
  });

  it('for intra-diagram auto-routing, avoids front/back and can use top/bottom', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['client-layer', [12.5, 1.3, 0]],
      ['api', [2.5, 2.5, 0]],
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

    const pts = routePoints(result, 'client-to-api');
    expect(pts.length).toBe(2);
    // End point should avoid front/back and remain on a planar side.
    expect(pts[1]?.[1]).toBeGreaterThanOrEqual(-2.5);
    expect(pts[1]?.[0]).toBeGreaterThanOrEqual(2.5);
  });

  it('keeps flow exits face-normal before turning toward the target', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['src', [0, 0, 0]],
      ['dst', [-3, 8, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['src', [4, 2, 1]],
      ['dst', [6, 3, 1]],
    ]);

    const result = routeEdges(
      [{ id: 'vertical-flow', from: 'src', to: 'dst', routing: 'flow' }],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    const pts = routePoints(result, 'vertical-flow');
    expect(pts.length).toBeGreaterThanOrEqual(2);
    // The first two points should be approximately vertical (face-normal exit).
    expect(Math.abs((pts[1]?.[0] ?? 0) - (pts[0]?.[0] ?? 0))).toBeLessThan(0.02);
    expect((pts[1]?.[1] ?? 0)).toBeLessThan(pts[0]?.[1] ?? 0);
  });

  it('keeps member-to-member flow routes clean inside an enclosing group', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['group', [0, 0, 0]],
      ['db', [0, -6, 0]],
      ['table', [0, 0, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['group', [12, 12, 1]],
      ['db', [4, 2, 1]],
      ['table', [5, 2, 1]],
    ]);

    const result = routeEdges(
      [{ id: 'within-group', from: 'db', to: 'table', routing: 'flow' }],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    const pts = routePoints(result, 'within-group');
    expect(pts.length).toBeGreaterThanOrEqual(4);
    expect(routePath(result, 'within-group')?.punctures).toEqual([]);
  });

  it('bundles downward fan-out from a top hub through a shared bottom trunk in flow mode', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['swarm', [0, -10, 0]],
      ['core-storage', [-8, 0, 0]],
      ['coordination', [8, 0, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['swarm', [10, 2.5, 1]],
      ['core-storage', [7, 6, 1]],
      ['coordination', [7, 6, 1]],
    ]);

    const result = routeEdges(
      [
        { id: 'swarm-core', from: 'swarm', to: 'core-storage', routing: 'flow' },
        { id: 'swarm-coordination', from: 'swarm', to: 'coordination', routing: 'flow' },
      ],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    expect(routePath(result, 'swarm-core')?.startTangent).toEqual([0, -1, 0]);
    expect(routePath(result, 'swarm-coordination')?.startTangent).toEqual([0, -1, 0]);
    expect(routePath(result, 'swarm-core')?.endTangent?.[1]).toBeCloseTo(-1);
    expect(routePath(result, 'swarm-coordination')?.endTangent?.[1]).toBeCloseTo(-1);
    expect(Math.abs(routePoints(result, 'swarm-core')[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(Math.abs(routePoints(result, 'swarm-coordination')[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(routePoints(result, 'swarm-core').at(-1)?.[0] ?? 0).toBeLessThan(0);
    expect(routePoints(result, 'swarm-coordination').at(-1)?.[0] ?? 0).toBeGreaterThan(0);
  });

  it('uses a shared vertical trunk for symmetric multi-row fan-out', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['swarm', [0, -10, 0]],
      ['core-storage', [-8, 0, 0]],
      ['coordination', [8, 0, 0]],
      ['intelligence', [-8, 12, 0]],
      ['recovery', [8, 12, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['swarm', [10, 2.5, 1]],
      ['core-storage', [7, 10, 1]],
      ['coordination', [7, 10, 1]],
      ['intelligence', [7, 4, 1]],
      ['recovery', [7, 4, 1]],
    ]);

    const result = routeEdges(
      [
        { id: 'swarm-core', from: 'swarm', to: 'core-storage', routing: 'flow' },
        { id: 'swarm-coordination', from: 'swarm', to: 'coordination', routing: 'flow' },
        { id: 'swarm-intelligence', from: 'swarm', to: 'intelligence', routing: 'flow' },
        { id: 'swarm-recovery', from: 'swarm', to: 'recovery', routing: 'flow' },
      ],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    expect(routePath(result, 'swarm-core')?.startTangent).toEqual([0, -1, 0]);
    expect(routePath(result, 'swarm-coordination')?.startTangent).toEqual([0, -1, 0]);
    expect(routePath(result, 'swarm-core')?.endTangent?.[1]).toBeCloseTo(-1);
    expect(routePath(result, 'swarm-coordination')?.endTangent?.[1]).toBeCloseTo(-1);
    expect(Math.abs(routePoints(result, 'swarm-core')[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(Math.abs(routePoints(result, 'swarm-coordination')[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(routePoints(result, 'swarm-core').at(-1)?.[0] ?? 0).toBeLessThan(0);
    expect(routePoints(result, 'swarm-coordination').at(-1)?.[0] ?? 0).toBeGreaterThan(0);
    expect(routePath(result, 'swarm-intelligence')?.startTangent?.[1]).toBeCloseTo(-1);
    expect(routePath(result, 'swarm-recovery')?.startTangent?.[1]).toBeCloseTo(-1);
  });

  it('distributes inferred flow anchors on the same face instead of collapsing to one center point', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['source', [0, 0, 0]],
      ['upper-right', [10, -3, 0]],
      ['lower-right', [10, 3, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['source', [4, 6, 1]],
      ['upper-right', [4, 2, 1]],
      ['lower-right', [4, 2, 1]],
    ]);

    const result = routeEdges(
      [
        { id: 'to-upper', from: 'source', to: 'upper-right', routing: 'flow' },
        { id: 'to-lower', from: 'source', to: 'lower-right', routing: 'flow' },
      ],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    const upper = routePoints(result, 'to-upper');
    const lower = routePoints(result, 'to-lower');
    expect(upper[0]?.[0]).toBeCloseTo(2);
    expect(lower[0]?.[0]).toBeCloseTo(2);
    expect(upper[0]?.[1]).not.toBe(lower[0]?.[1]);
  });

  it('keeps vertically stacked flow edges centered instead of drifting to a side slot', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['top', [0, 0, 0]],
      ['bottom', [0, 8, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['top', [10, 2.8, 1]],
      ['bottom', [10, 2.8, 1]],
    ]);

    const result = routeEdges(
      [{ id: 'vertical-center', from: 'top', to: 'bottom', routing: 'flow' }],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    const pts = routePoints(result, 'vertical-center');
    expect(routePath(result, 'vertical-center')?.startTangent?.[1]).toBeCloseTo(-1);
    expect(routePath(result, 'vertical-center')?.endTangent?.[1]).toBeCloseTo(-1);
    expect(Math.abs(pts[0]?.[0] ?? 0)).toBeLessThan(0.05);
    expect(Math.abs(pts.at(-1)?.[0] ?? 0)).toBeLessThan(0.05);
  });

  it('keeps group-target flow routes on explicit perimeter faces without puncturing', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['db', [0, -8, 0]],
      ['group-left', [-8, 0, 0]],
      ['group-right', [8, 0, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['db', [8.8, 2.5, 1]],
      ['group-left', [7, 10, 0.01]],
      ['group-right', [7, 10, 0.01]],
    ]);

    const result = routeEdges(
      [
        { id: 'left', from: 'db', to: 'group-left', routing: 'flow' },
        { id: 'right', from: 'db', to: 'group-right', routing: 'flow' },
      ],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    expect(routePath(result, 'left')?.punctures).toEqual([]);
    expect(routePath(result, 'right')?.punctures).toEqual([]);
    expect(Math.abs(routePath(result, 'left')?.endTangent?.[0] ?? 0) + Math.abs(routePath(result, 'left')?.endTangent?.[1] ?? 0)).toBeGreaterThan(0.95);
    expect(Math.abs(routePath(result, 'right')?.endTangent?.[0] ?? 0) + Math.abs(routePath(result, 'right')?.endTangent?.[1] ?? 0)).toBeGreaterThan(0.95);
    expect(routePoints(result, 'left').at(-1)?.[0] ?? 0).toBeLessThan(0);
    expect(routePoints(result, 'right').at(-1)?.[0] ?? 0).toBeGreaterThan(0);
  });

  it('shares a bottom-center trunk before splitting for downward cross-column flow fan-out', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['db', [0, -10, 0]],
      ['core', [-8, -1, 0]],
      ['coord', [8, -1, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['db', [10, 2.8, 1]],
      ['core', [8, 8, 0.01]],
      ['coord', [8, 8, 0.01]],
    ]);

    const result = routeEdges(
      [
        { id: 'db-core', from: 'db', to: 'core', routing: 'flow' },
        { id: 'db-coord', from: 'db', to: 'coord', routing: 'flow' },
      ],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    const left = routePoints(result, 'db-core');
    const right = routePoints(result, 'db-coord');
    expect(routePath(result, 'db-core')?.startTangent?.[1]).toBeCloseTo(-1);
    expect(routePath(result, 'db-coord')?.startTangent?.[1]).toBeCloseTo(-1);
    expect(Math.abs(left[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(Math.abs(right[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(Math.abs((left[1]?.[0] ?? Infinity) - (right[1]?.[0] ?? -Infinity))).toBeLessThan(0.05);
    expect(Math.abs((left[1]?.[1] ?? Infinity) - (right[1]?.[1] ?? -Infinity))).toBeLessThan(0.05);
    expect((left.at(-1)?.[0] ?? 0)).toBeLessThan(0);
    expect((right.at(-1)?.[0] ?? 0)).toBeGreaterThan(0);
    expect(routePath(result, 'db-core')?.punctures).toEqual([]);
    expect(routePath(result, 'db-coord')?.punctures).toEqual([]);
  });

  it('shares a top-center trunk before splitting when compiled y-order increases downward', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['db', [0, -0.16, 0]],
      ['core', [-0.18, -0.33, 0]],
      ['coord', [0.18, -0.57, 0]],
      ['intel', [-0.18, -0.76, 0]],
      ['recov', [0.18, -0.88, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['db', [0.74, 0.06, 1]],
      ['core', [0.68, 0.29, 0.01]],
      ['coord', [0.68, 0.29, 0.01]],
      ['intel', [0.68, 0.17, 0.01]],
      ['recov', [0.68, 0.17, 0.01]],
    ]);

    const result = routeEdges(
      [
        { id: 'db-core', from: 'db', to: 'core', routing: 'flow' },
        { id: 'db-coord', from: 'db', to: 'coord', routing: 'flow' },
        { id: 'db-intel', from: 'db', to: 'intel', routing: 'flow' },
        { id: 'db-recov', from: 'db', to: 'recov', routing: 'flow' },
      ],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    expect(routePath(result, 'db-core')?.startTangent).toEqual([0, 1, 0]);
    expect(routePath(result, 'db-coord')?.startTangent).toEqual([0, 1, 0]);
    expect(routePath(result, 'db-intel')?.startTangent).toEqual([0, 1, 0]);
    expect(routePath(result, 'db-recov')?.startTangent).toEqual([0, 1, 0]);
    expect(Math.abs(routePath(result, 'db-core')?.endTangent?.[1] ?? 0)).toBeGreaterThan(0.95);
    expect(Math.abs(routePath(result, 'db-coord')?.endTangent?.[1] ?? 0)).toBeGreaterThan(0.95);
    expect(Math.abs(routePoints(result, 'db-core')[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(Math.abs(routePoints(result, 'db-coord')[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(Math.abs(routePoints(result, 'db-intel')[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(Math.abs(routePoints(result, 'db-recov')[0]?.[0] ?? Infinity)).toBeLessThan(0.05);
    expect(routePath(result, 'db-intel')?.punctures).toEqual([]);
    expect(routePath(result, 'db-recov')?.punctures).toEqual([]);
    expect(result.get('db-intel')?.pathDebug?.selectedDstFace).toBeDefined();
    expect(result.get('db-recov')?.pathDebug?.selectedDstFace).toBeDefined();
  });

  it('routes to a side boundary when a lower group top corridor is explicitly blocked', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['db', [0, -10, 0]],
      ['upper-left', [-8, -1, 0]],
      ['lower-left', [-8, 12, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['db', [10, 2.8, 1]],
      ['upper-left', [8, 10, 0.01]],
      ['lower-left', [8, 8, 0.01]],
    ]);

    const result = routeEdges(
      [{ id: 'db-lower-left', from: 'db', to: 'lower-left', routing: 'flow' }],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
    );

    expect(routePath(result, 'db-lower-left')?.punctures).toEqual([]);
    expect(Math.abs(routePath(result, 'db-lower-left')?.endTangent?.[0] ?? 0)).toBeGreaterThan(0.95);
    expect(['left', 'right']).toContain(result.get('db-lower-left')?.pathDebug?.selectedDstFace);
  });

  it('disables shared flow trunks when flowBundleStrength is set to 0', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['swarm', [0, -10, 0]],
      ['core-storage', [-8, 0, 0]],
      ['coordination', [8, 0, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['swarm', [10, 2.5, 1]],
      ['core-storage', [7, 6, 1]],
      ['coordination', [7, 6, 1]],
    ]);

    const result = routeEdges(
      [
        { id: 'swarm-core', from: 'swarm', to: 'core-storage', routing: 'flow' },
        { id: 'swarm-coordination', from: 'swarm', to: 'coordination', routing: 'flow' },
      ],
      localPositions,
      localSizes,
      'flow',
      'nearest-face',
      undefined,
      1.6,
      {
        ...DEFAULT_FLOW_ROUTING_CONFIG,
        flowBundleStrength: 0,
      },
    );

    expect(routePath(result, 'swarm-core')?.startTangent).toEqual([-1, 0, 0]);
    expect(routePath(result, 'swarm-coordination')?.startTangent).toEqual([1, 0, 0]);
  });

  it('with only fromPort fixed, chooses a non-crossing destination side', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['output-filters', [16, 7.5, 0]],
      ['llm-conv', [2, 13, 0]],
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

    const pts = routePoints(result, 'output-to-llm-conv');
    expect(pts.length).toBe(2);
    // Destination side may be top/bottom when it is the better planar landing.
    expect(pts[1]?.[1]).toBeGreaterThan(-13);
  });

  it('prefers the target face that actually faces the source node', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['users', [8, -6, 0]],
      ['app-layer', [2.5, -3.5, 0]],
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

    const pts = routePoints(result, 'users-app');
    expect(pts.length).toBeGreaterThanOrEqual(2);
    const end = pts[pts.length - 1];
    expect(end?.[0]).toBeGreaterThan(2.5);
  });

  it('group-to-group links with horizontal dominance use side-face ports', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['left-group', [0, 0, 0]],
      ['right-group', [20, -8, 0]],
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

    const pts = routePoints(result, 'group-link');
    expect(pts.length).toBe(4);
    const [start, c1, _c2, end] = pts;
    expect(start[0]).toBeGreaterThan(8.5);
    expect(end[0]).toBeLessThan(11.5);
    expect(c1[0] - start[0]).toBeGreaterThan(0.35);
    expect(Math.abs(c1[1] - start[1])).toBeLessThan(0.2);
  });

  it('api -> output-filters exits API from right side (scene_llm_filter geometry)', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['api', [2.5, 2.5, 0]],
      ['output-filters', [16, 7.5, 0]],
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

    const pts = routePoints(result, 'api-output');
    expect(pts.length).toBe(4);
    const [start, c1] = pts;
    const apiRightX = 2.5 + 11;
    const apiBottomY = -2.5 - 0.7;
    // right-face start should be near apiRightX + EDGE_EPSILON (0.012)
    expect(start[0]).toBeGreaterThan(apiRightX + 0.01);
    // tangent should point primarily along +X, not down.
    expect(c1[0] - start[0]).toBeGreaterThan(0.5);
    expect(Math.abs(c1[1] - start[1])).toBeLessThan(0.25);
    // guard against bottom-face landing near y bottom edge
    expect(Math.abs(start[1] - apiBottomY)).toBeGreaterThan(0.3);
  });

  it('organic routing with custom organicVariation differs from organicVariation=0', () => {
    const localPositions = new Map<string, [number, number, number]>([
      ['src', [0, 0, 0]],
      ['dst', [8, 0, 0]],
    ]);
    const localSizes = new Map<string, NodeDimensions>([
      ['src', [2, 2, 1]],
      ['dst', [2, 2, 1]],
    ]);
    // Use a deterministic edge ID so the hash-based offset is reproducible.
    const resultZero = routeEdges(
      [{ id: 'organic-edge', from: 'src', to: 'dst', routing: 'organic' }],
      localPositions,
      localSizes,
      'organic',
      'nearest-face',
      undefined,
      0,
    );
    const resultNonZero = routeEdges(
      [{ id: 'organic-edge', from: 'src', to: 'dst', routing: 'organic' }],
      localPositions,
      localSizes,
      'organic',
      'nearest-face',
      undefined,
      2.0,
    );
    const ptsZero = routePoints(resultZero, 'organic-edge');
    const ptsNonZero = routePoints(resultNonZero, 'organic-edge');
    expect(ptsZero.length).toBeGreaterThan(0);
    expect(ptsNonZero.length).toBeGreaterThan(0);
    // At least one control point should differ between the two results.
    const anyDifference = ptsZero.some((pt, i) => {
      const other = ptsNonZero[i];
      return other && (
        Math.abs(pt[0] - other[0]) > 1e-6 ||
        Math.abs(pt[1] - other[1]) > 1e-6
      );
    });
    expect(anyDifference).toBe(true);
  });
});
