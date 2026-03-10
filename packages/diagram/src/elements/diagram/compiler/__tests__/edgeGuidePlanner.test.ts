// Unit tests for guide point generation in edgeGuidePlanner.ts.

import { describe, expect, it } from 'vitest';
import { buildCandidateGuides } from '../edgeGuidePlanner';
import type {
  EdgePortCandidate,
  EdgeRoutingRequest,
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

function makeRequest(
  override: Partial<EdgeRoutingRequest> = {},
): EdgeRoutingRequest {
  return {
    id: 'e1',
    fromId: 'from',
    toId: 'to',
    routing: 'flow',
    landing: 'shortest-path',
    thickness: 0.05,
    flowTurnRadius: 0.4,
    flowFaceStub: 0.2,
    flowBundleStrength: 1.0,
    flowTargetApproachBias: 0.5,
    allowUnderpass: false,
    ...override,
  };
}

function makePortCandidate(
  srcFace: EdgePortCandidate['srcFace'],
  dstFace: EdgePortCandidate['dstFace'],
  sourceAnchor: Vec3,
  destinationAnchor: Vec3,
  overrides: Partial<EdgePortCandidate> = {},
): EdgePortCandidate {
  return {
    edgeId: 'e1',
    srcFace,
    dstFace,
    sourceFaceLocked: false,
    destinationFaceLocked: false,
    sourceAnchor,
    destinationAnchor,
    ...overrides,
  };
}

// ─── buildCandidateGuides — non-flow routing ──────────────────────────────────

describe('buildCandidateGuides — non-flow routing', () => {
  it('does not produce a destination guide for curved routing', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [6, 0, 0]);
    const request = makeRequest({ routing: 'curved' });
    const candidate = makePortCandidate('right', 'left', [1, 0, 0], [5, 0, 0]);
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.destinationGuide).toBeUndefined();
  });

  it('does not produce a destination guide for straight routing', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [6, 0, 0]);
    const request = makeRequest({ routing: 'straight' });
    const candidate = makePortCandidate('right', 'left', [1, 0, 0], [5, 0, 0]);
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.destinationGuide).toBeUndefined();
  });
});

// ─── buildCandidateGuides — flow routing guide rejection ─────────────────────

describe('buildCandidateGuides — flow routing guide rejection', () => {
  it('rejects destination guide when face normal does not face the source (face_not_facing_source)', () => {
    // from is to the RIGHT of to. dstFace=right means the right face points away from the source.
    const nodeMap = makeNodeMap([0, 0, 0], [6, 0, 0]);
    const request = makeRequest({ flowTargetApproachBias: 1.0 });
    // destinationAnchor on the right face of 'to' — normal [1,0,0] points AWAY from [0,0,0].
    const candidate = makePortCandidate('right', 'right', [1, 0, 0], [7, 0, 0]);
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.destinationGuide).toBeUndefined();
  });

  it('keeps valid destination guide when face normal faces the source', () => {
    // from=[0,0,0], to=[6,0,0]. dstFace=left means left face at x≈5, normal [-1,0,0] points toward source.
    const nodeMap = makeNodeMap([0, 0, 0], [6, 0, 0]);
    const request = makeRequest({ flowTargetApproachBias: 1.0 });
    const candidate = makePortCandidate('right', 'left', [1, 0, 0], [5, 0, 0]);
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.destinationGuide).toBeDefined();
  });

  it('returns no destination guide when flowTargetApproachBias is zero', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [6, 0, 0]);
    const request = makeRequest({ flowTargetApproachBias: 0 });
    const candidate = makePortCandidate('right', 'left', [1, 0, 0], [5, 0, 0]);
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.destinationGuide).toBeUndefined();
  });

  it('rejects destination guide when it would cause uphill backtracking against source normal', () => {
    // Source exits top (normal=[0,1,0]). Destination guide below source guide → dot < 0.
    // from=[0,0,0] exits 'top', sourceGuide is above the source anchor.
    // Set up so destinationGuide is BELOW sourceGuide, causing uphill backtracking.
    const nodeMap = makeNodeMap([0, 0, 0], [0, -8, 0]);
    const request = makeRequest({ flowTargetApproachBias: 1.0 });
    // Bundle hint provides sourceGuide above source anchor.
    const bundleHint = {
      edgeId: 'e1',
      sourceFaceHint: 'top' as const,
      sourceAnchorHint: [0, 1, 0] as Vec3,
      sourceGuideHint: [0, 3, 0] as Vec3,
    };
    const candidate = makePortCandidate('top', 'top', [0, 1, 0], [0, -7, 0], {
      sourceFaceLocked: true,
      bundleHint,
    });
    const result = buildCandidateGuides(candidate, request, nodeMap);
    // destinationGuide if generated would be ABOVE [0,-7,0] (top normal [0,1,0]).
    // That would point toward [0,-5,0] approx. Vector from sourceGuide [0,3,0] to
    // destGuide [0,-5,0] is [0,-8,0]. Dot with srcNormal [0,1,0] = -8 < 0 → rejected.
    expect(result.destinationGuide).toBeUndefined();
  });

  it('rejects destination guide when source face is locked and destination face is perpendicular', () => {
    // Source face is locked top (normal=[0,1,0]), destination face is left (normal=[-1,0,0]).
    // Parallelism = |dot([0,1,0], [-1,0,0])| = 0 < 0.1 → reject.
    const nodeMap = makeNodeMap([0, 0, 0], [4, 4, 0]);
    const request = makeRequest({ flowTargetApproachBias: 1.0 });
    const candidate = makePortCandidate('top', 'left', [0, 1, 0], [3, 4, 0], {
      sourceFaceLocked: true,
    });
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.destinationGuide).toBeUndefined();
  });

  it('keeps destination guide when source face is locked and destination face is parallel (top→bottom)', () => {
    // Source top (normal=[0,1,0]), destination bottom (normal=[0,-1,0]).
    // Parallelism = |dot([0,1,0],[0,-1,0])| = 1 ≥ 0.1 → keep guide.
    const nodeMap = makeNodeMap([0, 0, 0], [0, 6, 0]);
    const request = makeRequest({ flowTargetApproachBias: 1.0 });
    const candidate = makePortCandidate('top', 'bottom', [0, 1, 0], [0, 5, 0], {
      sourceFaceLocked: true,
    });
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.destinationGuide).toBeDefined();
  });
});

// ─── buildCandidateGuides — source guide passthrough ─────────────────────────

describe('buildCandidateGuides — source guide passthrough', () => {
  it('attaches sourceGuide from bundleHint.sourceGuideHint when present', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [5, 0, 0]);
    const request = makeRequest({ routing: 'straight' });
    const sourceGuideHint: Vec3 = [0, 2, 0];
    const candidate = makePortCandidate('top', 'bottom', [0, 1, 0], [5, -1, 0], {
      bundleHint: {
        edgeId: 'e1',
        sourceFaceHint: 'top',
        sourceGuideHint,
      },
    });
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.sourceGuide).toEqual(sourceGuideHint);
  });

  it('produces no sourceGuide when bundleHint has no sourceGuideHint', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [5, 0, 0]);
    const request = makeRequest({ routing: 'flow' });
    const candidate = makePortCandidate('right', 'left', [1, 0, 0], [4, 0, 0]);
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.sourceGuide).toBeUndefined();
  });
});

// ─── buildCandidateGuides — missing nodes ─────────────────────────────────────

describe('buildCandidateGuides — missing nodes', () => {
  it('returns candidate unchanged when from-node is missing from nodeMap', () => {
    const nodeMap: RoutingNodeMap = new Map([
      ['to', { position: [5, 0, 0], size: [2, 2, 1] }],
    ]);
    const request = makeRequest();
    const candidate = makePortCandidate('right', 'left', [1, 0, 0], [4, 0, 0]);
    const result = buildCandidateGuides(candidate, request, nodeMap);
    expect(result.sourceGuide).toBeUndefined();
    expect(result.destinationGuide).toBeUndefined();
  });
});
