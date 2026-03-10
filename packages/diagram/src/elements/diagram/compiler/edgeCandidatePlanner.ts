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
      const projectedDistance = sourceNormal[1] * (targetPos[1] - sourceAnchorHint[1]);
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

    const bundleTargets = edgeTargets;
    const nearestProjectedDistance = bundleTargets[0]?.projectedDistance ?? Infinity;
    const availableRun = Number.isFinite(nearestProjectedDistance)
      ? nearestProjectedDistance
      : Math.max(sourceSize[1], flowFaceStub * 3);

    const guideFraction = clamp(0.15 + clamp(bundleStrength, 0, 1.5) * 0.35, 0.15, 0.65);
    const guideDistance = Math.max(
      flowFaceStub * 1.25,
      Math.min(
        availableRun * guideFraction,
        availableRun - Math.max(0.025, flowFaceStub * 0.5),
      ),
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
  const fromNode = nodeMap.get(request.fromId);
  const toNode = nodeMap.get(request.toId);
  if (!fromNode || !toNode) return candidates;

  const fromPos = fromNode.position;
  const toPos = toNode.position;
  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const dz = toPos[2] - fromPos[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const dirToTarget: Vec3 = [dx / len, dy / len, dz / len];

  const pruned = candidates.filter((c) => {
    // Never prune locked faces.
    if (c.sourceFaceLocked && c.destinationFaceLocked) return true;

    // Prune source face if it strongly points away from the target (and not locked).
    if (!c.sourceFaceLocked) {
      const srcNormal = getFaceNormalLocal(c.srcFace);
      const dotSrc = srcNormal[0] * dirToTarget[0] + srcNormal[1] * dirToTarget[1] + srcNormal[2] * dirToTarget[2];
      if (dotSrc < -0.7 && c.srcFace !== 'front' && c.srcFace !== 'back') return false;
    }

    // Prune destination face if it strongly faces away from the source (and not locked).
    if (!c.destinationFaceLocked) {
      const dstNormal = getFaceNormalLocal(c.dstFace);
      const dirFromTarget: Vec3 = [-dirToTarget[0], -dirToTarget[1], -dirToTarget[2]];
      const dotDst = dstNormal[0] * dirFromTarget[0] + dstNormal[1] * dirFromTarget[1] + dstNormal[2] * dirFromTarget[2];
      if (dotDst < -0.7 && c.dstFace !== 'front' && c.dstFace !== 'back') return false;

      // Prune destination face if the source node is behind that face (would require
      // passing through the destination node to enter from this side).
      const dstFaceCenter = getFaceCenterLocal(toNode.position, toNode.size, c.dstFace);
      const fromToDstFace: Vec3 = [
        fromPos[0] - dstFaceCenter[0],
        fromPos[1] - dstFaceCenter[1],
        fromPos[2] - dstFaceCenter[2],
      ];
      const dotBehind = dstNormal[0] * fromToDstFace[0] + dstNormal[1] * fromToDstFace[1] + dstNormal[2] * fromToDstFace[2];
      if (dotBehind < 0) return false;

      // Prune destination face if the source face is locked AND vertical (top/bottom)
      // AND the destination face is horizontal (left/right). A vertical exit through a
      // bundle trunk naturally continues into a vertical approach at the destination;
      // allowing a horizontal destination face creates an extra 90° bend that makes
      // side-face routes win spuriously over the shorter-bend top-face route.
      if (c.sourceFaceLocked && !groupIds.has(request.toId)) {
        const srcIsVertical = c.srcFace === 'top' || c.srcFace === 'bottom';
        const dstIsHorizontal = c.dstFace === 'left' || c.dstFace === 'right';
        if (srcIsVertical && dstIsHorizontal) return false;
      }
    }

    return true;
  });

  // Never return an empty set — keep at least the nearest-face pair as fallback.
  if (pruned.length === 0) {
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
