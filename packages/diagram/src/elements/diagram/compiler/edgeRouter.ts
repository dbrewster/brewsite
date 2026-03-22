// Edge routing orchestration layer — wires the staged candidate pipeline.
// Pure functions only — no Three.js, no React.

import type {
  DiagramEdgePort,
  DiagramWarnFn,
  EdgeLandingAlgorithm,
  EdgeRoutingAlgorithm,
} from '../types';
import {
  buildLegacyEdgePath,
  commandsToControlPoints,
} from './flowPathBuilder';
import {
  enumerateFaceCandidates,
  inferBundleHints,
  pruneImpossibleFaceCandidates,
  evaluateFaceCandidatePruning,
} from './edgeCandidatePlanner';
import { assignPorts, enumeratePortCandidates } from './edgePortPlanner';
import { buildCandidateGuides } from './edgeGuidePlanner';
import { candidateToRankKey, scoreCandidate } from './edgeCandidateScorer';
import { selectBestCandidate } from './edgeCandidateSelector';
import { ROUTING_PROFILES } from './edgeRoutingProfiles';
import { buildRoutingNodeMap, denormalizeEdgeRoute } from './routingSpace';
import type {
  EdgeRoutingRequest,
  FaceId,
  NodeDimensions,
  RoutingNodeMap,
  RoutingProfileContext,
  RoutedEdgeCandidate,
  ScoredEdgeCandidate,
  Vec3,
} from './routingTypes';

// ─── Re-exported types (backwards compatibility) ──────────────────────────────

export type {
  EdgeRouteState,
  FaceId,
  FlowRoutingConfig,
  NodeDimensions,
  Vec3,
} from './routingTypes';

// ─── Internal type for routeEdges / routeEdgesYDown input ─────────────────────

type EdgeRoutingInput = {
  id?: string;
  from: string;
  to: string;
  routing?: EdgeRoutingAlgorithm;
  flowTurnRadius?: number;
  flowFaceStub?: number;
  flowBundleStrength?: number;
  flowTargetApproachBias?: number;
  allowUnderpass?: boolean;
  fromPort?: DiagramEdgePort;
  toPort?: DiagramEdgePort;
  thickness?: number;
};

// ─── Public constants ─────────────────────────────────────────────────────────

export const DEFAULT_FLOW_ROUTING_CONFIG: import('./routingTypes').FlowRoutingConfig = {
  flowTurnRadius: 0.05,
  flowFaceStub: 0.05,
  flowBundleStrength: 1.0,
  flowObstaclePadding: 0.025,
  flowTargetApproachBias: 1.35,
  flowUnderpassDepth: 0.08,
  flowUnderpassClearance: 0.03,
  flowTurnPenalty: 0.45,
  flowPunchthroughPenalty: 500,
  flowUnderpassPenalty: 60,
};

// ─── Private math helpers ─────────────────────────────────────────────────────

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleVec = (v: Vec3, scalar: number): Vec3 => [v[0] * scalar, v[1] * scalar, v[2] * scalar];

// ─── Public utility functions (used by renderers, tests, and external callers) ─

/**
 * Returns the center point of a named face on a positioned node.
 */
export function getFaceCenter(pos: Vec3, size: NodeDimensions, face: FaceId): Vec3 {
  const [x, y, z] = pos;
  const [w, h, d] = size;
  // Anchor at the mid-depth plane between the front face and the back.
  const sideZ = z - d / 2;
  switch (face) {
    case 'left':   return [x - w / 2, y,         sideZ];
    case 'right':  return [x + w / 2, y,         sideZ];
    case 'top':    return [x,         y + h / 2, sideZ];
    case 'bottom': return [x,         y - h / 2, sideZ];
  }
}

/**
 * Returns the outward unit normal for a named side (in the XY diagram plane).
 */
export function getFaceNormal(face: FaceId): Vec3 {
  switch (face) {
    case 'left':   return [-1,  0,  0];
    case 'right':  return [ 1,  0,  0];
    case 'top':    return [ 0,  1,  0];
    case 'bottom': return [ 0, -1,  0];
  }
}

/**
 * Returns the anchor point for a numbered port slot on a node face.
 * Port slots are evenly distributed across the face span.
 */
export function getFacePortAnchor(
  pos: Vec3,
  size: NodeDimensions,
  face: FaceId,
  portIndex: number,
  portCount: number,
  targetPos: Vec3,
): Vec3 {
  const [x, y, z] = pos;
  const [w, h, d] = size;
  // Anchor at the front face plane so edge tubes don't clip through the box.
  const sideZ = z;

  switch (face) {
    case 'top': {
      const offset = portCount <= 1 ? 0 : -w / 2 + (w / (portCount - 1)) * portIndex;
      return [x + offset, y + h / 2, sideZ];
    }
    case 'bottom': {
      const offset = portCount <= 1 ? 0 : -w / 2 + (w / (portCount - 1)) * portIndex;
      return [x + offset, y - h / 2, sideZ];
    }
    case 'left': {
      const offset = portCount <= 1 ? 0 : -h / 2 + (h / (portCount - 1)) * portIndex;
      return [x - w / 2, y + offset, sideZ];
    }
    case 'right': {
      const offset = portCount <= 1 ? 0 : -h / 2 + (h / (portCount - 1)) * portIndex;
      return [x + w / 2, y + offset, sideZ];
    }
  }
}

function portToFace(port: DiagramEdgePort): FaceId {
  return port as FaceId;
}

/** Pick the nearest planar side by dominant delta-vector direction. */
export function nearestFace(origin: Vec3, target: Vec3): FaceId {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (ady >= adx * 0.7) return dy >= 0 ? 'top' : 'bottom';
  return dx >= 0 ? 'right' : 'left';
}

function nearestFaceForNode(origin: Vec3, target: Vec3, size: NodeDimensions): FaceId {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const halfW = Math.max(0.001, size[0] * 0.5);
  const halfH = Math.max(0.001, size[1] * 0.5);

  const nx = Math.abs(dx) / halfW;
  const ny = Math.abs(dy) / halfH;

  if (ny >= nx) return dy >= 0 ? 'top' : 'bottom';
  return dx >= 0 ? 'right' : 'left';
}

function nearestFaceForNodePair(
  origin: Vec3,
  target: Vec3,
  originSize: NodeDimensions,
  targetSize: NodeDimensions,
): FaceId {
  // DEBT: Remove unused targetSize parameter
  void targetSize;
  return nearestFaceForNode(origin, target, originSize);
}

/** shortest-path: enumerate all 36 face-pair combos, pick minimum distance. */
function shortestPathFaces(
  srcPos: Vec3, srcSize: NodeDimensions,
  dstPos: Vec3, dstSize: NodeDimensions,
): { srcFace: FaceId; dstFace: FaceId } {
  const faces: FaceId[] = ['left', 'right', 'top', 'bottom'];
  let minDist = Infinity;
  let best: { srcFace: FaceId; dstFace: FaceId } = { srcFace: 'right', dstFace: 'left' };
  for (const sf of faces) {
    const sc = getFaceCenter(srcPos, srcSize, sf);
    for (const df of faces) {
      const dc = getFaceCenter(dstPos, dstSize, df);
      const dist = Math.sqrt(
        (dc[0] - sc[0]) ** 2 + (dc[1] - sc[1]) ** 2 + (dc[2] - sc[2]) ** 2,
      );
      if (dist < minDist) { minDist = dist; best = { srcFace: sf, dstFace: df }; }
    }
  }
  return best;
}

/**
 * Resolve source and destination faces for an edge using the given landing algorithm.
 * Explicit port locks override all algorithmic selection.
 */
export function resolveFaces(
  srcPos: Vec3, srcSize: NodeDimensions,
  dstPos: Vec3, dstSize: NodeDimensions,
  landing: EdgeLandingAlgorithm,
  fromPort?: DiagramEdgePort,
  toPort?: DiagramEdgePort,
): { srcFace: FaceId; dstFace: FaceId } {
  if (fromPort && toPort) {
    return { srcFace: portToFace(fromPort), dstFace: portToFace(toPort) };
  }
  if (fromPort || toPort) {
    const sf = fromPort ? portToFace(fromPort) : nearestFaceForNodePair(srcPos, dstPos, srcSize, dstSize);
    const df = toPort ? portToFace(toPort) : nearestFaceForNodePair(dstPos, srcPos, dstSize, srcSize);
    return { srcFace: sf, dstFace: df };
  }
  if (landing === 'shortest-path') return shortestPathFaces(srcPos, srcSize, dstPos, dstSize);
  return {
    srcFace: nearestFaceForNodePair(srcPos, dstPos, srcSize, dstSize),
    dstFace: nearestFaceForNodePair(dstPos, srcPos, dstSize, srcSize),
  };
}

// ─── Empty route constant ─────────────────────────────────────────────────────

const EMPTY_ROUTE: import('./routingTypes').EdgeRouteState = {
  path: {
    commands: [],
    startTangent: [0, 0, 0],
    endTangent: [0, 0, 0],
    usedUnderpass: false,
    punctures: [],
  },
  controlPoints: [],
};

// DEBT: Remove debug infrastructure or move behind build-time conditional
const ROUTE_DEBUG_ENABLED = false;
const ROUTE_DEBUG_FILTER: string | undefined = undefined;

function appendDebugEntry(_json: string): void {
  // Debug logging disabled. Enable ROUTE_DEBUG_ENABLED and
  // use console.warn to inspect individual edges during development.
}

function emitRouteDebugLog(
  request: EdgeRoutingRequest,
  debugContext: {
    readonly bundleHint?: {
      readonly sourceFaceHint?: FaceId;
      readonly sourceAnchorHint?: Vec3;
      readonly sourceGuideHint?: Vec3;
      readonly sharedTrunkKey?: string;
      readonly sharedTrunkDepth?: number;
    };
    readonly fromNode?: { readonly position: Vec3; readonly size: NodeDimensions };
    readonly toNode?: { readonly position: Vec3; readonly size: NodeDimensions };
    readonly faceCandidates: ReadonlyArray<{
      readonly srcFace: FaceId;
      readonly dstFace: FaceId;
      readonly sourceFaceLocked: boolean;
      readonly destinationFaceLocked: boolean;
      readonly hasBundleHint: boolean;
    }>;
    readonly activeFaceCandidates: ReadonlyArray<{
      readonly srcFace: FaceId;
      readonly dstFace: FaceId;
      readonly sourceFaceLocked: boolean;
      readonly destinationFaceLocked: boolean;
      readonly hasBundleHint: boolean;
    }>;
    readonly prunedFaceCandidates: ReadonlyArray<{
      readonly srcFace: FaceId;
      readonly dstFace: FaceId;
      readonly sourceFaceLocked: boolean;
      readonly destinationFaceLocked: boolean;
      readonly reasons: ReadonlyArray<string>;
    }>;
  },
  candidates: ReadonlyArray<ScoredEdgeCandidate>,
  winner: ScoredEdgeCandidate | undefined,
): void {
  if (!ROUTE_DEBUG_ENABLED) return;
  if (ROUTE_DEBUG_FILTER && request.id !== ROUTE_DEBUG_FILTER) return;

  const serializedCandidates = [...candidates]
    .sort((a, b) => {
      for (let index = 0; index < a.rankKey.length; index += 1) {
        const delta = a.rankKey[index]! - b.rankKey[index]!;
        if (Math.abs(delta) > 1e-9) return delta;
      }
      return 0;
    })
    .map((candidate) => ({
      srcFace: candidate.srcFace,
      dstFace: candidate.dstFace,
      sourcePortIndex: candidate.sourcePortIndex,
      destinationPortIndex: candidate.destinationPortIndex,
      sourceAnchor: candidate.sourceAnchor,
      destinationAnchor: candidate.destinationAnchor,
      sourceGuide: candidate.sourceGuide,
      destinationGuide: candidate.destinationGuide,
      routeKind: candidate.geometry.routeKind,
      obstacleIds: candidate.geometry.obstacleIds ?? [],
      usedUnderpass: candidate.geometry.usedUnderpass ?? false,
      groupIngressPenalty: candidate.geometry.groupIngressPenalty,
      debug: candidate.geometry.debug,
      bendCount: candidate.geometry.bendCount,
      pathLength: candidate.geometry.pathLength,
      score: candidate.score,
      rankKey: candidate.rankKey,
      sharedTrunkKey: candidate.sharedTrunkKey,
      bundleHint: candidate.bundleHint
        ? {
          sourceFaceHint: candidate.bundleHint.sourceFaceHint,
          sourceAnchorHint: candidate.bundleHint.sourceAnchorHint,
          sourceGuideHint: candidate.bundleHint.sourceGuideHint,
          sharedTrunkKey: candidate.bundleHint.sharedTrunkKey,
        }
        : undefined,
    }));

  appendDebugEntry(JSON.stringify({
      edgeId: request.id,
      fromId: request.fromId,
      toId: request.toId,
      routing: request.routing,
      landing: request.landing,
      bundleHint: debugContext.bundleHint,
      fromNode: debugContext.fromNode,
      toNode: debugContext.toNode,
      faceCandidates: debugContext.faceCandidates,
      activeFaceCandidates: debugContext.activeFaceCandidates,
      prunedFaceCandidates: debugContext.prunedFaceCandidates,
      winner: winner
        ? {
          srcFace: winner.srcFace,
          dstFace: winner.dstFace,
          sourcePortIndex: winner.sourcePortIndex,
          destinationPortIndex: winner.destinationPortIndex,
          routeKind: winner.geometry.routeKind,
          obstacleIds: winner.geometry.obstacleIds ?? [],
          rankKey: winner.rankKey,
          score: winner.score,
        }
        : null,
      candidates: serializedCandidates,
  }));
}

// ─── Center-landing special case ──────────────────────────────────────────────

function routeCenterLanding(
  fromPos: Vec3,
  fromSize: NodeDimensions,
  toPos: Vec3,
  toSize: NodeDimensions,
  routing: EdgeRoutingAlgorithm,
): import('./routingTypes').EdgeRouteState {
  const sn = getFaceNormal(nearestFaceForNode(fromPos, toPos, fromSize));
  const dn = getFaceNormal(nearestFaceForNode(toPos, fromPos, toSize));
  // Center landing anchors at mid-depth (z - d/2), same as side edges.
  const fromCenter: Vec3 = [fromPos[0], fromPos[1], fromPos[2] - fromSize[2] / 2];
  const toCenter: Vec3 = [toPos[0], toPos[1], toPos[2] - toSize[2] / 2];
  const start = addVec(fromCenter, scaleVec(sn, 0.012));
  const end   = addVec(toCenter,   scaleVec(dn, 0.012));

  let controlPoints: ReadonlyArray<Vec3>;
  if (routing === 'straight') {
    controlPoints = [start, end];
  } else {
    const dist = Math.sqrt(
      (toPos[0] - fromPos[0]) ** 2 +
      (toPos[1] - fromPos[1]) ** 2 +
      (toPos[2] - fromPos[2]) ** 2,
    );
    const stub = Math.max(0.25, Math.min(1.6, dist * 0.22));
    controlPoints = [start, addVec(start, scaleVec(sn, stub)), addVec(end, scaleVec(dn, stub)), end];
  }

  const path = buildLegacyEdgePath(controlPoints, sn, scaleVec(dn, -1));
  return { path, controlPoints: commandsToControlPoints(path.commands) };
}

// ─── Main orchestration ───────────────────────────────────────────────────────

/**
 * Route all edges using the staged candidate pipeline.
 * Positions must be in Y-down NVS space — buildRoutingNodeMap converts them to Y-up router space.
 */
export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm = 'curved',
  defaultLanding: EdgeLandingAlgorithm = 'nearest-face',
  onWarn?: DiagramWarnFn,
  organicVariation: number = 1.6,
  flowConfig: import('./routingTypes').FlowRoutingConfig = DEFAULT_FLOW_ROUTING_CONFIG,
  groupIds: ReadonlySet<string> = new Set(),
  obstacleGroupIds?: ReadonlySet<string>,
): Map<string, import('./routingTypes').EdgeRouteState> {
  const effectiveGroupIds = groupIds.size > 0
    ? groupIds
    : new Set(
      [...sizes.entries()]
        .filter(([, size]) => size[2] <= 0.02)
        .map(([id]) => id),
    );
  // When obstacleGroupIds is explicitly provided (including empty set), use it
  // as-is. An empty set from compile.ts means "all groups are variant=container,
  // no groups are obstacles" — edges pass through container boundaries freely.
  // When undefined (caller didn't specify), fall back to effectiveGroupIds so
  // the depth-heuristic inferred groups are treated as obstacles (backward compat).
  const effectiveObstacleGroupIds = obstacleGroupIds !== undefined
    ? obstacleGroupIds
    : effectiveGroupIds;
  const resolvedThickness = (edge: EdgeRoutingInput): number => edge.thickness ?? 0.06;

  // Build normalized request objects with all defaults applied.
  const requests: EdgeRoutingRequest[] = edges.map((edge, index) => ({
    id: edge.id ?? `${edge.from}-${edge.to}-${index}`,
    fromId: edge.from,
    toId: edge.to,
    routing: edge.routing ?? defaultRouting,
    landing: (edge.fromPort || edge.toPort) ? 'port' : defaultLanding,
    fromPort: edge.fromPort,
    toPort: edge.toPort,
    thickness: resolvedThickness(edge),
    flowTurnRadius: edge.flowTurnRadius ?? flowConfig.flowTurnRadius,
    flowFaceStub: edge.flowFaceStub ?? flowConfig.flowFaceStub,
    flowBundleStrength: edge.flowBundleStrength ?? flowConfig.flowBundleStrength,
    flowTargetApproachBias: edge.flowTargetApproachBias ?? flowConfig.flowTargetApproachBias,
    allowUnderpass: edge.allowUnderpass ?? true,
  }));

  // Build node map in Y-up router space from Y-down NVS positions.
  const nodeMap: RoutingNodeMap = buildRoutingNodeMap(positions, sizes);

  // Infer bundle hints from sibling flow edges.
  const bundleHints = inferBundleHints(requests, nodeMap);

  const result = new Map<string, import('./routingTypes').EdgeRouteState>();

  requests.forEach((request) => {
    const edgeId = request.id;

    // Self-loop: emit an empty route.
    if (request.fromId === request.toId) {
      result.set(edgeId, EMPTY_ROUTE);
      return;
    }

    const fromNode = nodeMap.get(request.fromId);
    const toNode = nodeMap.get(request.toId);

    // Missing endpoint: warn and emit an empty route.
    if (!fromNode || !toNode) {
      const missingId = !fromNode ? request.fromId : request.toId;
      const fromId = request.fromId;
      const toId = request.toId;
      onWarn?.(
        'MISSING_EDGE_ENDPOINT',
        `<DiagramEdge from="${fromId}" to="${toId}">: node "${missingId}" not found. ` +
          `Check that "${missingId}" exactly matches a sibling <DiagramNode id="${missingId}"> ` +
          `in the same <Diagram>.`,
      );
      result.set(edgeId, EMPTY_ROUTE);
      return;
    }

    const { position: fromPos, size: fromSize } = fromNode;
    const { position: toPos, size: toSize } = toNode;

    // Center landing bypasses the candidate pipeline.
    if (request.landing === 'center') {
      result.set(edgeId, routeCenterLanding(fromPos, fromSize, toPos, toSize, request.routing));
      return;
    }

    // Build shared routing profile context.
    const context: RoutingProfileContext = {
      nodeMap,
      groupIds: effectiveGroupIds,
      obstacleGroupIds: effectiveObstacleGroupIds,
      config: flowConfig,
      edgeId,
      fromId: request.fromId,
      toId: request.toId,
      allowUnderpass: request.allowUnderpass,
      organicVariation,
      onWarn,
    };

    const profile = ROUTING_PROFILES[request.routing];

    // Stage 1: Face enumeration.
    const faceCandidates = enumerateFaceCandidates(request, nodeMap, bundleHints);
    const pruneEvaluations = evaluateFaceCandidatePruning(faceCandidates, request, nodeMap, effectiveGroupIds);
    const prunedCandidates = pruneImpossibleFaceCandidates(faceCandidates, request, nodeMap, effectiveGroupIds);
    const activeCandidates = prunedCandidates.length > 0 ? prunedCandidates : faceCandidates;

    // Stage 2–4: Port assignment, guide generation, route generation.
    const scoredCandidates: ScoredEdgeCandidate[] = activeCandidates.flatMap((faceCandidate) => {
      const shouldEnumeratePortPairs =
        request.routing === 'flow' &&
        (
          effectiveGroupIds.has(request.fromId) ||
          effectiveGroupIds.has(request.toId) ||
          request.fromPort !== undefined ||
          request.toPort !== undefined ||
          faceCandidate.bundleHint?.sourceAnchorHint !== undefined ||
          faceCandidate.destinationFaceLocked
        );
      const portCandidates = shouldEnumeratePortPairs
        ? enumeratePortCandidates(faceCandidate, request, nodeMap, effectiveGroupIds)
        : [assignPorts(faceCandidate, request, nodeMap, effectiveGroupIds)];

      return portCandidates.map((portCandidate) => {
        const guidedCandidate = buildCandidateGuides(portCandidate, request, nodeMap, effectiveGroupIds);
        const geometry = profile.generateRoute(guidedCandidate, context);

        const routedCandidate: RoutedEdgeCandidate = {
          ...guidedCandidate,
          geometry,
          sharedTrunkKey: faceCandidate.bundleHint?.sharedTrunkKey,
        };

        const hintedTrunkKey = bundleHints.get(request.id)?.sharedTrunkKey;
        const score = scoreCandidate(routedCandidate, fromPos, toPos, fromSize, toSize, hintedTrunkKey);
        const rankKey = candidateToRankKey(score);
        return { ...routedCandidate, score, rankKey };
      });
    });

    // Stage 5: Lexicographic selection.
    const winner = selectBestCandidate(scoredCandidates);
    emitRouteDebugLog(request, {
      bundleHint: bundleHints.get(request.id),
      fromNode,
      toNode,
      faceCandidates: faceCandidates.map((candidate) => ({
        srcFace: candidate.srcFace,
        dstFace: candidate.dstFace,
        sourceFaceLocked: candidate.sourceFaceLocked,
        destinationFaceLocked: candidate.destinationFaceLocked,
        hasBundleHint: candidate.bundleHint !== undefined,
      })),
      activeFaceCandidates: activeCandidates.map((candidate) => ({
        srcFace: candidate.srcFace,
        dstFace: candidate.dstFace,
        sourceFaceLocked: candidate.sourceFaceLocked,
        destinationFaceLocked: candidate.destinationFaceLocked,
        hasBundleHint: candidate.bundleHint !== undefined,
      })),
      prunedFaceCandidates: pruneEvaluations
        .filter((evaluation) => !evaluation.keep)
        .map((evaluation) => ({
          srcFace: evaluation.candidate.srcFace,
          dstFace: evaluation.candidate.dstFace,
          sourceFaceLocked: evaluation.candidate.sourceFaceLocked,
          destinationFaceLocked: evaluation.candidate.destinationFaceLocked,
          reasons: evaluation.reasons,
        })),
    }, scoredCandidates, winner ?? undefined);
    if (!winner) {
      result.set(edgeId, EMPTY_ROUTE);
      return;
    }

    // Stage 6: Path materialization.
    const routeState = profile.materializePath(winner, context);
    result.set(edgeId, routeState);
  });

  return result;
}

/**
 * Route edges provided in Y-down NVS coordinate space.
 * Calls routeEdges (which accepts Y-down positions) and mirrors results back to Y-down NVS.
 */
export function routeEdgesYDown(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm = 'curved',
  defaultLanding: EdgeLandingAlgorithm = 'nearest-face',
  onWarn?: DiagramWarnFn,
  organicVariation: number = 1.6,
  flowConfig: import('./routingTypes').FlowRoutingConfig = DEFAULT_FLOW_ROUTING_CONFIG,
  groupIds: ReadonlySet<string> = new Set(),
  obstacleGroupIds?: ReadonlySet<string>,
): Map<string, import('./routingTypes').EdgeRouteState> {
  const routed = routeEdges(
    edges,
    positions,
    sizes,
    defaultRouting,
    defaultLanding,
    onWarn,
    organicVariation,
    flowConfig,
    groupIds,
    obstacleGroupIds,
  );

  // Mirror results back to Y-down NVS.
  const mirroredResult = new Map<string, import('./routingTypes').EdgeRouteState>();
  routed.forEach((state, id) => {
    mirroredResult.set(id, denormalizeEdgeRoute(state));
  });
  return mirroredResult;
}
