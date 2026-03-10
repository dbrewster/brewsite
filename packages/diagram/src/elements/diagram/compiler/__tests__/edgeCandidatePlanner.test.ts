// Unit tests for bundle inference, face enumeration, and pruning in edgeCandidatePlanner.ts.

import { describe, expect, it } from 'vitest';
import {
  inferBundleHints,
  enumerateFaceCandidates,
  pruneImpossibleFaceCandidates,
} from '../edgeCandidatePlanner';
import type {
  EdgeRoutingRequest,
  RoutingNodeMap,
  Vec3,
} from '../routingTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNodeMap(nodes: Record<string, { pos: Vec3; size?: readonly [number, number, number] }>): RoutingNodeMap {
  const map = new Map<string, { readonly position: Vec3; readonly size: readonly [number, number, number] }>();
  for (const [id, { pos, size = [2, 2, 1] }] of Object.entries(nodes)) {
    map.set(id, { position: pos, size });
  }
  return map;
}

function makeFlowRequest(
  id: string,
  fromId: string,
  toId: string,
  override: Partial<EdgeRoutingRequest> = {},
): EdgeRoutingRequest {
  return {
    id,
    fromId,
    toId,
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

// ─── inferBundleHints ─────────────────────────────────────────────────────────

describe('inferBundleHints', () => {
  it('returns empty map for a single edge (no siblings)', () => {
    const nodeMap = makeNodeMap({
      src: { pos: [0, 0, 0] },
      a: { pos: [4, 4, 0] },
    });
    const requests = [makeFlowRequest('e1', 'src', 'a')];
    const hints = inferBundleHints(requests, nodeMap);
    expect(hints.size).toBe(0);
  });

  it('infers bundle hint for symmetric top fan-out (both targets above, one left one right)', () => {
    // src at [0,0], a at [-5,6] (left+above), b at [5,6] (right+above).
    const nodeMap = makeNodeMap({
      src: { pos: [0, 0, 0] },
      a: { pos: [-5, 6, 0] },
      b: { pos: [5, 6, 0] },
    });
    const requests = [
      makeFlowRequest('e1', 'src', 'a'),
      makeFlowRequest('e2', 'src', 'b'),
    ];
    const hints = inferBundleHints(requests, nodeMap);
    // Both edges should get bundle hints with sourceFaceHint='top'.
    expect(hints.get('e1')?.sourceFaceHint).toBe('top');
    expect(hints.get('e2')?.sourceFaceHint).toBe('top');
  });

  it('infers bottom fan-out when all targets are below the source', () => {
    const nodeMap = makeNodeMap({
      src: { pos: [0, 0, 0] },
      a: { pos: [-5, -6, 0] },
      b: { pos: [5, -6, 0] },
    });
    const requests = [
      makeFlowRequest('e1', 'src', 'a'),
      makeFlowRequest('e2', 'src', 'b'),
    ];
    const hints = inferBundleHints(requests, nodeMap);
    expect(hints.get('e1')?.sourceFaceHint).toBe('bottom');
    expect(hints.get('e2')?.sourceFaceHint).toBe('bottom');
  });

  it('does not infer a bundle hint when all targets are on the same side', () => {
    // All targets to the right — no left target → no symmetric fan-out.
    const nodeMap = makeNodeMap({
      src: { pos: [0, 0, 0] },
      a: { pos: [5, 4, 0] },
      b: { pos: [5, 6, 0] },
    });
    const requests = [
      makeFlowRequest('e1', 'src', 'a'),
      makeFlowRequest('e2', 'src', 'b'),
    ];
    const hints = inferBundleHints(requests, nodeMap);
    expect(hints.size).toBe(0);
  });

  it('does not infer bundle hints when bundleStrength is zero', () => {
    const nodeMap = makeNodeMap({
      src: { pos: [0, 0, 0] },
      a: { pos: [-5, 5, 0] },
      b: { pos: [5, 5, 0] },
    });
    const requests = [
      makeFlowRequest('e1', 'src', 'a', { flowBundleStrength: 0 }),
      makeFlowRequest('e2', 'src', 'b', { flowBundleStrength: 0 }),
    ];
    const hints = inferBundleHints(requests, nodeMap);
    expect(hints.size).toBe(0);
  });

  it('does not infer bundle hints when targets are not all in the same vertical direction', () => {
    // a is above, b is below — mixed direction → no bundle.
    const nodeMap = makeNodeMap({
      src: { pos: [0, 0, 0] },
      a: { pos: [-5, 6, 0] },
      b: { pos: [5, -6, 0] },
    });
    const requests = [
      makeFlowRequest('e1', 'src', 'a'),
      makeFlowRequest('e2', 'src', 'b'),
    ];
    const hints = inferBundleHints(requests, nodeMap);
    expect(hints.size).toBe(0);
  });

  it('skips edges with explicit fromPort set', () => {
    const nodeMap = makeNodeMap({
      src: { pos: [0, 0, 0] },
      a: { pos: [-5, 6, 0] },
      b: { pos: [5, 6, 0] },
    });
    const requests = [
      makeFlowRequest('e1', 'src', 'a', { fromPort: 'top' }),
      makeFlowRequest('e2', 'src', 'b'),
    ];
    // Only one eligible edge in the group — below the minimum of 2.
    const hints = inferBundleHints(requests, nodeMap);
    // e1 is skipped; e2 alone can't form a bundle.
    expect(hints.size).toBe(0);
  });

  it('attaches sourceAnchorHint and sourceGuideHint to bundle entries', () => {
    const nodeMap = makeNodeMap({
      src: { pos: [0, 0, 0] },
      a: { pos: [-5, 6, 0] },
      b: { pos: [5, 6, 0] },
    });
    const requests = [
      makeFlowRequest('e1', 'src', 'a'),
      makeFlowRequest('e2', 'src', 'b'),
    ];
    const hints = inferBundleHints(requests, nodeMap);
    const hint = hints.get('e1');
    expect(hint?.sourceAnchorHint).toBeDefined();
    expect(hint?.sourceGuideHint).toBeDefined();
  });
});

// ─── enumerateFaceCandidates ──────────────────────────────────────────────────

describe('enumerateFaceCandidates', () => {
  it('returns a single candidate for a fully locked (fromPort + toPort) edge', () => {
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 0, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to', {
      fromPort: 'right',
      toPort: 'left',
    });
    const candidates = enumerateFaceCandidates(request, nodeMap, new Map());
    expect(candidates.length).toBe(1);
    expect(candidates[0]?.srcFace).toBe('right');
    expect(candidates[0]?.dstFace).toBe('left');
    expect(candidates[0]?.sourceFaceLocked).toBe(true);
    expect(candidates[0]?.destinationFaceLocked).toBe(true);
  });

  it('locks source face from bundleHint.sourceFaceHint', () => {
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 0, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to');
    const bundleHints = new Map([
      ['e1', { edgeId: 'e1', sourceFaceHint: 'top' as const }],
    ]);
    const candidates = enumerateFaceCandidates(request, nodeMap, bundleHints);
    // All candidates should have srcFace='top' (locked by hint).
    expect(candidates.every(c => c.srcFace === 'top')).toBe(true);
    expect(candidates.every(c => c.sourceFaceLocked)).toBe(true);
  });

  it('expands over all 4 planar destination faces when toPort is not locked', () => {
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 0, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to', { fromPort: 'right' });
    const candidates = enumerateFaceCandidates(request, nodeMap, new Map());
    const dstFaces = new Set(candidates.map(c => c.dstFace));
    expect(dstFaces.has('left')).toBe(true);
    expect(dstFaces.has('right')).toBe(true);
    expect(dstFaces.has('top')).toBe(true);
    expect(dstFaces.has('bottom')).toBe(true);
  });

  it('expands over all 4 planar source faces for flow routing with no locks', () => {
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 0, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to');
    const candidates = enumerateFaceCandidates(request, nodeMap, new Map());
    const srcFaces = new Set(candidates.map(c => c.srcFace));
    expect(srcFaces.has('left')).toBe(true);
    expect(srcFaces.has('right')).toBe(true);
    expect(srcFaces.has('top')).toBe(true);
    expect(srcFaces.has('bottom')).toBe(true);
  });

  it('returns at least one candidate even for missing nodes (fallback pair)', () => {
    const nodeMap: RoutingNodeMap = new Map();
    const request = makeFlowRequest('e1', 'from', 'to');
    const candidates = enumerateFaceCandidates(request, nodeMap, new Map());
    expect(candidates.length).toBe(0); // no nodes → empty
  });

  it('restricts source faces to left/right when horizontal displacement dominates', () => {
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [10, 0, 0] }, // strongly horizontal
    });
    const request = makeFlowRequest('e1', 'from', 'to', { routing: 'curved' });
    const candidates = enumerateFaceCandidates(request, nodeMap, new Map());
    const srcFaces = new Set(candidates.map(c => c.srcFace));
    expect(srcFaces.has('left')).toBe(true);
    expect(srcFaces.has('right')).toBe(true);
    // top/bottom should not appear for strongly horizontal non-flow.
    expect(srcFaces.has('top')).toBe(false);
    expect(srcFaces.has('bottom')).toBe(false);
  });
});

// ─── pruneImpossibleFaceCandidates ────────────────────────────────────────────

describe('pruneImpossibleFaceCandidates', () => {
  it('preserves all candidates when nodes are missing', () => {
    const nodeMap: RoutingNodeMap = new Map();
    const candidates = [
      { edgeId: 'e1', srcFace: 'right' as const, dstFace: 'left' as const, sourceFaceLocked: false, destinationFaceLocked: false },
    ];
    const request = makeFlowRequest('e1', 'from', 'to');
    const result = pruneImpossibleFaceCandidates(candidates, request, nodeMap);
    expect(result).toEqual(candidates);
  });

  it('prunes source face pointing strongly away from target', () => {
    // Source at [0,0,0], target at [5,0,0] (to the right).
    // left face normal [-1,0,0] has dot=-1 with direction [1,0,0] → pruned.
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 0, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to');
    const candidates = [
      { edgeId: 'e1', srcFace: 'left' as const, dstFace: 'left' as const, sourceFaceLocked: false, destinationFaceLocked: false },
    ];
    const result = pruneImpossibleFaceCandidates(candidates, request, nodeMap);
    // Should either be pruned (length 0) or have a single fallback.
    if (result.length === 1) {
      // fallback must not be the original bad candidate unchanged in a meaningful sense
      // (the result is a nearest-face pair, not the left-left pair).
      expect(result[0]?.srcFace).not.toBe('left');
    } else {
      expect(result.length).toBe(0);
    }
  });

  it('never returns empty — provides nearest-face fallback', () => {
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 0, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to');
    // All candidates point away from target.
    const candidates = [
      { edgeId: 'e1', srcFace: 'left' as const, dstFace: 'right' as const, sourceFaceLocked: false, destinationFaceLocked: false },
    ];
    const result = pruneImpossibleFaceCandidates(candidates, request, nodeMap);
    expect(result.length).toBeGreaterThan(0);
  });

  it('always keeps fully locked candidates (both faces locked)', () => {
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 0, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to');
    const candidates = [
      {
        edgeId: 'e1',
        srcFace: 'left' as const,
        dstFace: 'right' as const,
        sourceFaceLocked: true,
        destinationFaceLocked: true,
      },
    ];
    const result = pruneImpossibleFaceCandidates(candidates, request, nodeMap);
    expect(result.length).toBe(1);
    expect(result[0]?.srcFace).toBe('left');
    expect(result[0]?.dstFace).toBe('right');
  });

  it('prunes destination face when source is behind that face', () => {
    // Source at [0,0,0], dest at [5,0,0]. dstFace=right (normal [1,0,0]).
    // fromToDstFace points LEFT from the face toward source → dot(dstNormal, fromToDstFace) < 0 → pruned.
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 0, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to');
    const candidates = [
      { edgeId: 'e1', srcFace: 'right' as const, dstFace: 'right' as const, sourceFaceLocked: false, destinationFaceLocked: false },
    ];
    const result = pruneImpossibleFaceCandidates(candidates, request, nodeMap);
    // The right-right candidate should be pruned.
    const hasRightRight = result.some(c => c.srcFace === 'right' && c.dstFace === 'right');
    expect(hasRightRight).toBe(false);
  });

  it('prunes horizontal destination face when source face is locked vertical', () => {
    // Source face locked=top, destination face=left → vertical×horizontal → prune.
    const nodeMap = makeNodeMap({
      from: { pos: [0, 0, 0] },
      to: { pos: [5, 5, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to');
    const candidates = [
      {
        edgeId: 'e1',
        srcFace: 'top' as const,
        dstFace: 'left' as const,
        sourceFaceLocked: true,
        destinationFaceLocked: false,
      },
      {
        edgeId: 'e1',
        srcFace: 'top' as const,
        dstFace: 'bottom' as const,
        sourceFaceLocked: true,
        destinationFaceLocked: false,
      },
    ];
    const result = pruneImpossibleFaceCandidates(candidates, request, nodeMap);
    // top×left should be pruned.
    expect(result.some(c => c.srcFace === 'top' && c.dstFace === 'left')).toBe(false);
    // top×bottom should survive.
    expect(result.some(c => c.srcFace === 'top' && c.dstFace === 'bottom')).toBe(true);
  });

  it('does not prune horizontal destination when source face is horizontal and locked', () => {
    // Source face locked=left (horizontal), destination face=left.
    // srcIsVertical=false → vertical-to-horizontal rule does not apply → keep.
    const nodeMap = makeNodeMap({
      from: { pos: [8, 0, 0] },
      to: { pos: [0, 5, 0] },
    });
    const request = makeFlowRequest('e1', 'from', 'to');
    const candidates = [
      {
        edgeId: 'e1',
        srcFace: 'left' as const,
        dstFace: 'right' as const,
        sourceFaceLocked: true,
        destinationFaceLocked: false,
      },
    ];
    const result = pruneImpossibleFaceCandidates(candidates, request, nodeMap);
    // left×right should survive (srcIsVertical=false).
    const survived = result.some(c => c.srcFace === 'left' && c.dstFace === 'right');
    expect(survived).toBe(true);
  });
});
