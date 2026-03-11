// Stable data contracts for the diagram edge routing candidate pipeline.

import type {
  DiagramEdgePathDebug,
  DiagramEdgePathState,
  DiagramEdgePort,
  DiagramWarnFn,
  EdgeLandingAlgorithm,
  EdgeRoutingAlgorithm,
} from '../types';

/** Face identifier for a node in 3D space. */
export type FaceId = 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back';

/** 3D vector as an immutable triple. */
export type Vec3 = readonly [number, number, number];

/** Node bounding box dimensions [width, height, depth]. */
export type NodeDimensions = readonly [number, number, number];

/** Configuration parameters for the flow routing algorithm. */
export type FlowRoutingConfig = {
  readonly flowTurnRadius: number;
  readonly flowFaceStub: number;
  readonly flowBundleStrength: number;
  readonly flowObstaclePadding: number;
  readonly flowTargetApproachBias: number;
  readonly flowUnderpassDepth: number;
  readonly flowUnderpassClearance: number;
  readonly flowTurnPenalty: number;
  readonly flowPunchthroughPenalty: number;
  readonly flowUnderpassPenalty: number;
};

/**
 * Fully-resolved edge routing request with all defaults applied.
 * Built by routeEdges() before any pipeline stage is invoked.
 */
export type EdgeRoutingRequest = {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly routing: EdgeRoutingAlgorithm;
  readonly landing: EdgeLandingAlgorithm;
  readonly fromPort?: DiagramEdgePort;
  readonly toPort?: DiagramEdgePort;
  readonly thickness: number;
  readonly flowTurnRadius: number;
  readonly flowFaceStub: number;
  readonly flowBundleStrength: number;
  readonly flowTargetApproachBias: number;
  readonly allowUnderpass: boolean;
};

/**
 * Node geometry map in router Y-up planning space.
 * Built from Y-down NVS positions by buildRoutingNodeMap().
 */
export type RoutingNodeMap = ReadonlyMap<
  string,
  { readonly position: Vec3; readonly size: NodeDimensions }
>;

/**
 * Bundle routing hint inferred from sibling edges sharing the same source node.
 * Present when multiple flow edges fan out from one source to targets on both sides.
 */
export type BundleHint = {
  readonly edgeId: string;
  readonly sourceFaceHint?: FaceId;
  readonly sourceAnchorHint?: Vec3;
  readonly sourceGuideHint?: Vec3;
  readonly sharedTrunkKey?: string;
  readonly sharedTrunkDepth?: number;
};

/** A face-pair candidate before port assignment or route generation. */
export type EdgeFaceCandidate = {
  readonly edgeId: string;
  readonly srcFace: FaceId;
  readonly dstFace: FaceId;
  readonly sourceFaceLocked: boolean;
  readonly destinationFaceLocked: boolean;
  readonly bundleHint?: BundleHint;
};

/** Face candidate with computed source and destination port anchors. */
export type EdgePortPairCandidate = EdgeFaceCandidate & {
  readonly sourceAnchor: Vec3;
  readonly destinationAnchor: Vec3;
  readonly sourcePortIndex?: number;
  readonly destinationPortIndex?: number;
  readonly sourcePortCount?: number;
  readonly destinationPortCount?: number;
  readonly sourcePortLocalScore?: number;
  readonly destinationPortLocalScore?: number;
  readonly sourceLateralClass?: 'center' | 'inner' | 'outer' | 'edge';
  readonly destinationLateralClass?: 'center' | 'inner' | 'outer' | 'edge';
};

/** Back-compat alias for non-flow profiles that still use single port assignment. */
export type EdgePortCandidate = EdgePortPairCandidate;

/** Port candidate with optional source and destination guide points. */
export type EdgeGuidedCandidate = EdgePortPairCandidate & {
  readonly sourceGuide?: Vec3;
  readonly destinationGuide?: Vec3;
  readonly routeStart: Vec3;
  readonly routeEnd: Vec3;
};

/**
 * Intermediate route geometry produced by RoutingProfile.generateRoute().
 * Pre-computes bendCount and pathLength so the scorer reads them without
 * any profile-specific branching. DiagramEdgePathState is not produced here.
 */
export type NormalizedRouteGeometry = {
  /** Planning-space Y-up waypoints including stubs and any guides. */
  readonly waypoints: ReadonlyArray<Vec3>;
  /** Direction changes above a straight-line dot-product threshold. */
  readonly bendCount: number;
  /** Total polyline path length in planning-space units. */
  readonly pathLength: number;
  /** Route kind string forwarded to DiagramEdgePathDebug.routeKind. */
  readonly routeKind: string;
  /** Obstacle IDs intersected, forwarded to DiagramEdgePathDebug.obstacleIds. */
  readonly obstacleIds?: ReadonlyArray<string>;
  /** Number of acute turns in planning space; should be zero for orthogonal flow routes. */
  readonly acuteTurnCount: number;
  /** Number of 180-degree reversals in planning space. */
  readonly reversalCount: number;
  /** Penalty applied when a nominally orthogonal route still deviates. */
  readonly orthogonalDeviationPenalty: number;
  /** Penalty for destination-group ingress that violates the intended perimeter behavior. */
  readonly groupIngressPenalty: number;
  /** True when this candidate used underpass routing. */
  readonly usedUnderpass?: boolean;
};

/** A guided candidate with its generated route geometry attached. */
export type RoutedEdgeCandidate = EdgeGuidedCandidate & {
  readonly geometry: NormalizedRouteGeometry;
  readonly sharedTrunkKey?: string;
};

/** A routed candidate augmented with structured score and lexicographic rank key. */
export type ScoredEdgeCandidate = RoutedEdgeCandidate & {
  readonly score: EdgeCandidateScore;
  readonly rankKey: EdgeCandidateRankKey;
};

/** Structured score for one route candidate. Each metric is independently comparable. */
export type EdgeCandidateScore = {
  /** Penalty for obstacle penetrations, punctures, and underpasses. */
  readonly blockerPenalty: number;
  /** Penalty for route waypoints that overshoot or backtrack past the source-target axis. */
  readonly overshootPenalty: number;
  /** Penalty for acute turns; should dominate cosmetic length wins. */
  readonly acuteTurnPenalty: number;
  /** Penalty for 180-degree reversals; worse than a 90-degree bend. */
  readonly reversalPenalty: number;
  /** Number of direction changes in the waypoint polyline. */
  readonly bendCount: number;
  /** Total polyline path length in planning-space units. */
  readonly pathLength: number;
  /** Penalty when shared-trunk behavior is unavailable or incompatible. */
  readonly sharedPathPenalty: number;
  /** Late-stage penalty: face alignment, directional fitness, near-edge, fanout, ingress. */
  readonly heuristicPenalty: number;
};

/**
 * Lexicographic rank key for candidate comparison.
 * Lower is better. Ordered by the selection priority: blockers → overshoot →
 * bends → length → shared-path → heuristics.
 */
export type EdgeCandidateRankKey = readonly [
  blockerPenalty: number,
  overshootPenalty: number,
  acuteTurnPenalty: number,
  reversalPenalty: number,
  bendCount: number,
  pathLength: number,
  sharedPathPenalty: number,
  heuristicPenalty: number,
];

/**
 * Immutable context passed to every RoutingProfile method.
 * Profiles must not store this context between calls.
 */
export type RoutingProfileContext = {
  /** Full node map in router Y-up space. Required by the flow profile for obstacle model. */
  readonly nodeMap: RoutingNodeMap;
  /** Explicit set of routing IDs that represent diagram groups. */
  readonly groupIds: ReadonlySet<string>;
  /** Subset of groupIds that should behave as routing obstacles. */
  readonly obstacleGroupIds: ReadonlySet<string>;
  /** Routing configuration parameters (turn radius, face stub, padding, penalties). */
  readonly config: FlowRoutingConfig;
  /** Edge ID, forwarded to warnings and debug output only. */
  readonly edgeId: string;
  /** Source node ID, required by the flow profile for obstacle model construction. */
  readonly fromId: string;
  /** Destination node ID, required by the flow profile for obstacle model construction. */
  readonly toId: string;
  /** Whether this edge allows underpass routing (flow profile only). */
  readonly allowUnderpass: boolean;
  /** Organic variation magnitude for the organic profile. */
  readonly organicVariation: number;
  /** Optional warn callback for non-fatal routing events. */
  readonly onWarn?: DiagramWarnFn;
};

/**
 * Algorithm-specific route generation and path materialization contract.
 * All four routing algorithms (flow, curved, straight, organic) implement this.
 *
 * generateRoute() is called once per candidate (all candidates before scoring).
 * materializePath() is called once for the winning candidate only.
 */
export type RoutingProfile = {
  /**
   * Generate intermediate normalized route geometry from a guided candidate.
   * Must pre-compute bendCount and pathLength so the scorer can read them.
   * Must not produce a DiagramEdgePathState — that is materializePath's job.
   */
  generateRoute(
    candidate: EdgeGuidedCandidate,
    context: RoutingProfileContext,
  ): NormalizedRouteGeometry;

  /**
   * Materialize the final EdgeRouteState from the winning scored candidate.
   * Called once per edge after selection completes.
   */
  materializePath(
    candidate: ScoredEdgeCandidate,
    context: RoutingProfileContext,
  ): EdgeRouteState;
};

/** Final resolved state for one edge route. */
export type EdgeRouteState = {
  readonly path: DiagramEdgePathState;
  readonly controlPoints: ReadonlyArray<Vec3>;
  readonly pathDebug?: DiagramEdgePathDebug;
};
