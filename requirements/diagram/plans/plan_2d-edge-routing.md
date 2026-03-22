---
title: "2D Edge Routing Pipeline"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-21
---

# Plan: 2D Edge Routing Pipeline

## Problem

The diagram edge routing pipeline is 5,067 lines across 16 files. It models edges as connections between the 3D faces of boxes, spawning a multi-stage candidate search that generates hundreds of combinations per edge. This is wrong: diagrams are 2D layouts rendered with cosmetic 3D depth. The routing decisions — which side to exit, where to turn, what to avoid — are all 2D XY-plane decisions.

**Current pipeline (per edge):**

```
enumerate 16 face pairs → for each: assign N port pairs → for each: generate guide points
  → for each: run full route (A* for flow, Bezier for curved) → score → rank → pick winner
```

This means a single flow edge with groups can trigger hundreds of routed candidates, most of which are thrown away. The 6-face model (now 4-face after today's fix) created the need for face *selection*, which spawned the entire candidate machinery.

**Current file inventory (16 files, 5,067 LOC):**

| File | LOC | Role |
|---|---|---|
| `edgeRouter.ts` | 626 | Orchestration + 5 duplicated geometry fns |
| `edgeCandidatePlanner.ts` | 480 | Face enumeration + pruning + 4 duplicated fns |
| `edgePortPlanner.ts` | 468 | Port assignment + 3 duplicated fns |
| `edgeGuidePlanner.ts` | 99 | Guide point generation |
| `edgeCandidateScorer.ts` | 247 | Structured scoring |
| `edgeCandidateSelector.ts` | 48 | Lexicographic pick |
| `edgeRoutingProfiles.ts` | 536 | 4 profile implementations + 3 duplicated fns |
| `edgeRenderOptimizer.ts` | 622 | Shared trunk trimming |
| `flowRouter.ts` | 190 | Flow route coordination |
| `flowPathBuilder.ts` | 349 | Arc rounding + path commands |
| `flowVisibilityGraph.ts` | 557 | A* orthogonal search |
| `flowObstacleModel.ts` | 158 | Obstacle rect construction |
| `curveKernel.ts` | 110 | Bezier with endpoint normals |
| `shapeEndpointSnap.ts` | 230 | Polygon endpoint projection + Z fixup |
| `routingSpace.ts` | 62 | Y-mirror adapter |
| `routingTypes.ts` | 285 | Types |

**Duplicated functions:** `addVec`, `scaleVec`, `dotVec`, `clamp`, `normalizeVec`, `subVec`, `lengthVec` appear in 7 files. `getFaceNormal` appears in 5 files. `getFaceCenter` appears in 4 files.

---

## Design

### Core Insight

Replace the combinatorial candidate search with a direct 2D routing algorithm. One side-selection call, one route computation, one path output. The routing profiles (flow, curved, straight, organic) become post-processors on a shared 2D waypoint path, not separate route generators that each run independently.

### Architecture: 8 Files, ~2,500 LOC Target

```
compiler/
  routing/
    routingTypes.ts        Types + shared Vec2/Vec3 math utilities (consolidated)
    sideSelect.ts          2D side selection: nearest-side, port placement (replaces edgeCandidatePlanner + edgePortPlanner + edgeGuidePlanner)
    obstacleModel.ts       2D obstacle rect construction with containment (simplified flowObstacleModel)
    orthogonalRouter.ts    A* Manhattan routing with obstacle avoidance (refactored flowVisibilityGraph)
    pathBuilder.ts         Path command generation: 4 profile builders + arc rounding + Z assignment (replaces flowPathBuilder + curveKernel + edgeRoutingProfiles)
    shapeSnap.ts           XY-only polygon/circle endpoint snap (simplified shapeEndpointSnap)
    trunkOptimizer.ts      Shared trunk trimming (refactored edgeRenderOptimizer)
  edgeRouter.ts            Thin orchestrator: side select → obstacles → A* → pathBuilder → Z → snap → optimize
```

**Eliminated entirely:**
- `routingSpace.ts` — Y-mirror absorbed into orchestrator (two inline helper calls)
- `edgeCandidatePlanner.ts` — no candidate enumeration needed
- `edgePortPlanner.ts` — port logic folded into `sideSelect.ts`
- `edgeGuidePlanner.ts` — guide logic folded into `sideSelect.ts`
- `edgeCandidateScorer.ts` — no scoring needed (one route per edge)
- `edgeCandidateSelector.ts` — no selection needed
- `edgeRoutingProfiles.ts` — profile logic is a branch in the orchestrator + 4 functions in `pathBuilder.ts`
- `curveKernel.ts` — Bezier generation absorbed into `pathBuilder.ts`
- `flowRouter.ts` — absorbed into `orthogonalRouter.ts`
- `flowPathBuilder.ts` — absorbed into `pathBuilder.ts`

### Routing Pipeline (Per Edge)

```
1. Side selection       sideSelect.ts      O(1) — pick exit/entry sides from XY geometry
2. Anchor + port        sideSelect.ts      O(1) — compute anchor point on selected side
3. 2D route             orthogonalRouter.ts O(V log V) — A* Manhattan with obstacles
4. Profile shaping      pathProfiles.ts     O(n) — smooth corners, Bezier, organic offset
5. Path commands        pathBuilder.ts      O(n) — arc rounding, line/cubic emission
6. Z assignment         edgeRouter.ts       O(n) — smoothstep from source Z to dest Z
7. Shape snap           shapeSnap.ts        O(1) — polygon/circle XY projection
8. Trunk optimization   trunkOptimizer.ts   O(edges²) — shared prefix trimming
```

No candidate enumeration. No scoring. No selection. One route per edge.

---

## Module Specifications

### `routingTypes.ts` — Types + Math Utilities

**Consolidates:** All duplicated Vec2/Vec3 math from 7 files, `FaceId` → `SideId`, routing request/result types.

```typescript
/** Side identifier for a node in the 2D diagram plane. */
export type SideId = 'left' | 'right' | 'top' | 'bottom';

/** 2D point in the routing plane. */
export type Vec2 = readonly [number, number];

/** 3D point (XY from routing + Z from depth assignment). */
export type Vec3 = readonly [number, number, number];

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

// ─── Shared math utilities ────────────────────────────────────────────────────

export const addVec2 = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const subVec2 = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scaleVec2 = (v: Vec2, s: number): Vec2 => [v[0] * s, v[1] * s];
export const lengthVec2 = (v: Vec2): number => Math.sqrt(v[0] ** 2 + v[1] ** 2);
export const dotVec2 = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const normalizeVec2 = (v: Vec2): Vec2 => { const l = lengthVec2(v); return l < 1e-9 ? [0, 0] : [v[0] / l, v[1] / l]; };
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// Vec3 variants (used only for Z-assigned output, not routing)
export const vec3 = (xy: Vec2, z: number): Vec3 => [xy[0], xy[1], z];
```

**Key change:** The routing pipeline works in `Vec2` internally. `Vec3` is only used at the final Z-assignment step. This makes the 2D nature explicit in the type system.

---

### `sideSelect.ts` — 2D Side Selection + Port Placement

**Replaces:** `edgeCandidatePlanner.ts` (480 LOC), `edgePortPlanner.ts` (468 LOC), `edgeGuidePlanner.ts` (99 LOC) — total 1,047 LOC.

**Target:** ~200 LOC.

**Design:**

```typescript
export type SideSelection = {
  readonly sourceSide: SideId;
  readonly destinationSide: SideId;
  readonly sourceAnchor: Vec2;
  readonly destinationAnchor: Vec2;
  readonly sourceStub: Vec2;
  readonly destinationStub: Vec2;
};

/**
 * Select exit/entry sides and compute anchor points for a single edge.
 *
 * Algorithm:
 * 1. If ports are locked (fromPort/toPort DSL props), use them directly.
 * 2. Otherwise, pick sides by comparing the XY delta between node centers
 *    against each node's aspect ratio (nearest-side-for-node).
 * 3. For bundle hints (sibling flow edges sharing a source), lock the source
 *    side to the hinted side and compute a lateral-offset anchor.
 * 4. Compute anchor point: center of the selected side, optionally offset
 *    laterally toward the target for multi-edge port spreading.
 * 5. Compute stub point: anchor + sideNormal * stubLength.
 */
export function selectSides(
  request: EdgeRoutingRequest,
  fromRect: NodeRect,
  toRect: NodeRect,
  bundleHint?: BundleHint,
  config?: FlowConfig,
): SideSelection;

/**
 * Nearest side for a node, considering aspect ratio.
 * Pure 2D: compares |dx|/halfW vs |dy|/halfH. No Z.
 */
export function nearestSide(from: Vec2, to: Vec2, halfW: number, halfH: number): SideId;

/**
 * Outward unit normal for a side in the 2D plane.
 */
export function sideNormal(side: SideId): Vec2;

/**
 * Center point of a side on a node rect.
 */
export function sideCenter(rect: NodeRect, side: SideId): Vec2;

/**
 * Compute port anchor on a side, offset laterally for multi-port spreading.
 * portIndex/portCount control lateral distribution along the side span.
 */
export function portAnchor(
  rect: NodeRect,
  side: SideId,
  portIndex: number,
  portCount: number,
): Vec2;
```

**What's eliminated:**
- The entire face-pair enumeration loop (was: 16 pairs × N ports each)
- The port-scoring and lateral-class system (was: center/inner/outer/edge classification + 7 scoring terms)
- The guide-point generation as a separate stage (folded into stub computation)

**What's kept:**
- Bundle hint support (shared source side for sibling flow edges)
- Nearest-side with aspect-ratio weighting
- Port lateral offset for multi-edge spreading
- Explicit port lock from DSL `fromPort`/`toPort`

---

### `obstacleModel.ts` — 2D Obstacle Rects with Containment

**Replaces:** `flowObstacleModel.ts` (158 LOC).

**Target:** ~150 LOC.

**Three containment tiers:**

| Group variant | Obstacle behavior |
|---|---|
| `container` | **Invisible** — filtered out before reaching the obstacle model. Edges pass through freely. |
| `cluster` / `swimlane` / `boundary` that **owns** the source or dest | **Soft + corridor** — the edge must punch through the group wall. An allowed corridor (narrow rect along the exit side near the anchor) lets the edge cross the group boundary cleanly. |
| `cluster` / `swimlane` / `boundary` that is **unrelated** | **Soft obstacle** — the router avoids it, but with lower penalty (85% of hard). If there's no clean path around it, the router can cross through. |
| Node (not source/dest) | **Hard obstacle** — the router will not cross. |

```typescript
export type Obstacle = {
  readonly id: string;
  readonly kind: 'node' | 'group';
  readonly rect: Rect2D;               // tight bounding rect
  readonly expandedRect: Rect2D;       // rect + padding (nodes) or + padding * 1.35 (groups)
  readonly hard: boolean;              // true = node, false = group boundary
  readonly ownsEndpoint: boolean;      // true if this group contains the source or dest
  readonly allowedCorridors: ReadonlyArray<Rect2D>;  // narrow rects where the edge may cross
};

/**
 * Build the 2D obstacle set for a single edge.
 *
 * Containment rules:
 * 1. Source and destination nodes are never obstacles (edges start/end there).
 * 2. Container groups (`variant="container"`) are invisible — not included.
 *    (compile.ts filters these out before calling the router.)
 * 3. Visible groups that contain the source or destination anchor get an
 *    allowed corridor: a narrow rect along the exit/entry side that lets
 *    the edge punch through the group wall near the anchor point.
 * 4. Visible groups unrelated to the edge are soft obstacles (lower penalty).
 * 5. All other nodes are hard obstacles (no crossing).
 *
 * The A* router uses `hard` to decide blocking vs. penalty, and checks
 * `allowedCorridors` before penalizing a segment that crosses a soft obstacle.
 */
export function buildObstacles(
  nodeRects: ReadonlyMap<string, NodeRect>,
  groupIds: ReadonlySet<string>,
  obstacleGroupIds: ReadonlySet<string>,
  sourceId: string,
  destId: string,
  sourceAnchor: Vec2,
  destAnchor: Vec2,
  sourceSide: SideId,
  destSide: SideId,
  padding: number,
): ObstacleModel;

export type ObstacleModel = {
  readonly obstacles: ReadonlyArray<Obstacle>;
  readonly sourceOwningGroupIds: ReadonlySet<string>;
  readonly destOwningGroupIds: ReadonlySet<string>;
};
```

**Corridor computation (2D):**

For a group that contains an endpoint, the corridor is a narrow axis-aligned rect from the anchor point outward along the exit/entry side:

```
Left/right exit:  corridor spans horizontally from anchor to stub, narrow vertically (±padding*1.5)
Top/bottom exit:  corridor spans vertically from anchor to stub, narrow horizontally (±padding*1.5)
```

This is the 2D equivalent of the old `corridorForFace()` — same logic, no `FaceId` parameter, just `SideId`.

**What's eliminated:**
- Z-depth threshold heuristic for inferring groups (`size[2] <= 0.02`) — groups are explicitly passed
- All `Vec3`/`FaceId` parameters — pure `Vec2`/`SideId`

---

### `orthogonalRouter.ts` — A* Manhattan Routing

**Replaces:** `flowVisibilityGraph.ts` (557 LOC) + `flowRouter.ts` (190 LOC) — total 747 LOC.

**Target:** ~500 LOC (the A* algorithm is genuinely complex and stays).

**What changes:**
- Input is `Vec2` start/end + `Obstacle[]`, not a mix of `Vec3`/`FaceId`/`NodeDimensions`
- Output is `Vec2[]` waypoints, not a full `FlowRouteResult` with path commands
- No face-center computation, no face-normal computation, no Z
- No `sourceAnchor`/`destinationAnchor` — those come from `sideSelect.ts`
- Approach direction derived from destination side (not a face lookup)

```typescript
export type OrthogonalRouteResult = {
  readonly waypoints: ReadonlyArray<Vec2>;
  readonly usedUnderpass: boolean;
  readonly punctures: ReadonlyArray<{ obstacleId: string; direction: string }>;
  readonly bendCount: number;
  readonly pathLength: number;
};

/**
 * Find the shortest orthogonal (Manhattan) path from start to end,
 * avoiding obstacles, using A* on a visibility graph.
 *
 * The visibility graph vertices are obstacle corners + start/end points.
 * Edges are axis-aligned segments that don't cross hard obstacle interiors.
 */
export function routeOrthogonal(
  start: Vec2,
  end: Vec2,
  obstacles: ReadonlyArray<Obstacle>,
  approachDirection: 'N' | 'S' | 'E' | 'W',
  config: {
    turnPenalty: number;
    punchthroughPenalty: number;
  },
): OrthogonalRouteResult;
```

**What's kept intact:**
- The A* search algorithm
- Turn penalty scoring
- Obstacle intersection testing (`assessSegment`)
- Punchthrough detection
- The core graph construction from obstacle corners

**What's eliminated:**
- Underpass logic (Z-dip around obstacles) — this is a 3D concept; remove
- `planeZ` parameter — no Z in the router
- Face-to-direction mapping (`endApproachDirectionMap`)
- All Vec3 operations replaced with Vec2

---

### `pathBuilder.ts` — Path Building + Z Assignment

**Replaces:** `flowPathBuilder.ts` (349 LOC) + `curveKernel.ts` (110 LOC) + `edgeRoutingProfiles.ts` (536 LOC) — total 995 LOC.

**Target:** ~350 LOC.

No separate profile post-processor module. The profile is a branch in the orchestrator that calls one of four `pathBuilder` functions. All four produce `PathCommand2D[]`. Corner smoothing is integral to path building, not a separate step.

```typescript
/** 2D path command — line or cubic Bezier, XY only. */
export type PathCommand2D =
  | { kind: 'line'; from: Vec2; to: Vec2 }
  | { kind: 'cubic'; p0: Vec2; p1: Vec2; p2: Vec2; p3: Vec2 };

/**
 * Build a flow path from orthogonal waypoints.
 * Every 90° turn becomes a smooth cubic Bezier arc with the given radius.
 * Straight segments become lines. No sharp corners ever emitted.
 */
export function buildFlowPath(
  waypoints: ReadonlyArray<Vec2>,
  turnRadius: number,
): ReadonlyArray<PathCommand2D>;

/**
 * Build a curved path (single Bezier S-curve) between two anchors.
 * The A* router provides collision-free waypoints; for a simple L-turn
 * or straight shot, this collapses to a single smooth cubic.
 * For paths with multiple turns, smooths the waypoints into a Catmull-Rom
 * style spline that respects the collision-free corridor.
 */
export function buildCurvedPath(
  sourceAnchor: Vec2,
  destAnchor: Vec2,
  sourceNormal: Vec2,
  destNormal: Vec2,
  waypoints: ReadonlyArray<Vec2>,
  options?: { handleFactor?: number; handleMin?: number; handleMax?: number },
): ReadonlyArray<PathCommand2D>;

/**
 * Build a straight path (direct line between anchors).
 * If the A* route has turns (obstacles in the way), falls back to buildFlowPath.
 */
export function buildStraightPath(
  sourceAnchor: Vec2,
  destAnchor: Vec2,
  waypoints: ReadonlyArray<Vec2>,
  turnRadius: number,
): ReadonlyArray<PathCommand2D>;

/**
 * Build an organic path (curved + deterministic hash-based perturbation).
 */
export function buildOrganicPath(
  sourceAnchor: Vec2,
  destAnchor: Vec2,
  sourceNormal: Vec2,
  destNormal: Vec2,
  waypoints: ReadonlyArray<Vec2>,
  edgeId: string,
  variation: number,
): ReadonlyArray<PathCommand2D>;

/**
 * Convert 2D path commands to 3D by assigning Z via smoothstep interpolation.
 * When sourceZ ≈ destZ, all points get the same Z (common flat case).
 */
export function assignDepth(
  commands: ReadonlyArray<PathCommand2D>,
  sourceZ: number,
  destZ: number,
  sourceDepth: number,
  destDepth: number,
): ReadonlyArray<DiagramEdgePathCommand>;

/**
 * Extract control points from path commands (for the compiled DiagramState).
 */
export function commandsToControlPoints(
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): ReadonlyArray<Vec3>;
```

**Z assignment (`assignDepth`):**

```typescript
// For each point in the path, compute t ∈ [0, 1] as cumulative arc-length fraction.
// Z = lerp(sourceMidZ, destMidZ, smoothstep(t))
// where sourceMidZ = sourceZ - sourceDepth / 2
//       destMidZ = destZ - destDepth / 2
//       smoothstep(t) = 3t² - 2t³
//
// When sourceMidZ ≈ destMidZ (within 1e-6), all Z = sourceMidZ. Zero cost.
```

This is the smoothstep interpolation for different-depth nodes. For the common case (all nodes at z=0), it's a no-op that sets every Z to the same mid-depth value.

---

### `shapeSnap.ts` — XY Polygon Endpoint Snap

**Replaces:** `shapeEndpointSnap.ts` (230 LOC).

**Target:** ~140 LOC.

**Simplification:** XY-only. No Z manipulation. The old `frontFaceZ()` function that caused the Z-dip bug is gone because Z is handled entirely by `assignDepth()`.

```typescript
/**
 * Snap the first/last points of a path to the actual polygon/circle boundary.
 * XY only — Z is already correct from assignDepth().
 * Rectangle/square shapes: no adjustment (AABB matches geometry).
 */
export function snapEndpointsToShape(
  commands: ReadonlyArray<DiagramEdgePathCommand>,
  sourceShape: ShapeInfo | undefined,
  destShape: ShapeInfo | undefined,
): ReadonlyArray<DiagramEdgePathCommand>;
```

---

### `trunkOptimizer.ts` — Shared Trunk Trimming

**Replaces:** `edgeRenderOptimizer.ts` (622 LOC).

**Target:** ~500 LOC (mostly kept — this logic is genuinely complex).

**Changes:** Operates on 2D path length for trimming decisions, Z is passthrough. Internal helpers use `Vec2` where possible, `Vec3` only for the final command manipulation.

---

### `edgeRouter.ts` — Thin Orchestrator

**Replaces:** current `edgeRouter.ts` (626 LOC).

**Target:** ~200 LOC.

**Design:**

```typescript
/**
 * Route all edges in a diagram. Pure 2D routing with post-hoc Z assignment.
 *
 * Positions are Y-down NVS. Results are Y-down NVS with Z at mid-depth.
 */
export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  nodeRects: ReadonlyMap<string, NodeRect>,
  groupIds: ReadonlySet<string>,
  obstacleGroupIds: ReadonlySet<string>,
  config: FlowConfig,
  onWarn?: DiagramWarnFn,
): Map<string, EdgeRouteResult> {
  // 1. Mirror Y-down NVS to Y-up router space (inline, no separate module)
  const routerRects = mirrorNodeRectsY(nodeRects);

  // 2. Infer bundle hints for sibling flow edges
  const bundleHints = inferBundleHints(edges, routerRects);

  // 3. Route each edge
  for (const edge of edges) {
    const fromRect = routerRects.get(edge.fromId)!;
    const toRect = routerRects.get(edge.toId)!;

    // a. Select sides + anchors (2D)
    const sides = selectSides(edge, fromRect, toRect, bundleHints.get(edge.id), config);

    // b. Build per-edge obstacle model with containment corridors
    const obstacles = buildObstacles(
      routerRects, groupIds, obstacleGroupIds,
      edge.fromId, edge.toId,
      sides.sourceAnchor, sides.destinationAnchor,
      sides.sourceSide, sides.destinationSide,
      config.obstaclePadding,
    );

    // c. Route in 2D — ALL profiles go through A* for collision avoidance
    const route = routeOrthogonal(
      sides.sourceStub, sides.destinationStub,
      obstacles.obstacles, sideToApproach(sides.destinationSide),
      { turnPenalty: config.turnPenalty, punchthroughPenalty: config.punchthroughPenalty },
    );

    // d. Build path commands — profile controls smoothing, not routing
    let commands2D: PathCommand2D[];
    if (edge.profile === 'flow') {
      commands2D = buildFlowPath(route.waypoints, config.turnRadius);
    } else if (edge.profile === 'curved') {
      commands2D = buildCurvedPath(
        sides.sourceAnchor, sides.destinationAnchor,
        sideNormal(sides.sourceSide), sideNormal(sides.destinationSide),
        route.waypoints,
      );
    } else if (edge.profile === 'organic') {
      commands2D = buildOrganicPath(
        sides.sourceAnchor, sides.destinationAnchor,
        sideNormal(sides.sourceSide), sideNormal(sides.destinationSide),
        route.waypoints, edge.id, config.organicVariation,
      );
    } else {
      commands2D = buildStraightPath(
        sides.sourceAnchor, sides.destinationAnchor,
        route.waypoints, config.turnRadius,
      );
    }

    // e. Assign Z (smoothstep from source mid-depth to dest mid-depth)
    const commands3D = assignDepth(commands2D, fromRect.z, toRect.z, fromRect.depth, toRect.depth);

    // f. Mirror Y back to NVS, store result
    results.set(edge.id, mirrorRouteY({ path: { commands: commands3D, ... }, ... }));
  }

  return results;
}
```

**Key change from current design:** Every profile gets collision-free waypoints from the A* router. The profile just controls how those waypoints are presented:
- **flow**: Arc-rounded orthogonal path (keeps the Manhattan character)
- **curved**: Smooth Bezier that respects the collision-free corridor
- **straight**: Direct line if obstacle-free, otherwise falls back to flow
- **organic**: Curved + hash-based perturbation

One A* call per edge. One path build per edge. No candidates, no scoring, no selection.

**What's eliminated from the orchestrator:**
- The entire candidate pipeline (face enumeration → pruning → port assignment → guide generation → per-candidate routing → scoring → selection)
- The Y-mirror as a separate module (`routingSpace.ts`) — two inline helper calls
- The `resolveFaces()` / `nearestFaceForNodePair()` / `shortestPathFaces()` family
- The `ROUTING_PROFILES` registry indirection
- The debug logging infrastructure (~200 LOC of debug serialization)

---

## Y-Mirror Strategy

**Current:** `routingSpace.ts` mirrors all positions at entry, all results at exit. Separate module.

**New:** The orchestrator applies Y-negate to `NodeRect.cy` when building the obstacle set, and Y-negates the output path commands before returning. Two lines of code, no separate module. The orthogonal router and profile shapers work in Y-up internally, which is natural for "top" meaning +Y in the A* heuristic.

---

## Bundle Hints

Bundle inference (`inferBundleHints`) stays. It groups sibling flow edges sharing a source node and assigns them a shared source side + lateral offset. This is a 2D operation that works identically in the new pipeline — it just operates on `SideId` instead of `FaceId` and `Vec2` instead of `Vec3`.

The bundle hint feeds into `selectSides()` to lock the source side and offset the anchor laterally.

---

## Non-Routing Code Assessment

The 3D face model is **properly confined to the routing pipeline**. The rest of the diagram package is clean:

| Area | Status | Notes |
|---|---|---|
| `rendering/EdgeRenderer.ts` | **CLEAN** | Consumes pre-baked path commands. No routing topology. |
| `rendering/NodeRenderer.ts` | **CLEAN** | `sideColor`/front-face logic is visual appearance, not topology. |
| `rendering/GroupRenderer.ts` | **CLEAN** | 2D bounds + edge lights positioning. No routing. |
| `compiler/nodeCompiler.ts` | **CLEAN** | DSL→state, pure transformation. |
| `compiler/groupCompiler.ts` | **CLEAN** | Appearance compilation + edgeLights 2D math. |
| `compiler/layoutResolver.ts` | **CLEAN** | Theme cascade + 2D layout math. |
| `compiler/layoutAlgorithms.ts` | **CLEAN** | Grid/hierarchical/flow dispatch — 2D positioning. |
| `compiler/transitionHelpers.ts` | **CLEAN** | Blending + state mapping. Routing call is a proper boundary. |
| `compiler/normalizeToViewport.ts` | **CLEAN** | Coordinate transformation only. |
| `compile.ts` | **MINOR** | One `routeEdgesYDown()` call (line 267) → update to new `routeEdges()`. |
| `types.ts` | **CLEAN** | `DiagramEdgePathDebug` uses string labels, not `FaceId`. Update `DiagramEdgePort`. |
| Player layer | **CLEAN** | No routing imports. |
| Widget | **CLEAN** | Calls high-level render/transition — no routing internals. |

**No rework needed** in renderers, compilers, layouts, player, or widget. The routing rewrite is self-contained.

---

## Migration Strategy: Delete First, Build Fresh

No backward compatibility. The old routing code and its tests are deleted in Phase 1. The new pipeline is built from scratch — it's faster to write clean 2D code than to incrementally refactor 3D code.

### Phase 1: Delete Old Routing Pipeline

**Delete production code (16 files, 5,067 LOC):**
- `compiler/edgeRouter.ts`
- `compiler/edgeCandidatePlanner.ts`
- `compiler/edgePortPlanner.ts`
- `compiler/edgeGuidePlanner.ts`
- `compiler/edgeCandidateScorer.ts`
- `compiler/edgeCandidateSelector.ts`
- `compiler/edgeRoutingProfiles.ts`
- `compiler/edgeRenderOptimizer.ts`
- `compiler/flowRouter.ts`
- `compiler/flowPathBuilder.ts`
- `compiler/flowVisibilityGraph.ts`
- `compiler/flowObstacleModel.ts`
- `compiler/curveKernel.ts`
- `compiler/shapeEndpointSnap.ts`
- `compiler/routingSpace.ts`
- `compiler/routingTypes.ts`

**Delete test code (12 files, 3,244 LOC):**
- `compiler/__tests__/edgeRouter.test.ts` (804 LOC)
- `compiler/__tests__/edgeCandidatePlanner.test.ts` (504 LOC)
- `compiler/__tests__/edgePortPlanner.test.ts` (273 LOC)
- `compiler/__tests__/edgeGuidePlanner.test.ts` (202 LOC)
- `compiler/__tests__/edgeCandidateScorer.test.ts` (315 LOC)
- `compiler/__tests__/edgeCandidateSelector.test.ts` (115 LOC)
- `compiler/__tests__/edgeRoutingProfiles.test.ts` (248 LOC)
- `compiler/__tests__/edgeRenderOptimizer.test.ts` (243 LOC)
- `compiler/__tests__/flowRouter.test.ts` (101 LOC)
- `compiler/__tests__/flowPathBuilder.test.ts` (104 LOC)
- `compiler/__tests__/flowObstacleModel.test.ts` (148 LOC)
- `compiler/__tests__/routingSpace.test.ts` (187 LOC)

**Keep** (not routing):
- `compiler/__tests__/groupCompiler.test.ts`
- `compiler/__tests__/nodeCompiler.test.ts`
- `compiler/__tests__/themeResolver.test.ts`
- `compiler/__tests__/layoutResolver.test.ts`
- `compiler/__tests__/layoutAlgorithms.test.ts`
- `compiler/__tests__/defaultsCompiler.test.ts`
- `compiler/__tests__/transitionHelpers.test.ts`
- `compiler/__tests__/ghostNodeMerge.test.ts`
- `compiler/__tests__/hoverStateMachine.test.ts`
- `player/__tests__/sceneCfOverviewRouting.test.tsx` (integration tests — **keep, they validate the routing output**)

**Total deleted: 28 files, 8,311 LOC.**

**Update `compile.ts`:** Stub out the `routeEdgesYDown` call with an empty route map so the non-routing tests still pass while the new pipeline is built. The integration tests (`sceneCfOverviewRouting.test.tsx`) will fail — that's expected and intentional until Phase 7.

### Phase 2: Build `routingTypes.ts` + `sideSelect.ts`

Create `compiler/routing/`. Build types, Vec2 math, side selection, port placement.

**New tests:** `compiler/routing/__tests__/sideSelect.test.ts`

### Phase 3: Build `obstacleModel.ts`

Build 2D obstacle model with the three containment tiers: container (invisible), owning group (soft + corridor), unrelated group (soft), node (hard).

**New tests:** `compiler/routing/__tests__/obstacleModel.test.ts`

### Phase 4: Build `orthogonalRouter.ts`

Port the A* visibility graph algorithm from the deleted `flowVisibilityGraph.ts`. Convert Vec3→Vec2, remove underpass logic, remove `planeZ`. Keep the A* search, obstacle intersection, turn penalty, corridor allowance.

**New tests:** `compiler/routing/__tests__/orthogonalRouter.test.ts`

### Phase 5: Build `pathBuilder.ts`

Build all four path building functions (`buildFlowPath`, `buildCurvedPath`, `buildStraightPath`, `buildOrganicPath`) + `assignDepth` + `commandsToControlPoints`.

**New tests:** `compiler/routing/__tests__/pathBuilder.test.ts`

### Phase 6: Build `shapeSnap.ts` + `trunkOptimizer.ts`

Port polygon/circle XY projection (no Z). Port shared trunk trimming.

**New tests:** `compiler/routing/__tests__/shapeSnap.test.ts`, `compiler/routing/__tests__/trunkOptimizer.test.ts`

### Phase 7: Build `edgeRouter.ts` orchestrator + wire into `compile.ts`

Build the thin orchestrator. Replace the stub in `compile.ts` with the real call. All integration tests (`sceneCfOverviewRouting.test.tsx`, `sceneCsOverview`) must pass.

**New tests:** `compiler/routing/__tests__/edgeRouter.test.ts` (unit) + integration tests already exist

### Phase 3: Build Side Selection

Implement `sideSelect.ts` with `nearestSide()`, `sideNormal()`, `sideCenter()`, `portAnchor()`, `selectSides()`. This replaces the face enumeration + port assignment + guide generation pipeline.

**Test:** Port the existing `edgeRouter.test.ts` side-selection tests.

### Phase 4: Build Profile Shapers

Implement `pathProfiles.ts` with the four profile functions. Port the Bezier kernel from `curveKernel.ts` for curved/organic. Port arc rounding from `flowPathBuilder.ts` for flow.

**Test:** Port `flowPathBuilder.test.ts` arc rounding tests + `edgeRoutingProfiles.test.ts` profile-specific tests.

### Phase 5: Build Path Builder + Z Assignment

Implement `pathBuilder.ts` with `roundCorners()`, `assignDepth()`, `commandsToControlPoints()`.

**Test:** New tests for smoothstep Z interpolation at t=0, t=0.5, t=1 with same-Z and different-Z nodes.

### Phase 6: Build Shape Snap (XY Only)

Implement `shapeSnap.ts` — port polygon/circle projection from `shapeEndpointSnap.ts`, remove all Z manipulation.

**Test:** Port existing shape snap tests.

### Phase 7: Build Trunk Optimizer

Refactor `edgeRenderOptimizer.ts` into `trunkOptimizer.ts`. Minimal changes — mostly mechanical Vec3→Vec2 where possible, keep Vec3 for final command manipulation.

**Test:** Port existing trunk optimizer tests.

### Phase 8: Build Orchestrator + Wire Into compile.ts

Implement the new `edgeRouter.ts` orchestrator. Wire it into `compile.ts` as a replacement for the old `routeEdgesYDown()` call.

**Test:** Run the full `sceneCfOverviewRouting.test.tsx` and `sceneCsOverview` test suites against the new pipeline. All routing assertions must pass.

### Phase 9: Delete Old Pipeline

Once all tests pass with the new pipeline:

**Delete:**
- `compiler/edgeCandidatePlanner.ts`
- `compiler/edgePortPlanner.ts`
- `compiler/edgeGuidePlanner.ts`
- `compiler/edgeCandidateScorer.ts`
- `compiler/edgeCandidateSelector.ts`
- `compiler/edgeRoutingProfiles.ts`
- `compiler/flowRouter.ts`
- `compiler/flowPathBuilder.ts`
- `compiler/flowVisibilityGraph.ts`
- `compiler/flowObstacleModel.ts`
- `compiler/curveKernel.ts`
- `compiler/shapeEndpointSnap.ts`
- `compiler/routingSpace.ts`
- `compiler/routingTypes.ts` (old one)
- `compiler/edgeRouter.ts` (old one)
- `compiler/edgeRenderOptimizer.ts` (old one)

**Update:**
- `compiler/edgeRouter.ts` → re-export from `compiler/routing/edgeRouter.ts`
- `compile.ts` → import from new location
- All test files → update imports

---

## Test Strategy

| Module | Test approach |
|---|---|
| `sideSelect.ts` | Real `NodeRect` inputs → assert selected sides match XY geometry. Test locked ports, bundle hints, aspect-ratio weighting. |
| `obstacleModel.ts` | Real node/group rects → assert obstacle set: includes correct nodes, excludes source/dest, respects container transparency, generates corridors for owning groups, soft vs hard classification. |
| `orthogonalRouter.ts` | Real obstacle sets → assert waypoints avoid obstacles, path is orthogonal, bend count is minimal. Test corridor punchthrough for owning groups. Port existing `flowRouter.test.ts` cases. |
| `pathBuilder.ts` | `buildFlowPath`: assert arc rounding at 90° turns, no sharp corners. `buildCurvedPath`: assert smooth Bezier through waypoints. `buildStraightPath`: assert fallback to flow when obstacles present. `assignDepth`: assert smoothstep Z at t=0, 0.5, 1 for same-Z and different-Z nodes. |
| `shapeSnap.ts` | Real polygon/circle shapes → assert XY projection lands on shape boundary. Assert Z is unchanged. |
| `trunkOptimizer.ts` | Port existing `edgeRenderOptimizer.test.ts` cases directly. |
| `edgeRouter.ts` (orchestrator) | Full integration: `sceneCfOverviewRouting.test.tsx` suite. All 22 tests must pass. |

---

## Metrics

| Metric | Current | Target |
|---|---|---|
| Files | 16 | 8 (including orchestrator) |
| Total LOC | 5,067 | ~2,000 |
| Duplicated functions | ~90 LOC across 7 files | 0 (one `routingTypes.ts`) |
| Candidates generated per edge | up to hundreds | 0 (direct routing) |
| A* calls per edge | up to hundreds (one per candidate) | 1 (all profiles) |
| Vec3 in routing internals | everywhere | Vec2 only (Vec3 at Z-assignment boundary) |
| Separate Y-mirror module | yes (routingSpace.ts) | no (inline in orchestrator) |
| Containment model | soft/hard + corridors + Z-depth heuristic | soft/hard + corridors (explicit group sets, no Z) |
| Profile code paths | 4 separate route generators | 1 router + 4 path builder functions |
