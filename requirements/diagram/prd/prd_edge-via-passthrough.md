---
title: "Edge Via Pass-Through Routing"
doc_type: prd
status: draft
owner: Toolkit Product
last_updated: 2026-03-21
change_history:
  - date: 2026-03-19
    author: Toolkit Product
    summary: "Initial PRD created. Defines the `via` prop for DiagramEdge pass-through routing."
  - date: 2026-03-21
    author: Toolkit Product
    summary: "Updated references to reflect the 2D routing pipeline rewrite. resolveFaces → selectSides in compiler/routing/sideSelect.ts. edgeRouter.ts → compiler/routing/edgeRouter.ts. Face → side terminology throughout. Updated dependency references."
---

# Edge Via Pass-Through Routing

## Overview

Adds a `via` prop to `<DiagramEdge>` that routes an edge through one or more intermediate nodes, visually "docking" at each intermediate's face before continuing to the final destination. Affects `@brewsite/diagram` only.

## Problem Statement

In architecture diagrams with vertically or horizontally stacked nodes, edges frequently pass near or through intermediate nodes on the way to their destination. The current routing produces a single continuous curve from source to destination that visually overlaps the intermediate node without acknowledging it, creating a messy appearance.

**Concrete example:** In a pipeline `WidgetRegistry → SceneCanvas` where `EngineOverlayHost` sits between them, the edge flies past the overlay node diagonally. The author's intent is for the edge to visually pass *through* the overlay — entering one face and exiting the other — before reaching the canvas.

Today the only workaround is to split the edge into two separate `<DiagramEdge>` elements (`registry→overlay`, `overlay→canvas`), which changes the semantic meaning and requires the author to manage two edges instead of one.

## Goals & Success Metrics

| Goal | Metric |
|---|---|
| Authors can express pass-through routes in a single edge | `via` prop available on `<DiagramEdge>` |
| Visual output matches hand-drawn expectation: edge docks at each intermediate | Manual DX review: pass-through edge touches each intermediate's face |
| No regression to existing edges without `via` | All existing edge routing tests pass unchanged |
| Bundle size impact < 1 KB gzipped | Measured via `pnpm build && gzip -9` |

**Guardrail:** Edges without `via` must produce identical output before and after this change.

## Non-Goals

- **Auto-detection of pass-throughs.** The compiler does not infer that an edge should dock at an intermediate node just because the straight-line path passes near it. This is too heuristic-dependent and would surprise authors. Explicit `via` is the correct API.
- **Intermediate node state changes.** The `via` nodes are visual pass-through points only. They do not receive edge state (no `onHover`, no `onSelect`, no flow animation restarts at intermediates).
- **Branching at intermediates.** The edge enters and exits the same intermediate node in a single pass. It does not fan out or change direction at the intermediate (use separate edges for that).

## Consumer Stories

1. As a diagram author, I want to route an edge through an intermediate node so the visual pipeline shows the data flow touching each layer.
2. As a diagram author, I want a single `<DiagramEdge>` with `via` instead of managing two separate edges for a pass-through, so my DSL is concise and semantically correct.
3. As a diagram author, I want the pass-through to automatically choose the entry/exit faces on the intermediate node based on the edge direction, so I don't need to specify ports manually.

## Functional Requirements

1. `<DiagramEdge>` accepts an optional `via` prop: an ordered array of node IDs through which the edge passes.
2. For each intermediate node in `via`, the edge visually docks at the node's entry face and exits from the opposite face (or the face nearest to the next waypoint).
3. The edge renders as a single continuous tube with a consistent flow animation pulse.
4. Side selection at each intermediate node uses the same `selectSides` algorithm used for source/destination sides.
5. The intermediate segments are routed independently using the edge's `routing` algorithm (curved, flow, straight, organic).
6. The `via` prop accepts 1–4 intermediate node IDs. More than 4 emits a compile warning and truncates.
7. Edge labels, if present, are placed on the longest segment (source→first-via, or last-via→destination, or between vias — whichever is longest).

## API Design

### DSL Props

```typescript
export interface DiagramEdgeProps {
  // ... existing props ...

  /**
   * Ordered list of intermediate node IDs the edge passes through.
   * The edge routes from `from` → via[0] → via[1] → ... → `to`,
   * docking at each intermediate node's face.
   *
   * @example
   * <DiagramEdge from="registry" to="canvas" via={["overlay"]} flow="forward" />
   */
  via?: string[];
}
```

### Compiled State

The compiled `DiagramEdgeState` is unchanged — the `via` routing produces a single `path` with commands that span all segments. The `controlPoints` array contains all points across all segments. A new optional field records the via metadata:

```typescript
export interface DiagramEdgeState {
  // ... existing fields ...

  /** Intermediate node IDs this edge passes through (from `via` prop). */
  viaNodeIds?: ReadonlyArray<string>;
  /** NVS positions where the edge docks at each intermediate node face. */
  viaDockPoints?: ReadonlyArray<readonly [number, number, number]>;
}
```

### Example Usage

```tsx
{/* Before: two edges, messy semantic */}
<DiagramEdge from="registry" to="overlay" style="dashed" />
<DiagramEdge from="overlay" to="canvas" label="apply()" flow="forward" />

{/* After: single edge with pass-through */}
<DiagramEdge from="registry" to="canvas" via={["overlay"]} label="apply()" flow="forward" />
```

## Technical Considerations

### Compiler Pipeline

The `via` prop is resolved during edge compilation in `compile.ts`:

1. The compiler expands `from → via[0] → via[1] → ... → to` into N+1 sub-segments.
2. Each sub-segment gets side selection (entry/exit sides) using the existing `selectSides` function from `compiler/routing/sideSelect.ts`.
3. Each sub-segment is routed independently using the edge's routing profile (curved/flow/straight/organic) via the `compiler/routing/` pipeline.
4. The sub-segment paths are concatenated into a single `DiagramEdgePathState` with continuous commands.
5. At each via dock point, the exit side anchor of segment N must equal the entry side anchor of segment N+1 (C0 continuity).

### Edge Router Changes

- `compiler/routing/edgeRouter.ts`: The `EdgeRoutingRequest` type adds `via?: string[]`. The `routeEdges` function detects via edges and routes each sub-segment separately, then concatenates results.
- Side anchors at intermediate nodes are computed as exit/entry pairs: the entry side is the side nearest to the previous node, the exit side is nearest to the next node.

### Flow Animation

The flow pulse travels along the entire concatenated path as a single animation. No restart or gap at intermediate nodes.

### Obstacle Model

Intermediate via nodes are excluded from the obstacle model for their own edge (they're pass-through points, not obstacles).

## Breaking Change Assessment

**Semver: minor** — new optional prop, no changes to existing behavior. Edges without `via` produce identical output.

## Dependencies

- Existing side selection (`selectSides` in `compiler/routing/sideSelect.ts`)
- Existing routing profiles (curved, flow, straight, organic) in `compiler/routing/pathBuilder.ts`
- Existing path concatenation pattern for multi-segment paths

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tangent discontinuity at via dock points | Ensure C1 continuity by matching exit tangent of segment N with entry tangent of segment N+1 |
| Performance: N+1 route computations per via edge | Cap via length at 4; most diagrams use 1-2 intermediates |
| API regret: auto-detection later makes `via` redundant | Explicit > implicit; even with auto-detection, `via` remains the override mechanism |

## Open Questions

1. Should the edge visually "pause" at each via node (tiny gap in the tube) or pass through seamlessly (no visual indication of the dock)?
2. Should via nodes receive hover highlights when the edge is hovered?
3. Should the `via` prop support group IDs (pass through a group boundary) in addition to node IDs?

## Launch Criteria

- [ ] `via` prop accepted on `<DiagramEdge>` DSL
- [ ] Compiled state includes `viaNodeIds` and `viaDockPoints`
- [ ] Edge renders as single continuous tube through all intermediates
- [ ] Flow animation pulse travels the full path without gaps
- [ ] Side selection at intermediates uses `selectSides`
- [ ] All existing edge routing tests pass unchanged
- [ ] New e2e test with via pass-through in `archDiagramEdgeRouting.test.ts`
- [ ] TypeScript types exported from `@brewsite/diagram`
- [ ] Example in `apps/examples/` demonstrates via routing
