import { describe, expect, it } from 'vitest';
import { snapEndpointsToShape } from '../shapeSnap';
import type { ShapeInfo } from '../shapeSnap';
import type { DiagramEdgePathCommand } from '../../../types';

// ─── helpers ────────────────────────────────────────────────────────────────

const makeLineCmd = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): DiagramEdgePathCommand => ({ kind: 'line', from, to });

const makeCubicCmd = (
  p0: readonly [number, number, number],
  p1: readonly [number, number, number],
  p2: readonly [number, number, number],
  p3: readonly [number, number, number],
): DiagramEdgePathCommand => ({ kind: 'cubic', p0, p1, p2, p3 });

// ─── Rectangle shapes (no adjustment) ──────────────────────────────────────

describe('snapEndpointsToShape — rectangles', () => {
  it('does not adjust endpoints for rectangle shapes', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([0, 0.5, -0.02], [1, 0.5, -0.02]),
    ];
    const source: ShapeInfo = { cx: 0, cy: 0, size: [1, 1], shape: 'rectangle' };
    const dest: ShapeInfo = { cx: 1, cy: 0, size: [1, 1], shape: 'rectangle' };

    const result = snapEndpointsToShape(commands, source, dest);
    expect(result).toEqual(commands);
  });

  it('does not adjust for square shapes', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([0, 0.5, 0], [2, 0.5, 0]),
    ];
    const source: ShapeInfo = { cx: 0, cy: 0, size: [1, 1], shape: 'square' };
    const result = snapEndpointsToShape(commands, source, undefined);
    expect(result).toEqual(commands);
  });
});

// ─── Circle shapes ─────────────────────────────────────────────────────────

describe('snapEndpointsToShape — circles', () => {
  it('snaps XY to circle boundary, Z unchanged', () => {
    // Node at (0, 0) with size [2, 2] → radius 1
    // Edge starts at (1, 0, -0.02) — right side of AABB
    // Circle boundary at angle 0: (1, 0) — already on boundary
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([1, 0, -0.02], [3, 0, -0.02]),
    ];
    const source: ShapeInfo = { cx: 0, cy: 0, size: [2, 2], shape: 'circle' };

    const result = snapEndpointsToShape(commands, source, undefined);
    if (result[0]!.kind === 'line') {
      // Point is already on circle boundary, so no change
      expect(result[0]!.from[0]).toBeCloseTo(1, 4);
      expect(result[0]!.from[1]).toBeCloseTo(0, 4);
      expect(result[0]!.from[2]).toBeCloseTo(-0.02, 6);
    }
  });

  it('projects AABB corner point to circle boundary', () => {
    // Node at (0, 0) with size [2, 2] → radius 1 (min(2,2)/2)
    // Edge starts at (0.5, 0.5, 0) — inside the circle
    // Should project outward along the (0.5, 0.5) direction to the boundary
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([0.5, 0.5, -0.01], [2, 2, -0.01]),
    ];
    const source: ShapeInfo = { cx: 0, cy: 0, size: [2, 2], shape: 'circle' };

    const result = snapEndpointsToShape(commands, source, undefined);
    if (result[0]!.kind === 'line') {
      // The projected point should be at distance 1 from center
      const x = result[0]!.from[0];
      const y = result[0]!.from[1];
      const dist = Math.sqrt(x * x + y * y);
      expect(dist).toBeCloseTo(1, 4);
      // Z should be unchanged
      expect(result[0]!.from[2]).toBeCloseTo(-0.01, 6);
    }
  });

  it('adjusts destination circle endpoint', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([0, 0, 0], [5, 1, 0]),
    ];
    const dest: ShapeInfo = { cx: 5, cy: 0, size: [2, 2], shape: 'circle' };

    const result = snapEndpointsToShape(commands, undefined, dest);
    if (result[0]!.kind === 'line') {
      // Destination should be projected onto circle at (5, 0) radius 1
      const x = result[0]!.to[0] - 5;
      const y = result[0]!.to[1] - 0;
      const dist = Math.sqrt(x * x + y * y);
      expect(dist).toBeCloseTo(1, 4);
      // Z unchanged
      expect(result[0]!.to[2]).toBeCloseTo(0, 6);
    }
  });
});

// ─── Polygon shapes ────────────────────────────────────────────────────────

describe('snapEndpointsToShape — polygons', () => {
  it('snaps to hexagon boundary, Z unchanged', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([1, 0, -0.02], [3, 0, -0.02]),
    ];
    // Node at (0, 0), size [2, 2] → r = 1
    const source: ShapeInfo = { cx: 0, cy: 0, size: [2, 2], shape: 'hexagon' };

    const result = snapEndpointsToShape(commands, source, undefined);
    if (result[0]!.kind === 'line') {
      // Projected onto hexagon boundary — should be at or near distance from center
      const x = result[0]!.from[0];
      const y = result[0]!.from[1];
      const dist = Math.sqrt(x * x + y * y);
      // Hexagon apothem = r * cos(π/6) ≈ 0.866; distance varies by angle
      expect(dist).toBeGreaterThan(0.85);
      expect(dist).toBeLessThanOrEqual(1.001);
      // Z unchanged
      expect(result[0]!.from[2]).toBeCloseTo(-0.02, 6);
    }
  });

  it('snaps to diamond boundary', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([1, 0, 0], [3, 0, 0]),
    ];
    const source: ShapeInfo = { cx: 0, cy: 0, size: [2, 2], shape: 'diamond' };

    const result = snapEndpointsToShape(commands, source, undefined);
    if (result[0]!.kind === 'line') {
      // Diamond at right: boundary point along x axis is at hw = 1
      expect(result[0]!.from[0]).toBeCloseTo(1, 4);
      expect(result[0]!.from[1]).toBeCloseTo(0, 4);
      expect(result[0]!.from[2]).toBeCloseTo(0, 6);
    }
  });
});

// ─── Cubic commands ─────────────────────────────────────────────────────────

describe('snapEndpointsToShape — cubic commands', () => {
  it('adjusts p0 and p1 for source snap on cubic', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeCubicCmd([0.5, 0.5, 0], [0.8, 0.5, 0], [2.2, 0.5, 0], [2.5, 0.5, 0]),
    ];
    const source: ShapeInfo = { cx: 0, cy: 0, size: [2, 2], shape: 'circle' };

    const result = snapEndpointsToShape(commands, source, undefined);
    if (result[0]!.kind === 'cubic') {
      // p0 should be on circle boundary
      const x = result[0]!.p0[0];
      const y = result[0]!.p0[1];
      const dist = Math.sqrt(x * x + y * y);
      expect(dist).toBeCloseTo(1, 4);
      // p1 should be shifted by the same delta as p0
      const dx = result[0]!.p0[0] - 0.5;
      const dy = result[0]!.p0[1] - 0.5;
      expect(result[0]!.p1[0]).toBeCloseTo(0.8 + dx, 4);
      expect(result[0]!.p1[1]).toBeCloseTo(0.5 + dy, 4);
      // p2 and p3 should be unchanged
      expect(result[0]!.p2).toEqual([2.2, 0.5, 0]);
      expect(result[0]!.p3).toEqual([2.5, 0.5, 0]);
    }
  });

  it('adjusts p3 and p2 for destination snap on cubic', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeCubicCmd([0, 0, 0], [0.3, 0, 0], [0.7, 0.5, 0], [0.5, 0.5, 0]),
    ];
    const dest: ShapeInfo = { cx: 1, cy: 0, size: [2, 2], shape: 'circle' };

    const result = snapEndpointsToShape(commands, undefined, dest);
    if (result[0]!.kind === 'cubic') {
      // p3 should be on circle boundary around (1, 0)
      const x = result[0]!.p3[0] - 1;
      const y = result[0]!.p3[1] - 0;
      const dist = Math.sqrt(x * x + y * y);
      expect(dist).toBeCloseTo(1, 4);
      // p0 and p1 unchanged
      expect(result[0]!.p0).toEqual([0, 0, 0]);
      expect(result[0]!.p1).toEqual([0.3, 0, 0]);
    }
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('snapEndpointsToShape — edge cases', () => {
  it('returns commands unchanged for empty list', () => {
    expect(snapEndpointsToShape([], undefined, undefined)).toEqual([]);
  });

  it('returns commands unchanged when both shapes are undefined', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([0, 0, 0], [1, 1, 0]),
    ];
    expect(snapEndpointsToShape(commands, undefined, undefined)).toEqual(commands);
  });

  it('handles both source and destination snap on multi-command path', () => {
    const commands: DiagramEdgePathCommand[] = [
      makeLineCmd([0.5, 0.5, 0], [1, 1, 0]),
      makeLineCmd([1, 1, 0], [2, 1, 0]),
      makeLineCmd([2, 1, 0], [2.5, 0.5, 0]),
    ];
    const source: ShapeInfo = { cx: 0, cy: 0, size: [2, 2], shape: 'circle' };
    const dest: ShapeInfo = { cx: 3, cy: 0, size: [2, 2], shape: 'circle' };

    const result = snapEndpointsToShape(commands, source, dest);
    expect(result).toHaveLength(3);
    // First command start: on circle at (0, 0)
    if (result[0]!.kind === 'line') {
      const x = result[0]!.from[0];
      const y = result[0]!.from[1];
      expect(Math.sqrt(x * x + y * y)).toBeCloseTo(1, 4);
    }
    // Last command end: on circle at (3, 0)
    if (result[2]!.kind === 'line') {
      const x = result[2]!.to[0] - 3;
      const y = result[2]!.to[1] - 0;
      expect(Math.sqrt(x * x + y * y)).toBeCloseTo(1, 4);
    }
    // Middle command should be untouched
    expect(result[1]).toEqual(commands[1]);
  });
});
