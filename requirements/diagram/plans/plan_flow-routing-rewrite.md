---
title: "Diagram Flow Routing Rewrite — Implementation Plan"
doc_type: plan
owner: brewsite-architect
status: ready
updated: 2026-03-09
---

# Plan: Diagram Flow Routing Rewrite

## 1. Overview

This plan rewrites the current diagram edge router for the routing mode currently exposed as
`'orthogonal'`. The current implementation no longer matches the intended visual language:
it produces center-trunk clustering, poor group avoidance, imprecise border attachment, and
turn shaping that reads as accidental rather than designed.

The rewrite introduces a new canonical routing mode named **`'flow'`** and removes
`'orthogonal'` immediately. The new mode is not a Manhattan router. It is a **flow router**:

- straight when line-of-sight is available,
- smooth when it must turn,
- face-normal on exit and entry,
- obstacle-aware around nodes and groups,
- capable of temporary Z-underpass escape when planar routing is boxed in,
- exact on face-center attachment.

This is a routing architecture change, not a cosmetic tweak.

## 2. Objectives

The new router must satisfy these requirements:

1. **Straight when possible, smooth when turning.**
   The route may travel at any angle in XY. It is not constrained to Manhattan segments.
2. **Rename the mode to `flow`.**
   `orthogonal` is removed immediately from the public API.
3. **Face-perpendicular entry and exit.**
   The first path tangent must align with the source face normal; the last tangent must align
   with the destination face normal.
4. **Prefer routing around groups and nodes.**
   Punch through only as a last resort. Allow an underpass in Z when that produces a cleaner
   result than a border puncture.
5. **Exact face-center attachment.**
   For face-based routing, the pipe centerline must hit the geometric center of the selected
   face. No auto-spread away from the face center in `flow` mode.

## 3. Terminology and API Decision

### 3.1 Canonical name

The canonical routing algorithm becomes:

```typescript
type EdgeRoutingAlgorithm = 'curved' | 'straight' | 'organic' | 'flow';
```

Rules:

- `flow` is the new public name.
- `orthogonal` is removed from DSL, theme, compiled state, tests, and docs in the same change.
- This is a breaking API change and must be treated as such in migration notes.

### 3.2 Backward compatibility

This plan does **not** preserve `orthogonal`.

Compatibility behavior:

- Themes must use `edge.routing: 'flow'`.
- `<DiagramEdge routing="flow" />` is the only replacement.
- `DiagramEdgeState.routing` stores `'flow'`.
- Docs/examples migrate to `flow` in the same change.

## 4. Architectural Direction

The current `controlPoints: Vec3[]` shape is too ambiguous. The renderer has to infer path
meaning from point count, which is the root cause of several regressions. The rewrite moves
to an explicit path contract.

### 4.1 New path data model

Add explicit segment commands to compiled state.

File: `packages/diagram/src/elements/diagram/types.ts`

```typescript
export type DiagramEdgePathCommand =
  | {
      readonly kind: 'line';
      readonly from: readonly [number, number, number];
      readonly to: readonly [number, number, number];
    }
  | {
      readonly kind: 'cubic';
      readonly p0: readonly [number, number, number];
      readonly p1: readonly [number, number, number];
      readonly p2: readonly [number, number, number];
      readonly p3: readonly [number, number, number];
    };

export interface DiagramEdgePathState {
  readonly commands: ReadonlyArray<DiagramEdgePathCommand>;
  readonly startTangent: readonly [number, number, number];
  readonly endTangent: readonly [number, number, number];
  readonly usedUnderpass: boolean;
  readonly punctures: ReadonlyArray<{
    readonly obstacleId: string;
    readonly obstacleKind: 'node' | 'group';
  }>;
}
```

Update `DiagramEdgeState`:

```typescript
readonly path: DiagramEdgePathState;
```

Transitional compatibility:

- Keep `controlPoints` for one release as a derived compatibility field.
- Renderer stops using `controlPoints` for `flow`.
- Tests move to `path.commands` as the source of truth.

### 4.2 Module boundaries

The rewrite must remain pure compiler logic. No Three.js outside render layer.

New files:

- `packages/diagram/src/elements/diagram/compiler/flowRouter.ts`
- `packages/diagram/src/elements/diagram/compiler/flowPathBuilder.ts`
- `packages/diagram/src/elements/diagram/compiler/flowObstacleModel.ts`
- `packages/diagram/src/elements/diagram/compiler/flowVisibilityGraph.ts`

Modified files:

- `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`
- `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`
- `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts`
- `packages/diagram/src/elements/diagram/compile.ts`
- `packages/diagram/src/elements/diagram/rendering/EdgeRenderer.ts`
- `packages/diagram/src/elements/diagram/types.ts`
- `packages/diagram/src/elements/diagram/dsl.tsx`
- `packages/diagram/src/elements/diagram/themes/*.ts`
- `requirements/diagram/prd/prd_diagram_element.md`

Responsibility split:

- `edgeRouter.ts`
  Keeps public routing entrypoint (`routeEdges`) and legacy algorithms (`curved`, `straight`,
  `organic`), and delegates canonical `flow` routing to `flowRouter.ts`.
- `flowObstacleModel.ts`
  Builds obstacle geometry for nodes and groups in normalized diagram space.
- `flowVisibilityGraph.ts`
  Produces candidate corridor graph and weighted path search.
- `flowPathBuilder.ts`
  Converts waypoint route into explicit line/cubic path commands with turn smoothing.
- `EdgeRenderer.ts`
  Consumes explicit `DiagramEdgePathCommand[]`, no longer guesses curve type from point count.

## 5. Public API Changes

### 5.1 DSL and theme

File: `packages/diagram/src/elements/diagram/types.ts`
File: `packages/diagram/src/elements/diagram/dsl.tsx`

Add the following theme edge config:

```typescript
readonly routing: EdgeRoutingAlgorithm;
readonly flowTurnRadius: number;
readonly flowFaceStub: number;
readonly flowObstaclePadding: number;
readonly flowUnderpassDepth: number;
readonly flowUnderpassClearance: number;
readonly flowTurnPenalty: number;
readonly flowPunchthroughPenalty: number;
readonly flowUnderpassPenalty: number;
```

Add optional per-edge overrides:

```typescript
readonly routing?: EdgeRoutingAlgorithm;
readonly flowTurnRadius?: number;
readonly flowFaceStub?: number;
readonly allowUnderpass?: boolean;
```

### 5.2 Exact attachment semantics

For `flow` mode:

- `fromPort` / `toPort` choose the face, not an offset slot.
- Attachment point is the exact face center of the selected face.
- Automatic face-port spreading is disabled for `flow`.
- Legacy auto-spread behavior may remain in `curved` / `organic` if needed.

### 5.3 Warning codes

Introduce compiler warnings:

- `DIAGRAM_FLOW_UNDERPASS_USED`
- `DIAGRAM_FLOW_PUNCHTHROUGH_USED`
- `DIAGRAM_FLOW_ROUTE_FALLBACK_STRAIGHT`
- `DIAGRAM_FLOW_NO_VALID_ROUTE`

## 6. Routing Algorithm

## 6.1 High-level pipeline

For each edge using canonical routing `flow`:

1. Resolve source and destination faces.
2. Compute exact face-center anchor on each face.
3. Build mandatory face-normal stub point on each side.
4. Attempt direct route:
   `sourceAnchor -> sourceStub -> destinationStub -> destinationAnchor`
5. If blocked, run obstacle-aware visibility search in XY using stubs as terminals.
6. If XY route still requires high-penalty puncture, try Z-underpass candidate routes.
7. Choose the lowest-cost route.
8. Convert raw waypoint route into explicit line/cubic path commands with smooth interior turns.
9. Emit path state plus compatibility `controlPoints`.

## 6.2 Attachment geometry

Attachment contract:

- Source anchor = exact center of source face.
- Destination anchor = exact center of destination face.
- Source tangent = outward face normal.
- Destination tangent = inward inverse of destination face normal.
- First visible motion must be perpendicular to source face.
- Final visible motion must be perpendicular to destination face.

This is mandatory. No heuristic endpoint wobble.

## 6.3 Obstacles

Obstacle kinds:

- node rectangle,
- group border rectangle,
- optional diagram viewport border (soft cost only, not hard block).

Obstacle model file:

- `packages/diagram/src/elements/diagram/compiler/flowObstacleModel.ts`

Data type:

```typescript
type FlowObstacle = {
  readonly id: string;
  readonly kind: 'node' | 'group';
  readonly rect: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  readonly hard: boolean;
};
```

Rules:

- Source node and destination node are excluded as blockers.
- An enclosing group for the source or destination is **soft-ignored** for the initial and final
  attachment segment so the edge can legally meet the border it targets.
- Other groups are avoided with high cost.
- Node interiors are hard obstacles unless the node is the source or destination.

## 6.4 Visibility graph search

File: `packages/diagram/src/elements/diagram/compiler/flowVisibilityGraph.ts`

Search space:

- terminal vertices: source stub, destination stub,
- obstacle corner escape vertices expanded by obstacle padding,
- face-adjacent slide vertices for groups,
- optional underpass entry/exit vertices.

Search algorithm:

- Weighted A* or Dijkstra on visibility graph.
- Edge is valid if XY segment does not intersect hard obstacles.
- Soft intersections are allowed with configured penalty.

Cost function:

```typescript
cost =
  segmentLength
  + turnPenalty * turnMagnitude
  + obstaclePenalty
  + underpassPenalty
  + puncturePenalty;
```

Turn penalty must be lower than puncture penalty, so a longer clean route beats a short ugly
group puncture.

## 6.5 Underpass in Z

The router may temporarily route below diagram geometry when XY routing is ugly or blocked.

Underpass rules:

- Only enabled for canonical `flow`.
- Only considered after planar clean-route search fails or scores worse than threshold.
- Start and end remain on the authored diagram Z plane.
- Underpass ramps occur outside source/destination face stubs.
- Underpass depth is theme-configurable.

Generated path shape:

- cubic ramp down,
- line/cubic travel under obstacle,
- cubic ramp up.

This produces a readable “goes under” visual instead of punching through a group border.

## 6.6 Turn smoothing

The flow router must not emit jagged elbow chains.

Path shaping rules:

- If route has no interior turns, prefer a single straight line segment between stubs.
- If route turns, replace each interior corner with a cubic fillet.
- Do **not** round the corner adjacent to the source face stub or destination face stub if doing
  so would visibly detach the edge from the boundary.
- Turn radius is clamped by adjacent segment lengths.

Implementation file:

- `packages/diagram/src/elements/diagram/compiler/flowPathBuilder.ts`

Algorithm:

1. Start from waypoint polyline.
2. Preserve terminal anchor + stub geometry exactly.
3. For each interior corner:
   - inset both sides by clamped radius,
   - create cubic approximation of the arc between inset points,
   - keep line segments between turns.
4. Emit `DiagramEdgePathCommand[]`.

## 7. Renderer Rewrite

File: `packages/diagram/src/elements/diagram/rendering/EdgeRenderer.ts`

Current problem:

- Renderer guesses semantics from point count.
- This permanently couples compiler correctness to undocumented point-array conventions.

Required renderer behavior:

- `line` command -> `THREE.LineCurve3`
- `cubic` command -> `THREE.CubicBezierCurve3`
- Whole edge -> `THREE.CurvePath<THREE.Vector3>`

Arrow placement:

- compute tangent from the explicit path object,
- place arrowheads at path start/end,
- maintain face-perpendicular orientation.

Segment count:

- line-only paths: low segment count,
- multi-cubic flow paths: segment count proportional to command count and theme smoothness,
- no `CatmullRomCurve3` for canonical `flow`.

## 8. State Management and Transitions

Files:

- `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`
- `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts`
- `packages/diagram/src/elements/diagram/compile.ts`

Rules:

- `compileEdge()` must store canonical routing value (`flow` not `orthogonal`).
- `DiagramEdgeState.path` is the runtime contract.
- `controlPoints` remains derived compatibility output during migration only.
- `rerouteLiveEdges()` must reroute using the same `flow` algorithm and preserve per-edge
  `flowTurnRadius`, `flowFaceStub`, `allowUnderpass`, and canonical routing value.
- `blendDiagramEdges()` continues blending opacity only; path is always rerouted live.

## 9. File-by-File Implementation

### 9.1 `packages/diagram/src/elements/diagram/types.ts`

Add:

- `flow` to `EdgeRoutingAlgorithm` and remove `orthogonal`
- new path command/state types
- new theme routing config fields
- new per-edge DSL/state overrides

Update docs on:

- exact face-center flow attachment,
- underpass semantics,
- explicit path contract.

### 9.2 `packages/diagram/src/elements/diagram/dsl.tsx`

Add props:

- `flowTurnRadius?: number`
- `flowFaceStub?: number`
- `allowUnderpass?: boolean`

Update JSDoc:

- `routing="flow"` recommended
- no `orthogonal` compatibility language

### 9.3 `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`

Refactor to:

- keep `routeEdges()` public shape,
- delegate `flow` edges to `routeFlowEdge(...)`,
- leave `curved` / `straight` / `organic` implementations isolated.

### 9.4 `packages/diagram/src/elements/diagram/compiler/flowObstacleModel.ts`

Implement:

- node/group obstacle extraction,
- enclosure detection,
- soft-ignore logic for source/destination owning groups,
- obstacle padding expansion.

### 9.5 `packages/diagram/src/elements/diagram/compiler/flowVisibilityGraph.ts`

Implement:

- candidate vertex generation,
- line-of-sight tests,
- weighted path search,
- optional underpass path generation.

### 9.6 `packages/diagram/src/elements/diagram/compiler/flowPathBuilder.ts`

Implement:

- polyline to explicit command conversion,
- cubic turn fillets,
- terminal stub preservation,
- compatibility control-point derivation.

### 9.7 `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`

Update edge defaults:

- `routing: theme.edge.routing`
- `flowTurnRadius`
- `flowFaceStub`
- `allowUnderpass`

Store `flow` directly; no alias normalization path.

### 9.8 `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts`

Preserve new edge routing fields through live reroute path generation.

### 9.9 `packages/diagram/src/elements/diagram/rendering/EdgeRenderer.ts`

Consume `DiagramEdgeState.path.commands` as source of truth.

Do not infer path type from `controlPoints.length`.

### 9.10 `packages/diagram/src/elements/diagram/themes/*.ts`

Update all built-in themes:

- change default routing where appropriate:
  - `darkGlass`: `flow`
  - `lightMinimal`: `flow`
  - `neonCyber`: `flow`
  - `enterprise`: keep `curved` or switch to `flow` based on desired examples; recommended: `flow`
- add sensible defaults:
  - `flowTurnRadius: 0.035`
  - `flowFaceStub: 0.05`
  - `flowObstaclePadding: 0.025`
  - `flowUnderpassDepth: 0.08`
  - `flowUnderpassClearance: 0.03`
  - `flowTurnPenalty: 0.45`
  - `flowPunchthroughPenalty: 500`
  - `flowUnderpassPenalty: 60`

### 9.11 `requirements/diagram/prd/prd_diagram_element.md`

Update:

- DSL docs for `flow`,
- path rendering architecture,
- exact face-center attachment requirement,
- underpass behavior.

### 9.12 Example scene updates

Files to touch for smoke coverage:

- `apps/examples/src/brewflow-comparison/scenes/scene_cf_overview.tsx`
- any example scene currently relying on `orthogonal`

Change examples to:

- use `flow`,
- verify multi-group fan-out from a top source node,
- verify clean border entry.

## 10. Visual Direction and Styling

This rewrite changes geometry, not DOM/CSS layout. There are no stylesheet updates required.

Visual direction:

- pipes should read as intentional “flows”, not wiring harnesses,
- straight runs should remain visually calm,
- turns should feel swept and deliberate,
- group boundaries should remain visually respected,
- underpass should be subtle and legible, not dramatic rollercoaster motion.

Tube material, thickness, glow, and arrowhead styling remain controlled by existing theme fields.

## 11. Error Handling

Compiler behavior:

- If no clean route exists, try underpass if allowed.
- If underpass fails, allow puncture through soft obstacles with warning.
- If no valid route exists even then, fall back to straight face-normal cubic and emit
  `DIAGRAM_FLOW_NO_VALID_ROUTE`.

Warnings must be routed through existing `DiagramWarnFn`.

Do not `console.warn` directly from compiler code.

## 12. Telemetry and Diagnostics

Add dev-only instrumentation hooks through warnings and test assertions:

- count underpass usage,
- count puncture usage,
- expose chosen route mode in compiled edge state for test assertions if needed:

```typescript
readonly pathDebug?: {
  readonly routeKind: 'direct' | 'visibility' | 'underpass' | 'puncture-fallback';
  readonly obstacleIds: readonly string[];
};
```

`pathDebug` must be development-only and stripped from production builds if that is already a
pattern elsewhere; otherwise keep it optional and omit in production compile path.

## 13. Testing Strategy

### 13.1 New compiler tests

Add:

- `packages/diagram/src/elements/diagram/compiler/__tests__/flowRouter.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/flowPathBuilder.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/flowObstacleModel.test.ts`

Required test cases:

1. direct line-of-sight route stays straight,
2. source and destination tangents are face-normal,
3. route around single node obstacle,
4. route around group border without clipping,
5. source inside group to external node exits through correct border centerline,
6. multi-fan-out from top node does not collapse into a single center trunk,
7. underpass chosen over puncture when cheaper,
8. puncture only when no clean route exists,
9. `flow` attachment hits exact face center on left/right/top/bottom/front/back faces.

### 13.2 Existing test updates

Update:

- `packages/diagram/src/elements/diagram/compiler/__tests__/edgeRouter.test.ts`
- `packages/diagram/src/elements/diagram/compiler/__tests__/transitionHelpers.test.ts`
- `packages/diagram/src/elements/diagram/rendering/__tests__/EdgeRenderer.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/compile.test.ts`

Specific assertions to add:

- compiled group-border centerline attachment remains exact,
- `EdgeRenderer` builds `CurvePath` from explicit commands,
- no `CatmullRomCurve3` use for `flow`,
- underpass path contains Z deviation while preserving face-center anchors.

### 13.3 Example regression coverage

Add regression tests modeled after the failing visual:

- `cf-db -> cf-memstore`
- `cf-db -> cf-shared`
- `cf-db -> cf-patterns`
- `cf-db -> cf-workflow`

Expected behavior:

- four distinct routes,
- no shared trunk after leaving the source boundary,
- clean border entry into each group region,
- no visible endpoint shelf segments.

## 14. Validation Commands

Implementation must pass at minimum:

```bash
pnpm --filter @brewsite/diagram exec vitest run \
  src/elements/diagram/compiler/__tests__/edgeRouter.test.ts \
  src/elements/diagram/compiler/__tests__/flowRouter.test.ts \
  src/elements/diagram/compiler/__tests__/flowPathBuilder.test.ts \
  src/elements/diagram/compiler/__tests__/transitionHelpers.test.ts
```

```bash
pnpm --filter @brewsite/diagram exec vitest run \
  src/elements/diagram/rendering/__tests__/EdgeRenderer.test.ts \
  src/elements/diagram/__tests__/compile.test.ts \
  src/elements/diagram/__tests__/diagramRenderer.test.ts
```

Recommended manual validation:

```bash
pnpm dev
```

Then inspect the Brewflow comparison example and at least one other dense grouped diagram.

## 15. Rollout Sequence

Implementation order:

1. Remove `orthogonal` from public API and add canonical `flow` API.
2. Introduce explicit path command types.
3. Implement obstacle model + visibility search.
4. Implement path builder and renderer support.
5. Update transitions and compile state.
6. Migrate themes/examples/docs.
7. Remove renderer guessing logic for `flow`.
8. Verify example regressions visually.

## 16. Non-Goals for This Plan

- Rewriting `curved` routing.
- Rewriting `organic` routing beyond preserving compatibility.
- Reintroducing multi-port face spreading for `flow`.
- Adding author-facing UI controls or CSS.
- Adding live interactive path editing.

## 17. Acceptance Criteria

This plan is complete when all of the following are true:

- `routing="flow"` is the documented primary API.
- `routing="orthogonal"` does not exist in public API or examples.
- Flow edges attach to exact face centers and depart/arrive face-perpendicular.
- Dense grouped examples no longer show trunk-clustering or boundary shelf artifacts.
- Group avoidance is visibly preferred over puncture.
- Underpass routing is available and tested.
- `EdgeRenderer` consumes explicit path commands for `flow`.
- All focused diagram compiler and renderer tests pass.
