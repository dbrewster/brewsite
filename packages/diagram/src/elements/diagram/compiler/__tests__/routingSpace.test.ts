// Unit tests for coordinate-system normalization in routingSpace.ts.

import { describe, expect, it } from 'vitest';
import { mirrorVecY, buildRoutingNodeMap, denormalizeEdgeRoute } from '../routingSpace';
import type { Vec3, NodeDimensions } from '../routingTypes';

// ─── mirrorVecY ───────────────────────────────────────────────────────────────

describe('mirrorVecY', () => {
  it('negates the Y component and preserves X and Z', () => {
    const result = mirrorVecY([3, 5, -2]);
    expect(result).toEqual([3, -5, -2]);
  });

  it('negates positive Y to negative', () => {
    expect(mirrorVecY([0, 4, 0])).toEqual([0, -4, 0]);
  });

  it('negates negative Y to positive', () => {
    expect(mirrorVecY([1, -7, 2])).toEqual([1, 7, 2]);
  });

  it('preserves zero Y as -0 (IEEE754 negation of 0)', () => {
    // JS: -0 === 0 is true, so this is functionally zero.
    const result = mirrorVecY([6, 0, -3]);
    expect(result[0]).toBe(6);
    expect(result[1] === 0).toBe(true); // -0 === 0 is true in JS
    expect(result[2]).toBe(-3);
  });

  it('is its own inverse — double application restores original', () => {
    const original: Vec3 = [4, -3, 1];
    expect(mirrorVecY(mirrorVecY(original))).toEqual(original);
  });
});

// ─── buildRoutingNodeMap ──────────────────────────────────────────────────────

describe('buildRoutingNodeMap', () => {
  it('mirrors Y in positions while keeping sizes unchanged', () => {
    const positions = new Map<string, Vec3>([
      ['a', [1, 4, 0]],
    ]);
    const sizes = new Map<string, NodeDimensions>([
      ['a', [2, 1, 0.5]],
    ]);
    const map = buildRoutingNodeMap(positions, sizes);
    expect(map.get('a')?.position).toEqual([1, -4, 0]);
    expect(map.get('a')?.size).toEqual([2, 1, 0.5]);
  });

  it('excludes nodes that have no corresponding size entry', () => {
    const positions = new Map<string, Vec3>([
      ['a', [0, 1, 0]],
      ['b', [0, 2, 0]],
    ]);
    const sizes = new Map<string, NodeDimensions>([
      ['a', [1, 1, 1]],
      // 'b' intentionally omitted
    ]);
    const map = buildRoutingNodeMap(positions, sizes);
    expect(map.has('a')).toBe(true);
    expect(map.has('b')).toBe(false);
  });

  it('includes all nodes that have both position and size', () => {
    const positions = new Map<string, Vec3>([
      ['x', [0, 0, 0]],
      ['y', [5, 2, 0]],
      ['z', [-3, -1, 0]],
    ]);
    const sizes = new Map<string, NodeDimensions>([
      ['x', [2, 2, 1]],
      ['y', [3, 3, 1]],
      ['z', [1, 1, 1]],
    ]);
    const map = buildRoutingNodeMap(positions, sizes);
    expect(map.size).toBe(3);
  });

  it('builds an empty map when positions is empty', () => {
    const map = buildRoutingNodeMap(new Map(), new Map());
    expect(map.size).toBe(0);
  });

  it('applies Y mirror to multiple nodes independently', () => {
    const positions = new Map<string, Vec3>([
      ['a', [0, 2, 0]],
      ['b', [0, -3, 0]],
    ]);
    const sizes = new Map<string, NodeDimensions>([
      ['a', [1, 1, 1]],
      ['b', [1, 1, 1]],
    ]);
    const map = buildRoutingNodeMap(positions, sizes);
    expect(map.get('a')?.position[1]).toBe(-2);
    expect(map.get('b')?.position[1]).toBe(3);
  });
});

// ─── denormalizeEdgeRoute ─────────────────────────────────────────────────────

describe('denormalizeEdgeRoute', () => {
  it('mirrors Y in startTangent and endTangent', () => {
    const route = makeMinimalRoute();
    const result = denormalizeEdgeRoute(route);
    expect(result.path.startTangent).toEqual([1, -1, 0]);
    expect(result.path.endTangent).toEqual([-1, 1, 0]);
  });

  it('mirrors Y in all line command vertices', () => {
    const route = makeMinimalRoute();
    const result = denormalizeEdgeRoute(route);
    const cmd = result.path.commands[0];
    if (cmd?.kind !== 'line') throw new Error('expected line command');
    expect(cmd.from).toEqual([0, -1, 0]);
    expect(cmd.to).toEqual([4, -2, 0]);
  });

  it('mirrors Y in all cubic command control points', () => {
    const route = makeRouteWithCubic();
    const result = denormalizeEdgeRoute(route);
    const cmd = result.path.commands[0];
    if (cmd?.kind !== 'cubic') throw new Error('expected cubic command');
    expect(cmd.p0[1]).toBe(-1);
    expect(cmd.p1[1]).toBe(-2);
    expect(cmd.p2[1]).toBe(-3);
    expect(cmd.p3[1]).toBe(-4);
  });

  it('mirrors Y in controlPoints array', () => {
    const route = makeMinimalRoute();
    const result = denormalizeEdgeRoute(route);
    expect(result.controlPoints[0]).toEqual([0, -1, 0]);
    expect(result.controlPoints[1]).toEqual([4, -2, 0]);
  });

  it('is its own inverse — double application restores original', () => {
    const route = makeMinimalRoute();
    const roundTripped = denormalizeEdgeRoute(denormalizeEdgeRoute(route));
    expect(roundTripped.path.startTangent).toEqual(route.path.startTangent);
    expect(roundTripped.path.endTangent).toEqual(route.path.endTangent);
    expect(roundTripped.controlPoints[0]).toEqual(route.controlPoints[0]);
  });

  it('preserves pathDebug unchanged', () => {
    const route = makeMinimalRoute();
    const result = denormalizeEdgeRoute(route);
    expect(result.pathDebug).toBe(route.pathDebug);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMinimalRoute() {
  return {
    path: {
      commands: [
        { kind: 'line' as const, from: [0, 1, 0] as Vec3, to: [4, 2, 0] as Vec3 },
      ],
      startTangent: [1, 1, 0] as Vec3,
      endTangent: [-1, -1, 0] as Vec3,
    },
    controlPoints: [[0, 1, 0] as Vec3, [4, 2, 0] as Vec3],
    pathDebug: undefined,
  };
}

function makeRouteWithCubic() {
  return {
    path: {
      commands: [
        {
          kind: 'cubic' as const,
          p0: [0, 1, 0] as Vec3,
          p1: [1, 2, 0] as Vec3,
          p2: [3, 3, 0] as Vec3,
          p3: [4, 4, 0] as Vec3,
        },
      ],
      startTangent: [1, 0, 0] as Vec3,
      endTangent: [-1, 0, 0] as Vec3,
    },
    controlPoints: [[0, 1, 0] as Vec3, [4, 4, 0] as Vec3],
    pathDebug: undefined,
  };
}
