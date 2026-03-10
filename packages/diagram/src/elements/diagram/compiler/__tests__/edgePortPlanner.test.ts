// Unit tests for per-candidate port assignment in edgePortPlanner.ts.

import { describe, expect, it } from 'vitest';
import { assignPorts, enumeratePortCandidates } from '../edgePortPlanner';
import type {
  EdgeFaceCandidate,
  EdgeRoutingRequest,
  RoutingNodeMap,
  Vec3,
} from '../routingTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNodeMap(
  fromPos: Vec3,
  toPos: Vec3,
  fromSize: readonly [number, number, number] = [2, 2, 1],
  toSize: readonly [number, number, number] = [2, 2, 1],
): RoutingNodeMap {
  return new Map([
    ['from', { position: fromPos, size: fromSize }],
    ['to',   { position: toPos,   size: toSize }],
  ]);
}

function makeRequest(override: Partial<EdgeRoutingRequest> = {}): EdgeRoutingRequest {
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

function makeFaceCandidate(
  srcFace: EdgeFaceCandidate['srcFace'],
  dstFace: EdgeFaceCandidate['dstFace'],
  overrides: Partial<EdgeFaceCandidate> = {},
): EdgeFaceCandidate {
  return {
    edgeId: 'e1',
    srcFace,
    dstFace,
    sourceFaceLocked: false,
    destinationFaceLocked: false,
    ...overrides,
  };
}

// ─── assignPorts — fallback when nodes are missing ────────────────────────────

describe('assignPorts — missing nodes', () => {
  it('returns zero anchors when from-node is absent', () => {
    const nodeMap: RoutingNodeMap = new Map([
      ['to', { position: [5, 0, 0], size: [2, 2, 1] }],
    ]);
    const candidate = makeFaceCandidate('right', 'left');
    const request = makeRequest();
    const result = assignPorts(candidate, request, nodeMap);
    expect(result.sourceAnchor).toEqual([0, 0, 0]);
    expect(result.destinationAnchor).toEqual([0, 0, 0]);
  });

  it('returns zero anchors when to-node is absent', () => {
    const nodeMap: RoutingNodeMap = new Map([
      ['from', { position: [0, 0, 0], size: [2, 2, 1] }],
    ]);
    const candidate = makeFaceCandidate('right', 'left');
    const request = makeRequest();
    const result = assignPorts(candidate, request, nodeMap);
    expect(result.sourceAnchor).toEqual([0, 0, 0]);
    expect(result.destinationAnchor).toEqual([0, 0, 0]);
  });
});

// ─── assignPorts — anchor placement on correct face surface ──────────────────

describe('assignPorts — anchor on face surface', () => {
  it('places source anchor on the right face surface of from-node', () => {
    // Node at [0,0,0] with size [2,2,1]. Right face is at x = 0 + 2/2 = 1.
    const nodeMap = makeNodeMap([0, 0, 0], [8, 0, 0]);
    const candidate = makeFaceCandidate('right', 'left');
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    expect(result.sourceAnchor[0]).toBeCloseTo(1, 5);
  });

  it('places source anchor on the left face surface of from-node', () => {
    // Node at [0,0,0] with size [2,2,1]. Left face is at x = 0 - 2/2 = -1.
    const nodeMap = makeNodeMap([0, 0, 0], [-8, 0, 0]);
    const candidate = makeFaceCandidate('left', 'right');
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    expect(result.sourceAnchor[0]).toBeCloseTo(-1, 5);
  });

  it('places source anchor on the top face surface of from-node', () => {
    // Node at [0,0,0] with size [2,2,1]. Top face is at y = 0 + 2/2 = 1.
    const nodeMap = makeNodeMap([0, 0, 0], [0, 8, 0]);
    const candidate = makeFaceCandidate('top', 'bottom');
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    expect(result.sourceAnchor[1]).toBeCloseTo(1, 5);
  });

  it('places source anchor on the bottom face surface of from-node', () => {
    // Node at [0,0,0] with size [2,2,1]. Bottom face is at y = 0 - 2/2 = -1.
    const nodeMap = makeNodeMap([0, 0, 0], [0, -8, 0]);
    const candidate = makeFaceCandidate('bottom', 'top');
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    expect(result.sourceAnchor[1]).toBeCloseTo(-1, 5);
  });

  it('places destination anchor on the left face surface of to-node', () => {
    // to-node at [8,0,0] with size [2,2,1]. Left face is at x = 8 - 1 = 7.
    const nodeMap = makeNodeMap([0, 0, 0], [8, 0, 0]);
    const candidate = makeFaceCandidate('right', 'left');
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    expect(result.destinationAnchor[0]).toBeCloseTo(7, 5);
  });
});

// ─── assignPorts — center port preference ────────────────────────────────────

describe('assignPorts — center slot preference', () => {
  it('chooses a port near the center of a top face for a directly-above target', () => {
    // Source directly above target — neutral horizontal signal → center port.
    const nodeMap = makeNodeMap([0, 0, 0], [0, 8, 0], [4, 2, 1], [4, 2, 1]);
    const candidate = makeFaceCandidate('top', 'bottom');
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    // Center port on top face should have x close to node center (0).
    expect(result.sourceAnchor[0]).toBeCloseTo(0, 1);
  });
});

// ─── assignPorts — lateral port preference ───────────────────────────────────

describe('assignPorts — lateral port preference', () => {
  it('steers destination port toward source position on top face', () => {
    // Source is to the left of destination (fromPos[0]=-6, toPos[0]=0).
    // Destination top face — free-source destination should be pro-lateral (toward source = left).
    const nodeMap = makeNodeMap([-6, 0, 0], [0, 8, 0], [2, 2, 1], [6, 2, 1]);
    const candidate = makeFaceCandidate('top', 'bottom', { sourceFaceLocked: false });
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    // Destination port on bottom face should be biased toward the left (negative x).
    expect(result.destinationAnchor[0]).toBeLessThan(0);
  });

  it('steers destination port away from source on top face when source face is locked (anti-lateral)', () => {
    // Source locked on top face, target is to the RIGHT.
    // Anti-lateral should push destination port LEFT (away from source side).
    const nodeMap = makeNodeMap([0, 0, 0], [0, 8, 0], [2, 2, 1], [8, 2, 1]);
    const bundleHint = {
      edgeId: 'e1',
      sourceFaceHint: 'top' as const,
      sourceAnchorHint: [0, 1, 0] as Vec3,
      sourceGuideHint: [0, 3, 0] as Vec3,
    };
    // Source face is locked, and the to-node is strongly to the right.
    const candidateRight = makeFaceCandidate('top', 'bottom', {
      sourceFaceLocked: true,
      bundleHint,
    });
    const requestRight = makeRequest({ fromId: 'from', toId: 'to' });
    const nodeMapRight = makeNodeMap([0, 0, 0], [6, 8, 0], [2, 2, 1], [8, 2, 1]);
    const resultRight = assignPorts(candidateRight, requestRight, nodeMapRight);
    // Anti-lateral for locked source + right-side target → port at far side from source (x > nodeCenter=6).
    // Anti-lateral pushes the port AWAY from the source (to the outer edge of the destination face).
    expect(resultRight.destinationAnchor[0]).toBeGreaterThan(6);
  });
});

// ─── assignPorts — bundle hint source anchor passthrough ─────────────────────

describe('assignPorts — bundle hint source anchor', () => {
  it('uses sourceAnchorHint directly when provided in bundleHint', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [5, 5, 0]);
    const sourceAnchorHint: Vec3 = [0, 1, 0];
    const candidate = makeFaceCandidate('top', 'bottom', {
      sourceFaceLocked: true,
      bundleHint: {
        edgeId: 'e1',
        sourceFaceHint: 'top',
        sourceAnchorHint,
        sourceGuideHint: [0, 3, 0],
      },
    });
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    expect(result.sourceAnchor).toEqual(sourceAnchorHint);
  });

  it('computes source anchor geometrically when no sourceAnchorHint is present', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [5, 5, 0]);
    const candidate = makeFaceCandidate('top', 'bottom', {
      bundleHint: {
        edgeId: 'e1',
        sourceFaceHint: 'top',
        // No sourceAnchorHint
      },
    });
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    // Source anchor should be on the top face (y = 0 + 2/2 = 1 for default size [2,2,1]).
    expect(result.sourceAnchor[1]).toBeCloseTo(1, 4);
  });
});

// ─── assignPorts — port index and count metadata ─────────────────────────────

describe('assignPorts — port metadata', () => {
  it('populates sourcePortIndex and sourcePortCount', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [8, 0, 0]);
    const candidate = makeFaceCandidate('right', 'left');
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    expect(result.sourcePortIndex).toBeDefined();
    expect(result.sourcePortCount).toBeDefined();
  });

  it('populates destinationPortIndex and destinationPortCount', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [8, 0, 0]);
    const candidate = makeFaceCandidate('right', 'left');
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    expect(result.destinationPortIndex).toBeDefined();
    expect(result.destinationPortCount).toBeDefined();
  });

  it('does not set sourcePortIndex when bundle hint provides sourceAnchorHint', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [5, 5, 0]);
    const candidate = makeFaceCandidate('top', 'bottom', {
      sourceFaceLocked: true,
      bundleHint: {
        edgeId: 'e1',
        sourceFaceHint: 'top',
        sourceAnchorHint: [0, 1, 0],
      },
    });
    const result = assignPorts(candidate, makeRequest(), nodeMap);
    // When sourceAnchorHint is used, sourcePortIndex is not set by the branch.
    expect(result.sourcePortIndex).toBeUndefined();
  });
});

describe('enumeratePortCandidates', () => {
  it('enumerates multiple source/destination port pairs for a wide face pair', () => {
    const nodeMap = makeNodeMap([0, 0, 0], [0, 8, 0], [10, 2, 1], [10, 2, 1]);
    const candidate = makeFaceCandidate('top', 'bottom');
    const result = enumeratePortCandidates(candidate, makeRequest(), nodeMap);

    expect(result.length).toBeGreaterThan(1);
    expect(new Set(result.map((entry) => `${entry.sourcePortIndex}:${entry.destinationPortIndex}`)).size).toBe(result.length);
  });
});
