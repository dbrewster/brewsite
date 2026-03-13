---
title: "BrewSite Diagram — Edge Routing System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-13
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram edge routing system as implemented."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "NVS recalibration: MIN_PORT_PITCH reduced from 0.35 to 0.05 (was calibrated for pre-NVS world units; 35% NVS pitch made multi-port faces impossible on typical nodes); EDGE_EPSILON reduced from 0.06 to 0.012 (6% NVS was too large for dense layouts). Functional Requirement 9 updated to remove stale pivot offset reference. Port Slot Distribution constants block updated."
  - date: 2026-03-10
    author: "Toolkit Product"
    summary: "Documented the unified candidate pipeline architecture introduced by plan_edge-routing-candidate-pipeline. All four routing algorithms now share the same staged planning pipeline (routingSpace → candidatePlanner → portPlanner → guidePlanner → routingProfiles → scorer → selector). Algorithm differences are confined to RoutingProfile.generateRoute() and materializePath(). Replaced the former weighted-sum face-scoring description with the new structured lexicographic scoring model. Updated API Design to reflect new compiler module boundaries and exported types. Updated Technical Considerations to reflect staged pipeline decomposition. Added RoutingProfile interface to API Design."
  - date: 2026-03-10
    author: "Toolkit Product"
    summary: "Updated the `flow` routing contract to use orthogonal visibility-graph planning with joint source/destination port-pair evaluation, explicit group-perimeter ingress behavior, acute/reversal-aware scoring, and rounded orthogonal path materialization."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Audit corrections: updated EdgeRoutingRequest to include all flow-routing configuration fields from DiagramThemeEdgeConfig (flowTurnRadius, flowFaceStub, flowBundleStrength, flowTargetApproachBias, allowUnderpass — and the new flowObstaclePadding, flowUnderpassDepth, flowUnderpassClearance, flowTurnPenalty, flowPunchthroughPenalty, flowUnderpassPenalty fields). Corrected the Lexicographic Candidate Selection Technical Considerations section — the rank key is 8 elements (matching EdgeCandidateRankKey), not 6."
---

## Overview

The edge routing system computes the 3D control points for `DiagramEdge` connections between nodes in `@brewsite/diagram`. It runs inside the diagram compilation pipeline after layout resolves all node positions. The result is stored as `ReadonlyArray<readonly [number, number, number]>` on each `DiagramEdgeState.controlPoints`. Control points are consumed by `EdgeRenderer` to construct CatmullRom tube geometry at render time.

The system is implemented as a **unified candidate pipeline** shared across all four routing algorithms (`flow`, `curved`, `straight`, `organic`). The pipeline lives in `packages/diagram/src/elements/diagram/compiler/` and consists entirely of pure TypeScript modules — no Three.js or React dependencies anywhere in the routing stack. `flow` now has a stronger contract than the other profiles: it plans over an orthogonal visibility graph, evaluates bounded source/destination port pairs jointly, and only rounds corners after the orthogonal path is selected.

## Problem Statement

Diagram edges in a 3D scene require more than a straight line between two node centers. Each edge must: (1) exit its source node from a natural face rather than cutting through the geometry, (2) avoid visually penetrating adjacent nodes, (3) not overlap sibling edges that share the same face, and (4) suit the aesthetic intent of the chosen theme (organic curves for dark presentations, sharp 90° turns for circuit-board diagrams). Without a principled routing system, consumer scenes require manual control point specification for every edge — a prohibitive authoring burden for diagrams with tens or hundreds of connectors.

Prior to the candidate pipeline, each routing algorithm (`flow`, `curved`, `straight`, `organic`) ran its own face-selection and scoring logic, causing algorithm-to-algorithm inconsistency: `flow` accumulated obstacle-aware logic and guide heuristics while the other algorithms bypassed much of that machinery. This produced routing modes that behaved as separate systems and made it impossible to guarantee that the most direct valid route would always win.

## Goals and Success Metrics

**Primary goals:**
- All edges in a compiled diagram have valid control points without consumer-authored coordinate data
- The default routing produces visually clean output for grids of 4–50 nodes with no obvious overlaps or face penetrations
- Per-edge routing overrides work without recompiling the whole diagram
- Self-loop and missing-node edges degrade gracefully to empty control points with no thrown exception
- All four routing algorithms obey the same planning semantics and selection ordering; only route geometry and path materialization differ between them

**Success metrics:**
- Zero thrown exceptions for self-loop or missing-node edge inputs in the test suite
- Stage-level unit tests cover all seven pipeline modules independently
- Example scenes in `apps/examples/` render without manual control point specification
- Direct routes beat overshooting routes in all candidate-scorer unit tests

**Guardrail metrics:**
- `routeEdges` function signature remains backward compatible across minor versions
- No Three.js import introduced into any compiler module in `elements/diagram/compiler/`

## Non-Goals

- Obstacle avoidance that guarantees clearance around all intermediate nodes (paths may pass through unrelated nodes in complex layouts; the pipeline penalizes this but does not guarantee clearance)
- Dynamic re-routing at runtime in response to node drag interactions
- Bezier editing UI or consumer-visible handle manipulation
- Path smoothing as a post-process step after control point computation

## Consumer Stories

- As a toolkit consumer, I want edges to connect automatically so that I can author a 50-node architecture diagram without specifying a single control point.
- As a toolkit consumer, I want to specify `routing="orthogonal"` on a per-edge basis so that I can mix curved and grid-style connectors in the same diagram.
- As a toolkit consumer, I want to pin an edge to a specific face using `fromPort` and `toPort` so that connectors entering a node always arrive at the expected side.
- As a toolkit consumer, I want edges that connect a node to itself to silently produce no geometry so that self-referential data does not break renders.

## Functional Requirements

1. `routeEdges` shall compute control points for all edges in a single pass after node layout is resolved.
2. Self-loop edges (`from === to`) shall produce an empty control points array and shall not throw.
3. Edges referencing a node ID absent from `positions` or `sizes` shall produce an empty control points array and emit a `console.warn`.
4. Edge IDs shall be auto-generated as `"${from}-${to}-${index}"` when not explicitly specified in the DSL.
5. Per-edge `routing` prop shall override the `defaultRouting` argument for that edge only.
6. When `fromPort` or `toPort` is specified on an edge, face selection for that endpoint shall use the declared port and ignore the candidate expansion model for that endpoint.
7. When only one port is declared, the opposite endpoint shall resolve its face using the candidate pipeline's lexicographic selection.
8. Multiple edges sharing the same face on the same node shall be distributed across port slots to avoid overlap.
9. All control points shall be expressed in diagram-local space (after node positions are resolved by the layout engine).
10. No module in `elements/diagram/compiler/` shall import Three.js, React, or any runtime dependency.
11. All four routing algorithms (`flow`, `curved`, `straight`, `organic`) shall use the same candidate pipeline for face selection, port assignment, guide generation, and candidate ranking. Algorithm differences are confined to `RoutingProfile.generateRoute()` and `RoutingProfile.materializePath()`.
12. Candidate selection shall follow lexicographic ordering: blocker penalty, overshoot penalty, acute-turn penalty, reversal penalty, bend count, path length, shared-path compatibility, then heuristic tie-breakers. No stage shall collapse this ordering into a single weighted scalar.
13. `routing="flow"` shall plan as an orthogonal XY route whose first and last planning segments respect the selected source and destination face normals.
14. `routing="flow"` shall not produce acute planning-space interior turns during normal routing; corner smoothing is a render-time fillet on top of the orthogonal path.
15. Group targets in `routing="flow"` shall be treated as perimeter targets. The router shall prefer externally reachable boundary faces and shall not rely on globally ignoring the destination group body.

## API Design

### Public function

```typescript
// packages/diagram/src/elements/diagram/compiler/edgeRouter.ts

export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm = 'curved',
  defaultLanding: EdgeLandingAlgorithm = 'nearest-face',
): Map<string, ReadonlyArray<Vec3>>;
```

`EdgeRoutingInput` is the minimal edge descriptor used internally; it mirrors the fields of `DiagramEdgeDSL` that are relevant to routing:

```typescript
type EdgeRoutingInput = {
  id?: string;
  from: string;
  to: string;
  routing?: EdgeRoutingAlgorithm;
  fromPort?: DiagramEdgePort;
  toPort?: DiagramEdgePort;
  thickness?: number;
};

type Vec3 = readonly [number, number, number];
type NodeDimensions = readonly [number, number, number]; // [width, height, depth]
```

The returned `Map` keys are resolved edge IDs (either the declared `id` or the auto-generated fallback). A key maps to an empty array for self-loops and missing-node edges.

### Routing algorithm types

```typescript
// packages/diagram/src/elements/diagram/types.ts

export type EdgeRoutingAlgorithm = 'curved' | 'flow' | 'straight' | 'organic';
export type EdgeLandingAlgorithm = 'nearest-face' | 'shortest-path' | 'center' | 'port';
export type DiagramEdgePort = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
```

### Core pipeline types

All inter-stage data contracts are defined in `routingTypes.ts`:

```typescript
// packages/diagram/src/elements/diagram/compiler/routingTypes.ts

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
  readonly flowObstaclePadding: number;
  readonly flowTargetApproachBias: number;
  readonly flowUnderpassDepth: number;
  readonly flowUnderpassClearance: number;
  readonly flowTurnPenalty: number;
  readonly flowPunchthroughPenalty: number;
  readonly flowUnderpassPenalty: number;
  readonly allowUnderpass: boolean;
};

export type RoutingNodeMap = ReadonlyMap<string, {
  readonly position: Vec3;
  readonly size: NodeDimensions;
}>;

export type EdgeFaceCandidate = {
  readonly edgeId: string;
  readonly srcFace: FaceId;
  readonly dstFace: FaceId;
  readonly sourceFaceLocked: boolean;
  readonly destinationFaceLocked: boolean;
  readonly bundleHint?: BundleHint;
};

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

export type EdgeGuidedCandidate = EdgePortPairCandidate & {
  readonly sourceGuide?: Vec3;
  readonly destinationGuide?: Vec3;
  readonly routeStart: Vec3;
  readonly routeEnd: Vec3;
};

export type NormalizedRouteGeometry = {
  readonly waypoints: ReadonlyArray<Vec3>;
  readonly bendCount: number;
  readonly pathLength: number;
  readonly routeKind: string;
  readonly obstacleIds?: ReadonlyArray<string>;
  readonly acuteTurnCount: number;
  readonly reversalCount: number;
  readonly orthogonalDeviationPenalty: number;
  readonly groupIngressPenalty: number;
  readonly usedUnderpass?: boolean;
};

export type RoutedEdgeCandidate = EdgeGuidedCandidate & {
  readonly geometry: NormalizedRouteGeometry;
  readonly sharedTrunkKey?: string;
};

export type EdgeCandidateScore = {
  readonly blockerPenalty: number;
  readonly overshootPenalty: number;
  readonly acuteTurnPenalty: number;
  readonly reversalPenalty: number;
  readonly bendCount: number;
  readonly pathLength: number;
  readonly sharedPathPenalty: number;
  readonly heuristicPenalty: number;
};

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

export type ScoredEdgeCandidate = RoutedEdgeCandidate & {
  readonly score: EdgeCandidateScore;
  readonly rankKey: EdgeCandidateRankKey;
};
```

### RoutingProfile interface

All four routing algorithms implement the same profile contract. Only `ROUTING_PROFILES` is exported from `edgeRoutingProfiles.ts`; the individual profile objects are non-exported implementation details.

```typescript
// packages/diagram/src/elements/diagram/compiler/edgeRoutingProfiles.ts

export type RoutingProfileContext = {
  readonly nodeMap: RoutingNodeMap;
  readonly config: FlowRoutingConfig;
  readonly edgeId: string;
  readonly onWarn?: DiagramWarnFn;
};

export type RoutingProfile = {
  generateRoute(
    candidate: EdgeGuidedCandidate,
    context: RoutingProfileContext,
  ): NormalizedRouteGeometry;

  materializePath(
    candidate: ScoredEdgeCandidate,
    context: RoutingProfileContext,
  ): EdgeRouteState;
};

export const ROUTING_PROFILES: Record<EdgeRoutingAlgorithm, RoutingProfile>;
```

### Lower-level face utilities (exported for testing)

```typescript
export type FaceId = 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back';

export function getFaceCenter(pos: Vec3, size: NodeDimensions, face: FaceId): Vec3;
export function getFaceNormal(face: FaceId): Vec3;
export function getFacePortAnchor(
  pos: Vec3,
  size: NodeDimensions,
  face: FaceId,
  portIndex: number,
  portCount: number,
  targetPos: Vec3,
): Vec3;
export function nearestFace(origin: Vec3, target: Vec3): FaceId;
export function resolveFaces(
  srcPos: Vec3, srcSize: NodeDimensions,
  dstPos: Vec3, dstSize: NodeDimensions,
  landing: EdgeLandingAlgorithm,
  fromPort?: DiagramEdgePort,
  toPort?: DiagramEdgePort,
): { srcFace: FaceId; dstFace: FaceId };
```

## Technical Considerations

### Staged Candidate Pipeline

Routing is decomposed into a sequence of pure data transformations. All four algorithms traverse the same twelve stages; only stages 8 (route generation) and 11 (path materialization) vary by algorithm:

1. Build normalized routing space (`routingSpace.ts` — Y-down NVS → Y-up router space)
2. Build immutable `EdgeRoutingRequest[]`
3. Infer sibling bundle hints (`edgeCandidatePlanner.ts`)
4. Expand face-pair candidates (`edgeCandidatePlanner.ts`)
5. Prune impossible face candidates early (`edgeCandidatePlanner.ts`)
6. Assign ports per candidate (`edgePortPlanner.ts`)
7. Build guides per candidate (`edgeGuidePlanner.ts`)
8. Generate candidate route geometry via `RoutingProfile.generateRoute()` (`edgeRoutingProfiles.ts`)
9. Score each candidate (`edgeCandidateScorer.ts`)
10. Select the best candidate lexicographically (`edgeCandidateSelector.ts`)
11. Materialize final `EdgeRouteState` via `RoutingProfile.materializePath()` (`edgeRoutingProfiles.ts`)
12. Transform back to caller coordinate space (`routingSpace.ts`)

### Coordinate System Normalization

`routingSpace.ts` owns Y-axis normalization. NVS space is Y-down; the router pipeline operates in Y-up space. `buildRoutingNodeMap()` converts all positions on entry; `denormalizeEdgeRoute()` mirrors routes back before returning to `routeEdges()`. No other module performs Y-axis translation.

### Lexicographic Candidate Selection

`edgeCandidateScorer.ts` produces a structured `EdgeCandidateScore` — not a single scalar. `edgeCandidateSelector.ts` projects this into an `EdgeCandidateRankKey` (an 8-tuple) and compares candidates in strict tuple order:

1. Lowest blocker penalty
2. Lowest overshoot penalty
3. Lowest acute-turn penalty
4. Lowest reversal penalty
5. Fewest bends
6. Shortest path length
7. Best shared-path compatibility
8. Lowest heuristic penalty

Acute-turn and reversal penalties are architectural-level disqualifiers that rank before bend count. Shared-path compatibility and heuristic preferences (aesthetic face bias, near-edge penalties) are only tie-breakers — they cannot override a more direct or less-bent route. This is a hard requirement: no stage may collapse the rank key into a weighted sum for final selection.

### Bundle Hint Inference

`edgeCandidatePlanner.ts` infers bundle hints from sibling edges before face expansion. Edges from the same source node targeting nodes on the same geometric side are grouped into a shared trunk. Bundle hints express a preferred face and guide anchor for those sibling edges. They bias (but do not override) candidate expansion and guide generation.

### Per-Candidate Port Assignment

Port assignment is local to each candidate face pair. Each candidate independently computes `sourceAnchor` and `destinationAnchor` via `edgePortPlanner.ts` based on per-face slot occupancy within the current call context. This is a behavioral improvement over the prior model where global group-face slot assignment was detached from face pair context.

### Guide Generation and Overshoot Suppression

`edgeGuidePlanner.ts` attaches optional source and destination guide points to each candidate. Guide generation is gated on two conditions:
- A destination guide is only created when the destination face normal faces toward the source.
- A guide is rejected when it would project beyond the source-to-target span by more than a small fixed tolerance.

These rejections happen before route generation, so the route generator never receives a spurious guide that would introduce unnecessary turns.

### Routing Profile Responsibilities

The `flow` profile calls `flowRouter.ts` (obstacle-aware visibility routing) and `flowPathBuilder.ts` for route generation and materialization. The `curved` profile uses `routeCurvedWithEndpointNormals` from `curveKernel.ts`. The `straight` profile emits a minimal stub-to-stub segment sequence. The `organic` profile uses the curved pipeline and applies a deterministic perpendicular offset keyed by edge ID hash during materialization.

All four profiles receive the same face, port, and guide data selected by the shared pipeline. Profile-specific behavior is strictly limited to how the path geometry is generated from that data.

### Port Slot Distribution

When multiple edges share the same face on a node, `edgePortPlanner.ts` distributes them across evenly spaced port slots along the face span. Slot count is derived from the face span, edge thickness, and minimum port pitch:

```typescript
const EDGE_EPSILON = 0.012;      // NVS units: face-center offset to avoid z-fighting
const MIN_PORT_PITCH = 0.05;     // NVS units: minimum spacing between adjacent edge ports on a face
const PORT_SPACING_FACTOR = 3.0; // pitch = max(MIN_PORT_PITCH, thickness * PORT_SPACING_FACTOR)
const PORT_MARGIN_FACTOR = 1.5;  // margin from face edge = thickness * PORT_MARGIN_FACTOR
```

These constants are calibrated for the 0..1 NVS coordinate system.

### Orthogonal Routing

`flow` mode with face-perpendicular exit and entry semantics replaces the former `orthogonal` algorithm. The `flow` profile handles four face-pair cases internally: H→H, V→V, H→V, and V→H. For `front`/`back` source or destination faces, the `flow` profile falls back to curved path generation since 90° routing in the Z dimension is not visually meaningful for typical 2.5D diagrams.

### Organic Routing

The `organic` profile builds on the curved pipeline and applies a deterministic perpendicular offset to the path midpoint. The offset magnitude uses a hash of the edge ID (`hashStr`) to produce stable variation across recompiles.

### Integration with compile.ts

`routeEdges` is called from `compile.ts` after `layoutResolver` assigns positions. The call passes:
- `edges` from `DiagramDSL.edges`
- `positions` and `sizes` maps built from compiled `DiagramNodeState` entries
- `defaultRouting` and `defaultLanding` from the resolved `DiagramTheme.edge`

The returned map is used to populate `DiagramEdgeState.controlPoints` for each edge.

### EdgeRenderer Consumption

`EdgeRenderer.getOrCreate(edge, parent)` reads `edge.controlPoints` and creates a `THREE.CatmullRomCurve3` from the points. Tube segments are set to `Math.max(20, controlPoints.length * 8) * edgeSmoothness`. Empty control points arrays result in a degenerate 0-length curve; `EdgeRenderer` skips mesh creation when `controlPoints.length < 2`.

## Breaking Change Assessment

**Semver impact: none (patch-only changes to internal algorithms).** The `routeEdges` function signature and all type exports involved in routing are unchanged. The `EdgeRoutingAlgorithm`, `EdgeLandingAlgorithm`, and `DiagramEdgePort` types are additive closed unions — new values would be a minor bump; removing a value would be a major bump.

The new compiler modules (`routingTypes.ts`, `routingSpace.ts`, `edgeCandidatePlanner.ts`, `edgePortPlanner.ts`, `edgeGuidePlanner.ts`, `edgeCandidateScorer.ts`, `edgeCandidateSelector.ts`, `edgeRoutingProfiles.ts`) are internal implementation details not re-exported from any package index. No consumer code is affected.

## Dependencies

- `compiler/curveKernel.ts` — shared spline math; no external dependencies
- `compiler/flowRouter.ts` — obstacle-aware routing for the `flow` profile
- `compiler/flowPathBuilder.ts` — explicit path command construction for the `flow` profile
- `compiler/flowObstacleModel.ts` — obstacle geometry for flow routing
- `elements/diagram/types.ts` — `EdgeRoutingAlgorithm`, `EdgeLandingAlgorithm`, `DiagramEdgePort`
- No external npm packages

## Risks and Mitigations

**API regret — `routeEdges` signature:** The function accepts two separate `Map` arguments (`positions`, `sizes`) rather than a single `Map<string, NodeState>`. This is intentional: routing does not need the full node state, and keeping the signature minimal reduces coupling. The only caller is `compile.ts`, so the surface is not exposed to consumers.

**Candidate pipeline performance at scale:** Face candidate expansion is bounded at `O(F²)` with a small fixed `F` (planar faces only by default). Route generation per edge is bounded by the small post-pruning candidate set. Stage-local caches eliminate duplicate route computation for repeated candidate keys. For diagrams with 200+ edges, total compile time is measurable but acceptable since compile runs are synchronous and happen once per scene transition, not per frame.

**Orthogonal fall-through to curved:** When `flow` routing is selected for edges involving `front` or `back` faces, the `flow` profile falls back to curved path generation. A consumer authoring flow diagrams with Z-offset nodes will observe mixed routing styles on front/back-facing edges. This is documented behavior.

## Open Questions

- Should `routeEdges` accept a `depthMap: Map<string, number>` as a separate argument to decouple depth from `NodeDimensions[2]`, or is the current `[width, height, depth]` triple sufficient? The current approach works for 2.5D diagrams but becomes ambiguous if node depth ever differs from the collision depth used for routing.
- Should `flow:cylinder-stack` and `flow:queue` icon shapes influence face selection (e.g., always prefer top/bottom faces for stack nodes)? Currently icon choice has no effect on routing.

## Launch Criteria

- All seven pipeline modules have independent unit test files
- Self-loop and missing-node cases covered by unit tests
- Port slot distribution unit tested for 3+ edges sharing a single face
- Lexicographic tie-breaking tested: bend count wins over shared-path compatibility; shared-path only wins as a tie-breaker when bends and path length are equal
- `@brewsite/diagram` CHANGELOG updated
- At least one example scene in `apps/examples/diagram/` demonstrates the `flow` routing algorithm
