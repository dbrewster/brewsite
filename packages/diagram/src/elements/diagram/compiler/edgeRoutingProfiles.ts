// Algorithm-specific route generation and path materialization for all four routing profiles.

import { routeCurvedWithEndpointNormals } from './curveKernel';
import { buildLegacyEdgePath, commandsToControlPoints } from './flowPathBuilder';
import { routeFlowEdge } from './flowRouter';
import { buildFlowObstacleModel } from './flowObstacleModel';
import type { FlowObstacleModel } from './flowObstacleModel';
import type { EdgeRoutingAlgorithm } from '../types';
import type {
  EdgeGuidedCandidate,
  EdgeRouteState,
  FaceId,
  NormalizedRouteGeometry,
  RoutingProfile,
  RoutingProfileContext,
  ScoredEdgeCandidate,
  Vec3,
} from './routingTypes';

// ─── Geometry helpers (inline — profiles must not import from edgeRouter.ts) ──

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleVec = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];

/** EPSILON offset applied to all profile anchors to prevent z-fighting at node surfaces. */
const EDGE_EPSILON = 0.012;

const getFaceNormal = (face: FaceId): Vec3 => {
  switch (face) {
    case 'left':   return [-1, 0, 0];
    case 'right':  return [1, 0, 0];
    case 'top':    return [0, 1, 0];
    case 'bottom': return [0, -1, 0];
    case 'front':  return [0, 0, 1];
    case 'back':   return [0, 0, -1];
  }
};

function computePolylineLength(pts: ReadonlyArray<Vec3>): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    len += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return len;
}

const BEND_DOT_THRESHOLD = 0.92;

function computeBendCount(pts: ReadonlyArray<Vec3>): number {
  if (pts.length < 3) return 0;
  let bends = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]!;
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const inDx = curr[0] - prev[0];
    const inDy = curr[1] - prev[1];
    const inDz = curr[2] - prev[2];
    const outDx = next[0] - curr[0];
    const outDy = next[1] - curr[1];
    const outDz = next[2] - curr[2];
    const inLen = Math.sqrt(inDx ** 2 + inDy ** 2 + inDz ** 2);
    const outLen = Math.sqrt(outDx ** 2 + outDy ** 2 + outDz ** 2);
    if (inLen < 1e-9 || outLen < 1e-9) continue;
    const dot = (inDx * outDx + inDy * outDy + inDz * outDz) / (inLen * outLen);
    if (dot < BEND_DOT_THRESHOLD) bends++;
  }
  return bends;
}

function toNormalizedGeometry(
  waypoints: ReadonlyArray<Vec3>,
  routeKind: string,
  obstacleIds?: ReadonlyArray<string>,
): NormalizedRouteGeometry {
  return {
    waypoints,
    bendCount: computeBendCount(waypoints),
    pathLength: computePolylineLength(waypoints),
    routeKind,
    obstacleIds,
    acuteTurnCount: 0,
    reversalCount: 0,
    orthogonalDeviationPenalty: 0,
    groupIngressPenalty: 0,
    usedUnderpass: false,
  };
}

/** Deterministic hash for organic variation seeding. */
const hashStr = (s: string): number =>
  s.split('').reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) | 0, 0x9e3779b9);

// ─── Shared curved-route helper ───────────────────────────────────────────────

function routeCurvedFromAnchors(
  srcAnchor: Vec3,
  dstAnchor: Vec3,
  srcFace: FaceId,
  dstFace: FaceId,
  isRenderProfile: boolean,
): ReadonlyArray<Vec3> {
  const srcNormal = getFaceNormal(srcFace);
  const dstNormal = getFaceNormal(dstFace);
  const srcIsSide = srcFace === 'left' || srcFace === 'right';
  const dstIsSide = dstFace === 'left' || dstFace === 'right';
  return routeCurvedWithEndpointNormals(srcAnchor, dstAnchor, srcNormal, dstNormal, {
    epsilon: EDGE_EPSILON,
    handleMin: 0.04,
    handleMax: 1.1,
    handleFactor: 0.22,
    allowDirectSegment: !srcIsSide && !dstIsSide,
    directDistanceThreshold: 0.6,
    directAlignmentThreshold: 0.97,
    startPreferSide: isRenderProfile && srcIsSide,
    endPreferSide: isRenderProfile && dstIsSide,
    sideVerticalRatioThreshold: 0.3,
    sideVerticalBase: 0.45,
    sideVerticalFactor: 0.18,
    sideVerticalMax: 3.2,
    minSideHandle: isRenderProfile ? 0.12 : 0,
  });
}

// ─── Curved profile ───────────────────────────────────────────────────────────

const curvedProfile: RoutingProfile = {
  generateRoute(candidate: EdgeGuidedCandidate): NormalizedRouteGeometry {
    const pts = routeCurvedFromAnchors(
      candidate.sourceAnchor,
      candidate.destinationAnchor,
      candidate.srcFace,
      candidate.dstFace,
      false,
    );
    return toNormalizedGeometry(pts, 'curved');
  },

  materializePath(candidate: ScoredEdgeCandidate): EdgeRouteState {
    const pts = routeCurvedFromAnchors(
      candidate.sourceAnchor,
      candidate.destinationAnchor,
      candidate.srcFace,
      candidate.dstFace,
      true,
    );
    const path = buildLegacyEdgePath(
      pts,
      getFaceNormal(candidate.srcFace),
      scaleVec(getFaceNormal(candidate.dstFace), -1),
    );
    return {
      path,
      controlPoints: commandsToControlPoints(path.commands),
    };
  },
};

// ─── Straight profile ─────────────────────────────────────────────────────────

const straightProfile: RoutingProfile = {
  generateRoute(candidate: EdgeGuidedCandidate): NormalizedRouteGeometry {
    const srcNormal = getFaceNormal(candidate.srcFace);
    const dstNormal = getFaceNormal(candidate.dstFace);
    const start: Vec3 = addVec(candidate.sourceAnchor, scaleVec(srcNormal, EDGE_EPSILON));
    const end: Vec3 = addVec(candidate.destinationAnchor, scaleVec(dstNormal, EDGE_EPSILON));
    return toNormalizedGeometry([start, end], 'straight');
  },

  materializePath(candidate: ScoredEdgeCandidate): EdgeRouteState {
    const srcNormal = getFaceNormal(candidate.srcFace);
    const dstNormal = getFaceNormal(candidate.dstFace);
    const start: Vec3 = addVec(candidate.sourceAnchor, scaleVec(srcNormal, EDGE_EPSILON));
    const end: Vec3 = addVec(candidate.destinationAnchor, scaleVec(dstNormal, EDGE_EPSILON));
    const path = buildLegacyEdgePath(
      [start, end],
      srcNormal,
      scaleVec(dstNormal, -1),
    );
    return {
      path,
      controlPoints: commandsToControlPoints(path.commands),
    };
  },
};

// ─── Organic profile ──────────────────────────────────────────────────────────

function applyOrganicOffset(
  base: ReadonlyArray<Vec3>,
  edgeId: string,
  organicVariation: number,
): ReadonlyArray<Vec3> {
  const seed = Math.abs(hashStr(edgeId));
  const [p0, p1, p2, p3] = base;
  if (!p0 || !p1 || !p2 || !p3) return base;
  const dx = p3[0] - p0[0];
  const dy = p3[1] - p0[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const edgeScale = Math.max(0.03, Math.min(0.18, len * 0.22));
  const offset = (((seed % 1000) / 1000) - 0.5) * organicVariation * edgeScale;
  const c1: Vec3 = [p1[0] + perpX * offset * 1.15, p1[1] + perpY * offset * 1.15, p1[2]];
  const c2: Vec3 = [p2[0] - perpX * offset * 0.65, p2[1] - perpY * offset * 0.65, p2[2]];
  return [p0, c1, c2, p3];
}

const organicProfile: RoutingProfile = {
  generateRoute(candidate: EdgeGuidedCandidate, context: RoutingProfileContext): NormalizedRouteGeometry {
    const base = routeCurvedFromAnchors(
      candidate.sourceAnchor,
      candidate.destinationAnchor,
      candidate.srcFace,
      candidate.dstFace,
      false,
    );
    const pts = applyOrganicOffset(base, candidate.edgeId, context.organicVariation);
    return toNormalizedGeometry(pts, 'organic');
  },

  materializePath(candidate: ScoredEdgeCandidate, context: RoutingProfileContext): EdgeRouteState {
    const base = routeCurvedFromAnchors(
      candidate.sourceAnchor,
      candidate.destinationAnchor,
      candidate.srcFace,
      candidate.dstFace,
      true,
    );
    const pts = applyOrganicOffset(base, candidate.edgeId, context.organicVariation);
    const path = buildLegacyEdgePath(
      pts,
      getFaceNormal(candidate.srcFace),
      scaleVec(getFaceNormal(candidate.dstFace), -1),
    );
    return {
      path,
      controlPoints: commandsToControlPoints(path.commands),
    };
  },
};

// ─── Flow profile ─────────────────────────────────────────────────────────────

/** Cache obstacle models keyed by context object — one build per edge, shared across candidates. */
const flowObstacleModelCache = new WeakMap<RoutingProfileContext, Map<string, FlowObstacleModel>>();

/**
 * Build the FlowObstacleModel for the given edge context.
 * Called once per edge; result is cached for all candidates of the same edge.
 */
function flowObstacleCacheKey(candidate: EdgeGuidedCandidate): string {
  return [
    candidate.srcFace,
    candidate.dstFace,
    candidate.sourcePortIndex ?? 'x',
    candidate.destinationPortIndex ?? 'x',
    candidate.routeStart[0].toFixed(6),
    candidate.routeStart[1].toFixed(6),
    candidate.routeEnd[0].toFixed(6),
    candidate.routeEnd[1].toFixed(6),
  ].join(':');
}

function buildFlowObstacleModelForEdge(
  candidate: EdgeGuidedCandidate,
  context: RoutingProfileContext,
): FlowObstacleModel | null {
  const { nodeMap, groupIds, config, fromId, toId } = context;
  const fromNode = nodeMap.get(fromId);
  const toNode = nodeMap.get(toId);
  if (!fromNode || !toNode) return null;

  const cache = flowObstacleModelCache.get(context) ?? new Map<string, FlowObstacleModel>();
  flowObstacleModelCache.set(context, cache);
  const cacheKey = flowObstacleCacheKey(candidate);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const positions = new Map<string, Vec3>();
  const sizes = new Map<string, readonly [number, number, number]>();
  nodeMap.forEach((node, id) => {
    positions.set(id, node.position);
    sizes.set(id, node.size);
  });

  const model = buildFlowObstacleModel({
    positions,
    sizes,
    groupIds,
    sourceId: fromId,
    destinationId: toId,
    sourceAnchor: candidate.sourceAnchor,
    destinationAnchor: candidate.destinationAnchor,
    sourceFace: candidate.srcFace,
    destinationFace: candidate.dstFace,
    routeStart: candidate.routeStart,
    routeEnd: candidate.routeEnd,
    obstaclePadding: config.flowObstaclePadding,
  });
  cache.set(cacheKey, model);
  return model;
}

/**
 * Route a single guided candidate using a pre-built obstacle model.
 * Receives the model from buildFlowObstacleModelForEdge — never builds it internally.
 */
function buildFlowRouteWithModel(
  candidate: EdgeGuidedCandidate,
  context: RoutingProfileContext,
  obstacleModel: FlowObstacleModel,
): ReturnType<typeof routeFlowEdge> {
  const { nodeMap, config, edgeId, fromId, toId, allowUnderpass, onWarn } = context;
  const fromNode = nodeMap.get(fromId)!;
  const toNode = nodeMap.get(toId)!;

  const positions = new Map<string, Vec3>();
  const sizes = new Map<string, readonly [number, number, number]>();
  nodeMap.forEach((node, id) => {
    positions.set(id, node.position);
    sizes.set(id, node.size);
  });

  return routeFlowEdge({
    edgeId,
    fromId,
    toId,
    fromPos: fromNode.position,
    fromSize: fromNode.size,
    toPos: toNode.position,
    toSize: toNode.size,
    srcFace: candidate.srcFace,
    dstFace: candidate.dstFace,
    sourceAnchor: candidate.sourceAnchor,
    destinationAnchor: candidate.destinationAnchor,
    sourceGuide: candidate.sourceGuide,
    destinationGuide: candidate.destinationGuide,
    routeStart: candidate.routeStart,
    routeEnd: candidate.routeEnd,
    positions,
    sizes,
    flowTurnRadius: config.flowTurnRadius,
    flowFaceStub: config.flowFaceStub,
    flowObstaclePadding: config.flowObstaclePadding,
    flowUnderpassDepth: config.flowUnderpassDepth,
    flowUnderpassClearance: config.flowUnderpassClearance,
    flowTurnPenalty: config.flowTurnPenalty,
    flowPunchthroughPenalty: config.flowPunchthroughPenalty,
    flowUnderpassPenalty: config.flowUnderpassPenalty,
    allowUnderpass,
    onWarn,
    obstacleModel,
  });
}

function computeDestinationGroupIngressPenalty(
  candidate: EdgeGuidedCandidate,
  context: RoutingProfileContext,
  obstacleModel: FlowObstacleModel,
): number {
  if (!context.groupIds.has(context.toId)) return 0;
  const fromNode = context.nodeMap.get(context.fromId);
  const toNode = context.nodeMap.get(context.toId);
  if (!fromNode || !toNode) return 0;

  const sourceAbove = fromNode.position[1] >= toNode.position[1];
  const preferredVerticalFace: FaceId = sourceAbove ? 'top' : 'bottom';
  const halfW = toNode.size[0] * 0.5;
  const halfH = toNode.size[1] * 0.5;
  const destinationRect = {
    left: toNode.position[0] - halfW,
    right: toNode.position[0] + halfW,
    bottom: toNode.position[1] - halfH,
    top: toNode.position[1] + halfH,
  };
  const verticalCorridor = sourceAbove
    ? {
      left: destinationRect.left,
      right: destinationRect.right,
      bottom: destinationRect.top,
      top: fromNode.position[1],
    }
    : {
      left: destinationRect.left,
      right: destinationRect.right,
      bottom: fromNode.position[1],
      top: destinationRect.bottom,
    };

  const corridorBlocked = obstacleModel.obstacles.some((obstacle) =>
    obstacle.expandedRect.left < verticalCorridor.right &&
    obstacle.expandedRect.right > verticalCorridor.left &&
    obstacle.expandedRect.bottom < verticalCorridor.top &&
    obstacle.expandedRect.top > verticalCorridor.bottom,
  );

  const dstIsSide = candidate.dstFace === 'left' || candidate.dstFace === 'right';
  const dstIsVertical = candidate.dstFace === 'top' || candidate.dstFace === 'bottom';
  let penalty = 0;

  if (!corridorBlocked && dstIsSide) {
    penalty += 3.5;
  }
  if (corridorBlocked && candidate.dstFace === preferredVerticalFace) {
    penalty += 2.5;
  }

  const lateralOffset = Math.abs(fromNode.position[0] - toNode.position[0]);
  if (dstIsVertical && lateralOffset > toNode.size[0] * 0.35) {
    const destinationLateralClass = candidate.destinationLateralClass ?? 'center';
    if (destinationLateralClass === 'center' || destinationLateralClass === 'inner') {
      penalty += corridorBlocked ? 0.5 : 2;
    }
  }

  return penalty;
}

function fallbackEdgeRoute(candidate: EdgeGuidedCandidate): EdgeRouteState {
  const pts: ReadonlyArray<Vec3> = [candidate.sourceAnchor, candidate.destinationAnchor];
  const path = buildLegacyEdgePath(
    pts,
    getFaceNormal(candidate.srcFace),
    scaleVec(getFaceNormal(candidate.dstFace), -1),
  );
  return { path, controlPoints: commandsToControlPoints(path.commands) };
}

const flowProfile: RoutingProfile = {
  generateRoute(candidate: EdgeGuidedCandidate, context: RoutingProfileContext): NormalizedRouteGeometry {
    const obstacleModel = buildFlowObstacleModelForEdge(candidate, context);
    if (!obstacleModel) {
      const pts: ReadonlyArray<Vec3> = [candidate.sourceAnchor, candidate.destinationAnchor];
      return toNormalizedGeometry(pts, 'direct');
    }
    const result = buildFlowRouteWithModel(candidate, context, obstacleModel);
    const groupIngressPenalty =
      result.groupIngressPenalty +
      computeDestinationGroupIngressPenalty(candidate, context, obstacleModel);
    return {
      waypoints: result.planningWaypoints,
      bendCount: computeBendCount(result.planningWaypoints),
      pathLength: computePolylineLength(result.planningWaypoints),
      routeKind: result.pathDebug?.routeKind ?? 'direct',
      obstacleIds: result.pathDebug?.obstacleIds ? [...result.pathDebug.obstacleIds] : undefined,
      acuteTurnCount: result.acuteTurnCount,
      reversalCount: result.reversalCount,
      orthogonalDeviationPenalty: result.orthogonalDeviationPenalty,
      groupIngressPenalty,
      usedUnderpass: result.path.usedUnderpass,
    };
  },

  materializePath(candidate: ScoredEdgeCandidate, context: RoutingProfileContext): EdgeRouteState {
    const obstacleModel = buildFlowObstacleModelForEdge(candidate, context);
    if (!obstacleModel) return fallbackEdgeRoute(candidate);
    const result = buildFlowRouteWithModel(candidate, context, obstacleModel);
    return {
      path: result.path,
      controlPoints: result.controlPoints,
      pathDebug: result.pathDebug
        ? {
          ...result.pathDebug,
          selectedFaces: { srcFace: candidate.srcFace, dstFace: candidate.dstFace },
          selectedPorts: {
            sourcePortIndex: candidate.sourcePortIndex,
            destinationPortIndex: candidate.destinationPortIndex,
          },
          selectedSrcFace: candidate.srcFace,
          selectedDstFace: candidate.dstFace,
          selectedSourcePortIndex: candidate.sourcePortIndex,
          selectedDestinationPortIndex: candidate.destinationPortIndex,
          rankKey: [...candidate.rankKey],
          usedBundleHint: candidate.bundleHint !== undefined,
          usedDestinationGuide: candidate.destinationGuide !== undefined,
          isFallback: candidate.score.blockerPenalty > 0,
        }
        : undefined,
    };
  },
};

// ─── Profile registry ─────────────────────────────────────────────────────────

/** Registry mapping routing algorithm names to their profile implementations. */
export const ROUTING_PROFILES: Record<EdgeRoutingAlgorithm, RoutingProfile> = {
  curved: curvedProfile,
  straight: straightProfile,
  organic: organicProfile,
  flow: flowProfile,
};
