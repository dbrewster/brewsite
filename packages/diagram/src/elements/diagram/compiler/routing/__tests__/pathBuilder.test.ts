import { describe, expect, it } from 'vitest';
import {
  buildFlowPath,
  buildCurvedPath,
  buildStraightPath,
  buildOrganicPath,
  assignDepth,
  commandsToControlPoints,
} from '../pathBuilder';
import type { PathCommand2D } from '../pathBuilder';
import type { Vec2 } from '../routingTypes';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Check that no PathCommand2D has a sharp 90° corner (all turns should be arcs). */
const hasSharpCorner = (commands: ReadonlyArray<PathCommand2D>): boolean => {
  for (let i = 0; i < commands.length - 1; i++) {
    const a = commands[i]!;
    const b = commands[i + 1]!;
    const endA = a.kind === 'line' ? a.to : a.p3;
    const startB = b.kind === 'line' ? b.from : b.p0;
    // If two line segments meet at a point, it's a sharp corner
    if (
      a.kind === 'line' && b.kind === 'line' &&
      Math.abs(endA[0] - startB[0]) < 1e-6 &&
      Math.abs(endA[1] - startB[1]) < 1e-6
    ) {
      // Check if there's actually a direction change
      const dxA = a.to[0] - a.from[0];
      const dyA = a.to[1] - a.from[1];
      const dxB = b.to[0] - b.from[0];
      const dyB = b.to[1] - b.from[1];
      const lenA = Math.hypot(dxA, dyA);
      const lenB = Math.hypot(dxB, dyB);
      if (lenA > 1e-6 && lenB > 1e-6) {
        const dot = (dxA * dxB + dyA * dyB) / (lenA * lenB);
        if (dot < 0.95) return true;
      }
    }
  }
  return false;
};

// ─── buildFlowPath ──────────────────────────────────────────────────────────

describe('buildFlowPath', () => {
  it('produces a straight line for a two-point path', () => {
    const result = buildFlowPath([[0, 0], [1, 0]], 0.1);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('line');
  });

  it('produces no sharp corners for a 90° turn', () => {
    const waypoints: Vec2[] = [[0, 0], [1, 0], [1, 1]];
    const result = buildFlowPath(waypoints, 0.2);
    expect(result.length).toBeGreaterThan(1);
    expect(result.some((cmd) => cmd.kind === 'cubic')).toBe(true);
    expect(hasSharpCorner(result)).toBe(false);
  });

  it('produces arc rounding at multiple 90° turns', () => {
    const waypoints: Vec2[] = [[0, 0], [0, 1], [1, 1], [1, 2]];
    const result = buildFlowPath(waypoints, 0.2);
    const cubics = result.filter((cmd) => cmd.kind === 'cubic');
    expect(cubics.length).toBe(2);
    expect(hasSharpCorner(result)).toBe(false);
  });

  it('preserves start and end anchor points', () => {
    const waypoints: Vec2[] = [[0, 0], [1, 0], [1, 1]];
    const result = buildFlowPath(waypoints, 0.2);
    const first = result[0]!;
    const last = result[result.length - 1]!;
    const startPt = first.kind === 'line' ? first.from : first.p0;
    const endPt = last.kind === 'line' ? last.to : last.p3;
    expect(startPt[0]).toBeCloseTo(0);
    expect(startPt[1]).toBeCloseTo(0);
    expect(endPt[0]).toBeCloseTo(1);
    expect(endPt[1]).toBeCloseTo(1);
  });

  it('returns empty for insufficient waypoints', () => {
    expect(buildFlowPath([], 0.1)).toHaveLength(0);
    expect(buildFlowPath([[0, 0]], 0.1)).toHaveLength(0);
  });

  it('handles duplicate consecutive waypoints gracefully', () => {
    const waypoints: Vec2[] = [[0, 0], [0, 0], [1, 0], [1, 0]];
    const result = buildFlowPath(waypoints, 0.1);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('caps arc radius when segment is shorter than turnRadius', () => {
    // Short segment: 0.05 long, turnRadius = 0.2
    const waypoints: Vec2[] = [[0, 0], [0.05, 0], [0.05, 1]];
    const result = buildFlowPath(waypoints, 0.2);
    // Should still produce an arc, just smaller
    expect(result.some((cmd) => cmd.kind === 'cubic')).toBe(true);
  });
});

// ─── buildCurvedPath ────────────────────────────────────────────────────────

describe('buildCurvedPath', () => {
  it('produces a single cubic for a straight shot (no waypoints)', () => {
    const result = buildCurvedPath(
      [0, 0], [2, 0],
      [1, 0], [-1, 0],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('cubic');
  });

  it('produces a single cubic for an S-curve with waypoints', () => {
    const result = buildCurvedPath(
      [0, 0], [2, 2],
      [1, 0], [-1, 0],
      [[1, 0], [1, 2]],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('cubic');
  });

  it('preserves source and destination anchors', () => {
    const result = buildCurvedPath(
      [0, 0], [3, 1],
      [1, 0], [-1, 0],
      [],
    );
    const cmd = result[0]!;
    const start = cmd.kind === 'cubic' ? cmd.p0 : cmd.from;
    const end = cmd.kind === 'cubic' ? cmd.p3 : cmd.to;
    expect(start[0]).toBeCloseTo(0);
    expect(start[1]).toBeCloseTo(0);
    expect(end[0]).toBeCloseTo(3);
    expect(end[1]).toBeCloseTo(1);
  });

  it('returns a direct line for well-aligned short edges', () => {
    // Very short, perfectly aligned, non-side normals
    const result = buildCurvedPath(
      [0, 0], [0, 0.3],
      [0, 1], [0, -1],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('line');
  });

  it('handles zero-distance endpoints', () => {
    const result = buildCurvedPath(
      [1, 1], [1, 1],
      [1, 0], [-1, 0],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('line');
  });
});

// ─── buildStraightPath ──────────────────────────────────────────────────────

describe('buildStraightPath', () => {
  it('returns a single line for a straight shot', () => {
    const result = buildStraightPath([0, 0], [5, 0], [], 0.1);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('line');
  });

  it('returns a single line when all waypoints are colinear', () => {
    const result = buildStraightPath([0, 0], [3, 0], [[1, 0], [2, 0]], 0.1);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe('line');
  });

  it('falls back to flow when obstacles cause turns', () => {
    const result = buildStraightPath(
      [0, 0], [2, 2],
      [[0, 1], [2, 1]],
      0.1,
    );
    // The waypoints form turns, so buildFlowPath should be used
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Should contain arcs at the turn
    expect(result.some((cmd) => cmd.kind === 'cubic')).toBe(true);
  });

  it('preserves start and end points', () => {
    const result = buildStraightPath([0, 0], [5, 0], [], 0.1);
    const first = result[0]!;
    expect(first.kind).toBe('line');
    if (first.kind === 'line') {
      expect(first.from).toEqual([0, 0]);
      expect(first.to).toEqual([5, 0]);
    }
  });
});

// ─── buildOrganicPath ───────────────────────────────────────────────────────

describe('buildOrganicPath', () => {
  it('produces deterministic output for the same edgeId', () => {
    const a = buildOrganicPath(
      [0, 0], [3, 1], [1, 0], [-1, 0], [], 'edge-42', 0.02,
    );
    const b = buildOrganicPath(
      [0, 0], [3, 1], [1, 0], [-1, 0], [], 'edge-42', 0.02,
    );
    expect(a).toEqual(b);
  });

  it('produces different output for different edgeIds', () => {
    const a = buildOrganicPath(
      [0, 0], [3, 1], [1, 0], [-1, 0], [], 'edge-1', 0.02,
    );
    const b = buildOrganicPath(
      [0, 0], [3, 1], [1, 0], [-1, 0], [], 'edge-2', 0.02,
    );
    // The commands should differ in control point positions
    const cmdA = a[0]!;
    const cmdB = b[0]!;
    if (cmdA.kind === 'cubic' && cmdB.kind === 'cubic') {
      const sameCPs =
        cmdA.p1[0] === cmdB.p1[0] && cmdA.p1[1] === cmdB.p1[1] &&
        cmdA.p2[0] === cmdB.p2[0] && cmdA.p2[1] === cmdB.p2[1];
      expect(sameCPs).toBe(false);
    }
  });

  it('preserves endpoints despite perturbation', () => {
    const result = buildOrganicPath(
      [0, 0], [3, 1], [1, 0], [-1, 0], [], 'edge-organic', 0.05,
    );
    const cmd = result[0]!;
    const start = cmd.kind === 'cubic' ? cmd.p0 : cmd.from;
    const end = cmd.kind === 'cubic' ? cmd.p3 : cmd.to;
    expect(start[0]).toBeCloseTo(0);
    expect(start[1]).toBeCloseTo(0);
    expect(end[0]).toBeCloseTo(3);
    expect(end[1]).toBeCloseTo(1);
  });

  it('returns base curve when variation is zero', () => {
    const base = buildCurvedPath([0, 0], [3, 1], [1, 0], [-1, 0], []);
    const organic = buildOrganicPath(
      [0, 0], [3, 1], [1, 0], [-1, 0], [], 'edge-x', 0,
    );
    // With variation=0, the offset is 0, so control points should match the base
    expect(organic).toEqual(base);
  });
});

// ─── assignDepth ────────────────────────────────────────────────────────────

describe('assignDepth', () => {
  it('assigns uniform Z when source and dest are at the same depth', () => {
    const commands: PathCommand2D[] = [
      { kind: 'line', from: [0, 0], to: [1, 0] },
      { kind: 'line', from: [1, 0], to: [2, 0] },
    ];
    const result = assignDepth(commands, 0, 0, 0.04, 0.04);
    // sourceMidZ = 0 - 0.02 = -0.02, destMidZ = 0 - 0.02 = -0.02
    for (const cmd of result) {
      if (cmd.kind === 'line') {
        expect(cmd.from[2]).toBeCloseTo(-0.02);
        expect(cmd.to[2]).toBeCloseTo(-0.02);
      }
    }
  });

  it('interpolates Z via smoothstep for different-depth nodes', () => {
    const commands: PathCommand2D[] = [
      { kind: 'line', from: [0, 0], to: [1, 0] },
    ];
    // sourceZ=0, sourceDepth=0 → sourceMidZ=0
    // destZ=1, destDepth=0 → destMidZ=1
    const result = assignDepth(commands, 0, 1, 0, 0);

    expect(result).toHaveLength(1);
    const cmd = result[0]!;
    if (cmd.kind === 'line') {
      // t=0 → smoothstep(0) = 0 → Z = 0
      expect(cmd.from[2]).toBeCloseTo(0);
      // t=1 → smoothstep(1) = 1 → Z = 1
      expect(cmd.to[2]).toBeCloseTo(1);
    }
  });

  it('applies smoothstep at t=0.5 (midpoint Z)', () => {
    // Two segments of equal length → the junction is at t=0.5
    const commands: PathCommand2D[] = [
      { kind: 'line', from: [0, 0], to: [1, 0] },
      { kind: 'line', from: [1, 0], to: [2, 0] },
    ];
    // sourceMidZ=0, destMidZ=2
    const result = assignDepth(commands, 0, 2, 0, 0);

    // The junction point (end of first segment = start of second) is at t=0.5
    // smoothstep(0.5) = 3*(0.25) - 2*(0.125) = 0.75 - 0.25 = 0.5
    // Z = 0 + 2 * 0.5 = 1
    const firstEnd = result[0]!.kind === 'line' ? result[0]!.to : result[0]!;
    expect((firstEnd as readonly [number, number, number])[2]).toBeCloseTo(1);
  });

  it('handles cubic commands', () => {
    const commands: PathCommand2D[] = [
      { kind: 'cubic', p0: [0, 0], p1: [0.3, 0.1], p2: [0.7, 0.1], p3: [1, 0] },
    ];
    const result = assignDepth(commands, 0, 0, 0.1, 0.1);
    // All Z should be sourceMidZ = -0.05
    expect(result).toHaveLength(1);
    const cmd = result[0]!;
    if (cmd.kind === 'cubic') {
      expect(cmd.p0[2]).toBeCloseTo(-0.05);
      expect(cmd.p1[2]).toBeCloseTo(-0.05);
      expect(cmd.p2[2]).toBeCloseTo(-0.05);
      expect(cmd.p3[2]).toBeCloseTo(-0.05);
    }
  });

  it('handles empty command list', () => {
    const result = assignDepth([], 0, 1, 0, 0);
    expect(result).toHaveLength(0);
  });

  it('preserves XY coordinates', () => {
    const commands: PathCommand2D[] = [
      { kind: 'line', from: [3.5, 2.1], to: [7.8, 4.2] },
    ];
    const result = assignDepth(commands, 0, 0, 0, 0);
    if (result[0]!.kind === 'line') {
      expect(result[0]!.from[0]).toBeCloseTo(3.5);
      expect(result[0]!.from[1]).toBeCloseTo(2.1);
      expect(result[0]!.to[0]).toBeCloseTo(7.8);
      expect(result[0]!.to[1]).toBeCloseTo(4.2);
    }
  });
});

// ─── commandsToControlPoints ────────────────────────────────────────────────

describe('commandsToControlPoints', () => {
  it('extracts unique endpoints from line commands', () => {
    const points = commandsToControlPoints([
      { kind: 'line', from: [0, 0, 0], to: [1, 0, 0] },
      { kind: 'line', from: [1, 0, 0], to: [1, 1, 0] },
    ]);
    expect(points).toEqual([[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
  });

  it('extracts all four points from cubic commands', () => {
    const points = commandsToControlPoints([
      { kind: 'cubic', p0: [0, 0, 0], p1: [0.3, 0, 0], p2: [0.7, 1, 0], p3: [1, 1, 0] },
    ]);
    expect(points).toEqual([
      [0, 0, 0], [0.3, 0, 0], [0.7, 1, 0], [1, 1, 0],
    ]);
  });

  it('deduplicates consecutive identical points', () => {
    const points = commandsToControlPoints([
      { kind: 'line', from: [0, 0, 0], to: [1, 0, 0] },
      { kind: 'cubic', p0: [1, 0, 0], p1: [1.3, 0, 0], p2: [1.7, 1, 0], p3: [2, 1, 0] },
    ]);
    // [1, 0, 0] should appear only once (deduplicated between line.to and cubic.p0)
    expect(points).toEqual([
      [0, 0, 0], [1, 0, 0], [1.3, 0, 0], [1.7, 1, 0], [2, 1, 0],
    ]);
  });

  it('returns empty for empty commands', () => {
    expect(commandsToControlPoints([])).toEqual([]);
  });
});
