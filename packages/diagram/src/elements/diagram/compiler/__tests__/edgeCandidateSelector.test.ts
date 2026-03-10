// Unit tests for lexicographic candidate selection in edgeCandidateSelector.ts.

import { describe, expect, it } from 'vitest';
import { selectBestCandidate } from '../edgeCandidateSelector';
import type { ScoredEdgeCandidate, EdgeCandidateRankKey } from '../routingTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeScoredCandidate(
  id: string,
  rankKey: EdgeCandidateRankKey,
): ScoredEdgeCandidate {
  return {
    edgeId: id,
    srcFace: 'right',
    dstFace: 'left',
    sourceFaceLocked: false,
    destinationFaceLocked: false,
    sourceAnchor: [0, 0, 0],
    destinationAnchor: [5, 0, 0],
    geometry: {
      waypoints: [[0, 0, 0], [5, 0, 0]],
      bendCount: rankKey[2],
      pathLength: rankKey[3],
      routeKind: 'straight',
    },
    score: {
      blockerPenalty: rankKey[0],
      overshootPenalty: rankKey[1],
      bendCount: rankKey[2],
      pathLength: rankKey[3],
      sharedPathPenalty: rankKey[4],
      heuristicPenalty: rankKey[5],
    },
    rankKey,
  };
}

// ─── selectBestCandidate ──────────────────────────────────────────────────────

describe('selectBestCandidate', () => {
  it('returns null for an empty candidate list', () => {
    expect(selectBestCandidate([])).toBeNull();
  });

  it('returns the only candidate when given a single entry', () => {
    const a = makeScoredCandidate('a', [0, 0, 1, 5.0, 0, 0]);
    expect(selectBestCandidate([a])).toBe(a);
  });

  it('selects the candidate with lower blocker penalty first', () => {
    const a = makeScoredCandidate('a', [0, 0, 5, 1.0, 0, 0]);
    const b = makeScoredCandidate('b', [500, 0, 0, 0.1, 0, 0]);
    expect(selectBestCandidate([b, a])?.edgeId).toBe('a');
  });

  it('selects lower overshoot over higher when blocker is equal', () => {
    const a = makeScoredCandidate('a', [0, 0, 5, 1.0, 0, 0]);
    const b = makeScoredCandidate('b', [0, 500, 0, 0.1, 0, 0]);
    expect(selectBestCandidate([b, a])?.edgeId).toBe('a');
  });

  it('selects fewer bends over more when blocker and overshoot are equal', () => {
    const direct = makeScoredCandidate('direct', [0, 0, 1, 10.0, 0, 0]);
    const bendy = makeScoredCandidate('bendy', [0, 0, 3, 4.0, 0, 0]);
    expect(selectBestCandidate([bendy, direct])?.edgeId).toBe('direct');
  });

  it('selects shorter path when bends are equal', () => {
    const short = makeScoredCandidate('short', [0, 0, 2, 3.0, 0, 0]);
    const long = makeScoredCandidate('long', [0, 0, 2, 7.0, 0, 0]);
    expect(selectBestCandidate([long, short])?.edgeId).toBe('short');
  });

  it('selects better shared-path score as tie-breaker after bends and length', () => {
    // Same bends and path length, differ only on sharedPathPenalty.
    const a = makeScoredCandidate('a', [0, 0, 2, 5.0, 0, 10]);
    const b = makeScoredCandidate('b', [0, 0, 2, 5.0, 1, 0]);
    expect(selectBestCandidate([b, a])?.edgeId).toBe('a');
  });

  it('proves bend count outranks shared-path penalty — not a weighted sum', () => {
    // Candidate with fewer bends wins even though its sharedPathPenalty is higher.
    const fewer_bends = makeScoredCandidate('fewer_bends', [0, 0, 1, 5.0, 999, 999]);
    const more_bends_shared = makeScoredCandidate('more_bends_shared', [0, 0, 3, 2.0, 0, 0]);
    expect(selectBestCandidate([more_bends_shared, fewer_bends])?.edgeId).toBe('fewer_bends');
  });

  it('selects lower heuristic penalty as last tie-breaker', () => {
    const a = makeScoredCandidate('a', [0, 0, 1, 5.0, 0, 10]);
    const b = makeScoredCandidate('b', [0, 0, 1, 5.0, 0, 20]);
    expect(selectBestCandidate([b, a])?.edgeId).toBe('a');
  });

  it('is stable when all candidates are equal — returns first', () => {
    const a = makeScoredCandidate('a', [0, 0, 1, 5.0, 0, 0]);
    const b = makeScoredCandidate('b', [0, 0, 1, 5.0, 0, 0]);
    // When all equal, first in list should be returned (stable sort).
    const winner = selectBestCandidate([a, b]);
    expect(winner?.edgeId).toBe('a');
  });

  it('lexicographic ordering: three-candidate comparison proves non-weighted behavior', () => {
    // A and B are identical in everything except sharedPathPenalty (A lower = better).
    const a = makeScoredCandidate('a', [0, 0, 2, 5.0, 0, 0]);
    const b = makeScoredCandidate('b', [0, 0, 2, 5.0, 1, 0]);
    // C has lower bendCount but higher sharedPathPenalty.
    const c = makeScoredCandidate('c', [0, 0, 1, 6.0, 100, 100]);

    // A beats B (lower sharedPathPenalty at position 4).
    expect(selectBestCandidate([b, a])?.edgeId).toBe('a');
    // C beats both A and B because bendCount (position 2) is lower than A and B.
    expect(selectBestCandidate([a, b, c])?.edgeId).toBe('c');
  });
});
