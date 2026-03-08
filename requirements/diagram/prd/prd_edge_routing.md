---
title: "BrewSite Diagram — Edge Routing System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-08
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram edge routing system as implemented."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "NVS recalibration: MIN_PORT_PITCH reduced from 0.35 to 0.05 (was calibrated for pre-NVS world units; 35% NVS pitch made multi-port faces impossible on typical nodes); EDGE_EPSILON reduced from 0.06 to 0.012 (6% NVS was too large for dense layouts). Functional Requirement 9 updated to remove stale pivot offset reference. Port Slot Distribution constants block updated."
---

## Overview

The edge routing system computes the 3D control points for `DiagramEdge` connections between nodes in `@brewsite/diagram`. It runs inside the diagram compilation pipeline after layout resolves all node positions. The result is stored as `ReadonlyArray<readonly [number, number, number]>` on each `DiagramEdgeState.controlPoints`. Control points are consumed by `EdgeRenderer` to construct CatmullRom tube geometry at render time. The system is implemented across `compiler/edgeRouter.ts` and `compiler/curveKernel.ts`, both pure TypeScript with no Three.js or React dependencies.

## Problem Statement

Diagram edges in a 3D scene require more than a straight line between two node centers. Each edge must: (1) exit its source node from a natural face rather than cutting through the geometry, (2) avoid visually penetrating adjacent nodes, (3) not overlap sibling edges that share the same face, and (4) suit the aesthetic intent of the chosen theme (organic curves for dark presentations, sharp 90° turns for circuit-board diagrams). Without a principled routing system, consumer scenes require manual control point specification for every edge — a prohibitive authoring burden for diagrams with tens or hundreds of connectors.

## Goals and Success Metrics

**Primary goals:**
- All edges in a compiled diagram have valid control points without consumer-authored coordinate data
- The default routing produces visually clean output for grids of 4–50 nodes with no obvious overlaps or face penetrations
- Per-edge routing overrides work without recompiling the whole diagram
- Self-loop and missing-node edges degrade gracefully to empty control points with no thrown exception

**Success metrics:**
- Zero thrown exceptions for self-loop or missing-node edge inputs in the test suite
- `routeEdges` unit tests cover all four routing algorithms and all four landing algorithms
- Example scenes in `apps/examples/` render without manual control point specification

**Guardrail metrics:**
- `routeEdges` function signature remains backward compatible across minor versions
- No Three.js import introduced into `edgeRouter.ts` or `curveKernel.ts`

## Non-Goals

- Obstacle avoidance that reroutes around nodes mid-path (paths may pass through unrelated nodes in complex layouts; the cost-scoring system penalizes this but does not guarantee clearance)
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
6. When `fromPort` or `toPort` is specified on an edge, face selection for that endpoint shall use the declared port and ignore the landing algorithm for that endpoint.
7. When only one port is declared, the opposite endpoint shall resolve its face using the cost-scoring face selection algorithm.
8. Multiple edges sharing the same face on the same node shall be distributed across port slots to avoid overlap.
9. All control points shall be expressed in diagram-local space (after node positions are resolved by the layout engine).
10. The `routeEdges` function shall not import Three.js, React, or any runtime dependency.

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

export type EdgeRoutingAlgorithm = 'curved' | 'orthogonal' | 'straight' | 'organic';
export type EdgeLandingAlgorithm = 'nearest-face' | 'shortest-path' | 'center' | 'port';
export type DiagramEdgePort = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
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
export function routeEdgeCurved(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3>;
export function routeEdgeStraight(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3>;
export function routeEdgeOrganic(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  edgeId: string,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3>;
export function routeEdgeOrthogonal(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3>;
```

### Curved path kernel

`curveKernel.ts` exports a single pure function consumed by `edgeRouter.ts`:

```typescript
// packages/diagram/src/elements/diagram/compiler/curveKernel.ts

export function routeCurvedWithEndpointNormals(
  startAnchor: Vec3,
  endAnchor: Vec3,
  startNormalRaw: Vec3,
  endNormalRaw: Vec3,
  options: EndpointCurveOptions,
): ReadonlyArray<Vec3>;
```

`routeCurvedWithEndpointNormals` returns 2–4 control points. When `allowDirectSegment` is true and the endpoints are aligned and close, it returns 2 points (straight segment). Otherwise it returns 4 points (start, start-handle, end-handle, end), with handle lengths clamped to `[handleMin, handleMax]` via `handleFactor * distance`.

## Technical Considerations

### Two-Axis Decomposition

Routing is split into two independent decisions: **landing** (which face does the edge attach to?) and **routing** (given the attachment faces and their outward normals, what path do the control points describe?). This decomposition means any landing algorithm can be combined with any routing algorithm without code duplication.

### Cost-Scoring Face Selection

When the landing algorithm is `nearest-face` (or when only one port is locked), the system runs `resolveFacesByCost`. This function:

1. Constrains candidate source faces to the directionally dominant pair (`left`/`right` when `|Δx| >= |Δy| * 1.15`; `top`/`bottom` when `|Δy| >= |Δx| * 1.15`; all four otherwise).
2. For each candidate face pair, generates a test route using `routeOneEdgeWithFaces`.
3. Scores the route on five penalty terms with fixed weights:
   - **Penetration** (10,000): path length intersecting source or destination node geometry
   - **Obstacle hits** (1,000): segments crossing other nodes' bounding rectangles
   - **Alignment** (100): deviation of exit/entry direction from face normal
   - **Direction** (400): faces pointing away from the opposite node
   - **Near-edge** (320): port position too close to node boundary
4. Selects the lowest-scoring pair.

This approach replaces the simpler `nearestFace` heuristic for edges that benefit from it while avoiding O(36) enumeration for every edge.

### Port Slot Distribution

When multiple edges share the same face on a node, `routeEdges` distributes them across evenly spaced port slots along the face span. Slot count is derived from the face span, edge thickness, and minimum port pitch:

```typescript
const EDGE_EPSILON = 0.012;      // NVS units: face-center offset to avoid z-fighting
const MIN_PORT_PITCH = 0.05;     // NVS units: minimum spacing between adjacent edge ports on a face
const PORT_SPACING_FACTOR = 3.0; // pitch = max(MIN_PORT_PITCH, thickness * PORT_SPACING_FACTOR)
const PORT_MARGIN_FACTOR = 1.5;  // margin from face edge = thickness * PORT_MARGIN_FACTOR
```

These constants are calibrated for the 0..1 NVS coordinate system. The previous values (`MIN_PORT_PITCH = 0.35`, `EDGE_EPSILON = 0.06`) were calibrated for a pre-NVS world-unit system and produced incorrect behavior in the NVS space — 35% of the viewport as minimum port pitch made multi-port faces impossible on typical-sized nodes.

Each edge is assigned a slot using a weighted scoring function that balances proximity to the ideal position (derived from target node location), center attraction, edge-boundary repulsion, and current slot load. This prevents multiple edges from drawing through the same point on a node face.

### Orthogonal Routing

`routeEdgeOrthogonal` handles four cases: H→H (both horizontal faces), V→V (both vertical), H→V, and V→H. Each produces a polyline with axis-aligned segments and small chamfer offsets (`ce = 0.12`) at corners to give the CatmullRom tube renderer enough curvature information for smooth bends. For `front`/`back` source or destination faces, the function falls back to `routeEdgeCurved` since 90° routing in the Z dimension is not visually meaningful for typical 2.5D diagrams.

### Organic Routing

`routeEdgeOrganic` builds on `routeEdgeCurved` and applies a deterministic perpendicular offset to the path midpoint. The offset magnitude uses a hash of the edge ID (`hashStr`) to produce stable variation across recompiles. This separates parallel edges visually without requiring per-edge authored offsets.

### Integration with compile.ts

`routeEdges` is called from `compile.ts` after `layoutResolver` assigns positions. The call passes:
- `edges` from `DiagramDSL.edges`
- `positions` and `sizes` maps built from compiled `DiagramNodeState` entries
- `defaultRouting` and `defaultLanding` from the resolved `DiagramTheme.edge`

The returned map is used to populate `DiagramEdgeState.controlPoints` for each edge.

### EdgeRenderer Consumption

`EdgeRenderer.getOrCreate(edge, parent)` reads `edge.controlPoints` and creates a `THREE.CatmullRomCurve3` from the points. Tube segments are set to `Math.max(20, controlPoints.length * 8) * edgeSmoothness`. Empty control points arrays result in a degenerate 0-length curve; `EdgeRenderer` skips mesh creation when `controlPoints.length < 2`.

## Breaking Change Assessment

**Semver impact: none (patch-only changes to internal algorithms).** The `routeEdges` function and all type exports involved in routing have been stable since introduction. The `EdgeRoutingAlgorithm`, `EdgeLandingAlgorithm`, and `DiagramEdgePort` types are additive closed unions — new values would be a minor bump. Removing a value from any of these unions would be a breaking change requiring a major bump.

## Dependencies

- `compiler/curveKernel.ts` — shared spline math; no external dependencies
- `elements/diagram/types.ts` — `EdgeRoutingAlgorithm`, `EdgeLandingAlgorithm`, `DiagramEdgePort`
- No external npm packages

## Risks and Mitigations

**API regret — `routeEdges` signature:** The function accepts two separate `Map` arguments (`positions`, `sizes`) rather than a single `Map<string, NodeState>`. This is intentional: routing does not need the full node state, and keeping the signature minimal reduces coupling. The tradeoff is that callers must build these maps explicitly; this is acceptable because the only caller is `compile.ts`.

**Cost-scoring performance at scale:** The face-scoring algorithm runs `routeOneEdgeWithFaces` for up to 8 candidate face pairs per edge. For diagrams with 200+ edges this adds measurable compilation time. Compile runs are synchronous and happen once per scene transition, not per frame, so the practical impact is low. If compile times become a complaint, the scoring pass can be gated by a `useCostSelection` flag derived from layout density.

**Orthogonal fall-through to curved:** When orthogonal routing is selected for edges involving `front` or `back` faces, the algorithm silently falls back to `curved`. A consumer authoring orthogonal diagrams with Z-offset nodes will observe mixed routing styles. This is documented behavior but not surfaced as a warning.

## Open Questions

- Should `routeEdges` accept a `depthMap: Map<string, number>` as a separate argument to decouple depth from `NodeDimensions[2]`, or is the current `[width, height, depth]` triple sufficient? The current approach is sufficient for 2.5D diagrams but becomes ambiguous if node depth ever differs from the collision depth used for routing.
- Should `flow:cylinder-stack` and `flow:queue` icon shapes influence face selection (e.g., always prefer top/bottom faces for stack nodes)? Currently icon choice has no effect on routing.

## Launch Criteria

- All four routing algorithms covered by unit tests in `compiler/__tests__/edgeRouter.test.ts`
- Self-loop and missing-node cases covered by unit tests
- Port slot distribution unit tested for 3+ edges sharing a single face
- `@brewsite/diagram` CHANGELOG updated
- At least one example scene in `apps/examples/diagram/` uses orthogonal routing to demonstrate the contrast with the default curved routing
