---
title: "Diagram Edge Routing — Joint Port Pair Orthogonal Visibility Graph"
doc_type: plan
owner: brewsite-architect
status: draft
updated: 2026-03-10
---

# Plan: Diagram Edge Routing — Joint Port Pair Orthogonal Visibility Graph

## 1. Purpose

This plan replaces the current mostly-local flow-routing decision model with a more standard
diagram-routing architecture:

- obstacle-aware routing over a rectilinear / orthogonal visibility graph,
- full source/destination **face + port pair** evaluation before final selection,
- no acute interior bends in planning space,
- visual corner smoothing applied only after the route is chosen,
- explicit group-aware ingress/egress behavior.

The current pipeline already decomposes routing into clean modules, but the decision model is
still too local:

- face pair is chosen globally,
- source and destination port slots are often chosen independently,
- route scoring does not explicitly penalize acute bend geometry,
- group-target ingress is still too weak for fan-out and nested-group scenes,
- some scenes still produce “technically valid but visually wrong” routes.

This plan fixes the algorithm, not just the weights.

## 2. Scope

In scope:

- `routing="flow"` only
- compile-time routing
- live reroute during functional transitions
- group-aware obstacle avoidance
- joint source/destination port-pair selection
- orthogonal route search and selection
- rounded rendering of orthogonal corners
- new routing diagnostics and tests
- requirements/diagram documentation updates

Out of scope:

- changing `curved`, `straight`, or `organic` semantics
- arbitrary node dragging / interactive reroute
- edge-edge crossing minimization as a global graph optimization pass
- author-visible manual handle editing
- spline-only routing for `flow`

## 3. Target Behavior

### 3.1 User-visible behavior

For `routing="flow"`:

- Routes must plan as orthogonal polylines in XY.
- The first segment must leave the chosen source face along its outward normal.
- The last segment must approach the chosen destination face along its inward normal.
- Interior planning turns must be 90° or 180° only.
- 180° reversals must be heavily penalized and should only occur as a last resort.
- Visual rendering may round corners into cubic arcs, but the underlying route must remain orthogonal.
- The first bend after the source stub and the last bend before the destination stub must have enough straight run to preserve a visually square elbow after rounding. Do not round a micro-segment into an acute-looking fork.
- Group targets must be treated as perimeter targets, not as open interior regions. The route should terminate on the group boundary face that is externally reachable without crossing unrelated groups or child nodes.
- For stacked group scenes, a lower group may legitimately be reached on its left or right edge even when the source is vertically above it, if top-face ingress would require traveling over another group or its children.
- Paths may underpass in Z only when planar orthogonal routing is blocked or significantly worse.

### 3.2 Geometric interpretation of “at least 90°”

The requested design goal is not “all visible corners must look like perfect square elbows.”
The correct interpretation is:

- **planning space**: no acute interior turns; orthogonal only
- **render space**: corners may be rounded with cubic arcs
- **visual outcome**: the route reads as 90° structure with graceful smoothing, never as a sharp acute fork

This means the planner guarantees non-acute structure, and the renderer provides softness.

## 4. Current Failure Modes

The new algorithm must explicitly eliminate these classes of failures:

1. A locally reasonable source slot and locally reasonable destination slot combine into a globally ugly pair.
2. Group-target fan-out enters the top face near the wrong lateral position, causing the path to cut through the group silhouette or read as a diagonal fork.
3. Candidate scoring treats a 45° interior change as cheaper than a 90° elbow.
4. Flow bundle hints over-constrain the source side while destination slot selection is still too myopic.
5. Direct-to-group and group-to-group scenes choose the correct face but the wrong slot.
6. Live reroute and compile-time reroute diverge because routing geometry differs.
7. Group-target routing treats the whole destination group as softly ignorable, so the path can travel across the group body or over enclosed child nodes before reaching the chosen landing point.
8. Top-origin fan-out produces a visually acute first corner because the first orthogonal leg is too short to support corner rounding cleanly.

## 5. Design Summary

The new `flow` router will use this pipeline:

1. Normalize routing geometry in Y-up planning space.
2. Build explicit node/group obstacle rectangles.
3. Enumerate admissible source/destination face pairs.
4. Enumerate bounded source port options and destination port options.
5. Build **joint port-pair candidates**.
6. For each joint pair, build orthogonal terminals and route over an orthogonal visibility graph.
7. Score the full pair + route together.
8. Select by lexicographic rank.
9. Materialize an orthogonal path.
10. Round corners in `flowPathBuilder.ts` without changing topology.

The key design change is step 5: the pair is evaluated as a unit before final selection.

## 6. Module Boundaries

No new Three.js or React imports are allowed in compiler modules.

### 6.1 Files to modify

- `packages/diagram/src/elements/diagram/compiler/routingTypes.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeCandidatePlanner.ts`
- `packages/diagram/src/elements/diagram/compiler/edgePortPlanner.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeGuidePlanner.ts`
- `packages/diagram/src/elements/diagram/compiler/flowObstacleModel.ts`
- `packages/diagram/src/elements/diagram/compiler/flowVisibilityGraph.ts`
- `packages/diagram/src/elements/diagram/compiler/flowPathBuilder.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeCandidateScorer.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeCandidateSelector.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeRoutingProfiles.ts`
- `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`
- `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts`
- `packages/diagram/src/elements/diagram/compile.ts`
- `packages/diagram/src/elements/diagram/types.ts`
- `requirements/diagram/prd/prd_edge_routing.md`

### 6.2 Files to add if needed

- `packages/diagram/src/elements/diagram/compiler/__tests__/flowVisibilityGraph.orthogonal.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgePortPairPlanner.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeRoutingRegression.test.ts`

### 6.3 Responsibilities

- `edgeCandidatePlanner.ts`
  Owns face-pair enumeration and early pruning only.
- `edgePortPlanner.ts`
  Owns per-face option generation and joint source/destination port-pair candidate generation.
- `edgeGuidePlanner.ts`
  Owns orthogonal terminal and optional trunk guide generation.
- `flowObstacleModel.ts`
  Owns explicit node/group obstacle and ownership metadata.
- `flowVisibilityGraph.ts`
  Owns orthogonal visibility graph construction and weighted route search.
- `edgeCandidateScorer.ts`
  Owns full-route scoring, including bend-class and group-ingress penalties.
- `edgeCandidateSelector.ts`
  Owns rank-key comparison only.
- `flowPathBuilder.ts`
  Owns conversion from orthogonal waypoint path to rounded render path.
- `edgeRouter.ts`
  Orchestrates stages and preserves public API.

## 7. Data Contract Changes

### 7.1 `routingTypes.ts`

Add the following types.

```typescript
export type PortOption = {
  readonly index: number;
  readonly count: number;
  readonly anchor: Vec3;
  readonly localScore: number;
  readonly lateralClass: 'center' | 'inner' | 'outer' | 'edge';
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
```

Notes:

- `acuteTurnCount` should remain `0` for orthogonal flow routes in normal operation.
- `reversalCount` is a separate concept because a 180° U-turn is worse than a 90° bend.
- `groupIngressPenalty` stays inside `NormalizedRouteGeometry` so the scorer can use it without re-deriving route semantics.

### 7.2 `types.ts`

Extend `DiagramEdgePathDebug` with:

```typescript
readonly selectedSrcFace?: FaceId;
readonly selectedDstFace?: FaceId;
readonly selectedSourcePortIndex?: number;
readonly selectedDestinationPortIndex?: number;
readonly acuteTurnCount?: number;
readonly reversalCount?: number;
readonly routeCostClass?: 'direct' | 'clean-orthogonal' | 'underpass' | 'puncture-fallback';
```

This remains development-only.

## 8. Face-Pair Enumeration Rules

### 8.1 Input

`edgeCandidatePlanner.ts` continues to produce face-pair candidates.

### 8.2 Rules

- Planar faces remain `top`, `bottom`, `left`, `right`.
- `front`/`back` remain explicit-only and are not part of normal `flow` enumeration.
- Explicit `fromPort` / `toPort` lock the corresponding face.
- Bundle hints may lock the source face only.
- Group endpoints are still treated as rectangular planning targets; the distinction is in scoring and option generation, not in face enumeration.

### 8.3 Pruning rules

Keep current “strongly points away” pruning, but add:

- if source is not locked and target is vertically separated by more than `sourceHeight * 1.2`, prune opposite horizontal source faces
- if destination is a group, do not strongly prefer `top` / `bottom` solely from source-vs-group centroid position
- if destination is a group, preserve any face whose boundary is externally exposed after obstacle expansion, especially lateral faces on lower stacked groups
- if destination is a group and source is laterally dominant, preserve side-face options for comparison rather than pruning them too early

Implementation instruction:

- Do not encode “outward group ingress” in prune rules.
- Keep prune rules permissive enough that scoring can choose the better pair.
- Never prune the only externally exposed side face of a destination group just because the source lies above or below the group center.

## 9. Port Option Generation

### 9.1 `edgePortPlanner.ts`

Replace the current “pick one best slot per endpoint” logic with two APIs:

```typescript
export function buildPortOptions(...): ReadonlyArray<PortOption>;
export function enumeratePortPairCandidates(
  candidate: EdgeFaceCandidate,
  request: EdgeRoutingRequest,
  nodeMap: RoutingNodeMap,
  groupIds: ReadonlySet<string>,
): ReadonlyArray<EdgePortPairCandidate>;
```

Keep `assignPorts(...)` only as a compatibility wrapper used by non-flow profiles or tests if needed.

### 9.2 Port option count

Continue deriving port count from span and thickness.

Bound the returned option set per face:

- minimum: 1
- default cap: 8
- hard cap: 12

The option set must include:

- center slot
- nearest-to-target slot
- nearest-to-softened-target slot for locked side faces
- outer-most slot on each side for group targets
- immediate neighbors around center
- immediate neighbors around target-aligned slot

### 9.3 Group-target destination options

If `groupIds.has(request.toId)`:

- include both outer lateral extremes on the destination face
- tag each option with `lateralClass`
- do not collapse immediately to the locally cheapest destination slot

This is mandatory because the correct slot is often only obvious after the whole path is routed.

### 9.4 Side-face source bias

For locked `left` / `right` source faces:

- preserve vertical bias toward the target
- compress the bias so the slot stays in the upper/lower half, not at the extreme edge by default

This preserves established fan-out behavior while still allowing pair comparison later.

### 9.5 Group perimeter destination policy

For `groupIds.has(request.toId)`:

- treat the destination as a boundary target rather than a solid region that can be crossed freely
- generate options on the face that corresponds to the intended boundary landing, not interior “best effort” points
- when `top` / `bottom` ingress would require the terminal corridor to pass over unrelated obstacles, keep side-face options active and eligible to win
- include explicit `left` / `right` destination options for lower stacked groups even when the source is vertically above

This is mandatory for the `cf-db -> cf-intel` / `cf-recov` class of layouts.

## 10. Joint Port-Pair Candidate Generation

### 10.1 Candidate construction

For each face pair:

1. generate source options
2. generate destination options
3. build cross-product
4. de-duplicate by `(srcIndex, dstIndex)`
5. cap the pair set to a bounded size

### 10.2 Pair count cap

Per face pair, cap to **24** pair candidates.

Selection policy for the cap:

- always include the pair using locally best source + locally best destination
- always include any pair containing an outer group-destination option when destination is a group
- always include the center-center pair
- fill remaining slots by sum of local scores, then diversity across source/destination indices

### 10.3 When full pair enumeration applies

For `routing="flow"`, enumerate full pair candidates when any of the following are true:

- source is a group
- destination is a group
- `fromPort` is explicit
- `toPort` is explicit
- a bundle hint provides a fixed source anchor

Additionally, always enumerate full pair candidates when the destination is a group with another group or node obstacle between the source and the destination's top/bottom perimeter corridor.

For simple node-to-node flow edges with no explicit ports and no bundle anchor:

- allow the existing single-pick fallback path for performance stability
- but route through the new scoring model and orthogonal planner once the port pair is chosen

This preserves current good behavior while changing the ambiguous cases first.

## 11. Orthogonal Terminal Construction

### 11.1 `edgeGuidePlanner.ts`

For `flow`, stop thinking in terms of free-form endpoint guides.

Instead produce:

```typescript
routeStart = sourceAnchor + sourceFaceNormal * faceStub
routeEnd = destinationAnchor + destinationFaceNormal * faceStub
```

Bundle hints may still override `routeStart` when a shared trunk anchor exists.

### 11.2 Terminal invariants

- `routeStart` and `routeEnd` must lie outside the source/destination rectangle
- terminal segments must be axis-aligned
- terminals must preserve face-normal semantics
- the first turn after `routeStart` and the last turn before `routeEnd` must leave enough straight length for rounding; if not, extend the terminal leg or suppress rounding for that corner

## 12. Obstacle Model

### 12.1 `flowObstacleModel.ts`

Keep explicit `groupIds` support.

Add the following fields to each obstacle:

```typescript
readonly softOwnerKind?: 'source-group' | 'destination-group';
readonly expandedRect: Rect2D;
readonly rawRect: Rect2D;
```

### 12.2 Padding rules

- nodes use full obstacle padding
- groups use obstacle padding plus a configurable boundary clearance multiplier
- source and destination groups remain soft-passable only where the edge is expected to enter or exit
- destination groups are not globally soft-passable; only the selected ingress corridor may be soft-passable

### 12.3 Ownership rules

If the source anchor or destination anchor lies inside a group rectangle:

- record ownership in `sourceOwningGroupIds` / `destinationOwningGroupIds`
- allow terminal ingress through that group only near the intended face corridor
- do not globally ignore the owning group
- for destination groups, define the permitted corridor as a narrow strip normal to the selected boundary face; the route must not traverse the group interior outside that strip

This is important. The current “soft ignore the whole group” behavior is too broad.

## 13. Orthogonal Visibility Graph

### 13.1 `flowVisibilityGraph.ts`

Rewrite the `flow` search so graph edges are orthogonal only.

Graph vertices must include:

- `routeStart`
- `routeEnd`
- expanded obstacle corners
- horizontal and vertical escape points around obstacle corners
- face corridor slide points for group borders
- underpass entry and exit points when enabled

### 13.2 Edge validity

Graph edges are valid only when:

- they are axis-aligned in XY
- they do not intersect hard obstacles
- they do not cross soft-owned groups except in permitted ingress/egress corridors
- they do not use a destination-group corridor that would pass over unrelated node or group obstacles before reaching the destination boundary

### 13.3 Search algorithm

Use A* with Manhattan heuristic in XY plus Z offset when underpass is active.

Per-segment cost:

```typescript
segmentCost =
  manhattanLength
  + turnPenalty
  + softObstaclePenalty
  + groupBoundaryPenalty
  + underpassPenalty
  + puncturePenalty
```

### 13.4 Turn cost

Replace `1 - dot` turn scoring for `flow`.

For orthogonal planning, use discrete turn classes:

- straight continuation: `0`
- 90° turn: `turnPenalty90`
- 180° reversal: `turnPenalty180`

Recommended defaults:

- `turnPenalty90 = config.flowTurnPenalty`
- `turnPenalty180 = config.flowTurnPenalty * 5`

No continuous-angle formula should remain in orthogonal `flow` search.

### 13.5 Underpass

Underpass remains available only for `flow`.

Rules:

- only emit underpass candidate routes after planar clean-route search
- underpass entry and exit must occur after terminal stubs
- underpass cannot be used to bypass the source/destination face-normal contract

## 14. Path Materialization

### 14.1 `flowPathBuilder.ts`

The path builder must consume orthogonal waypoint sequences and emit:

- straight segments when two adjacent axes continue cleanly
- cubic corner arcs when a 90° turn occurs

### 14.2 Corner rounding

For every 90° interior turn:

- trim each adjacent segment by `turnRadius`
- emit one cubic command bridging the trimmed points
- preserve topological orthogonality; rounding is cosmetic only

### 14.3 No acute synthetic arcs

The path builder must not introduce a cubic that creates an acute visual fork relative to
the incoming and outgoing segments.

Implementation rule:

- cubic control handles must stay tangent to the orthogonal segments
- do not generate free-form bezier handles based on endpoint normals alone
- clamp rounding radius by adjacent segment length; if the first or last orthogonal leg is too short, render a hard elbow instead of an acute-looking rounded mouth

## 15. Candidate Scoring

### 15.1 `edgeCandidateScorer.ts`

Update scoring to operate on the whole route.

New metrics:

- `acuteTurnPenalty = acuteTurnCount * 10000`
- `reversalPenalty = reversalCount * 5000`
- `bendCount`
- `pathLength`
- `groupIngressPenalty`

### 15.2 Lexicographic ordering

Update rank-key priority to:

1. blocker penalty
2. overshoot penalty
3. acute turn penalty
4. reversal penalty
5. bend count
6. path length
7. shared-path penalty
8. heuristic penalty

This ordering must be explicit in `candidateToRankKey`.

### 15.3 Heuristic penalty contents

`heuristicPenalty` should include:

- endpoint alignment mismatch
- group ingress mismatch
- destination-group corridor occlusion mismatch
- near-edge penalty
- lateral asymmetry penalty for group fan-out when the route enters from the wrong side

It must **not** replace rank-key ordering with a weighted sum.

## 16. Selector

`edgeCandidateSelector.ts` remains lexicographic only.

No weighted collapse.

No random tie-break.

If two candidates are equal on rank key:

- prefer the one with lower `sourcePortLocalScore + destinationPortLocalScore`
- if still tied, prefer the one with lower source index distance from center

Implement this as an explicit deterministic tie-break after rank-key equality.

## 17. Public API Compatibility

### 17.1 `edgeRouter.ts`

Keep the current public `routeEdges(...)` and `routeEdgesYDown(...)` signatures.

Do not require callers to supply extra context beyond the optional `groupIds` already introduced.

### 17.2 Other routing modes

- `curved`, `straight`, and `organic` remain on the current candidate pipeline
- they may keep single-port selection
- they do not use orthogonal visibility routing

Do not refactor them in this plan.

## 18. Runtime and State Management

No new React state.

No new widget runtime state.

All new routing logic remains:

- compile-time pure logic
- transition-time pure reroute logic
- dev-only debug metadata on compiled edge state

Caching:

- retain per-edge obstacle model caching by `RoutingProfileContext`
- add optional per-edge port-pair route-cache keyed by `(srcFace, dstFace, srcIndex, dstIndex)`
- keep cache local to the routing call; do not add cross-scene global caches

## 19. Error Handling and Warnings

Add or preserve these warnings:

- `DIAGRAM_FLOW_UNDERPASS_USED`
- `DIAGRAM_FLOW_PUNCHTHROUGH_USED`
- `DIAGRAM_FLOW_ROUTE_FALLBACK_STRAIGHT`
- `DIAGRAM_FLOW_NO_VALID_ROUTE`

Add one new warning:

- `DIAGRAM_FLOW_GROUP_INGRESS_FALLBACK`

Emit it when:

- destination is a group
- no clean outward-ingress candidate wins
- router falls back to a less desirable ingress slot or puncture

Warnings remain non-fatal.

## 20. Debug and Telemetry

This repo does not have a formal telemetry pipeline for diagram routing, so use dev-only
debug metadata instead of analytics.

### 20.1 `DiagramEdgePathDebug`

Populate:

- selected source face
- selected destination face
- selected source slot
- selected destination slot
- route kind
- obstacle IDs
- acute turn count
- reversal count

### 20.2 Debug test hooks

Expose enough information through `pathDebug` so tests can assert:

- chosen face pair
- chosen port pair
- underpass use
- obstacle punctures

## 21. Documentation Updates

Update:

- `requirements/diagram/prd/prd_edge_routing.md`

Specifically document:

- orthogonal visibility graph for `flow`
- joint port-pair selection
- no acute interior turns in planning space
- rounded orthogonal corner rendering
- group ingress behavior

Do not update unrelated PRDs.

## 22. Test Strategy

### 22.1 Unit tests

Add or update unit tests for:

- `edgePortPlanner.ts`
  - bounded port option generation
  - group-destination outer option inclusion
  - joint pair enumeration
  - deterministic pair ordering
- `flowVisibilityGraph.ts`
  - orthogonal-only graph edges
  - obstacle avoidance around nodes
  - obstacle avoidance around groups
  - owning-group ingress corridor handling
  - underpass fallback
- `edgeCandidateScorer.ts`
  - acute turn penalty outranks path length
  - reversal penalty outranks bend count
  - group ingress mismatch loses to outward ingress
- `edgeRouter.ts`
  - node-to-group fan-out
  - group-to-group side ingress
  - bundle disabled case
  - explicit port case

### 22.2 Regression fixtures

Add regression tests mirroring the known failing geometries:

1. The `cf-db -> cf-core / cf-coord / cf-intel / cf-recov` overview layout from:
   [scene_cf_overview.tsx](/Volumes/ExtDrive/davebrewster/Development/brewblast/brewsite/apps/examples/src/brewflow-comparison/scenes/scene_cf_overview.tsx)
2. The top-db to two mid-groups plus lower groups layout from the existing edge-router tests.
3. A direct group-to-group horizontal scene.
4. A nested group ownership case.

These tests must assert route semantics, not screenshots:

- start tangent
- end tangent
- selected destination slot class
- selected destination face for lower stacked groups
- no puncture through unrelated groups
- no travel across destination-group interior except inside the selected ingress corridor
- no acute interior turn count
- no acute-looking first rounded corner caused by an undersized first orthogonal leg

### 22.3 Transition parity tests

Update `transitionHelpers.test.ts` so live reroute covers:

- group obstacle parity with compile-time routing
- group destination route selection parity for at least one fan-out case

## 23. Verification Commands

Run at minimum:

```bash
pnpm --filter @brewsite/diagram exec vitest run \
  src/elements/diagram/compiler/__tests__/edgePortPlanner.test.ts \
  src/elements/diagram/compiler/__tests__/flowObstacleModel.test.ts \
  src/elements/diagram/compiler/__tests__/flowVisibilityGraph*.test.ts \
  src/elements/diagram/compiler/__tests__/edgeCandidateScorer.test.ts \
  src/elements/diagram/compiler/__tests__/edgeRouter.test.ts \
  src/elements/diagram/compiler/__tests__/transitionHelpers.test.ts
```

```bash
pnpm --filter @brewsite/diagram typecheck
```

If an examples-page verification pass is done locally, use:

```bash
pnpm dev
```

Then inspect:

- `/examples/brewflow-comparison`

## 24. Implementation Sequence

### Phase 1: Contracts and debug data

- update `routingTypes.ts`
- update `types.ts` debug shape
- keep current behavior intact

### Phase 2: Port option and pair planner

- implement bounded port-option generation
- implement pair enumeration
- preserve single-pick fallback wrapper

### Phase 3: Orthogonal flow search

- rewrite `flowVisibilityGraph.ts` for orthogonal graph edges
- discrete turn classes
- group ingress corridor support

### Phase 4: Path materialization

- update `flowPathBuilder.ts` to round orthogonal corners only

### Phase 5: Scoring and selection

- add acute/reversal penalties
- add group-ingress penalty
- update rank-key ordering

### Phase 6: Integration

- wire through `edgeRoutingProfiles.ts`
- wire through `edgeRouter.ts`
- ensure `compile.ts` and `transitionHelpers.ts` parity

### Phase 7: Tests and docs

- add regression fixtures
- update PRD
- verify examples route correctly

## 25. Acceptance Criteria

The implementation is complete when all of the following are true:

1. `routing="flow"` plans over an orthogonal visibility graph.
2. Flow routes do not contain acute interior turns in planning space.
3. Group-target fan-out scenes choose outward, non-intersecting ingress routes.
4. Lower stacked group targets choose an externally reachable side boundary when top/bottom ingress would cross other groups or nodes.
5. Source/destination slot selection for ambiguous cases is based on full pair routing, not independent local choice.
6. Existing `curved`, `straight`, and `organic` behavior is unchanged.
7. Compile-time and live reroute use the same group-aware routing geometry.
8. The regression based on `scene_cf_overview.tsx` passes in a unit-level layout fixture.
9. Diagram package typecheck passes.
10. Targeted router and transition test suites pass.

## 26. Explicit Implementation Constraints

These are mandatory:

- Do not import Three.js or React into compiler files.
- Do not replace lexicographic rank keys with a weighted-sum selector.
- Do not silently weaken group avoidance to make tests pass.
- Do not rely on screenshot-only verification.
- Do not leave port-pair enumeration behavior implicit; it must be encoded in tests.
- Do not leave group ingress selection up to future tuning. Implement explicit outward-ingress candidate generation and scoring in this plan.
- Do not treat destination groups as globally soft obstacles. Only the selected boundary corridor may be relaxed.
