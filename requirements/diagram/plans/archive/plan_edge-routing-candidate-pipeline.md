---
title: "Diagram Edge Routing Candidate Pipeline — Implementation Plan"
doc_type: plan
owner: brewsite-architect
status: completed
updated: 2026-03-10
---

# Plan: Diagram Edge Routing Candidate Pipeline

## 1. Overview

This plan replaces the current edge-routing decision code with a **single pure candidate pipeline**
shared by every routing mode: `flow`, `curved`, `straight`, and `organic`.

The current implementation in
`packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`
mixes:

- coordinate normalization,
- bundle inference,
- face selection,
- port slot assignment,
- route generation,
- candidate scoring,
- path materialization,
- and legacy algorithm-specific exceptions

inside one large procedure. The result is difficult to test, difficult to reason about, and
prone to behavior where one heuristic rewards path detours that another part of the system
was supposed to suppress.

The rewrite in this plan turns routing into a sequence of **data transformations, space expansion,
and deterministic pruning**. Every stage is a small pure function operating only on input data and
producing output data. No stage should need access to mutable shared state or compiler context
outside its declared arguments.

This plan also explicitly addresses the user requirement that the non-`flow` algorithms stop acting
like rogue one-offs. The design below makes all algorithms obey the same structural routing
parameters and candidate selection rules, while still allowing each algorithm to render its own
profile after a candidate has been selected.

## 2. Objectives

The implementation must satisfy these objectives:

1. Replace the current monolithic routing selection logic with a staged pure pipeline.
2. Make `flow`, `curved`, `straight`, and `organic` use the same high-level planning stages:
   routing-space normalization, hint inference, face candidate expansion, per-candidate port
   assignment, per-candidate guide generation, candidate route generation, candidate scoring,
   candidate pruning, and final path materialization.
3. Ensure the router prioritizes:
   - valid routes over invalid routes,
   - direct routes over overshooting/backtracking routes,
   - fewer bends over more bends,
   - shorter routes over longer routes,
   - shared-trunk compatibility as a tie-breaker rather than a primary force,
   - face/port aesthetic heuristics only as late tie-breakers.
4. Preserve current public API surface unless explicitly noted.
5. Add stage-level unit tests so the routing system can be tested independently of rendering,
   scene compilation, or React.
6. Keep the entire implementation pure compiler logic. No React and no Three.js outside render.

## 3. Non-Goals

This plan does not:

- introduce runtime drag-and-drop rerouting,
- add consumer-authored manual control point editing,
- change scene DSL layout semantics,
- change diagram rendering materials or visual styling,
- alter camera, interaction, or input systems,
- add browser telemetry or analytics infrastructure.

## 4. Problem Statement

The current router is failing for two separate reasons:

1. **Architectural entanglement**
   A face-selection issue, port-slot issue, coordinate-system issue, or destination-guide issue
   all manifest as the same class of visual bug because they are evaluated inside the same shared
   scoring path.

2. **Algorithm inconsistency**
   `flow` has accumulated obstacle-aware logic, bundles, guides, and special port behavior while
   `curved`, `straight`, and `organic` still effectively bypass most of that machinery.
   This causes routing modes to behave like separate systems instead of shared profiles.

The immediate failure mode seen in the BrewFlow comparison scene is that the router can choose
indirect candidates which overshoot the destination and bend back, because the score is not
expressed as a clear lexicographic preference model. The system should instead choose the
most direct valid route with the fewest bends, only preferring shared trunk behavior when the
directness and bend count remain competitive.

## 5. Design Principles

The implementation must follow these principles:

1. **Pure functions only**
   Every planning stage consumes plain data and returns plain data.

2. **Space expansion then pruning**
   Candidate generation should expand search space explicitly, then prune aggressively with
   deterministic filters rather than carrying around large mutable bags of state.

3. **Invariant local data contracts**
   Each stage should accept the smallest stable input shape that is sufficient for its job.

4. **Single source of truth for semantics**
   Face semantics, routing-space semantics, scoring semantics, and guide semantics must each be
   defined once and reused across all routing algorithms.

5. **Profile-based rendering**
   Candidate selection should be shared. The routing algorithm differences should appear mainly in
   the route-generation profile and path-materialization profile.

6. **Lexicographic route choice**
   Candidate selection must not rely on a single opaque weighted sum when the intended behavior is
   ordered preference.

## 6. Affected Files

### 6.1 New files

Create these new pure compiler modules:

- `packages/diagram/src/elements/diagram/compiler/routingSpace.ts`
- `packages/diagram/src/elements/diagram/compiler/routingTypes.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeCandidatePlanner.ts`
- `packages/diagram/src/elements/diagram/compiler/edgePortPlanner.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeGuidePlanner.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeCandidateScorer.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeCandidateSelector.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeRoutingProfiles.ts`

### 6.2 Modified files

| File | What changes and why |
|---|---|
| `compiler/edgeRouter.ts` | Reduced to orchestration: builds `EdgeRoutingRequest[]`, invokes the staged pipeline (planner → port → guide → profile.generateRoute → scorer → selector → profile.materializePath), returns `Map<string, EdgeRouteState>`. All routing logic moves to new modules. `FaceId`, `Vec3`, `NodeDimensions` aliases move to `routingTypes.ts`. |
| `compiler/flowRouter.ts` | Signature unchanged. Now called per-candidate by the `flow` profile in `edgeRoutingProfiles.ts` instead of once per edge in `edgeRouter.ts`. The obstacle model is built once per edge (not per candidate) and cached in the profile's call-local context. No public API change. |
| `compiler/flowObstacleModel.ts` | No interface change. `buildFlowObstacleModel()` is called from the `flow` profile implementation. Its `Vec3`/`NodeDimensions` local aliases may be removed in favor of imports from `routingTypes.ts`. |
| `compiler/flowPathBuilder.ts` | No interface change. `buildFlowPathState()` and `commandsToControlPoints()` remain the materialization helpers called by the `flow` profile's `materializePath()`. `buildLegacyEdgePath()` is removed if no callers remain after extraction. |
| `compiler/transitionHelpers.ts` | `rerouteLiveEdges()` calls `routeEdgesYDown()`, which is unchanged at the call site. The only modification is updating internal imports to use `EdgeRoutingRequest`-shaped types from `routingTypes.ts` rather than `edgeRouter.ts` local types, if those aliases move. No behavioral change. |
| `compile.ts` | Import paths update if `FaceId`, `Vec3`, or other shared types migrate from `edgeRouter.ts` to `routingTypes.ts`. The `routeEdges()` call site is identical; no behavioral change. |
| `types.ts` | `DiagramEdgePathDebug` is extended with structured debug fields from the winning candidate (Section 12.4). No existing fields are removed. |
| `__tests__/compile.test.ts` | Update assertions that depend on edge `path` or `controlPoints` shape, if debug field additions change the output type. |
| `compiler/__tests__/edgeRouter.test.ts` | Update to exercise the new pipeline through `routeEdges()`, replacing any tests that depended on now-extracted internal functions. Stage-level tests move to their own files (Section 19.1). |

### 6.3 Documentation files

- `requirements/diagram/prd/prd_edge_routing.md`
- `requirements/diagram/plans/plan_flow-routing-rewrite.md`

`plan_flow-routing-rewrite.md` remains valid historically, but after implementation it must be
updated or archived with a note that the candidate-pipeline plan supersedes its monolithic
delegation assumptions.

## 7. Module Boundaries

### 7.1 `routingTypes.ts`

Purpose:
Defines the stable data contracts passed between routing stages.

This file must contain:

- route-space vector aliases,
- immutable planning input types,
- candidate types,
- scoring types,
- routing profile types,
- bundle hint types,
- normalized route output types.

It must not contain any route generation logic.

### 7.2 `routingSpace.ts`

Purpose:
Owns coordinate-system normalization and inverse normalization.

Responsibilities:

- convert Y-down NVS space to router Y-up planning space,
- mirror control points and tangents back to caller space,
- provide stateless helpers such as `mirrorVecY`.

This is the only place where Y-down vs Y-up translation may exist.

**Exported function signatures:**

```typescript
/** Negate the Y component of a Vec3. Y-down NVS ↔ Y-up router space (symmetric). */
export function mirrorVecY(v: Vec3): Vec3;

/**
 * Build a unified RoutingNodeMap in router Y-up space from separate NVS position
 * and size maps. Applies mirrorVecY to every position; sizes are unchanged.
 */
export function buildRoutingNodeMap(
  positions: ReadonlyMap<string, Vec3>,
  sizes: ReadonlyMap<string, NodeDimensions>,
): RoutingNodeMap;

/**
 * Mirror all Vec3 coordinates in a single EdgeRouteState back from router Y-up
 * space to caller Y-down NVS space. Called per-route by routeEdgesYDown().
 */
export function denormalizeEdgeRoute(route: EdgeRouteState): EdgeRouteState;
```

### 7.3 `edgeCandidatePlanner.ts`

Purpose:
Expand face candidates and bundle hints into candidate route requests.

Responsibilities:

- infer bundle hints from sibling edges,
- resolve locked faces from explicit ports or bundle hints,
- enumerate face-pair candidates,
- attach per-candidate metadata without generating routes yet.

This module must not assign ports or build guides.

**Exported function signatures:**

```typescript
/**
 * Infer bundle hints for a set of edges from their sibling routing requests.
 * Edges from the same source node targeting nodes on the same side are grouped
 * into a shared trunk. Returns a map keyed by edge ID.
 */
export function inferBundleHints(
  requests: ReadonlyArray<EdgeRoutingRequest>,
  nodeMap: RoutingNodeMap,
): ReadonlyMap<string, BundleHint>;

/**
 * Expand all valid face-pair candidates for a single edge, respecting explicit
 * port locks and bundle face hints. Returns all candidates before port assignment.
 */
export function enumerateFaceCandidates(
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
  bundleHints: ReadonlyMap<string, BundleHint>,
): ReadonlyArray<EdgeFaceCandidate>;

/**
 * Remove candidates that cannot produce a valid route given the request and node
 * positions, before any port assignment or route generation is attempted.
 */
export function pruneImpossibleFaceCandidates(
  candidates: ReadonlyArray<EdgeFaceCandidate>,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
): ReadonlyArray<EdgeFaceCandidate>;
```

### 7.4 `edgePortPlanner.ts`

Purpose:
Assign ports strictly in the context of a candidate face pair.

Responsibilities:

- compute per-face port capacity,
- score candidate slots,
- return `sourceAnchor` and `destinationAnchor`,
- avoid global port assignment detached from face pair context.

This module must not decide faces.

**Exported function signature:**

```typescript
/**
 * Assign source and destination port anchors for a single face-candidate given
 * the current node geometry and per-face slot occupancy within this call context.
 * Returns a port-assigned candidate; does not modify external state.
 */
export function assignPorts(
  candidate: EdgeFaceCandidate,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
): EdgePortCandidate;
```

### 7.5 `edgeGuidePlanner.ts`

Purpose:
Generate source/destination guides for a specific candidate.

Responsibilities:

- create bundle guide points,
- create target approach guides only when the target face actually faces the source,
- skip guide generation when a guide would introduce overshoot or backtracking risk.

This module must not score complete routes.

**Exported function signature:**

```typescript
/**
 * Attach source and destination guide points to a port-assigned candidate.
 * Guide rejection reasons are stored as optional debug metadata on the returned
 * candidate; rejected guides produce an undefined field (not an error throw).
 */
export function buildCandidateGuides(
  candidate: EdgePortCandidate,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
): EdgeGuidedCandidate;
```

### 7.6 `edgeCandidateScorer.ts`

Purpose:
Score a fully generated route candidate using explicit ordered metrics.

Responsibilities:

- compute blockers,
- compute overshoot/backtracking,
- compute bend count,
- compute route length,
- compute shared-trunk compatibility,
- compute late-stage face/port tie-breakers.

This module must produce a structured score object, not a single scalar.

**Exported function signatures:**

```typescript
/**
 * Compute a structured score for a single routed candidate.
 * All metrics read from candidate.geometry — no profile-specific branching.
 */
export function scoreCandidate(
  candidate: RoutedEdgeCandidate,
): EdgeCandidateScore;

/**
 * Project a structured score into a lexicographic rank key tuple.
 * The tuple ordering matches the required selection priority (Section 12.1).
 */
export function candidateToRankKey(
  score: EdgeCandidateScore,
): EdgeCandidateRankKey;
```

### 7.7 `edgeCandidateSelector.ts`

Purpose:
Apply ordered pruning and candidate selection.

Responsibilities:

- remove invalid candidates,
- rank remaining candidates lexicographically,
- choose the winning candidate.

This module must not generate geometry.

**Exported function signature:**

```typescript
/**
 * Select the winning candidate from a scored set using lexicographic comparison
 * of rank keys. Returns null only when the input array is empty (callers handle
 * the empty case by invoking the fallback path described in Section 14.2).
 * Must never collapse rank keys into a weighted sum.
 */
export function selectBestCandidate(
  candidates: ReadonlyArray<ScoredEdgeCandidate>,
): ScoredEdgeCandidate | null;
```

### 7.8 `edgeRoutingProfiles.ts`

Purpose:
Provide algorithm-specific route generation and path materialization behavior.

Profiles:

- `flow`
- `curved`
- `straight`
- `organic`

Each profile must implement the same pure interface. The interface is defined in
`routingTypes.ts` and is the central composition seam between the shared pipeline
and the algorithm-specific code.

**`RoutingProfileContext` and `RoutingProfile` interface:**

```typescript
/**
 * Immutable context passed to every RoutingProfile method.
 * Profiles must not store this context between calls.
 */
export type RoutingProfileContext = {
  /** Full node map in router Y-up space. Required by the flow profile for obstacle model. */
  readonly nodeMap: RoutingNodeMap;
  /** Routing configuration parameters (turn radius, face stub, padding, penalties). */
  readonly config: FlowRoutingConfig;
  /** Edge ID, forwarded to warnings and debug output only. */
  readonly edgeId: string;
  /** Optional warn callback for non-fatal routing events. */
  readonly onWarn?: DiagramWarnFn;
};

/**
 * Algorithm-specific route generation and path materialization contract.
 * All four routing algorithms (flow, curved, straight, organic) implement this.
 *
 * generateRoute() is called once per candidate (for all candidates before scoring).
 * materializePath() is called once for the winning candidate only.
 */
export type RoutingProfile = {
  /**
   * Generate intermediate normalized route geometry from a guided candidate.
   * Must pre-compute bendCount and pathLength (the scorer reads these directly).
   * Must not produce a DiagramEdgePathState — that is materializePath's responsibility.
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

/** Registry mapping routing algorithm names to their profile implementations. */
export const ROUTING_PROFILES: Record<EdgeRoutingAlgorithm, RoutingProfile>;
```

The four profile implementations (`flow`, `curved`, `straight`, `organic`) are
non-exported implementation details inside `edgeRoutingProfiles.ts`. Only
`ROUTING_PROFILES` is exported, so `edgeRouter.ts` selects the profile via
`ROUTING_PROFILES[request.routing]` without importing each profile individually.

### 7.9 `edgeRouter.ts`

Purpose:
Remain the public orchestration entry point.

Responsibilities:

- build routing context,
- invoke the staged candidate pipeline,
- invoke the selected routing profile,
- return `Map<string, EdgeRouteState>`,
- provide `routeEdgesYDown()` as a wrapper around normalized routing space.

After refactor, `edgeRouter.ts` should be a relatively thin composition module rather than the
site of all routing logic.

## 8. Data Model

### 8.1 Core route planning input

Add these immutable planning types in `routingTypes.ts`:

```typescript
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

export type RoutingNodeMap = ReadonlyMap<string, {
  readonly position: Vec3;
  readonly size: NodeDimensions;
}>;
```

### 8.2 Bundle hints

```typescript
export type BundleHint = {
  readonly edgeId: string;
  readonly sourceFaceHint?: FaceId;
  readonly sourceAnchorHint?: Vec3;
  readonly sourceGuideHint?: Vec3;
  readonly sharedTrunkKey?: string;
  readonly sharedTrunkDepth?: number;
};
```

### 8.3 Face candidate

```typescript
export type EdgeFaceCandidate = {
  readonly edgeId: string;
  readonly srcFace: FaceId;
  readonly dstFace: FaceId;
  readonly sourceFaceLocked: boolean;
  readonly destinationFaceLocked: boolean;
  readonly bundleHint?: BundleHint;
};
```

### 8.4 Port-assigned candidate

```typescript
export type EdgePortCandidate = EdgeFaceCandidate & {
  readonly sourceAnchor: Vec3;
  readonly destinationAnchor: Vec3;
  readonly sourcePortIndex?: number;
  readonly destinationPortIndex?: number;
  readonly sourcePortCount?: number;
  readonly destinationPortCount?: number;
};
```

### 8.5 Guide-assigned candidate

```typescript
export type EdgeGuidedCandidate = EdgePortCandidate & {
  readonly sourceGuide?: Vec3;
  readonly destinationGuide?: Vec3;
};
```

### 8.6 Normalized route geometry

Produced by `RoutingProfile.generateRoute()`. Provides a profile-neutral representation
that `edgeCandidateScorer.ts` can consume without any profile-specific branching.
This resolves the `FlowRouteResult | ReadonlyArray<Vec3>` union that would otherwise
leak profile knowledge into the shared scoring stage.

```typescript
/**
 * Intermediate route representation produced by RoutingProfile.generateRoute().
 * All metrics needed for lexicographic scoring are pre-computed by the profile.
 * DiagramEdgePathState is NOT produced here — only after the winner is selected.
 */
export type NormalizedRouteGeometry = {
  /** Planning-space Y-up waypoints, including stubs and any guides. */
  readonly waypoints: ReadonlyArray<Vec3>;
  /** Number of direction changes above a straight-line dot-product threshold. */
  readonly bendCount: number;
  /** Total polyline path length in planning-space units. */
  readonly pathLength: number;
  /** Route kind string, forwarded to DiagramEdgePathDebug.routeKind. */
  readonly routeKind: string;
  /** Obstacle IDs intersected, forwarded to DiagramEdgePathDebug.obstacleIds. */
  readonly obstacleIds?: ReadonlyArray<string>;
};
```

### 8.7 Routed candidate

`RoutedEdgeCandidate` carries a `NormalizedRouteGeometry` — not a raw
`FlowRouteResult` or bare `Vec3[]`. The path is not materialized until the winner
is selected (step 11 of the pipeline). The `sharedTrunkKey` is populated by the
`flow` profile when it detects a shared trunk during route generation.

```typescript
export type RoutedEdgeCandidate = EdgeGuidedCandidate & {
  readonly geometry: NormalizedRouteGeometry;
  readonly sharedTrunkKey?: string;
};
```

### 8.8 Scored candidate

Produced by combining a `RoutedEdgeCandidate` with its score and rank key.
This is the input type for `selectBestCandidate()`.

```typescript
export type ScoredEdgeCandidate = RoutedEdgeCandidate & {
  readonly score: EdgeCandidateScore;
  readonly rankKey: EdgeCandidateRankKey;
};
```

### 8.9 Structured score

```typescript
export type EdgeCandidateScore = {
  readonly blockerPenalty: number;
  readonly overshootPenalty: number;
  readonly bendCount: number;
  readonly pathLength: number;
  readonly sharedPathPenalty: number;
  readonly heuristicPenalty: number;
};
```

### 8.10 Lexicographic rank key

```typescript
export type EdgeCandidateRankKey = readonly [
  blockerPenalty: number,
  overshootPenalty: number,
  bendCount: number,
  pathLength: number,
  sharedPathPenalty: number,
  heuristicPenalty: number,
];
```

The selector compares rank keys in order. No stage may collapse this ordered ranking back into
a single weighted score for final selection.

## 9. Unified Pipeline

All routing algorithms must use the same pipeline:

1. Build normalized routing space.
2. Build immutable route requests.
3. Infer sibling bundle hints.
4. Expand face-pair candidates.
5. Prune impossible face candidates early.
6. Assign ports per candidate.
7. Build guides per candidate.
8. Generate candidate route geometry using the selected routing profile.
9. Score each candidate.
10. Select the best candidate.
11. Materialize final `EdgeRouteState`.
12. Transform back to caller coordinate space.

The algorithm-specific differences must appear only in steps 8 and 11.

## 10. Routing Profiles

### 10.1 Shared semantics

Every profile must obey the same planning parameters where applicable:

- face selection semantics,
- port assignment semantics,
- coordinate-space semantics,
- guide semantics,
- overshoot suppression,
- bend minimization ordering,
- shared-path tie-break rules.

Profiles may differ in path geometry but not in face/port/guide/selection semantics.

### 10.2 `flow`

Uses obstacle-aware routing via `flowRouter.ts` and `flowPathBuilder.ts`.

### 10.3 `straight`

Still participates in candidate expansion and port/guide evaluation, but route generation is a
direct segment or minimal stub-to-stub sequence. It must not bypass the face/port candidate model.

### 10.4 `curved`

Uses the same candidate pipeline and selected faces/ports as `flow`, but materializes via
`routeCurvedWithEndpointNormals`.

### 10.5 `organic`

Uses the same candidate pipeline and selected faces/ports as `curved`, then applies deterministic
organic deviation only during materialization.

## 11. Candidate Expansion and Pruning Rules

### 11.1 Face expansion

`enumerateFaceCandidates()` must:

- honor explicit port locks first,
- then honor bundle face hints,
- then expand over planar faces `left | right | top | bottom`,
- allow front/back only when explicitly locked or when a future profile explicitly requests it.

### 11.2 Early pruning

Prune candidates before port assignment when:

- the face points strongly away from the target and is not locked,
- the face is incompatible with the current profile,
- the candidate would force an illegal guide direction.

### 11.3 Port assignment

Port assignment must be local to a candidate face pair.

This is a required behavior change from the current global group-face slot assignment.

The implementation may still cache reusable face occupancy data, but the public mental model and
test model must be candidate-local.

### 11.4 Guide generation

`buildCandidateGuides()` must:

- never create a destination guide if the destination face normal does not face the source,
- never create a guide that projects beyond the source-to-target span by more than a small fixed
  tolerance,
- never force a guide for `straight` if doing so adds bends to a route that could otherwise remain
  direct.

## 12. Scoring and Selection

### 12.1 Ordered preference

Selection order must be:

1. Lowest blocker penalty
2. Lowest overshoot penalty
3. Fewest bends
4. Shortest path length
5. Best shared-path compatibility
6. Lowest heuristic penalty

This is the core behavioral requirement of this plan.

### 12.2 Shared-path compatibility

Shared paths are a tie-breaker. They must not dominate directness.

Implementation rule:

- shared trunk preference may improve candidate ranking only after the candidate has already
  matched or beaten competing candidates on blockers, overshoot, bends, and length.

### 12.3 Heuristic penalty content

Heuristic penalties include:

- aesthetic face preference,
- mild ingress preference,
- mild fanout preference,
- near-edge penalties,
- base nearest-face bias.

These values must remain late tie-breakers only.

### 12.4 Debug visibility

Extend `DiagramEdgePathDebug` so development builds can expose the winning candidate’s:

- selected faces,
- selected ports,
- rank key,
- route kind,
- whether bundle hint was used,
- whether destination guide was used,
- whether this is a fallback route (all candidates were invalid — see Section 14.2).

This remains compile-time debug data only.

## 13. API and Type Changes

### 13.1 Public API

Keep these public exports stable:

- `routeEdges`
- `routeEdgesYDown`
- `getFaceCenter`
- `getFaceNormal`
- `getFacePortAnchor`
- `nearestFace`
- `resolveFaces`

Add test-only exports only where necessary. Prefer exporting helper functions directly from the
new compiler modules rather than keeping private test hooks inside `edgeRouter.ts`.

### 13.2 Internal API

`routeEdges()` must internally transform raw edge inputs into `EdgeRoutingRequest[]`.
After that point, every stage must work off the normalized request shape only.

## 14. Error Handling

### 14.1 Missing endpoints

Maintain current behavior:

- return an empty route state,
- emit `MISSING_EDGE_ENDPOINT`.

### 14.2 No valid candidate

Add or retain a warning:

- `DIAGRAM_FLOW_NO_VALID_ROUTE`

Behavior:

- if all candidates are invalid, fall back to the minimal locked-face or nearest-face direct route,
  and attach debug metadata marking it as fallback.

### 14.3 Guide rejection

Add development-only debug reasons for guide rejection:

- `face_not_facing_source`
- `overshoots_target_span`
- `adds_unnecessary_turn`

These should be stored in debug structures, not console output by default.

## 15. Telemetry and Diagnostics

There is no browser telemetry change in this plan.

Compiler diagnostics added:

- structured `pathDebug.rankKey`
- structured `pathDebug.selectedFaces`
- structured `pathDebug.selectedPorts`
- structured `pathDebug.usedBundleHint`
- structured `pathDebug.usedDestinationGuide`
- optional dev-only per-candidate trace helpers for tests

No networked telemetry, analytics, or runtime logging is added.

## 16. UI / Layout / Styling Impact

This plan does not change:

- diagram visual style,
- CSS,
- React layout structure,
- page composition,
- demo scene markup structure.

Only compiled edge geometry and debug metadata change.

## 17. State Management

The router remains stateless.

All state passed between stages must be:

- local immutable objects,
- arrays,
- readonly maps,
- readonly tuples.

No module-level mutable caches beyond deterministic per-call memoization are allowed.

Allowed optimization:

- per-`routeEdges()` local caches keyed by immutable candidate keys, such as
  `flowRouteCache`, `obstacleCache`, or `faceSpanCache`.

Disallowed:

- global singleton caches,
- hidden mutation across calls,
- side effects during scoring.

## 18. Performance Plan

### 18.1 Expansion limits

Keep candidate expansion intentionally bounded:

- planar face candidates only by default,
- early pruning before route generation,
- cache route generation per candidate key,
- reuse obstacle model computation for all candidates of the same edge.

### 18.2 Prune unused baggage early

Each stage must return only the data needed for the next stage.

Examples:

- once a face candidate is pruned, discard it entirely rather than carrying a rejected list,
- once a route candidate loses selection, do not retain large control-point arrays unless debug
  mode explicitly requests them,
- avoid attaching raw obstacle data to candidate objects if a simple obstacle key is sufficient.

### 18.3 Complexity targets

- Face candidate expansion should remain `O(F^2)` with small fixed `F`.
- Route generation per edge should remain bounded by the small candidate set after pruning.
- Stage-local caches should eliminate duplicate route computation for repeated candidate keys.

## 19. Testing Strategy

### 19.1 New unit test files

Add:

- `packages/diagram/src/elements/diagram/compiler/__tests__/routingSpace.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeCandidatePlanner.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgePortPlanner.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeGuidePlanner.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeCandidateScorer.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeCandidateSelector.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeRoutingProfiles.test.ts`

### 19.2 Existing test suites to update

Update:

- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeRouter.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/compile.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/functionalTransitionSpec.test.ts`

### 19.3 Required coverage themes

Tests must independently cover:

1. Y-down normalization round-tripping.
2. Bundle hint inference for:
   - symmetric top fan-out,
   - mixed near-row and deep-row fan-out,
   - disabled bundle strength.
3. Face candidate expansion with:
   - explicit ports,
   - bundle face hints,
   - unlocked planar candidates.
4. Port assignment:
   - center slot preference,
   - side slot preference,
   - candidate-local slot scoring.
5. Guide generation:
   - rejects faces not facing source,
   - rejects overshooting guides,
   - keeps valid direct approach guides.
6. Candidate scoring:
   - direct route beats overshooting route,
   - fewer bends beats more bends when blockers/overshoot are equal,
   - shorter route beats longer route when bends are equal,
   - shared trunk only wins as a tie-breaker.
7. Profile parity:
   - `straight`, `curved`, and `organic` use the same selected faces and ports for identical inputs.
8. Real-scene compile regression:
   - BrewFlow comparison scene equivalent remains within expected NVS bounds and chooses direct
     upper links plus centered lower trunk links.
9. Guide rejection occurs before route generation:
   - Construct an `EdgePortCandidate` whose destination face normal points away from the source.
   - Call `buildCandidateGuides()` and assert `destinationGuide` is `undefined`.
   - Then call `profile.generateRoute()` with the guide-less candidate and assert the resulting
     route is shorter or has fewer bends than it would with a spurious guide attached.
   - This test verifies that overshoot suppression happens at the guide stage, not only at scoring.
10. Lexicographic tie-breaking is not a weighted sum:
    - Construct two `ScoredEdgeCandidate` instances that are identical in `blockerPenalty`,
      `overshootPenalty`, `bendCount`, and `pathLength`, but differ only in `sharedPathPenalty`
      (candidate A lower, candidate B higher).
    - Call `selectBestCandidate([B, A])` and assert candidate A wins.
    - Then construct a third candidate C with a lower `bendCount` but a higher `sharedPathPenalty`
      than both A and B.
    - Call `selectBestCandidate([A, B, C])` and assert C wins, proving bends outrank shared-path.
    - This test would fail if the selector used a weighted sum with large enough shared-path weight.
11. Fallback route is marked in debug metadata:
    - Construct a routing scenario where all candidates have non-zero `blockerPenalty` (all blocked).
    - Route via `routeEdges()` and assert the returned `EdgeRouteState.pathDebug` contains
      `isFallback: true`.
    - Assert the fallback route is a valid (non-empty) path despite all candidates failing.
    - This confirms Section 14.2 behavior: the system never silently returns an empty route.

### 19.4 Test style

Tests must remain interface-driven and data-only.

No DOM, no Three.js, no renderer dependence for planning-stage tests.

## 20. Implementation Sequence

Steps are listed in logical dependency order. **Steps 3–7 are parallelizable** once step 1
is complete — they each create a new file that depends only on the type definitions in
`routingTypes.ts` and `routingSpace.ts`, not on each other.

1. Add `routingTypes.ts` and `routingSpace.ts`. *(gate for all subsequent work — must finish first)*
2. Move Y-down normalization logic out of `edgeRouter.ts` into `routingSpace.ts`.

**Steps 3–7 may be implemented in parallel** by separate developers once step 1 is verified
(types compile cleanly):

3. Extract bundle inference and face expansion into `edgeCandidatePlanner.ts`.
4. Extract per-candidate port assignment into `edgePortPlanner.ts`.
5. Extract guide generation into `edgeGuidePlanner.ts`.
6. Extract structured scoring into `edgeCandidateScorer.ts`.
7. Extract lexicographic comparison into `edgeCandidateSelector.ts`.

> **Typecheck note for steps 3–8:** During this phase, the original routing logic in
> `edgeRouter.ts` remains in place and unchanged. New modules re-implement the logic from
> scratch based on the types in `routingTypes.ts`; they do not delete or import from
> `edgeRouter.ts` until step 9. This means both old and new code coexist, and `edgeRouter.ts`
> continues to typecheck cleanly throughout. The developer must resist the temptation to delete
> from `edgeRouter.ts` incrementally — all removal happens in step 9 as a single pass after
> steps 3–8 are complete and their tests pass.

8. Add `edgeRoutingProfiles.ts` and move algorithm-specific route generation there.
   *(depends on steps 3–7 — the profiles call the new stage functions)*
9. Reduce `edgeRouter.ts` to composition only — wire the staged pipeline, remove all extracted
   logic. This is when the old code is deleted. `edgeRouter.ts` must typecheck after this step.
10. Update compile and transition reroute code to use the new orchestration path unchanged from
    the caller perspective.
11. Add stage-level tests for all new modules.
12. Update PRD and archive/synchronize superseded planning docs after implementation is verified.

## 21. Acceptance Criteria

The implementation is complete when:

1. `edgeRouter.ts` is reduced to orchestration and shared public exports.
2. Every routing stage has its own test file and pure exported functions.
3. `flow`, `curved`, `straight`, and `organic` share the same candidate pipeline.
4. Candidate selection follows the required ordering:
   valid > direct > fewer bends > shorter > shared path > heuristic tie-breakers.
5. BrewFlow comparison scene equivalent compile regression passes.
6. `pnpm --filter @brewsite/diagram typecheck` passes.
7. Diagram router, compile, and transition suites pass.

## 22. Post-Implementation Documentation Tasks

After code lands:

- update `requirements/diagram/prd/prd_edge_routing.md` to describe the candidate pipeline,
  structured scoring, and shared algorithm semantics,
- update or archive `requirements/diagram/plans/plan_flow-routing-rewrite.md`,
- add brief notes to any docs or examples that mention algorithm-specific behavior inconsistent
  with the new shared pipeline.

