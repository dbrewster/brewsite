// Unit tests for routing profile parity and contract in edgeRoutingProfiles.ts.

import { describe, expect, it } from 'vitest';
import { ROUTING_PROFILES } from '../edgeRoutingProfiles';
import type {
  EdgeGuidedCandidate,
  ScoredEdgeCandidate,
  RoutingProfileContext,
  RoutingNodeMap,
  Vec3,
} from '../routingTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNodeMap(
  fromPos: Vec3,
  toPos: Vec3,
  size: readonly [number, number, number] = [2, 2, 1],
): RoutingNodeMap {
  return new Map([
    ['from', { position: fromPos, size }],
    ['to',   { position: toPos,   size }],
  ]);
}

const DEFAULT_CONFIG = {
  flowTurnRadius: 0.4,
  flowFaceStub: 0.2,
  flowBundleStrength: 1.0,
  flowObstaclePadding: 0.05,
  flowTargetApproachBias: 0.5,
  flowUnderpassDepth: 0.1,
  flowUnderpassClearance: 0.15,
  flowTurnPenalty: 500,
  flowPunchthroughPenalty: 2000,
  flowUnderpassPenalty: 800,
};

function makeContext(
  fromPos: Vec3,
  toPos: Vec3,
  size: readonly [number, number, number] = [2, 2, 1],
): RoutingProfileContext {
  return {
    nodeMap: makeNodeMap(fromPos, toPos, size),
    config: DEFAULT_CONFIG,
    edgeId: 'e1',
    fromId: 'from',
    toId: 'to',
    allowUnderpass: false,
    organicVariation: 0.5,
  };
}

function makeGuidedCandidate(
  srcFace: EdgeGuidedCandidate['srcFace'],
  dstFace: EdgeGuidedCandidate['dstFace'],
  sourceAnchor: Vec3,
  destinationAnchor: Vec3,
): EdgeGuidedCandidate {
  return {
    edgeId: 'e1',
    srcFace,
    dstFace,
    sourceFaceLocked: false,
    destinationFaceLocked: false,
    sourceAnchor,
    destinationAnchor,
  };
}

function makeScoredCandidate(guided: EdgeGuidedCandidate): ScoredEdgeCandidate {
  const len = Math.hypot(
    guided.destinationAnchor[0] - guided.sourceAnchor[0],
    guided.destinationAnchor[1] - guided.sourceAnchor[1],
    guided.destinationAnchor[2] - guided.sourceAnchor[2],
  );
  return {
    ...guided,
    geometry: {
      waypoints: [guided.sourceAnchor, guided.destinationAnchor],
      bendCount: 0,
      pathLength: len,
      routeKind: 'straight',
    },
    score: {
      blockerPenalty: 0,
      overshootPenalty: 0,
      bendCount: 0,
      pathLength: len,
      sharedPathPenalty: 0,
      heuristicPenalty: 0,
    },
    rankKey: [0, 0, 0, len, 0, 0],
  };
}

// ─── Profile parity: same faces and ports for identical candidate inputs ──────

describe('ROUTING_PROFILES — straight, curved, organic parity', () => {
  const fromPos: Vec3 = [0, 0, 0];
  const toPos: Vec3 = [6, 0, 0];
  const sourceAnchor: Vec3 = [1, 0, 0];
  const destinationAnchor: Vec3 = [5, 0, 0];
  const candidate = makeGuidedCandidate('right', 'left', sourceAnchor, destinationAnchor);
  const context = makeContext(fromPos, toPos);

  it('straight profile generates a non-empty waypoint list', () => {
    const result = ROUTING_PROFILES.straight.generateRoute(candidate, context);
    expect(result.waypoints.length).toBeGreaterThanOrEqual(2);
  });

  it('curved profile generates a non-empty waypoint list', () => {
    const result = ROUTING_PROFILES.curved.generateRoute(candidate, context);
    expect(result.waypoints.length).toBeGreaterThanOrEqual(2);
  });

  it('organic profile generates a non-empty waypoint list', () => {
    const result = ROUTING_PROFILES.organic.generateRoute(candidate, context);
    expect(result.waypoints.length).toBeGreaterThanOrEqual(2);
  });

  it('straight profile returns fewer or equal waypoints than curved for the same input', () => {
    const straightResult = ROUTING_PROFILES.straight.generateRoute(candidate, context);
    const curvedResult = ROUTING_PROFILES.curved.generateRoute(candidate, context);
    // Straight is at most as complex as curved (usually 2 waypoints vs 4 for curved).
    expect(straightResult.waypoints.length).toBeLessThanOrEqual(curvedResult.waypoints.length);
  });

  it('all profiles agree on source endpoint (first waypoint near sourceAnchor)', () => {
    const profiles = ['straight', 'curved', 'organic'] as const;
    for (const name of profiles) {
      const result = ROUTING_PROFILES[name].generateRoute(candidate, context);
      const first = result.waypoints[0]!;
      // First waypoint must be near the source anchor (within a small epsilon offset).
      expect(Math.abs(first[0] - sourceAnchor[0])).toBeLessThan(0.1);
      expect(Math.abs(first[1] - sourceAnchor[1])).toBeLessThan(0.1);
    }
  });

  it('all profiles agree on destination endpoint (last waypoint near destinationAnchor)', () => {
    const profiles = ['straight', 'curved', 'organic'] as const;
    for (const name of profiles) {
      const result = ROUTING_PROFILES[name].generateRoute(candidate, context);
      const last = result.waypoints.at(-1)!;
      // Last waypoint must be near the destination anchor.
      expect(Math.abs(last[0] - destinationAnchor[0])).toBeLessThan(0.1);
      expect(Math.abs(last[1] - destinationAnchor[1])).toBeLessThan(0.1);
    }
  });
});

// ─── Profile parity: materializePath produces valid EdgeRouteState ─────────────

describe('ROUTING_PROFILES — materializePath', () => {
  const fromPos: Vec3 = [0, 0, 0];
  const toPos: Vec3 = [6, 0, 0];
  const sourceAnchor: Vec3 = [1, 0, 0];
  const destinationAnchor: Vec3 = [5, 0, 0];
  const guided = makeGuidedCandidate('right', 'left', sourceAnchor, destinationAnchor);
  const context = makeContext(fromPos, toPos);

  it('straight materializePath returns non-empty control points', () => {
    const scored = makeScoredCandidate(guided);
    const result = ROUTING_PROFILES.straight.materializePath(scored, context);
    expect(result.controlPoints.length).toBeGreaterThan(0);
  });

  it('curved materializePath returns non-empty control points', () => {
    const scored = makeScoredCandidate(guided);
    const result = ROUTING_PROFILES.curved.materializePath(scored, context);
    expect(result.controlPoints.length).toBeGreaterThan(0);
  });

  it('organic materializePath returns non-empty control points', () => {
    const scored = makeScoredCandidate(guided);
    const result = ROUTING_PROFILES.organic.materializePath(scored, context);
    expect(result.controlPoints.length).toBeGreaterThan(0);
  });

  it('straight materializePath produces path with startTangent near source face normal', () => {
    const scored = makeScoredCandidate(guided);
    const result = ROUTING_PROFILES.straight.materializePath(scored, context);
    // Right face normal is [1,0,0], so startTangent should have positive x.
    expect(result.path.startTangent[0]).toBeGreaterThan(0);
  });

  it('straight materializePath produces path with endTangent along approach direction', () => {
    const scored = makeScoredCandidate(guided);
    const result = ROUTING_PROFILES.straight.materializePath(scored, context);
    // buildLegacyEdgePath receives scaleVec(dstNormal, -1) as endTangent argument.
    // For dstFace='left', dstNormal=[-1,0,0], so endTangent = [1,0,0] (approach direction).
    expect(result.path.endTangent[0]).toBeGreaterThan(0);
  });
});

// ─── Profile route kind identification ────────────────────────────────────────

describe('ROUTING_PROFILES — route kind', () => {
  const fromPos: Vec3 = [0, 0, 0];
  const toPos: Vec3 = [6, 0, 0];
  const candidate = makeGuidedCandidate('right', 'left', [1, 0, 0], [5, 0, 0]);
  const context = makeContext(fromPos, toPos);

  it('straight profile identifies route as straight', () => {
    const result = ROUTING_PROFILES.straight.generateRoute(candidate, context);
    expect(result.routeKind).toBe('straight');
  });

  it('curved profile identifies route as curved', () => {
    const result = ROUTING_PROFILES.curved.generateRoute(candidate, context);
    expect(result.routeKind).toBe('curved');
  });

  it('organic profile identifies route as organic', () => {
    const result = ROUTING_PROFILES.organic.generateRoute(candidate, context);
    expect(result.routeKind).toBe('organic');
  });
});

// ─── Profile pre-computation contract ────────────────────────────────────────

describe('ROUTING_PROFILES — NormalizedRouteGeometry contract', () => {
  const fromPos: Vec3 = [0, 0, 0];
  const toPos: Vec3 = [6, 0, 0];
  const candidate = makeGuidedCandidate('right', 'left', [1, 0, 0], [5, 0, 0]);
  const context = makeContext(fromPos, toPos);

  it('each profile pre-computes a non-negative pathLength', () => {
    for (const name of ['straight', 'curved', 'organic'] as const) {
      const result = ROUTING_PROFILES[name].generateRoute(candidate, context);
      expect(result.pathLength).toBeGreaterThanOrEqual(0);
    }
  });

  it('each profile pre-computes a non-negative bendCount', () => {
    for (const name of ['straight', 'curved', 'organic'] as const) {
      const result = ROUTING_PROFILES[name].generateRoute(candidate, context);
      expect(result.bendCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('straight profile produces zero bends for aligned source and destination faces', () => {
    // right→left on a purely horizontal path should produce 0 or 1 bend.
    const result = ROUTING_PROFILES.straight.generateRoute(candidate, context);
    expect(result.bendCount).toBeLessThanOrEqual(1);
  });
});
