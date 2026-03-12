// Bundle inference, face-pair enumeration, and early pruning for the edge routing pipeline.

import type {
  BundleHint,
  EdgeFaceCandidate,
  EdgeRoutingRequest,
  FaceId,
  RoutingNodeMap,
  Vec3,
} from './routingTypes';

// ─── Internal geometry helpers ────────────────────────────────────────────────

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleVec = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];

const getFaceNormalLocal = (face: FaceId): Vec3 => {
  switch (face) {
    case 'left':   return [-1, 0, 0];
    case 'right':  return [1, 0, 0];
    case 'top':    return [0, 1, 0];
    case 'bottom': return [0, -1, 0];
    case 'front':  return [0, 0, 1];
    case 'back':   return [0, 0, -1];
  }
};

const resolveGroupApproachX = (
  candidate: EdgeFaceCandidate,
  fromPos: Vec3,
): number =>
  candidate.bundleHint?.sourceGuideHint?.[0]
  ?? candidate.bundleHint?.sourceAnchorHint?.[0]
  ?? fromPos[0];

const getFaceCenterLocal = (pos: Vec3, size: readonly [number, number, number], face: FaceId): Vec3 => {
  const [x, y, z] = pos;
  const [w, h, d] = size;
  switch (face) {
    case 'left':   return [x - w / 2, y, z];
    case 'right':  return [x + w / 2, y, z];
    case 'top':    return [x, y + h / 2, z];
    case 'bottom': return [x, y - h / 2, z];
    case 'front':  return [x, y, z + d / 2];
    case 'back':   return [x, y, z - d / 2];
  }
};

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const getBoundaryPointAlongFaceNormal = (
  pos: Vec3,
  size: readonly [number, number, number],
  face: FaceId,
): Vec3 => {
  const normal = getFaceNormalLocal(face);
  return [
    pos[0] - normal[0] * size[0] * 0.5,
    pos[1] - normal[1] * size[1] * 0.5,
    pos[2] - normal[2] * size[2] * 0.5,
  ];
};

/** Planar faces used for candidate expansion. Front/back only via locks. */
const PLANAR_FACES: readonly FaceId[] = ['left', 'right', 'top', 'bottom'];

// ─── Bundle hint inference ────────────────────────────────────────────────────

/**
 * Infer bundle hints for a set of edges from their sibling routing requests.
 * Edges from the same source node targeting nodes on both sides and all in the
 * same vertical direction are grouped into a shared trunk. Returns a map keyed
 * by edge ID.
 */
export function inferBundleHints(
  requests: ReadonlyArray<EdgeRoutingRequest>,
  nodeMap: RoutingNodeMap,
): ReadonlyMap<string, BundleHint> {
  const result = new Map<string, BundleHint>();

  // Group flow edges by source node (ignore edges with explicit fromPort or bundleStrength=0).
  const outgoing = new Map<string, EdgeRoutingRequest[]>();
  for (const req of requests) {
    if (req.routing !== 'flow' || req.fromPort) continue;
    const group = outgoing.get(req.fromId) ?? [];
    group.push(req);
    outgoing.set(req.fromId, group);
  }

  outgoing.forEach((group, sourceId) => {
    if (group.length < 2) return;
    const sourceNode = nodeMap.get(sourceId);
    if (!sourceNode) return;

    // Check bundle strength: use minimum across all edges in the group.
    const bundleStrength = group.reduce(
      (acc, req) => Math.min(acc, req.flowBundleStrength),
      Infinity,
    );

    const { position: sourcePos, size: sourceSize } = sourceNode;
    const verticalTolerance = Math.max(0.04, sourceSize[1] * 0.08);
    const flowFaceStub = group[0]?.flowFaceStub ?? 0.05;

    let hasLeft = false;
    let hasRight = false;
    let allPositiveY = true;
    let allNegativeY = true;

    type TargetInfo = {
      edgeId: string;
      targetPos: Vec3;
      projectedDistance: number;
      preferredSideFace?: FaceId;
    };
    const edgeTargets: TargetInfo[] = [];

    for (const req of group) {
      const targetNode = nodeMap.get(req.toId);
      if (!targetNode) return;
      const targetPos = targetNode.position;

      if (targetPos[0] < sourcePos[0] - sourceSize[0] * 0.1) hasLeft = true;
      if (targetPos[0] > sourcePos[0] + sourceSize[0] * 0.1) hasRight = true;

      const dy = targetPos[1] - sourcePos[1];
      if (dy <= verticalTolerance) allPositiveY = false;
      if (dy >= -verticalTolerance) allNegativeY = false;
    }

    if (!hasLeft || !hasRight) return;
    if (!allPositiveY && !allNegativeY) return;

    if (bundleStrength <= 0) {
      return;
    }

    const sourceFace: FaceId = allPositiveY ? 'top' : 'bottom';
    const sourceNormal = getFaceNormalLocal(sourceFace);
    const sourceAnchorHint: Vec3 = [
      sourcePos[0] + sourceNormal[0] * sourceSize[0] * 0.5,
      sourcePos[1] + sourceNormal[1] * sourceSize[1] * 0.5,
      sourcePos[2] + sourceNormal[2] * sourceSize[2] * 0.5,
    ];

    for (const req of group) {
      const targetNode = nodeMap.get(req.toId);
      if (!targetNode) continue;
      const targetPos = targetNode.position;
      const targetBoundary = getBoundaryPointAlongFaceNormal(targetPos, targetNode.size, sourceFace);
      const projectedDistance =
        sourceNormal[0] * (targetBoundary[0] - sourceAnchorHint[0]) +
        sourceNormal[1] * (targetBoundary[1] - sourceAnchorHint[1]) +
        sourceNormal[2] * (targetBoundary[2] - sourceAnchorHint[2]);
      if (projectedDistance <= 0) continue;
      const preferredSideFace: FaceId | undefined =
        targetPos[0] < sourcePos[0] - sourceSize[0] * 0.1
          ? 'left'
          : targetPos[0] > sourcePos[0] + sourceSize[0] * 0.1
            ? 'right'
            : undefined;
      edgeTargets.push({ edgeId: req.id, targetPos, projectedDistance, preferredSideFace });
    }

    if (edgeTargets.length < 2) return;
    edgeTargets.sort((a, b) => a.projectedDistance - b.projectedDistance);

    const minimumBundleDepth = Math.max(
      flowFaceStub * 1.1,
      verticalTolerance * 1.5,
    );
    const bundleTargets = edgeTargets.filter((entry) => entry.projectedDistance >= minimumBundleDepth);
    if (bundleTargets.length < 2) return;

    const nearestProjectedDistance = bundleTargets[0]?.projectedDistance ?? Infinity;
    const availableRun = Number.isFinite(nearestProjectedDistance)
      ? nearestProjectedDistance
      : Math.max(sourceSize[1], flowFaceStub * 3);

    const guideFraction = clamp(0.98 + clamp(bundleStrength, 0, 1.5) * 0.02, 0.98, 1);
    // guideClearance keeps the shared trunk outside the nearest target's expanded
    // obstacle rect. The flow obstacle model expands rects by obstaclePadding on
    // each side, so the guide must stay at least obstaclePadding + faceStub away
    // from the target boundary to avoid the horizontal fan-out segments landing
    // inside the obstacle zone (which would force an underpass or puncture).
    const obstaclePadding = 0.025;
    const guideClearance = Math.max(
      obstaclePadding + flowFaceStub,
      flowFaceStub * 1.5,
    );
    const maxGuideDistance = Math.max(0, availableRun - guideClearance);
    const guideDistance = Math.max(
      Math.min(flowFaceStub * 1.6, maxGuideDistance),
      Math.min(availableRun * guideFraction, maxGuideDistance),
    );

    const sourceGuideHint: Vec3 = addVec(sourceAnchorHint, scaleVec(sourceNormal, guideDistance));

    for (const entry of bundleTargets) {
      result.set(entry.edgeId, {
        edgeId: entry.edgeId,
        sourceFaceHint: sourceFace,
        sourceAnchorHint,
        sourceGuideHint,
        sharedTrunkKey: `${sourceId}:${sourceFace}`,
        sharedTrunkDepth: entry.projectedDistance,
      });
    }

  });

  return result;
}

// ─── Face-pair enumeration ────────────────────────────────────────────────────

/**
 * Expand all valid face-pair candidates for a single edge, respecting explicit
 * port locks and bundle face hints. Returns all candidates before port assignment.
 */
export function enumerateFaceCandidates(
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
  bundleHints: ReadonlyMap<string, BundleHint>,
): ReadonlyArray<EdgeFaceCandidate> {
  const bundleHint = bundleHints.get(request.id);
  const lockedSrcFace: FaceId | undefined = request.fromPort as FaceId | undefined
    ?? bundleHint?.sourceFaceHint;
  const lockedDstFace: FaceId | undefined = request.toPort as FaceId | undefined;

  const fromNode = nodeMap.get(request.fromId);
  const toNode = nodeMap.get(request.toId);
  if (!fromNode || !toNode) return [];

  const fromPos = fromNode.position;
  const toPos = toNode.position;
  const fromSize = fromNode.size;

  // Determine source face candidates.
  let srcFaces: readonly FaceId[];
  if (lockedSrcFace) {
    srcFaces = [lockedSrcFace];
  } else {
    const absDx = Math.abs(toPos[0] - fromPos[0]);
    const absDy = Math.abs(toPos[1] - fromPos[1]);
    const isFlow = request.routing === 'flow';
    if (isFlow) {
      srcFaces = PLANAR_FACES;
    } else if (absDx >= absDy * 1.15) {
      srcFaces = ['left', 'right'];
    } else if (absDy >= absDx * 1.15) {
      srcFaces = ['top', 'bottom'];
    } else {
      srcFaces = PLANAR_FACES;
    }
  }

  // Destination face candidates are always all planar faces (or locked).
  const dstFaces: readonly FaceId[] = lockedDstFace ? [lockedDstFace] : PLANAR_FACES;

  const candidates: EdgeFaceCandidate[] = [];
  for (const srcFace of srcFaces) {
    for (const dstFace of dstFaces) {
      candidates.push({
        edgeId: request.id,
        srcFace,
        dstFace,
        sourceFaceLocked: lockedSrcFace !== undefined,
        destinationFaceLocked: lockedDstFace !== undefined,
        bundleHint: bundleHint ?? undefined,
      });
    }
  }

  // Ensure at least one candidate exists: fall back to nearest-face pair.
  if (candidates.length === 0) {
    const srcFace = nearestFaceLocal(fromPos, toPos, fromSize);
    const dstFace = nearestFaceLocal(toPos, fromPos, toNode.size);
    candidates.push({
      edgeId: request.id,
      srcFace,
      dstFace,
      sourceFaceLocked: false,
      destinationFaceLocked: false,
    });
  }

  return candidates;
}

// ─── Early pruning ────────────────────────────────────────────────────────────

/**
 * Remove candidates that cannot produce a valid route given the request and node
 * positions, before any port assignment or route generation is attempted.
 */
export function pruneImpossibleFaceCandidates(
  candidates: ReadonlyArray<EdgeFaceCandidate>,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
  groupIds: ReadonlySet<string> = new Set(),
): ReadonlyArray<EdgeFaceCandidate> {
  const evaluations = evaluateFaceCandidatePruning(candidates, request, nodeMap, groupIds);
  const pruned = evaluations
    .filter((evaluation) => evaluation.keep)
    .map((evaluation) => evaluation.candidate);

  const fromNode = nodeMap.get(request.fromId);
  const toNode = nodeMap.get(request.toId);
  if (!fromNode || !toNode) return candidates;

  // Never return an empty set — keep at least the nearest-face pair as fallback.
  if (pruned.length === 0) {
    const fromPos = fromNode.position;
    const toPos = toNode.position;
    const fromSize = fromNode.size;
    const srcFace = nearestFaceLocal(fromPos, toPos, fromSize);
    const dstFace = nearestFaceLocal(toPos, fromPos, toNode.size);
    return [{
      edgeId: request.id,
      srcFace,
      dstFace,
      sourceFaceLocked: false,
      destinationFaceLocked: false,
    }];
  }

  return pruned;
}

export type FaceCandidatePruneEvaluation = {
  readonly candidate: EdgeFaceCandidate;
  readonly keep: boolean;
  readonly reasons: ReadonlyArray<string>;
};

export function evaluateFaceCandidatePruning(
  candidates: ReadonlyArray<EdgeFaceCandidate>,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
  groupIds: ReadonlySet<string> = new Set(),
): ReadonlyArray<FaceCandidatePruneEvaluation> {
  const fromNode = nodeMap.get(request.fromId);
  const toNode = nodeMap.get(request.toId);
  if (!fromNode || !toNode) {
    return candidates.map((candidate) => ({
      candidate,
      keep: true,
      reasons: ['missing-endpoint'],
    }));
  }

  const fromPos = fromNode.position;
  const toPos = toNode.position;
  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const dz = toPos[2] - fromPos[2];
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const dirToTarget: Vec3 = [dx / len, dy / len, dz / len];

  return candidates.map((candidate) => {
    const reasons: string[] = [];
    // Never prune locked faces.
    if (candidate.sourceFaceLocked && candidate.destinationFaceLocked) {
      return { candidate, keep: true, reasons: ['fully-locked'] };
    }

    // Prune source face if it strongly points away from the target (and not locked).
    if (!candidate.sourceFaceLocked) {
      const srcNormal = getFaceNormalLocal(candidate.srcFace);
      const dotSrc = srcNormal[0] * dirToTarget[0] + srcNormal[1] * dirToTarget[1] + srcNormal[2] * dirToTarget[2];
      const destinationIsGroup = groupIds.has(request.toId);
      const sourceIsVertical = candidate.srcFace === 'top' || candidate.srcFace === 'bottom';
      const useModerateVerticalAwayThreshold =
        request.routing === 'flow' &&
        destinationIsGroup &&
        sourceIsVertical &&
        absDy >= absDx * 0.85;
      const sourceAwayThreshold = useModerateVerticalAwayThreshold ? -0.55 : -0.7;
      if (dotSrc < sourceAwayThreshold && candidate.srcFace !== 'front' && candidate.srcFace !== 'back') {
        reasons.push('source-face-points-away');
      }
    }

    // Prune destination face if it strongly faces away from the source (and not locked).
    if (!candidate.destinationFaceLocked) {
      const destinationIsGroup = groupIds.has(request.toId);
      const destinationIsSideFace = candidate.dstFace === 'left' || candidate.dstFace === 'right';
      const dstNormal = getFaceNormalLocal(candidate.dstFace);
      const dirFromTarget: Vec3 = [-dirToTarget[0], -dirToTarget[1], -dirToTarget[2]];
      const dotDst = dstNormal[0] * dirFromTarget[0] + dstNormal[1] * dirFromTarget[1] + dstNormal[2] * dirFromTarget[2];
      if (
        dotDst < -0.7 &&
        candidate.dstFace !== 'front' &&
        candidate.dstFace !== 'back' &&
        !(destinationIsGroup && destinationIsSideFace)
      ) {
        reasons.push('destination-face-points-away');
      }

      // Prune destination face if the source node is behind that face (would require
      // passing through the destination node to enter from this side).
      const dstFaceCenter = getFaceCenterLocal(toNode.position, toNode.size, candidate.dstFace);
      const fromToDstFace: Vec3 = [
        fromPos[0] - dstFaceCenter[0],
        fromPos[1] - dstFaceCenter[1],
        fromPos[2] - dstFaceCenter[2],
      ];
      const dotBehind = dstNormal[0] * fromToDstFace[0] + dstNormal[1] * fromToDstFace[1] + dstNormal[2] * fromToDstFace[2];
      if (dotBehind < 0 && !(destinationIsGroup && destinationIsSideFace)) {
        reasons.push('destination-face-behind-node');
      }

      // Prune destination face if the source face is locked AND vertical (top/bottom)
      // AND the destination face is horizontal (left/right). A vertical exit through a
      // bundle trunk naturally continues into a vertical approach at the destination;
      // allowing a horizontal destination face creates an extra 90° bend that makes
      // side-face routes win spuriously over the shorter-bend top-face route.
      if (candidate.sourceFaceLocked && !groupIds.has(request.toId)) {
        const srcIsVertical = candidate.srcFace === 'top' || candidate.srcFace === 'bottom';
        const dstIsHorizontal = candidate.dstFace === 'left' || candidate.dstFace === 'right';
        if (srcIsVertical && dstIsHorizontal) {
          reasons.push('locked-vertical-source-disallows-horizontal-destination');
        }
      }

      if (destinationIsGroup) {
        const srcIsVertical = candidate.srcFace === 'top' || candidate.srcFace === 'bottom';
        const dstIsHorizontal = destinationIsSideFace;
        const dstIsVertical = candidate.dstFace === 'top' || candidate.dstFace === 'bottom';
        const approachX = resolveGroupApproachX(candidate, fromPos);
        const bundledSideOffset = Math.abs(approachX - toPos[0]);
        const approachFromLeft = approachX < toPos[0] - toNode.size[0] * 0.1;
        const approachFromRight = approachX > toPos[0] + toNode.size[0] * 0.1;
        if (srcIsVertical && dstIsHorizontal) {
          if (approachFromLeft && candidate.dstFace === 'right') {
            reasons.push('group-target-side-face-opposes-target-direction');
          }
          if (approachFromRight && candidate.dstFace === 'left') {
            reasons.push('group-target-side-face-opposes-target-direction');
          }
        }
        if (
          srcIsVertical &&
          dstIsVertical &&
          (approachFromLeft || approachFromRight) &&
          bundledSideOffset >= toNode.size[0] * 0.35 &&
          candidate.bundleHint?.sourceGuideHint
        ) {
          reasons.push('group-target-vertical-face-ignores-bundled-side-approach');
        }
      }
    }

    return {
      candidate,
      keep: reasons.length === 0,
      reasons,
    };
  });
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function nearestFaceLocal(
  origin: Vec3,
  target: Vec3,
  size: readonly [number, number, number],
): FaceId {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const dz = target[2] - origin[2];
  const halfW = Math.max(0.001, size[0] * 0.5);
  const halfH = Math.max(0.001, size[1] * 0.5);
  const halfD = Math.max(0.001, size[2] * 0.5);
  const nx = Math.abs(dx) / halfW;
  const ny = Math.abs(dy) / halfH;
  const nz = Math.abs(dz) / halfD;
  if (ny >= nx && ny >= nz) return dy >= 0 ? 'top' : 'bottom';
  if (nx >= nz) return dx >= 0 ? 'right' : 'left';
  return dz >= 0 ? 'front' : 'back';
}

// Re-export for use in tests.
export { getFaceCenterLocal as getFaceCenterForPlanner };
