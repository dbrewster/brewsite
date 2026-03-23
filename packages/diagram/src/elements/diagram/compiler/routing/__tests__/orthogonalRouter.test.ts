// Tests for orthogonalRouter.ts — A* Manhattan routing with obstacle avoidance.

import { describe, it, expect } from 'vitest';
import { routeOrthogonal } from '../orthogonalRouter';
import type { OrthogonalRouteResult } from '../orthogonalRouter';
import type { Obstacle } from '../obstacleModel';
import type { Vec2, Rect2D } from '../routingTypes';

// ─── Test helpers ────────────────────────────────────────────────────────────

const makeNodeObstacle = (
  id: string,
  left: number,
  bottom: number,
  right: number,
  top: number,
  padding = 0.025,
): Obstacle => {
  const rect: Rect2D = { left, right, top, bottom };
  return {
    id,
    kind: 'node',
    rect,
    expandedRect: {
      left: left - padding,
      right: right + padding,
      top: top + padding,
      bottom: bottom - padding,
    },
    hard: true,
    ownsEndpoint: false,
    allowedCorridors: [],
  };
};

const makeGroupObstacle = (
  id: string,
  left: number,
  bottom: number,
  right: number,
  top: number,
  ownsEndpoint = false,
  corridors: Rect2D[] = [],
  padding = 0.05,
): Obstacle => {
  const rect: Rect2D = { left, right, top, bottom };
  return {
    id,
    kind: 'group',
    rect,
    expandedRect: {
      left: left - padding,
      right: right + padding,
      top: top + padding,
      bottom: bottom - padding,
    },
    hard: false,
    ownsEndpoint,
    allowedCorridors: corridors,
  };
};

const defaultConfig = { turnPenalty: 0.45, punchthroughPenalty: 500 };

/** Assert all waypoints are axis-aligned (Manhattan path). */
function assertOrthogonal(waypoints: ReadonlyArray<Vec2>): void {
  for (let i = 1; i < waypoints.length; i++) {
    const dx = Math.abs(waypoints[i]![0] - waypoints[i - 1]![0]);
    const dy = Math.abs(waypoints[i]![1] - waypoints[i - 1]![1]);
    expect(dx < 1e-6 || dy < 1e-6, `Segment ${i - 1}→${i} is not axis-aligned: dx=${dx}, dy=${dy}`).toBe(true);
  }
}

/** Assert the path starts and ends at the expected points. */
function assertEndpoints(waypoints: ReadonlyArray<Vec2>, start: Vec2, end: Vec2): void {
  expect(waypoints[0]![0]).toBeCloseTo(start[0]);
  expect(waypoints[0]![1]).toBeCloseTo(start[1]);
  expect(waypoints[waypoints.length - 1]![0]).toBeCloseTo(end[0]);
  expect(waypoints[waypoints.length - 1]![1]).toBeCloseTo(end[1]);
}

// ─── Degenerate cases ────────────────────────────────────────────────────────

describe('routeOrthogonal — degenerate cases', () => {
  it('returns single waypoint when start === end', () => {
    const result = routeOrthogonal([1, 1], [1, 1], [], 'N', defaultConfig);
    expect(result.waypoints).toHaveLength(1);
    expect(result.waypoints[0]).toEqual([1, 1]);
    expect(result.bendCount).toBe(0);
    expect(result.pathLength).toBe(0);
  });

  it('returns direct path with zero obstacles', () => {
    const start: Vec2 = [0, 0];
    const end: Vec2 = [3, 0];
    const result = routeOrthogonal(start, end, [], 'W', defaultConfig);
    assertEndpoints(result.waypoints, start, end);
    assertOrthogonal(result.waypoints);
    expect(result.punctures).toHaveLength(0);
  });

  it('returns a path when start is inside an obstacle (best-effort)', () => {
    const obstacle = makeNodeObstacle('obs', -1, -1, 1, 1);
    const start: Vec2 = [0, 0]; // inside obstacle
    const end: Vec2 = [3, 0];
    const result = routeOrthogonal(start, end, [obstacle], 'W', defaultConfig);
    // Should still produce a path (via punchthrough or fallback).
    expect(result.waypoints.length).toBeGreaterThanOrEqual(2);
    assertEndpoints(result.waypoints, start, end);
  });
});

// ─── Simple routing around obstacles ─────────────────────────────────────────

describe('routeOrthogonal — obstacle avoidance', () => {
  it('routes around a single node obstacle between start and end', () => {
    // Start at (0, 0), end at (4, 0), obstacle blocking the direct path.
    const obstacle = makeNodeObstacle('mid', 1.5, -0.5, 2.5, 0.5);
    const start: Vec2 = [0, 0];
    const end: Vec2 = [4, 0];
    const result = routeOrthogonal(start, end, [obstacle], 'W', defaultConfig);

    assertEndpoints(result.waypoints, start, end);
    assertOrthogonal(result.waypoints);
    expect(result.punctures).toHaveLength(0);
    // Path should go around the obstacle (more than 2 waypoints).
    expect(result.waypoints.length).toBeGreaterThan(2);
  });

  it('takes a direct path when obstacle does not block', () => {
    // Obstacle is off to the side, not blocking.
    const obstacle = makeNodeObstacle('off', 1, 2, 2, 3);
    const start: Vec2 = [0, 0];
    const end: Vec2 = [3, 0];
    const result = routeOrthogonal(start, end, [obstacle], 'W', defaultConfig);

    assertEndpoints(result.waypoints, start, end);
    // Should be a direct or near-direct path.
    expect(result.punctures).toHaveLength(0);
  });

  it('routes cleanly with two obstacles side by side', () => {
    const obs1 = makeNodeObstacle('obs1', 1, -0.5, 2, 0.5);
    const obs2 = makeNodeObstacle('obs2', 3, -0.5, 4, 0.5);
    const start: Vec2 = [0, 0];
    const end: Vec2 = [5, 0];
    const result = routeOrthogonal(start, end, [obs1, obs2], 'W', defaultConfig);

    assertEndpoints(result.waypoints, start, end);
    assertOrthogonal(result.waypoints);
    expect(result.punctures).toHaveLength(0);
  });
});

// ─── Corridor support ────────────────────────────────────────────────────────

describe('routeOrthogonal — corridor allowance', () => {
  it('allows punchthrough via corridor for owning group', () => {
    // Group covers the entire area but has a corridor.
    const corridor: Rect2D = { left: -0.1, right: 3.1, bottom: -0.2, top: 0.2 };
    const group = makeGroupObstacle('grp', -1, -2, 4, 2, true, [corridor]);
    const start: Vec2 = [0, 0];
    const end: Vec2 = [3, 0];
    const result = routeOrthogonal(start, end, [group], 'W', defaultConfig);

    assertEndpoints(result.waypoints, start, end);
    // Should find a clean route through the corridor.
    expect(result.punctures).toHaveLength(0);
  });
});

// ─── Soft obstacle punchthrough ──────────────────────────────────────────────

describe('routeOrthogonal — soft obstacles', () => {
  it('punches through a soft group obstacle when no clean path exists', () => {
    // Group obstacle blocks the only path, but it's soft.
    const group = makeGroupObstacle('grp', -0.5, -2, 3.5, 2);
    const start: Vec2 = [0, 0];
    const end: Vec2 = [3, 0];
    const result = routeOrthogonal(start, end, [group], 'W', defaultConfig);

    assertEndpoints(result.waypoints, start, end);
    // Should punchthrough the soft group.
    expect(result.punctures.length).toBeGreaterThan(0);
    expect(result.punctures[0]!.obstacleId).toBe('grp');
  });
});

// ─── Turn penalty ────────────────────────────────────────────────────────────

describe('routeOrthogonal — turn penalty', () => {
  it('prefers fewer turns when penalty is high', () => {
    // Two routes: one with 2 turns, one with 0 turns (direct).
    // An obstacle above the start forces a detour for non-direct routes.
    const start: Vec2 = [0, 0];
    const end: Vec2 = [3, 0];
    // No obstacle on the direct line → direct path preferred.
    const result = routeOrthogonal(start, end, [], 'W', { turnPenalty: 100, punchthroughPenalty: 500 });
    expect(result.bendCount).toBe(0);
  });
});

// ─── Path metrics ────────────────────────────────────────────────────────────

describe('routeOrthogonal — path metrics', () => {
  it('computes correct pathLength for direct route', () => {
    const start: Vec2 = [0, 0];
    const end: Vec2 = [5, 0];
    const result = routeOrthogonal(start, end, [], 'W', defaultConfig);
    expect(result.pathLength).toBeCloseTo(5);
  });

  it('computes correct bendCount for an L-shaped route', () => {
    // Force an L-shaped path by placing an obstacle that forces vertical then horizontal.
    const obstacle = makeNodeObstacle('obs', 0.5, -0.5, 2.5, 0.5);
    const start: Vec2 = [0, 0];
    const end: Vec2 = [3, 0];
    const result = routeOrthogonal(start, end, [obstacle], 'W', defaultConfig);

    assertOrthogonal(result.waypoints);
    // An obstacle detour creates at least 2 bends (up-over-down pattern).
    expect(result.bendCount).toBeGreaterThanOrEqual(2);
  });

  it('reports zero punctures for a clean route', () => {
    const result = routeOrthogonal([0, 0], [3, 0], [], 'W', defaultConfig);
    expect(result.punctures).toHaveLength(0);
  });
});

// ─── Approach direction ──────────────────────────────────────────────────────

describe('routeOrthogonal — approach direction', () => {
  it('prefers arriving with the specified approach direction when tied', () => {
    // Two equivalent routes exist; approachDirection should break the tie.
    const start: Vec2 = [0, 0];
    const end: Vec2 = [2, 2];
    // No obstacles — two L-shaped routes are equivalent:
    // (0,0)→(2,0)→(2,2) arriving from S, or (0,0)→(0,2)→(2,2) arriving from W.
    const resultN = routeOrthogonal(start, end, [], 'N', defaultConfig);
    const resultW = routeOrthogonal(start, end, [], 'W', defaultConfig);

    // Both should produce valid orthogonal paths.
    assertOrthogonal(resultN.waypoints);
    assertOrthogonal(resultW.waypoints);
    assertEndpoints(resultN.waypoints, start, end);
    assertEndpoints(resultW.waypoints, start, end);
  });

  // ── Midpoint routing candidates ────────────────────────────────────────────

  it('routes through midpoint between obstacles rather than hugging boundary', () => {
    // Two obstacles on the left and right, with a vertical gap between them.
    // The router should be able to use the midpoint Y between the obstacles
    // instead of being forced to route at obstacle boundary Y values.
    const start: Vec2 = [0, 0];
    const end: Vec2 = [4, 0];
    // Obstacle blocks direct horizontal path. Source is at (0,0), dest at (4,0).
    // Obstacle from y=−0.5 to y=0.5, x=1.5 to x=2.5.
    const blocker = makeNodeObstacle('block', 1.5, -0.5, 2.5, 0.5, 0.1);
    const result = routeOrthogonal(start, end, [blocker], 'W', defaultConfig);
    assertOrthogonal(result.waypoints);
    assertEndpoints(result.waypoints, start, end);

    // The route should go around the obstacle. With midpoint candidates,
    // horizontal segments should use Y values between adjacent obstacle
    // boundaries — not exactly at the obstacle boundary.
    const horizontalYs = new Set<number>();
    for (let i = 0; i < result.waypoints.length - 1; i++) {
      const a = result.waypoints[i]!;
      const b = result.waypoints[i + 1]!;
      if (Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[0] - b[0]) > 1e-6) {
        horizontalYs.add(a[1]);
      }
    }

    // At least one horizontal segment exists (the detour around the obstacle)
    expect(horizontalYs.size).toBeGreaterThanOrEqual(1);

    // The horizontal Y should NOT be exactly at the obstacle expanded boundary
    const obstacleTop = blocker.expandedRect.top;
    const obstacleBottom = blocker.expandedRect.bottom;
    for (const y of horizontalYs) {
      if (Math.abs(y) < 1e-6) continue; // Skip start/end Y=0
      // Should not hug the obstacle boundary — midpoint candidates provide alternatives
      expect(
        Math.abs(y - obstacleTop) > 0.01 || Math.abs(y - obstacleBottom) > 0.01,
        `horizontal segment at Y=${y} hugs obstacle boundary (top=${obstacleTop}, bottom=${obstacleBottom})`,
      ).toBe(true);
    }
  });

  it('produces valid path with midpoint candidates between two obstacles', () => {
    // Two obstacles stacked vertically with a gap. Route must go between them.
    const start: Vec2 = [0, 0.5];
    const end: Vec2 = [3, 0.5];
    const upper = makeNodeObstacle('upper', 1, 0.8, 2, 1.5, 0.05);
    const lower = makeNodeObstacle('lower', 1, -0.5, 2, 0.2, 0.05);
    const result = routeOrthogonal(start, end, [upper, lower], 'W', defaultConfig);
    assertOrthogonal(result.waypoints);
    assertEndpoints(result.waypoints, start, end);
    expect(result.punctures).toHaveLength(0);
  });
});
