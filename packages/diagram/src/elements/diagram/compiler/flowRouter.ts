import type {
  DiagramEdgePathDebug,
  DiagramWarnFn,
} from '../types';
import { buildFlowObstacleModel } from './flowObstacleModel';
import type { FlowObstacleModel } from './flowObstacleModel';
import { buildFlowPathState, commandsToControlPoints } from './flowPathBuilder';
import { findFlowVisibilityRoute } from './flowVisibilityGraph';

export type FaceId = 'left' | 'right' | 'top' | 'bottom';
export type Vec3 = readonly [number, number, number];
export type NodeDimensions = readonly [number, number, number];

export type FlowRouteResult = {
  readonly path: ReturnType<typeof buildFlowPathState>;
  readonly controlPoints: ReadonlyArray<Vec3>;
  readonly planningWaypoints: ReadonlyArray<Vec3>;
  readonly acuteTurnCount: number;
  readonly reversalCount: number;
  readonly orthogonalDeviationPenalty: number;
  readonly groupIngressPenalty: number;
  readonly pathDebug?: DiagramEdgePathDebug;
};

type RouteFlowEdgeInput = {
  readonly edgeId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly fromPos: Vec3;
  readonly fromSize: NodeDimensions;
  readonly toPos: Vec3;
  readonly toSize: NodeDimensions;
  readonly srcFace: FaceId;
  readonly dstFace: FaceId;
  readonly sourceAnchor?: Vec3;
  readonly destinationAnchor?: Vec3;
  readonly sourceGuide?: Vec3;
  readonly destinationGuide?: Vec3;
  readonly routeStart?: Vec3;
  readonly routeEnd?: Vec3;
  readonly positions: ReadonlyMap<string, Vec3>;
  readonly sizes: ReadonlyMap<string, NodeDimensions>;
  readonly flowTurnRadius: number;
  readonly flowFaceStub: number;
  readonly flowObstaclePadding: number;
  readonly flowUnderpassDepth: number;
  readonly flowUnderpassClearance: number;
  readonly flowTurnPenalty: number;
  readonly flowPunchthroughPenalty: number;
  readonly flowUnderpassPenalty: number;
  readonly allowUnderpass: boolean;
  readonly onWarn?: DiagramWarnFn;
  /** Pre-built obstacle model; if provided, skips the expensive buildFlowObstacleModel call. */
  readonly obstacleModel?: FlowObstacleModel;
};

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const scaleVec = (v: Vec3, scalar: number): Vec3 => [v[0] * scalar, v[1] * scalar, v[2] * scalar];

const getFaceCenter = (pos: Vec3, size: NodeDimensions, face: FaceId): Vec3 => {
  const [x, y, z] = pos;
  const [w, h, d] = size;
  const sideZ = z - d / 2;
  switch (face) {
    case 'left': return [x - w / 2, y, sideZ];
    case 'right': return [x + w / 2, y, sideZ];
    case 'top': return [x, y + h / 2, sideZ];
    case 'bottom': return [x, y - h / 2, sideZ];
  }
};

const getFaceNormal = (face: FaceId): Vec3 => {
  switch (face) {
    case 'left': return [-1, 0, 0];
    case 'right': return [1, 0, 0];
    case 'top': return [0, 1, 0];
    case 'bottom': return [0, -1, 0];
  }
};

export function routeFlowEdge(input: RouteFlowEdgeInput): FlowRouteResult {
  const sourceAnchor = input.sourceAnchor ?? getFaceCenter(input.fromPos, input.fromSize, input.srcFace);
  const destinationAnchor = input.destinationAnchor ?? getFaceCenter(input.toPos, input.toSize, input.dstFace);
  const startTangent = getFaceNormal(input.srcFace);
  const endTangent = scaleVec(getFaceNormal(input.dstFace), -1);
  const sourceStub = addVec(sourceAnchor, scaleVec(startTangent, input.flowFaceStub));
  const defaultDestinationStub = addVec(destinationAnchor, scaleVec(scaleVec(endTangent, -1), input.flowFaceStub));
  const routeStart = input.routeStart ?? input.sourceGuide ?? sourceStub;
  const routeEnd = input.routeEnd ?? input.destinationGuide ?? defaultDestinationStub;
  // For bundled side-face approaches, routeEnd may have been adjusted in buildCandidateGuides
  // to prevent control-point crossings. Use that adjusted point as destinationStub so rawPoints
  // (in buildFlowPathState) matches the visibility router's target.
  const isBundledSideFaceApproach =
    input.sourceGuide !== undefined &&
    (input.dstFace === 'left' || input.dstFace === 'right');
  const destinationStub = isBundledSideFaceApproach ? routeEnd : defaultDestinationStub;

  const obstacleModel = input.obstacleModel ?? buildFlowObstacleModel({
    positions: input.positions,
    sizes: input.sizes,
    sourceId: input.fromId,
    destinationId: input.toId,
    sourceAnchor,
    destinationAnchor,
    sourceFace: input.srcFace,
    destinationFace: input.dstFace,
    routeStart,
    routeEnd,
    obstaclePadding: input.flowObstaclePadding,
  });

  const endApproachDirectionMap: Record<FaceId, 'S' | 'N' | 'E' | 'W'> = {
    top: 'S', bottom: 'N', left: 'E', right: 'W',
  };

  const route = findFlowVisibilityRoute({
    start: routeStart,
    end: routeEnd,
    planeZ: sourceAnchor[2],
    obstacles: obstacleModel.obstacles,
    sourceOwningGroupIds: obstacleModel.sourceOwningGroupIds,
    destinationOwningGroupIds: obstacleModel.destinationOwningGroupIds,
    turnPenalty: input.flowTurnPenalty,
    punchthroughPenalty: input.flowPunchthroughPenalty,
    underpassPenalty: input.flowUnderpassPenalty,
    underpassDepth: input.flowUnderpassDepth,
    underpassClearance: input.flowUnderpassClearance,
    allowUnderpass: input.allowUnderpass,
    endApproachDirection: endApproachDirectionMap[input.dstFace],
  });

  if (route.usedUnderpass) {
    input.onWarn?.(
      'DIAGRAM_FLOW_UNDERPASS_USED',
      `Flow router used an underpass for edge "${input.edgeId}".`,
    );
  }
  if (route.punctures.length > 0) {
    input.onWarn?.(
      'DIAGRAM_FLOW_PUNCHTHROUGH_USED',
      `Flow router punctured ${route.punctures.length} obstacle(s) for edge "${input.edgeId}".`,
    );
  }
  if (route.routeKind === 'direct' && route.waypoints.length <= 2 && route.punctures.length > 0) {
    input.onWarn?.(
      'DIAGRAM_FLOW_ROUTE_FALLBACK_STRAIGHT',
      `Flow router fell back to a direct route for edge "${input.edgeId}".`,
    );
  }

  const path = buildFlowPathState({
    anchorStart: sourceAnchor,
    anchorEnd: destinationAnchor,
    startStub: sourceStub,
    endStub: destinationStub,
    waypoints: [
      ...(input.sourceGuide ? [input.sourceGuide] : []),
      ...route.waypoints.slice(1, -1),
      ...(input.destinationGuide ? [input.destinationGuide] : []),
    ],
    startTangent,
    endTangent,
    turnRadius: input.flowTurnRadius,
    usedUnderpass: route.usedUnderpass,
    punctures: route.punctures,
  });

  const controlPoints = commandsToControlPoints(path.commands);
  const pathDebug = process.env.NODE_ENV !== 'production'
    ? {
      routeKind: route.routeKind,
      obstacleIds: route.obstacleIds,
      acuteTurnCount: route.acuteTurnCount,
      reversalCount: route.reversalCount,
      routeCostClass: route.routeKind === 'clean-orthogonal' ? 'clean-orthogonal' : route.routeKind,
    } satisfies DiagramEdgePathDebug
    : undefined;

  return {
    path,
    controlPoints,
    planningWaypoints: route.waypoints,
    acuteTurnCount: route.acuteTurnCount,
    reversalCount: route.reversalCount,
    orthogonalDeviationPenalty: route.orthogonalDeviationPenalty,
    groupIngressPenalty: route.groupIngressPenalty,
    pathDebug,
  };
}
