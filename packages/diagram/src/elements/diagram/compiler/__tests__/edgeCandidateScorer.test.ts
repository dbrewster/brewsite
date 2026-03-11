// Unit tests for candidate scoring and rank-key projection in edgeCandidateScorer.ts.

import { describe, expect, it } from 'vitest';
import { scoreCandidate, candidateToRankKey } from '../edgeCandidateScorer';
import type { RoutedEdgeCandidate, Vec3 } from '../routingTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDirectCandidate(
  from: Vec3,
  to: Vec3,
): RoutedEdgeCandidate {
  return {
    edgeId: 'e1',
    srcFace: 'right',
    dstFace: 'left',
    sourceFaceLocked: false,
    destinationFaceLocked: false,
    sourceAnchor: from,
    destinationAnchor: to,
    geometry: {
      waypoints: [from, to],
      bendCount: 0,
      pathLength: Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]),
      routeKind: 'straight',
      acuteTurnCount: 0,
      reversalCount: 0,
      orthogonalDeviationPenalty: 0,
      groupIngressPenalty: 0,
    },
  };
}

function makeBendyCandidate(
  from: Vec3,
  mid: Vec3,
  to: Vec3,
): RoutedEdgeCandidate {
  const seg1 = Math.hypot(mid[0] - from[0], mid[1] - from[1], mid[2] - from[2]);
  const seg2 = Math.hypot(to[0] - mid[0], to[1] - mid[1], to[2] - mid[2]);
  return {
    edgeId: 'e2',
    srcFace: 'right',
    dstFace: 'top',
    sourceFaceLocked: false,
    destinationFaceLocked: false,
    sourceAnchor: from,
    destinationAnchor: to,
    geometry: {
      waypoints: [from, mid, to],
      bendCount: 1,
      pathLength: seg1 + seg2,
      routeKind: 'flow',
      acuteTurnCount: 0,
      reversalCount: 0,
      orthogonalDeviationPenalty: 0,
      groupIngressPenalty: 0,
    },
  };
}

function makeBlockedCandidate(from: Vec3, to: Vec3): RoutedEdgeCandidate {
  return {
    ...makeDirectCandidate(from, to),
    geometry: {
      ...makeDirectCandidate(from, to).geometry,
      obstacleIds: ['obstacle-a', 'obstacle-b'],
    },
  };
}

// ─── scoreCandidate ───────────────────────────────────────────────────────────

describe('scoreCandidate', () => {
  const fromPos: Vec3 = [0, 0, 0];
  const toPos: Vec3 = [5, 0, 0];
  const nodeSize: readonly [number, number, number] = [2, 2, 1];

  it('direct route has zero bend count', () => {
    const candidate = makeDirectCandidate(fromPos, toPos);
    const score = scoreCandidate(candidate, fromPos, toPos, nodeSize, nodeSize, undefined);
    expect(score.bendCount).toBe(0);
  });

  it('bendy route has non-zero bend count', () => {
    const candidate = makeBendyCandidate(fromPos, [0, 3, 0], toPos);
    const score = scoreCandidate(candidate, fromPos, toPos, nodeSize, nodeSize, undefined);
    expect(score.bendCount).toBe(1);
  });

  it('direct route has positive path length', () => {
    const candidate = makeDirectCandidate(fromPos, toPos);
    const score = scoreCandidate(candidate, fromPos, toPos, nodeSize, nodeSize, undefined);
    expect(score.pathLength).toBeCloseTo(5, 5);
  });

  it('zero blocker penalty for route with no obstacles', () => {
    const candidate = makeDirectCandidate(fromPos, toPos);
    const score = scoreCandidate(candidate, fromPos, toPos, nodeSize, nodeSize, undefined);
    expect(score.blockerPenalty).toBe(0);
  });

  it('non-zero blocker penalty for route with obstacle IDs', () => {
    const candidate = makeBlockedCandidate(fromPos, toPos);
    const score = scoreCandidate(candidate, fromPos, toPos, nodeSize, nodeSize, undefined);
    expect(score.blockerPenalty).toBeGreaterThan(0);
  });

  it('blocker penalty scales with obstacle count', () => {
    const oneObstacle: RoutedEdgeCandidate = {
      ...makeDirectCandidate(fromPos, toPos),
      geometry: { ...makeDirectCandidate(fromPos, toPos).geometry, obstacleIds: ['o1'] },
    };
    const twoObstacles: RoutedEdgeCandidate = {
      ...makeDirectCandidate(fromPos, toPos),
      geometry: { ...makeDirectCandidate(fromPos, toPos).geometry, obstacleIds: ['o1', 'o2'] },
    };
    const s1 = scoreCandidate(oneObstacle, fromPos, toPos, nodeSize, nodeSize, undefined);
    const s2 = scoreCandidate(twoObstacles, fromPos, toPos, nodeSize, nodeSize, undefined);
    expect(s2.blockerPenalty).toBe(s1.blockerPenalty * 2);
  });

  it('overshooting route has higher overshoot penalty than direct route', () => {
    // Route that dips behind the source before heading to the target.
    const overshootCandidate: RoutedEdgeCandidate = {
      ...makeDirectCandidate(fromPos, toPos),
      geometry: {
        waypoints: [fromPos, [-3, 0, 0], toPos],
        bendCount: 2,
        pathLength: 11,
        routeKind: 'curved',
        acuteTurnCount: 0,
        reversalCount: 0,
        orthogonalDeviationPenalty: 0,
        groupIngressPenalty: 0,
      },
    };
    const directScore = scoreCandidate(makeDirectCandidate(fromPos, toPos), fromPos, toPos, nodeSize, nodeSize, undefined);
    const overshootScore = scoreCandidate(overshootCandidate, fromPos, toPos, nodeSize, nodeSize, undefined);
    expect(overshootScore.overshootPenalty).toBeGreaterThan(directScore.overshootPenalty);
  });

  it('retreating route has higher overshoot penalty than a target-directed route', () => {
    const retreatingCandidate: RoutedEdgeCandidate = {
      ...makeDirectCandidate(fromPos, toPos),
      geometry: {
        waypoints: [fromPos, [0, 3, 0], [5, 3, 0], toPos],
        bendCount: 2,
        pathLength: 11,
        routeKind: 'flow',
        acuteTurnCount: 0,
        reversalCount: 0,
        orthogonalDeviationPenalty: 0,
        groupIngressPenalty: 0,
      },
    };
    const targetDirectedCandidate: RoutedEdgeCandidate = {
      ...makeDirectCandidate(fromPos, toPos),
      geometry: {
        waypoints: [fromPos, [2, 0, 0], toPos],
        bendCount: 0,
        pathLength: 5,
        routeKind: 'flow',
        acuteTurnCount: 0,
        reversalCount: 0,
        orthogonalDeviationPenalty: 0,
        groupIngressPenalty: 0,
      },
    };

    const retreatingScore = scoreCandidate(retreatingCandidate, fromPos, toPos, nodeSize, nodeSize, undefined);
    const targetDirectedScore = scoreCandidate(targetDirectedCandidate, fromPos, toPos, nodeSize, nodeSize, undefined);

    expect(retreatingScore.overshootPenalty).toBeGreaterThan(targetDirectedScore.overshootPenalty);
  });

  it('direct route produces lower total rank than bendy route (blocker/overshoot equal)', () => {
    const direct = makeDirectCandidate(fromPos, toPos);
    const bendy = makeBendyCandidate(fromPos, [0, 4, 0], toPos);
    const directScore = scoreCandidate(direct, fromPos, toPos, nodeSize, nodeSize, undefined);
    const bendyScore = scoreCandidate(bendy, fromPos, toPos, nodeSize, nodeSize, undefined);
    // Direct must have fewer or equal bends.
    expect(directScore.bendCount).toBeLessThan(bendyScore.bendCount);
  });

  it('sharedPathPenalty is zero when candidate sharedTrunkKey matches hinted trunk key', () => {
    const candidate: RoutedEdgeCandidate = {
      ...makeDirectCandidate(fromPos, toPos),
      sharedTrunkKey: 'src:top',
    };
    const score = scoreCandidate(candidate, fromPos, toPos, nodeSize, nodeSize, 'src:top');
    expect(score.sharedPathPenalty).toBe(0);
  });

  it('sharedPathPenalty is one when bundle hint exists and candidate lacks matching trunk key', () => {
    const candidate = makeDirectCandidate(fromPos, toPos); // no sharedTrunkKey
    const score = scoreCandidate(candidate, fromPos, toPos, nodeSize, nodeSize, 'src:top');
    expect(score.sharedPathPenalty).toBe(1);
  });

  it('sharedPathPenalty is zero when no bundle hint exists for this edge', () => {
    const candidate = makeDirectCandidate(fromPos, toPos);
    const score = scoreCandidate(candidate, fromPos, toPos, nodeSize, nodeSize, undefined);
    expect(score.sharedPathPenalty).toBe(0);
  });
});

// ─── candidateToRankKey ────────────────────────────────────────────────────────

describe('candidateToRankKey', () => {
  it('projects score fields into the correct tuple positions', () => {
    const score = {
      blockerPenalty: 100,
      overshootPenalty: 50,
      acuteTurnPenalty: 25,
      reversalPenalty: 10,
      bendCount: 2,
      pathLength: 7.5,
      sharedPathPenalty: 1,
      heuristicPenalty: 30,
    };
    const key = candidateToRankKey(score);
    expect(key[0]).toBe(100);   // blocker
    expect(key[1]).toBe(50);    // overshoot
    expect(key[2]).toBe(25);    // acute turns
    expect(key[3]).toBe(10);    // reversals
    expect(key[4]).toBe(2);     // bends
    expect(key[5]).toBe(7.5);   // length
    expect(key[6]).toBe(1);     // shared path
    expect(key[7]).toBe(30);    // heuristic
  });

  it('produces an 8-element tuple', () => {
    const score = {
      blockerPenalty: 0,
      overshootPenalty: 0,
      acuteTurnPenalty: 0,
      reversalPenalty: 0,
      bendCount: 0,
      pathLength: 0,
      sharedPathPenalty: 0,
      heuristicPenalty: 0,
    };
    expect(candidateToRankKey(score).length).toBe(8);
  });

  it('round-trips through scoreCandidate → candidateToRankKey for a direct route', () => {
    const from: Vec3 = [0, 0, 0];
    const to: Vec3 = [4, 0, 0];
    const size: readonly [number, number, number] = [2, 2, 1];
    const candidate = makeDirectCandidate(from, to);
    const score = scoreCandidate(candidate, from, to, size, size, undefined);
    const key = candidateToRankKey(score);
    // Blocker is zero, overshoot is zero for a direct route.
    expect(key[0]).toBe(0);
    expect(key[1]).toBe(0);
    expect(key[2]).toBe(0);     // no acute turns
    expect(key[3]).toBe(0);     // no reversals
    expect(key[4]).toBe(0);     // no bends
    expect(key[5]).toBeCloseTo(4, 5);
  });
});
