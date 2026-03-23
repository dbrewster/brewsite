---
title: "BrewSite Diagram — Edge Routing System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-21
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram edge routing system as implemented."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "NVS recalibration: MIN_PORT_PITCH reduced from 0.35 to 0.05 (was calibrated for pre-NVS world units; 35% NVS pitch made multi-port faces impossible on typical nodes); EDGE_EPSILON reduced from 0.06 to 0.012 (6% NVS was too large for dense layouts). Functional Requirement 9 updated to remove stale pivot offset reference. Port Slot Distribution constants block updated."
  - date: 2026-03-10
    author: "Toolkit Product"
    summary: "Documented the unified candidate pipeline architecture introduced by plan_edge-routing-candidate-pipeline. All four routing algorithms now share the same staged planning pipeline. Replaced the former weighted-sum face-scoring description with the new structured lexicographic scoring model."
  - date: 2026-03-10
    author: "Toolkit Product"
    summary: "Updated the `flow` routing contract to use orthogonal visibility-graph planning with joint source/destination port-pair evaluation, explicit group-perimeter ingress behavior, acute/reversal-aware scoring, and rounded orthogonal path materialization."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Audit corrections: updated EdgeRoutingRequest to include all flow-routing configuration fields. Corrected the Lexicographic Candidate Selection Technical Considerations section."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment: corrected EdgeRoutingRequest and RoutingProfileContext type definitions to match routingTypes.ts."
  - date: 2026-03-21
    author: "Toolkit Product"
    summary: "Complete rewrite: 2D edge routing pipeline. The routing system was rewritten from a 3D candidate-based pipeline (16 files, 5,067 LOC) to a direct 2D routing algorithm (8 files in compiler/routing/, ~2,000 LOC). Candidate enumeration, scoring, and selection are eliminated — one A* route per edge, with profiles as post-processors. FaceId replaced by SideId (4-side 2D model, no front/back). DiagramEdgePort narrowed from 6 to 4 values. All underpass-related fields removed: allowUnderpass from DiagramEdgeDSL/DiagramEdgeState, usedUnderpass from DiagramEdgePathState, flowUnderpassDepth/flowUnderpassClearance/flowUnderpassPenalty from theme edge config. 16 old production files + 12 old test files deleted. Semver impact: major version bump for @brewsite/diagram and @brewsite/themes."
---

## Overview

The edge routing system computes the 3D control points for `DiagramEdge` connections between nodes in `@brewsite/diagram`. It runs inside the diagram compilation pipeline after layout resolves all node positions. The result is stored as `ReadonlyArray<readonly [number, number, number]>` on each `DiagramEdgeState.controlPoints`. Control points are consumed by `EdgeRenderer` to construct CatmullRom tube geometry at render time.

The system is implemented as a **direct 2D routing pipeline** in `packages/diagram/src/elements/diagram/compiler/routing/`. Diagrams are 2D layouts rendered with cosmetic 3D depth — all routing decisions (which side to exit, where to turn, what to avoid) are XY-plane decisions. The pipeline computes one route per edge: side selection, A* Manhattan routing with obstacles, then profile-specific path shaping. There is no candidate enumeration, no scoring, and no selection. The four routing profiles (`flow`, `curved`, `straight`, `organic`) are post-processors on a shared 2D waypoint path, not separate route generators. The pipeline consists entirely of pure TypeScript modules — no Three.js or React dependencies.

## Problem Statement

Diagram edges in a 3D scene require more than a straight line between two node centers. Each edge must: (1) exit its source node from a natural side rather than cutting through the geometry, (2) avoid visually penetrating adjacent nodes, (3) not overlap sibling edges that share the same side, and (4) suit the aesthetic intent of the chosen theme (organic curves for dark presentations, sharp 90° turns for circuit-board diagrams). Without a principled routing system, consumer scenes require manual control point specification for every edge — a prohibitive authoring burden for diagrams with tens or hundreds of connectors.

## Goals and Success Metrics

**Primary goals:**
- All edges in a compiled diagram have valid control points without consumer-authored coordinate data
- The default routing produces visually clean output for grids of 4–50 nodes with no obvious overlaps or side penetrations
- Per-edge routing overrides work without recompiling the whole diagram
- Self-loop and missing-node edges degrade gracefully to empty control points with no thrown exception
- One route per edge — no combinatorial candidate search

**Success metrics:**
- Zero thrown exceptions for self-loop or missing-node edge inputs in the test suite
- Unit tests cover all eight routing modules independently
- Example scenes in `apps/examples/` render without manual control point specification
- All 991 tests passing across 63 test files

**Guardrail metrics:**
- `routeEdges` function signature remains backward compatible across minor versions
- No Three.js import introduced into any module in `elements/diagram/compiler/routing/`

## Non-Goals

- Obstacle avoidance that guarantees clearance around all intermediate nodes (paths may pass through unrelated nodes in complex layouts; the pipeline penalizes this but does not guarantee clearance)
- Dynamic re-routing at runtime in response to node drag interactions
- Bezier editing UI or consumer-visible handle manipulation
- Path smoothing as a post-process step after control point computation
- Z-axis underpass routing (eliminated — diagrams are 2D layouts with cosmetic depth)

## Consumer Stories

- As a toolkit consumer, I want edges to connect automatically so that I can author a 50-node architecture diagram without specifying a single control point.
- As a toolkit consumer, I want to specify `routing="flow"` on a per-edge basis so that I can mix curved and orthogonal connectors in the same diagram.
- As a toolkit consumer, I want to pin an edge to a specific side using `fromPort` and `toPort` so that connectors entering a node always arrive at the expected side.
- As a toolkit consumer, I want edges that connect a node to itself to silently produce no geometry so that self-referential data does not break renders.

## Functional Requirements

1. `routeEdges` shall compute control points for all edges in a single pass after node layout is resolved.
2. Self-loop edges (`from === to`) shall produce an empty control points array and shall not throw.
3. Edges referencing a node ID absent from `positions` or `sizes` shall produce an empty control points array and emit a `console.warn`.
4. Edge IDs shall be auto-generated as `"${from}-${to}-${index}"` when not explicitly specified in the DSL.
5. Per-edge `routing` prop shall override the `defaultRouting` argument for that edge only.
6. When `fromPort` or `toPort` is specified on an edge, side selection for that endpoint shall use the declared port and skip automatic side resolution.
7. When only one port is declared, the opposite endpoint shall resolve its side using the nearest-side algorithm.
8. Multiple edges sharing the same side on the same node shall be distributed across port slots to avoid overlap.
9. All control points shall be expressed in diagram-local space (after node positions are resolved by the layout engine).
10. No module in `elements/diagram/compiler/routing/` shall import Three.js, React, or any runtime dependency.
11. The routing pipeline shall compute exactly one route per edge — no candidate enumeration, no scoring, no selection.
12. `routing="flow"` shall plan as an orthogonal XY route using A* Manhattan pathfinding with obstacle avoidance.
13. Z assignment shall be a separate post-routing step: smoothstep interpolation from source Z to destination Z applied to the 2D waypoint path.
14. The routing pipeline operates in `Vec2` internally. `Vec3` is only used at the final Z-assignment step.

## API Design

### Public function

```typescript
// packages/diagram/src/elements/diagram/compiler/routing/edgeRouter.ts

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
export type DiagramEdgePort = 'top' | 'bottom' | 'left' | 'right';
```

Note: `DiagramEdgePort` has four values corresponding to the four sides of a 2D node bounding box. The former `'front'` and `'back'` values were removed — Z-axis ports are not meaningful for 2D routing.

### Core pipeline types

All inter-module data contracts are defined in `routing/routingTypes.ts`:

```typescript
// packages/diagram/src/elements/diagram/compiler/routing/routingTypes.ts

/** Side identifier for a node in the 2D diagram plane. */
export type SideId = 'left' | 'right' | 'top' | 'bottom';

/** 2D point in the routing plane. */
export type Vec2 = readonly [number, number];

/** 3D point (XY from routing + Z from depth assignment). */
export type Vec3 = readonly [number, number, number];

/** 2D axis-aligned bounding rect. */
export type Rect2D = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

/** Node bounding rect in the 2D routing plane. */
export type NodeRect = {
  readonly id: string;
  readonly cx: number;  // center X
  readonly cy: number;  // center Y
  readonly hw: number;  // half-width
  readonly hh: number;  // half-height
  readonly z: number;   // front-face Z (for depth interpolation)
  readonly depth: number; // thickness (for mid-depth Z computation)
};

/** Edge routing request. */
export type EdgeRoutingRequest = {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly profile: 'flow' | 'curved' | 'straight' | 'organic';
  readonly fromPort?: SideId;
  readonly toPort?: SideId;
  readonly thickness: number;
};

/** 2D waypoint path — output of the router, input to profiles. */
export type WaypointPath = {
  readonly sourceAnchor: Vec2;
  readonly destinationAnchor: Vec2;
  readonly sourceSide: SideId;
  readonly destinationSide: SideId;
  readonly waypoints: ReadonlyArray<Vec2>;
};

/** Final routed edge with 3D path commands. */
export type EdgeRouteResult = {
  readonly path: DiagramEdgePathState;
  readonly controlPoints: ReadonlyArray<Vec3>;
  readonly pathDebug?: DiagramEdgePathDebug;
};

/** Flow routing configuration. */
export type FlowConfig = {
  readonly turnRadius: number;
  readonly faceStub: number;
  readonly obstaclePadding: number;
  readonly turnPenalty: number;
  readonly punchthroughPenalty: number;
  readonly bundleStrength: number;
  readonly organicVariation: number;
};

/**
 * Bundle routing hint for sibling flow edges sharing the same source node.
 * Inferred by inferBundleHints() and consumed by selectSides().
 */
export type BundleHint = {
  readonly sourceSide: SideId;
  readonly lateralOffset: number;
  readonly sharedTrunkKey?: string;
};
```

### Shared math utilities

All duplicated Vec2/Vec3 math from the former 7-file pipeline is consolidated into `routingTypes.ts`:

```typescript
export const addVec2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const subVec2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scaleVec2 = (v: Vec2, s: number): Vec2 => [v[0] * s, v[1] * s];
export const lengthVec2 = (v: Vec2): number => Math.sqrt(v[0] ** 2 + v[1] ** 2);
export const dotVec2 = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const normalizeVec2 = (v: Vec2): Vec2 => { ... };
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const distVec2 = (a: Vec2, b: Vec2): number => lengthVec2(subVec2(a, b));
export const vec3 = (xy: Vec2, z: number): Vec3 => [xy[0], xy[1], z];
export const sideToApproach = (side: SideId): 'N' | 'S' | 'E' | 'W' => ...;
```

## Technical Considerations

### 2D Routing Pipeline

The routing pipeline operates in Vec2 internally. Each edge traverses seven steps with no candidate branching:

```
1. Side selection       sideSelect.ts        O(1) — pick exit/entry sides from XY geometry
2. Anchor + port        sideSelect.ts        O(1) — compute anchor point on selected side
3. 2D route             orthogonalRouter.ts   O(V log V) — A* Manhattan with obstacles
4. Profile shaping      pathBuilder.ts        O(n) — smooth corners, Bezier, organic offset
5. Z assignment         pathBuilder.ts        O(n) — smoothstep from source Z to dest Z
6. Shape snap           shapeSnap.ts          O(1) — polygon/circle XY projection
7. Trunk optimization   trunkOptimizer.ts     O(edges²) — shared prefix trimming
```

No candidate enumeration. No scoring. No selection. One route per edge.

### Module Structure

The routing pipeline lives in `compiler/routing/` (8 files):

| File | Role |
|---|---|
| `routingTypes.ts` | Types + consolidated Vec2/Vec3 math utilities |
| `sideSelect.ts` | 2D side selection + port placement (replaces former edgeCandidatePlanner + edgePortPlanner + edgeGuidePlanner) |
| `obstacleModel.ts` | 2D obstacle rect construction with containment (simplified from former flowObstacleModel) |
| `orthogonalRouter.ts` | A* Manhattan routing with obstacle avoidance (refactored from former flowVisibilityGraph) |
| `pathBuilder.ts` | 4 profile builders + arc rounding + Z assignment (replaces former flowPathBuilder + curveKernel + edgeRoutingProfiles) |
| `shapeSnap.ts` | XY-only polygon/circle endpoint snap (simplified from former shapeEndpointSnap) |
| `trunkOptimizer.ts` | Shared trunk trimming (refactored from former edgeRenderOptimizer) |
| `edgeRouter.ts` | Thin orchestrator: side select → obstacles → A* → pathBuilder → Z → snap → optimize |

### Side Selection (replacing Face/Candidate model)

`sideSelect.ts` performs O(1) side selection based on the 2D relative position of source and destination nodes. The pipeline uses `SideId` with four values (`'left' | 'right' | 'top' | 'bottom'`), replacing the former `FaceId` which included `'front'` and `'back'` Z-axis faces. Port placement distributes multiple edges sharing the same side across evenly-spaced port slots along the side span. Bundle hints (inferred from sibling edges sharing the same source node and direction) bias side selection for trunk alignment.

### Orthogonal Routing

`orthogonalRouter.ts` implements A* Manhattan pathfinding in the 2D plane with obstacle avoidance. The search is bounded by a padded bounding box around source and destination nodes. Obstacle rects are built by `obstacleModel.ts` from node bounding boxes, excluding source and destination nodes. The search produces an ordered array of `Vec2` waypoints.

### Profile Shaping

`pathBuilder.ts` contains four profile builder functions that transform the shared 2D waypoint path into final path commands:

- **`flow`** — Rounds orthogonal corners with arc segments using the configured turn radius. Produces orthogonal path commands with rounded fillets.
- **`curved`** — Generates Bezier curves from waypoints with endpoint-normal-aware control points. Produces smooth spline paths.
- **`straight`** — Emits minimal stub-to-stub segment sequences. Produces direct line segments.
- **`organic`** — Uses the curved pipeline and applies a deterministic perpendicular offset keyed by edge ID hash, producing stable variation across recompiles.

All four profiles receive the same side selection and waypoint path from the shared pipeline.

### Z Assignment

Z assignment is a separate post-routing step in `pathBuilder.ts`. Each 2D waypoint receives a Z value via smoothstep interpolation from the source node's Z to the destination node's Z. This makes the 2D nature of routing explicit in the type system: `Vec2` during routing, `Vec3` only at final output.

### Integration with compile.ts

`routeEdges` is called from `compile.ts` after `layoutResolver` assigns positions. The call passes:
- `edges` from `DiagramDSL.edges`
- `positions` and `sizes` maps built from compiled `DiagramNodeState` entries
- `defaultRouting` and `defaultLanding` from the resolved `DiagramTheme.edge`

The returned map is used to populate `DiagramEdgeState.controlPoints` for each edge.

### EdgeRenderer Consumption

`EdgeRenderer.getOrCreate(edge, parent)` reads `edge.controlPoints` and creates a `THREE.CatmullRomCurve3` from the points. Tube segments are set to `Math.max(20, controlPoints.length * 8) * edgeSmoothness`. Empty control points arrays result in a degenerate 0-length curve; `EdgeRenderer` skips mesh creation when `controlPoints.length < 2`.

## Breaking Change Assessment

**Semver impact: major version bump for `@brewsite/diagram` and `@brewsite/themes`.**

### Removed APIs

1. **`allowUnderpass` removed from `DiagramEdgeDSL` and `DiagramEdgeState`** — per-edge underpass control is eliminated. Consumers using `allowUnderpass` should remove it; the prop has no replacement because underpass routing (Z-axis path deviation) is not meaningful in the 2D routing model.

2. **`usedUnderpass` removed from `DiagramEdgePathState`** — the diagnostic field that indicated whether an edge used underpass routing is eliminated.

3. **`flowUnderpassDepth`, `flowUnderpassClearance`, `flowUnderpassPenalty` removed from `DiagramThemeEdgeConfig`** — theme-level underpass configuration is eliminated. Custom themes that set these fields must remove them.

4. **`DiagramEdgePort` narrowed from 6 to 4 values** — `'front'` and `'back'` are removed. The routing pipeline operates in 2D; Z-axis ports are not meaningful. Consumers using `fromPort="front"` or `toPort="back"` must switch to a 2D-appropriate side.

### Migration Guide

| Before | After |
|---|---|
| `<DiagramEdge allowUnderpass />` | `<DiagramEdge />` (remove prop) |
| `<DiagramEdge fromPort="front" />` | `<DiagramEdge fromPort="bottom" />` (or appropriate 2D side) |
| `<DiagramEdge fromPort="back" />` | `<DiagramEdge fromPort="top" />` (or appropriate 2D side) |
| Theme: `flowUnderpassDepth: 0.5` | Remove field |
| Theme: `flowUnderpassClearance: 0.3` | Remove field |
| Theme: `flowUnderpassPenalty: 100` | Remove field |
| Check: `edge.path.usedUnderpass` | Remove check (field no longer exists) |

### Internal modules deleted (not consumer-facing)

16 production files and 12 test files from the former candidate pipeline were deleted (28 files, ~8,311 LOC total). These were internal implementation details not re-exported from any package index. The new `compiler/routing/` directory contains 8 files (~2,000 LOC).

## Dependencies

- `compiler/routing/routingTypes.ts` — types + shared math; no external dependencies
- `compiler/routing/sideSelect.ts` — 2D side selection + port placement
- `compiler/routing/obstacleModel.ts` — 2D obstacle rect construction
- `compiler/routing/orthogonalRouter.ts` — A* Manhattan pathfinding
- `compiler/routing/pathBuilder.ts` — profile-specific path shaping + Z assignment
- `compiler/routing/shapeSnap.ts` — XY endpoint projection
- `compiler/routing/trunkOptimizer.ts` — shared trunk trimming
- `elements/diagram/types.ts` — `EdgeRoutingAlgorithm`, `EdgeLandingAlgorithm`, `DiagramEdgePort`
- No external npm packages

## Risks and Mitigations

**API regret — `routeEdges` signature:** The function accepts two separate `Map` arguments (`positions`, `sizes`) rather than a single `Map<string, NodeState>`. This is intentional: routing does not need the full node state, and keeping the signature minimal reduces coupling. The only caller is `compile.ts`, so the surface is not exposed to consumers.

**Single-route quality vs. candidate search:** The former pipeline generated hundreds of candidates per edge and selected the best one. The new pipeline computes exactly one route. For most diagrams (2D grid/hierarchical/flow layouts), the direct route is optimal. For edge cases where the candidate search would have found a non-obvious path, the new A* router with obstacle avoidance produces equivalent or better results because it reasons about the full 2D obstacle field rather than scoring face-pair combinations.

**Orthogonal fall-through:** When `flow` routing encounters degenerate geometry (zero-area nodes, coincident positions), the pipeline falls back to a straight-line route rather than throwing. This is documented behavior.

## Open Questions

None. All design decisions from the 2D routing rewrite have been resolved through implementation.

## Launch Criteria

- All eight routing modules have independent unit test files in `compiler/routing/__tests__/`
- Self-loop and missing-node cases covered by unit tests
- Port slot distribution unit tested for 3+ edges sharing a single side
- `@brewsite/diagram` and `@brewsite/themes` typecheck clean
- All 991 tests passing across 63 test files
- At least one example scene in `apps/examples/diagram/` demonstrates the `flow` routing algorithm
