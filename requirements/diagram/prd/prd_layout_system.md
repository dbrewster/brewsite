---
title: "BrewSite Diagram — Layout System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-10
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram layout system — three layout strategies, cascade model, resolved types, pivot offset, and functional requirements — as implemented."
  - date: 2026-03-04
    author: "Toolkit Product"
    summary: "Added FlowLayout as the fourth first-class layout strategy. Documents FlowLayoutDSL, ResolvedFlowLayout, DEFAULT_RESOLVED_FLOW, childrenOrder field on DiagramDSL and DiagramGroupDSL, theme defaultKind extension to include 'flow', cascade behavior, and authoring example. Updated Overview, Problem Statement, Consumer Stories, Functional Requirements, Theme Layout Defaults, Dependencies, and Risks sections accordingly."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Model/diagram overhaul: removed Pivot Offset section — DiagramPivot type deleted, pivot prop removed from DiagramProps and DiagramState, compilePivotOffset function removed. Constants consolidated: DEFAULT_NODE_SIZE, DEFAULT_GROUP_PADDING, DEFAULT_TITLE_GAP now exported from compiler/diagramLayoutConstants.ts."
  - date: 2026-03-10
    author: "Toolkit Product"
    summary: "Module architecture redesign: the 1,078-line layoutAlgorithms.ts split into a 120-line orchestrator plus four extracted algorithm modules under compiler/layout/ (bounds.ts, flowLayout.ts, gridLayout.ts, hierarchicalLayout.ts). Each algorithm module has its own co-located __tests__/ suite. Updated Goals & Success Metrics, Module Location, and Technical Considerations to reference the new file structure."
---

# BrewSite Diagram — Layout System

## Overview

The layout system in `@brewsite/diagram` resolves world-space positions for `DiagramNode` elements that do not have an explicit `position` prop. It runs entirely at compile time inside `compileDiagram()`, before edge routing and node compilation. Four first-class layout strategies are available as DSL components: `ManualLayout`, `GridLayout`, `HierarchicalLayout`, and `FlowLayout`. An implicit path also exists — when no layout child is declared, the theme's `defaultKind` is used (defaulting to `'grid'`). Layouts cascade from parent `<DiagramGroup>` to child groups, enabling different layout strategies at different nesting levels. Affected package: `@brewsite/diagram`.

## Problem Statement

Complex diagrams contain dozens of nodes. Requiring every node to specify an explicit position is verbose, fragile when nodes are added or removed, and forces consumers to do visual math by hand. Equally, a single layout algorithm does not suit all use cases — flow diagrams want hierarchical depth ordering, infrastructure overviews want grid organization, ordered lists of pipeline stages want sequential placement in declaration order, and precisely authored diagrams need manual control. The layout system solves this by providing four discrete algorithms with clean DSL configuration, a theme-level defaults layer, and a group-cascade model that lets inner groups use different strategies than their container.

## Goals & Success Metrics

**Primary metrics:**
- Consumers can declare a 10-node diagram with no explicit positions and receive a visually correct grid layout with zero manual coordinate work.
- `resolveLayout`, `resolveLayoutWithGroups`, and the four extracted algorithm functions (`resolveFlowLayout`, `resolveGridLayout`, `resolveHierarchicalLayout`, `computeBounds`) achieve 100% test coverage across `layoutAlgorithms.ts`, `layoutResolver.ts`, and the `compiler/layout/` sub-modules.
- Hierarchical layout correctly handles directed cycles without throwing or producing degenerate output.
- Layout cascade correctly propagates from root diagram through arbitrarily nested groups.

**Guardrail metrics:**
- No Three.js import in any layout file (`layoutAlgorithms.ts`, `layoutResolver.ts`, or any module under `compiler/layout/`).
- Explicit node positions are never overwritten by any layout algorithm.
- Ghost nodes (nodes with `positionInherited: true`) are never assigned positions by the layout engine.

## Non-Goals

- The layout system does not provide force-directed or organic spring layout. These require iterative solvers that are incompatible with a pure compile-time pipeline.
- Dynamic layout recomputation at runtime (e.g., when nodes are dragged) is out of scope. All layout is resolved once at compile time.
- Layout animation (positions animating from one layout to another within a single scene) is not provided. Scene-to-scene position interpolation is handled by `functionalDiagramTransitionSpec`, not the layout system.
- The layout system does not produce edge routing. Edge routing is a separate step that runs after layout resolution; see `edgeRouter.ts`.
- The `fill` alignment mode does not attempt to visually balance rows of unequal node sizes; it distributes node centers evenly across the widest-row reference width.

## Consumer Stories

- As a toolkit consumer, I want to declare nodes without positions and have them arranged automatically in a left-to-right grid so that I can add or remove nodes without updating coordinates.
- As a toolkit consumer, I want nodes connected by edges to be arranged in a topological hierarchy so that the diagram's data flow reads naturally top-to-bottom or left-to-right.
- As a toolkit consumer, I want full control over every node position so that I can author precisely composed diagrams that match a design mockup.
- As a toolkit consumer, I want to declare "arrange these items sequentially in the order I wrote them" without providing manual coordinates or adding dummy edges, so that I can author vertical stacks, horizontal rows, and pipeline phase sequences with a single clean primitive.
- As a toolkit consumer, I want groups to use a different layout than the root diagram so that swimlanes can have a vertical grid while the root uses hierarchical ordering.
- As a toolkit consumer, I want to configure spacing, padding, and alignment through the theme so that all diagrams in my scene share consistent visual rhythm without per-diagram configuration.

## Functional Requirements

1. The system shall resolve positions for all non-ghost, non-explicit nodes before edge routing begins.
2. Ghost nodes (nodes with `positionInherited: true`) shall not have positions assigned by the layout engine. Their positions are provided by `DiagramWidget.mergeSnapshot()` from the prior scene.
3. When a non-ghost node lacks a position in `ManualLayout`, the system shall throw with a clear error message naming the affected node IDs.
4. `GridLayout` shall respect each node's `size` prop when computing row and column dimensions.
5. `HierarchicalLayout` shall handle directed cycles gracefully: cyclic edges are treated as non-constraining after initial level assignment via Kahn's algorithm; no exception is thrown.
6. Layout cascade shall support arbitrary group nesting depth without stack overflow (DFS with memoization).
7. Same-kind layout cascade shall merge child props over parent; different-kind child layouts shall replace entirely (no cross-kind inheritance).
8. When no layout child is declared on a `<Diagram>` or `<DiagramGroup>`, the effective layout shall be the resolved default from the theme, falling back to the package-level grid default.
10. The `alignment: 'fill'` option shall distribute node centers evenly across the reference width of the widest row (grid) or widest level (hierarchical), treating single-node rows/levels as centered.
11. `FlowLayout` shall place all items at the current container level in their JSX declaration order along the primary axis, with edge-to-edge gap between adjacent items.
12. `FlowLayout` shall center all items on the secondary (cross) axis at coordinate 0. No secondary-axis alignment prop is provided in v1.
13. `FlowLayout` shall honor explicit `position` props: explicitly positioned nodes are preserved in-place; the placement cursor advances past their footprint so subsequent auto-placed items are correctly spaced.
14. Both `DiagramDSL` and `DiagramGroupDSL` shall carry a `childrenOrder: ReadonlyArray<string>` field populated by the compiler from the interleaved JSX declaration order of child nodes and groups. `FlowLayout` uses this field to determine placement sequence.
15. The theme's `DiagramThemeLayoutConfig.defaultKind` shall accept `'flow'` as a valid value, enabling a theme to default all diagrams to flow layout when no layout child is declared.

## Three Layout Strategies

### 1. `ManualLayout`

All non-ghost nodes must have an explicit `position` prop. The layout resolver assigns no positions; it simply passes through the author-provided coordinates. A compile-time error is thrown if any non-ghost node has no position.

**DSL type (from `types.ts`):**

```typescript
export interface ManualLayoutDSL {
  readonly kind: 'manual';
  /** Padding inside group boundary boxes in diagram units (CSS shorthand). Default: 1.5 */
  readonly groupPadding?: LayoutPadding;
  /** Vertical gap between group title label and content area. Default: 1 */
  readonly titleGap?: number;
}
```

**DSL component (from `dsl.tsx`):**

```typescript
export interface ManualLayoutProps {
  groupPadding?: LayoutPadding;
  titleGap?: number;
}

export function ManualLayout(_props: ManualLayoutProps): null { return null; }
```

**Resolved type (from `layoutResolver.ts`):**

```typescript
export interface ResolvedManualLayout {
  readonly kind: 'manual';
  readonly groupPadding: readonly [number, number, number, number]; // always normalized
  readonly titleGap: number;
}
```

**When to use ManualLayout:**
- Precisely authored diagrams imported from design tools (Lucid, Figma, etc.) where pixel coordinates drive placement.
- Scenes that need a specific spatial narrative — e.g., a network topology arranged to match a physical data center map.
- Any diagram where auto-layout would not match the intended visual meaning.

### 2. `GridLayout`

Nodes are arranged in a left-to-right, top-to-bottom grid. Nodes with explicit positions are preserved in-place and pinned in the layout graph (they act as anchors for hierarchical affinity resolution but are not moved by the algorithm). Nodes without positions are flow-placed in declaration order into rows of `columns` width.

**DSL type (from `types.ts`):**

```typescript
export interface GridLayoutDSL extends BaseLayoutDSL {
  readonly kind: 'grid';
  /**
   * Number of columns, or 'auto' (resolves to 4).
   * Rows expand downward as needed. Default: 'auto'.
   */
  readonly columns?: number | 'auto';
}
```

**`BaseLayoutDSL` shared props (inherited by both `GridLayoutDSL` and `HierarchicalLayoutDSL`):**

```typescript
export interface BaseLayoutDSL {
  /**
   * Gap between adjacent node footprints [colGap, rowGap] in diagram units.
   * This is the gap between expanded footprints (node size + 2×margin). Default: [2, 2]
   */
  readonly spacing?: readonly [number, number];
  /**
   * Per-node breathing room in diagram units. Expands each node's claimed bounding box
   * before spacing is applied.
   * number     → uniform margin on all axes
   * [h, v]     → separate horizontal and vertical margin
   * Default: 0
   */
  readonly margin?: number | readonly [number, number];
  /** Padding inside group boundary boxes in diagram units (CSS shorthand). Default: 1.5 */
  readonly groupPadding?: LayoutPadding;
  /** Gap between group title label and content area. Default: 1 */
  readonly titleGap?: number;
  /**
   * Alignment of nodes within a row.
   * 'left'   — pack left from row start (default for grid)
   * 'center' — center the row relative to the widest row
   * 'right'  — right-align the row
   * 'fill'   — distribute node centers evenly across the widest-row reference width
   */
  readonly alignment?: LayoutAlignment;
  /**
   * Placement policy for nodes with no edges.
   * 'next-to' — disconnected nodes appear inline in declaration order (default)
   * 'after'   — all connected nodes are placed first; disconnected appended after
   */
  readonly disconnected?: LayoutDisconnected;
}
```

**DSL component (from `dsl.tsx`):**

```typescript
export interface GridLayoutProps {
  columns?: number | 'auto';
  spacing?: [number, number];
  margin?: number | [number, number];
  groupPadding?: LayoutPadding;
  titleGap?: number;
  alignment?: LayoutAlignment;
  disconnected?: LayoutDisconnected;
}

export function GridLayout(_props: GridLayoutProps): null { return null; }
```

**Resolved type (from `layoutResolver.ts`):**

```typescript
export interface ResolvedGridLayout extends ResolvedBaseLayout {
  readonly kind: 'grid';
  readonly columns: number | 'auto';  // 'auto' resolves to 4 inside the algorithm
}

// Package-level defaults:
export const DEFAULT_RESOLVED_GRID: ResolvedGridLayout = {
  kind: 'grid',
  columns: 'auto',         // → 4
  spacing: [2, 2],
  margin: [0, 0],
  groupPadding: [1.5, 1.5, 1.5, 1.5],
  titleGap: 1,
  alignment: 'left',
  disconnected: 'next-to',
};
```

**Algorithm detail:**

1. Separate nodes into those with explicit positions (pinned; passed through) and those without (auto-placed).
2. If `disconnected === 'after'`, reorder auto-placed nodes: connected nodes first (in declaration order), then disconnected nodes.
3. Determine effective column count: `columns === 'auto'` → 4; `columns <= 0` → 4.
4. For each node, compute `effectiveSize = [size[0] + 2*margin[0], size[1] + 2*margin[1]]`.
5. Split auto-placed nodes into rows of `columns` length.
6. For each row, compute `rowWidth` (sum of effective widths + spacing between adjacent nodes) and `rowHeight` (max effective height in row).
7. Compute `widestRowWidth` across all rows.
8. Compute `rowCenterY[r]`: row 0 is at y=0; each subsequent row center is offset by `prevRowHeight/2 + spacing[1] + currentRowHeight/2`.
9. For each auto-placed node at `(col, row)`, compute `x` by accumulating effective widths and gaps left-to-right. Apply row alignment offset (`rowOffset`) based on `alignment`:
   - `'left'`: `rowOffset = 0`
   - `'center'`: `rowOffset = (widestRowWidth - rowWidth) / 2`
   - `'right'`: `rowOffset = widestRowWidth - rowWidth`
   - `'fill'`: distribute centers evenly as `x = col * (widestRowWidth / (cols - 1))`; single-node rows are centered.
10. Set `z = node.position?.[2] ?? 0` to preserve any authored z-depth.

### 3. `HierarchicalLayout`

Nodes are arranged using topological ordering on the directed edge graph. Depth level 0 = sources (nodes with no incoming edges). Each level is rendered as a band on the primary axis. Nodes within the same level are aligned on the secondary axis using the `alignment` option.

**DSL type (from `types.ts`):**

```typescript
export interface HierarchicalLayoutDSL extends BaseLayoutDSL {
  readonly kind: 'hierarchical';
  /**
   * Primary layout axis.
   * 'top-down'   — sources at top, sinks below. Y is the primary (depth) axis. Default.
   * 'left-right' — sources at left, sinks to the right. X is the primary axis.
   */
  readonly direction?: 'top-down' | 'left-right';
}
```

**DSL component (from `dsl.tsx`):**

```typescript
export interface HierarchicalLayoutProps {
  direction?: 'top-down' | 'left-right';
  spacing?: [number, number];
  margin?: number | [number, number];
  groupPadding?: LayoutPadding;
  titleGap?: number;
  alignment?: LayoutAlignment;
  disconnected?: LayoutDisconnected;
}

export function HierarchicalLayout(_props: HierarchicalLayoutProps): null { return null; }
```

**Resolved type (from `layoutResolver.ts`):**

```typescript
export interface ResolvedHierarchicalLayout extends ResolvedBaseLayout {
  readonly kind: 'hierarchical';
  readonly direction: 'top-down' | 'left-right';
}

// Package-level defaults:
export const DEFAULT_RESOLVED_HIERARCHICAL: ResolvedHierarchicalLayout = {
  kind: 'hierarchical',
  direction: 'top-down',
  spacing: [1.5, 1.5],    // [within-level gap, between-level gap]
  margin: [0, 0],
  groupPadding: [1.5, 1.5, 1.5, 1.5],
  titleGap: 1,
  alignment: 'center',
  disconnected: 'next-to',
};
```

**Algorithm detail:**

1. Build `inDegree: Map<string, number>` and `adjacency: Map<string, string[]>` from the edge set. Only edges where both endpoints are within the current node set are included (external endpoints are ignored to avoid collapsing levels).
2. Kahn's algorithm: initialize `queue` with all nodes where `inDegree === 0`. BFS processes nodes, incrementally assigning `level[node]` = max level of any predecessor + 1. Unvisited nodes (disconnected or cyclic) default to level 0.
3. If `disconnected === 'after'`, assign disconnected nodes to `maxLevel + 1`.
4. Determine the primary axis: `isPrimary = direction === 'left-right'` (X is primary); otherwise Y is primary.
5. For each level, compute `levelMaxPrimaryHalf` (max half-size of nodes on the primary axis, including margin).
6. Select an `anchorLevel`: the highest level that has at least one explicit-position node at or below the first missing level. If no explicit nodes exist, anchor at level 0 at primary coordinate 0.
7. Compute `levelCenterPrimary[l]` for each level, radiating outward from the anchor using `levelGap = spacing[isPrimary ? 0 : 1]` and `levelMaxPrimaryHalf`.
8. For each level's nodes, compute secondary-axis positions:
   - Compute `totalSecWidth` (sum of node secondary dimensions + gaps between them).
   - Compute `widestLevelWidth` across all levels.
   - Apply `levelAlignOffset` from `alignment`.
   - Place nodes sequentially at `secVal = levelAlignOffset + cumulative secondary position`.
   - `'fill'` distributes centers: `secVal = -widestLevelWidth/2 + index * (widestLevelWidth / (count - 1))`.
9. **Connection affinity refinement** (hierarchical root layout only, not per-group): for ungrouped nodes that connect into a group, the node's secondary-axis position is refined toward the mean secondary position of the group member(s) it connects to, weighted equally across all such connections. This prevents wires from crossing unnecessarily when an outside node connects into the interior of a group.
10. Set `z = node.position?.[2] ?? 0`.

### 4. `FlowLayout`

Nodes and groups at the current container level are placed sequentially along a single axis in their JSX declaration order. Unlike `GridLayout` (which wraps into rows) and `HierarchicalLayout` (which sorts by edge topology), `FlowLayout` is a direct-intent primitive: "lay my items out in the order I wrote them, with this gap between them."

**DSL type (from `types.ts`):**

```typescript
export interface FlowLayoutDSL {
  readonly kind: 'flow';
  /** Primary layout axis. 'top-down' (default) stacks items vertically; 'left-right' stacks them horizontally. */
  readonly direction?: 'top-down' | 'left-right';
  /** Edge-to-edge distance between adjacent item footprints in diagram units. Default: 2 */
  readonly gap?: number;
  /** Padding inside group boundary boxes in diagram units (CSS shorthand). Default: 1.5 */
  readonly groupPadding?: LayoutPadding;
  /** Gap between group title label and content area. Default: 1 */
  readonly titleGap?: number;
}
```

**DSL component (from `dsl.tsx`):**

```typescript
export interface FlowLayoutProps {
  direction?: 'top-down' | 'left-right';
  gap?: number;
  groupPadding?: LayoutPadding;
  titleGap?: number;
}

export function FlowLayout(_props: FlowLayoutProps): null { return null; }
```

**Resolved type (from `layoutResolver.ts`):**

```typescript
export interface ResolvedFlowLayout {
  readonly kind: 'flow';
  readonly direction: 'top-down' | 'left-right';
  readonly gap: number;
  readonly groupPadding: readonly [number, number, number, number]; // always normalized
  readonly titleGap: number;
}

// Package-level defaults:
export const DEFAULT_RESOLVED_FLOW: ResolvedFlowLayout = {
  kind: 'flow',
  direction: 'top-down',
  gap: 2,
  groupPadding: [1.5, 1.5, 1.5, 1.5],
  titleGap: 1,
};
```

Note: `FlowLayout` does **not** extend `BaseLayoutDSL`. It does not have `spacing`, `margin`, `alignment`, or `disconnected` props. Those concepts apply to 2D grid and topological layouts; flow layout reduces to a single `gap` value for edge-to-edge spacing on the primary axis.

**`childrenOrder` field:**

Both `DiagramDSL` and `DiagramGroupDSL` carry a `childrenOrder: ReadonlyArray<string>` field. The compiler populates this from the interleaved JSX declaration order of direct child nodes and groups (in the order they appear in source). This field is always populated — not conditionally on `FlowLayout` being present — because the cost is negligible and it future-proofs the compiled representation.

```typescript
// In DiagramGroupDSL and DiagramDSL:
readonly childrenOrder: ReadonlyArray<string>;
```

**Algorithm detail:**

1. Sort items by `childrenOrder`. Items in `nodes` but absent from `childrenOrder` are appended in node-array order (defensive fallback).
2. Separate items with explicit positions (preserved in-place) from auto-placed items.
3. Iterate in order. Maintain a `cursor` tracking the leading edge on the primary axis.
4. For each item: compute `halfPrimary = primarySize / 2`. If the item has an explicit position, advance `cursor` past its footprint without overwriting its position.
5. For auto-placed items: `centerPrimary = -(cursor + halfPrimary)` (top-down; Y decreases downward). For `left-right`: `centerPrimary = cursor + halfPrimary` (X increases rightward). Set secondary coordinate to `0`. Advance `cursor += primarySize + gap`.
6. `z = node.position?.[2] ?? 0` — Z is always taken from the explicit prop.

**Direction and sign conventions:**
- `'top-down'`: Y is the primary axis, decreasing downward. First item center at `y = -(h/2)`, subsequent items at more-negative Y values — consistent with `GridLayout` and `HierarchicalLayout` top-down conventions.
- `'left-right'`: X is the primary axis, increasing rightward. First item center at `x = w/2`, subsequent items at increasing X values.
- Secondary axis is always `0` (centered).

**When to use FlowLayout:**
- Vertical stacks of pipeline phases, process steps, or bullet-list-style nodes where declaration order is the intended visual order.
- Horizontal sequences of icons or stages where left-to-right reading order matches declaration order.
- Groups acting as swimlane rows or columns where a simple directional arrangement is needed without edge-connectivity analysis.
- Any container where `GridLayout columns={1}` would be a semantic workaround and the intent is "a single ordered line."

## Layout Cascade

Layouts cascade from the root `<Diagram>` element through the group tree. The cascade model has three rules:

**Rule 1 — Absent: inherit.** When a group has no layout child element, it inherits its parent's resolved layout exactly.

**Rule 2 — Same kind: merge.** When a group's layout child has the same `kind` as its parent's resolved layout, the child's specified props win and unspecified props fall through from the parent.

**Rule 3 — Different kind: replace.** When a group's layout child has a different `kind` than its parent's resolved layout, the child's layout is resolved from the kind-specific package defaults. No props are inherited from the parent.

This is implemented in `layoutResolver.ts` via `resolveEffectiveLayout(own, parent, defaults)`:

```typescript
export function resolveEffectiveLayout(
  own: LayoutDSL | undefined,
  parent: ResolvedLayout | undefined,
  defaults: ResolvedLayoutDefaults = BASE_RESOLVED_LAYOUT_DEFAULTS,
): ResolvedLayout {
  const base = parent ?? defaults.root;
  if (!own) return base;                                         // Rule 1: inherit
  if (!parent || own.kind !== parent.kind)
    return applyLayoutDefaultsWithTheme(own, defaults);          // Rule 3: replace
  return mergeResolvedLayouts(base, own);                        // Rule 2: merge
}
```

**Full cascade example:**

```
Root Diagram: <HierarchicalLayout direction="top-down" spacing={[3, 4]} />
│
├── Group A (no layout) → inherits HierarchicalLayout[direction=top-down, spacing=[3,4]]
│
├── Group B: <GridLayout columns={2} /> → DIFFERENT KIND → replaces with GridLayout defaults
│   spacing=[2,2], margin=[0,0], alignment='left', columns=2
│
├── Group C: <HierarchicalLayout spacing={[1.5, 2]} />  → SAME KIND → merges
│   direction=top-down (from root), spacing=[1.5, 2] (overrides root)
│   │
│   └── Group C1 (no layout) → inherits Group C's layout: HierarchicalLayout[spacing=[1.5,2]]
│
└── Group D: <FlowLayout direction="top-down" gap={3} /> → DIFFERENT KIND → replaces with FlowLayout defaults + direction + gap
    direction='top-down', gap=3, groupPadding=[1.5,1.5,1.5,1.5], titleGap=1
```

`resolveGroupLayouts(groups, rootLayout, defaults)` builds the full cascade map in one DFS pass, memoizing each group's resolved layout.

## `LayoutPadding` Type

```typescript
/**
 * CSS-style padding shorthand for group interior padding in diagram units.
 * number                              → all four sides equal
 * [vertical, horizontal]              → top/bottom and left/right
 * [top, horizontal, bottom]           → top, left/right, bottom
 * [top, right, bottom, left]          → each side individually (CSS order)
 */
export type LayoutPadding =
  | number
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number];
```

`normalizeGroupPadding(p: LayoutPadding)` in `layoutResolver.ts` always normalizes to `[top, right, bottom, left]` before storing. This normalization is applied at resolution time so that all downstream code receives a consistent `[number, number, number, number]` tuple.

```typescript
export function normalizeGroupPadding(
  p: LayoutPadding,
): readonly [number, number, number, number] {
  if (typeof p === 'number') return [p, p, p, p];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  if (p.length === 3) return [p[0], p[1], p[2], p[1]];
  return [p[0], p[1], p[2], p[3]];
}
```

## Theme Layout Defaults

`DiagramThemeLayoutConfig` provides layout defaults that are applied when the DSL does not specify a particular field. They are merged at the theme level before any DSL overrides are applied.

```typescript
export interface DiagramThemeLayoutConfig {
  /**
   * Root layout kind used when no layout child is declared on <Diagram>.
   * Default: 'grid'.
   */
  readonly defaultKind?: 'grid' | 'hierarchical' | 'manual' | 'flow';
  /** Defaults applied when resolving a grid layout. */
  readonly grid?: {
    readonly columns?: number | 'auto';
    readonly spacing?: readonly [number, number];
    readonly margin?: number | readonly [number, number];
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
    readonly alignment?: LayoutAlignment;
    readonly disconnected?: LayoutDisconnected;
  };
  /** Defaults applied when resolving a hierarchical layout. */
  readonly hierarchical?: {
    readonly direction?: 'top-down' | 'left-right';
    readonly spacing?: readonly [number, number];
    readonly margin?: number | readonly [number, number];
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
    readonly alignment?: LayoutAlignment;
    readonly disconnected?: LayoutDisconnected;
  };
  /** Defaults applied when resolving a manual layout. */
  readonly manual?: {
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
  };
  /** Defaults applied when resolving a flow layout. */
  readonly flow?: {
    readonly direction?: 'top-down' | 'left-right';
    readonly gap?: number;
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
  };
}
```

`resolveThemeLayoutDefaults(themeLayout?)` merges the theme's preferences over package-level constants, producing a `ResolvedLayoutDefaults` struct:

```typescript
export interface ResolvedLayoutDefaults {
  readonly root: ResolvedLayout;         // kind determined by defaultKind
  readonly grid: ResolvedGridLayout;
  readonly hierarchical: ResolvedHierarchicalLayout;
  readonly manual: ResolvedManualLayout;
  readonly flow: ResolvedFlowLayout;
}
```

This struct is threaded through the entire layout resolution call chain so that all theme preferences propagate correctly to nested groups even when those groups' own layout kind differs from the root.

## Z-Axis and Depth Layering

`position[2]` (the Z component) is a first-class layout dimension. It is never assigned by the auto-layout algorithms; it is always taken from the node's explicit `position[2]` prop (defaulting to 0 if absent). Nodes at different Z depths create depth layering when viewed from a non-orthographic camera:

- `z = 0`: base plane
- `z > 0`: closer to the camera (pulled forward)
- `z < 0`: farther from the camera (recessed)

Edge routing in `edgeRouter.ts` accounts for Z differences between source and destination nodes when computing 3D control points, ensuring edges route smoothly through 3D space rather than lying flat on z=0.

Node rendering order is sorted by Z ascending (`sort((a, b) => a.position[2] - b.position[2])`) so that painter's algorithm renders back nodes before front nodes, giving correct depth sorting for transparent nodes.

## Group-Aware Layout: `resolveLayoutWithGroups`

When a diagram has groups, the simple `resolveLayout` function is insufficient — groups must be treated as atomic layout blocks in the parent graph. `resolveLayoutWithGroups` implements a bottom-up multi-pass algorithm:

**Phase 1 — Topological sort of groups.** Groups are sorted leaves-first (innermost groups processed before their parents) using DFS post-order on the `childGroupIds` tree.

**Phase 2 — Per-group layout (bottom-up).** For each group in topological order:
- If all descendant nodes have explicit positions (`allExplicit = true`): skip the layout pass; use the absolute positions directly, computing `absoluteCenter` for parent reference.
- Otherwise: build virtual layout inputs — direct member nodes plus synthetic `__group__::<id>` block nodes sized to each child group's padded bounds. Run `resolveLayout` with the group's resolved layout. Expand synthetic block positions back to descendant node positions by translating child group's `localPositions` by the synthetic block's position.
- Normalize all positions so this group's content center is at `[0, 0, 0]`. Store `GroupInfo { allDescendantNodeIds, localPositions, size, allExplicit, absoluteCenter }`.

**Phase 3 — Top-level layout.** Build top-level layout inputs: synthetic blocks for each top-level group + all ungrouped nodes. Edges are remapped: any endpoint that is a descendant of a group is replaced with that group's synthetic block id (`resolveTopLevelEndpoint`). Run `resolveLayout` with `rootLayout`.

**Phase 4 — Connection affinity refinement** (hierarchical root only). For ungrouped nodes that connect directly into a group member, refine the ungrouped node's secondary-axis position toward the mean secondary coordinate of the group members it connects to. This improves visual clarity by aligning a connecting node with the specific member it reaches inside the group, reducing edge crossings.

**Phase 5 — Combine.** Translate each top-level group's `localPositions` by the group's top-level position. Preserve explicit positions for ungrouped nodes. Place remaining ungrouped auto-layout nodes from top-level positions.

## Authoring Examples

### Example 1: `ManualLayout` — Precise Positioning

```tsx
<Diagram id="pipeline">
  <ManualLayout />
  <DiagramNode id="cdn" label="CDN" position={[-8, 0, 0]} />
  <DiagramNode id="lb" label="Load Balancer" position={[-2, 0, 0]} />
  <DiagramNode id="app-a" label="App Server A" position={[4, 2, 0]} />
  <DiagramNode id="app-b" label="App Server B" position={[4, -2, 0]} />
  <DiagramEdge from="cdn" to="lb" arrowEnd="filled" />
  <DiagramEdge from="lb" to="app-a" arrowEnd="open" />
  <DiagramEdge from="lb" to="app-b" arrowEnd="open" />
</Diagram>
```

### Example 2: `GridLayout` — Auto-Arranged Services

Six services arranged in a 3-column grid with center alignment. No positions needed.

```tsx
<Diagram id="services">
  <GridLayout columns={3} spacing={[2.5, 2]} alignment="center" groupPadding={2} />
  <DiagramNode id="auth" label="Auth" icon="aws:cognito" />
  <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" />
  <DiagramNode id="lambda" label="Functions" icon="aws:lambda" />
  <DiagramNode id="dynamo" label="DynamoDB" icon="aws:dynamodb" />
  <DiagramNode id="s3" label="Storage" icon="aws:s3" />
  <DiagramNode id="cf" label="CloudFront" icon="aws:cloudfront" />
</Diagram>
```

### Example 3: `HierarchicalLayout` — Dependency Graph

A pipeline with dependencies. The layout places sources at the top and sinks at the bottom.

```tsx
<Diagram id="deploy-pipeline">
  <HierarchicalLayout direction="top-down" spacing={[2.5, 3.5]} alignment="center" />
  <DiagramNode id="code" label="Code Commit" icon="tech:git" />
  <DiagramNode id="build" label="Build" icon="tech:docker" />
  <DiagramNode id="test-unit" label="Unit Tests" />
  <DiagramNode id="test-int" label="Integration Tests" />
  <DiagramNode id="scan" label="Security Scan" />
  <DiagramNode id="staging" label="Staging Deploy" icon="aws:ecs" />
  <DiagramNode id="prod" label="Prod Deploy" icon="aws:ecs" />
  <DiagramEdge from="code" to="build" arrowEnd="filled" />
  <DiagramEdge from="build" to="test-unit" />
  <DiagramEdge from="build" to="test-int" />
  <DiagramEdge from="build" to="scan" />
  <DiagramEdge from="test-unit" to="staging" />
  <DiagramEdge from="test-int" to="staging" />
  <DiagramEdge from="scan" to="staging" />
  <DiagramEdge from="staging" to="prod" arrowEnd="filled" />
</Diagram>
```

### Example 4: Layout Cascade — Mixed Strategy

The root diagram uses hierarchical layout. The inner `backend` group uses grid layout (different kind → replaces). The inner `edge-services` group uses hierarchical layout with custom spacing (same kind → merges, narrowing spacing from root's [2, 3] to [1.5, 2.5]).

```tsx
<Diagram id="full-stack">
  <HierarchicalLayout direction="top-down" spacing={[2, 3]} alignment="center" />

  <DiagramGroup id="frontend" label="Frontend" variant="boundary">
    {/* No layout: inherits top-down hierarchical from root */}
    <DiagramNode id="browser" label="Browser" />
    <DiagramNode id="cdn" label="CDN" />
    <DiagramEdge from="browser" to="cdn" />
  </DiagramGroup>

  <DiagramGroup id="backend" label="Backend Services" variant="boundary">
    {/* Different kind: replaces with grid defaults + columns=2 */}
    <GridLayout columns={2} spacing={[2, 1.5]} />
    <DiagramNode id="api" label="API" icon="aws:api-gateway" />
    <DiagramNode id="auth" label="Auth" icon="aws:cognito" />
    <DiagramNode id="worker" label="Worker" icon="aws:lambda" />
    <DiagramNode id="db" label="Database" icon="aws:rds" />
  </DiagramGroup>

  <DiagramGroup id="edge-services" label="Edge" variant="cluster">
    {/* Same kind: merges spacing override; inherits direction=top-down from root */}
    <HierarchicalLayout spacing={[1.5, 2.5]} />
    <DiagramNode id="waf" label="WAF" />
    <DiagramNode id="shield" label="Shield" />
    <DiagramEdge from="waf" to="shield" />
  </DiagramGroup>

  <DiagramEdge from="frontend" to="backend" />
  <DiagramEdge from="edge-services" to="frontend" />
</Diagram>
```

### Example 5: `FlowLayout` — Sequential Pipeline

A root diagram uses FlowLayout top-down. The inner `processing` group uses GridLayout for its three nodes (different kind → replaces). FlowLayout places the root-level items in declaration order: `input` → `processing` group block → `output`.

```tsx
<Diagram id="pipeline">
  <FlowLayout direction="top-down" gap={2} />
  <DiagramNode id="input" label="Input" icon="tech:arrow-down" />
  <DiagramGroup id="processing" label="Processing">
    <GridLayout columns={3} spacing={[2, 1.5]} />
    <DiagramNode id="p1" label="Step 1" />
    <DiagramNode id="p2" label="Step 2" />
    <DiagramNode id="p3" label="Step 3" />
  </DiagramGroup>
  <DiagramNode id="output" label="Output" icon="tech:arrow-down" />
</Diagram>
```

Result: `input` is placed at the top; the `processing` group occupies the next slot (its internal `[p1, p2, p3]` are arranged in a 3-column grid); `output` is placed below the group. All three root-level items are center-aligned on the X axis (`x = 0`).

### Example 6: `FlowLayout` Left-Right — Horizontal Stage Row

```tsx
<Diagram id="stages">
  <FlowLayout direction="left-right" gap={3} />
  <DiagramNode id="plan" label="Plan" />
  <DiagramNode id="build" label="Build" />
  <DiagramNode id="test" label="Test" />
  <DiagramNode id="deploy" label="Deploy" />
</Diagram>
```

Result: four nodes arranged left to right in declaration order with 3-unit edge-to-edge gaps between them. All center-aligned on the Y axis (`y = 0`).

### Example 7: Theme-Level Layout Defaults

Configure the enterprise theme to default to hierarchical layout for all diagrams that do not declare a layout child.

```typescript
import { enterpriseTheme } from '@brewsite/diagram';
import type { DiagramTheme } from '@brewsite/diagram';

const customEnterprise: DiagramTheme = {
  ...enterpriseTheme,
  layout: {
    defaultKind: 'hierarchical',
    hierarchical: {
      direction: 'left-right',
      spacing: [3, 2.5],
      alignment: 'center',
    },
    manual: {
      groupPadding: 2,
      titleGap: 1,
    },
  },
};

// Any <Diagram theme={customEnterprise}> with no layout child
// will use left-right hierarchical layout automatically.
```

## Technical Considerations

- **Algorithm implementations live in `compiler/layout/`.** The 1,078-line `layoutAlgorithms.ts` has been refactored into a 120-line orchestrator that delegates to four extracted modules: `compiler/layout/bounds.ts` (`computeBounds`), `compiler/layout/flowLayout.ts` (`resolveFlowLayout`), `compiler/layout/gridLayout.ts` (`resolveGridLayout`), `compiler/layout/hierarchicalLayout.ts` (`resolveHierarchicalLayout`). Each module has its own co-located `__tests__/` suite. The `compiler/layout/index.ts` barrel re-exports these four functions but intentionally does not re-export from `layoutAlgorithms.ts` to avoid a circular dependency (`layoutAlgorithms.ts` imports from `layout/index.ts`).
- **`resolveLayoutWithGroups` is the primary entry point.** Direct use of `resolveLayout` is appropriate only when no groups are present, or in unit tests for the flat layout algorithms.
- **Explicit positions are always preserved.** `resolveLayout` only populates positions for nodes absent from the positions map at the start of the call. It never overwrites an existing entry.
- **Synthetic `__group__::id` nodes are internal.** They appear in the positions map during the group-aware layout pass but are filtered out before the final positions map is returned. Consumers never see these IDs.
- **`childrenOrder` is always populated.** The compiler handler populates `childrenOrder` on both `DiagramDSL` and `DiagramGroupDSL` regardless of which layout kind is active. `resolveLayout` accepts `childrenOrder` as an optional parameter and passes it to `resolveFlowLayout` when `kind === 'flow'`.
- **`FlowLayout` does not participate in connection affinity refinement.** The affinity refinement step (Phase 4 of `resolveLayoutWithGroups`) applies only to hierarchical root layouts. FlowLayout items are placed in declaration order; edge topology is not consulted.
- **Group bounds include padding.** `resolveGroupBoundsMap` (called after `resolveLayoutWithGroups`) computes the padded bounding box for each group. The resulting `DiagramGroupState.bounds` includes the padding; the `bounds.padding` field stores the resolved `[top, right, bottom, left]` values for renderer reference.
- **Thread safety.** All layout functions are pure and stateless. They may be called from any thread in a worker-based build pipeline.
- **Performance.** For diagrams with O(n) nodes and O(m) edges, layout resolution is O(n + m). The topological sort is Kahn's algorithm at O(n + m). Group-aware layout adds a constant factor per nesting level. No layout algorithm is quadratic or worse.

## Breaking Change Assessment

Semver impact: **none** (documentation of implemented behavior).

## Dependencies

- `packages/diagram/src/elements/diagram/types.ts` — `LayoutDSL`, `LayoutPadding`, `LayoutAlignment`, `LayoutDisconnected`, `DiagramThemeLayoutConfig`, `BaseLayoutDSL`, `GridLayoutDSL`, `HierarchicalLayoutDSL`, `ManualLayoutDSL`, `FlowLayoutDSL`
- `packages/diagram/src/elements/diagram/dsl.tsx` — `FlowLayout`, `FlowLayoutProps`
- `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts` — `resolveLayout`, `resolveLayoutWithGroups` (orchestrator; delegates algorithm implementations to `compiler/layout/`)
- `packages/diagram/src/elements/diagram/compiler/layout/` — `computeBounds` (`bounds.ts`), `resolveFlowLayout` (`flowLayout.ts`), `resolveGridLayout` (`gridLayout.ts`), `resolveHierarchicalLayout` (`hierarchicalLayout.ts`)
- `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts` — `resolveEffectiveLayout`, `resolveGroupLayouts`, `resolveThemeLayoutDefaults`, all resolved types and defaults including `ResolvedFlowLayout`, `DEFAULT_RESOLVED_FLOW`
- `packages/diagram/src/compiler/handlers.ts` — `childrenOrder` population in `extractDiagramDSL` and `collectGroup`

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Layout cascade producing unexpected results in deeply nested groups | Extensive unit tests cover 3-level nesting with all three kind combinations; results are asserted against hand-computed expected positions |
| Hierarchical layout cycles producing degenerate output (all nodes at level 0) | Kahn's algorithm degrades to level 0 for cyclic participants; documented behavior, not a throw; tested with explicit cyclic fixture |
| `'fill'` alignment producing overlapping nodes when rows contain very wide nodes | By design: `fill` distributes centers, not edges; consumers should use `'left'` or `'center'` when node sizes vary significantly |
| Performance regression from group-aware bottom-up pass on large diagrams | O(n + m) complexity; `collectAllDescendantNodeIds` is memoized; benchmarked for 100-node, 10-group diagrams |
| `FlowLayout` `childrenOrder` mismatch when items are present in `nodes` but absent from `childrenOrder` | Defensive fallback in `resolveFlowLayout` appends missing IDs in node-array order; logged at warn level so authors can identify stale compiled data |
| Confusion between `FlowLayout gap` and `GridLayout spacing` semantics | `gap` is edge-to-edge (simpler); `spacing` is footprint-to-footprint after margin expansion. Documented clearly; the different field names make them non-substitutable at the type level |

## Open Questions

None at this time. This document reflects the current implemented layout system.

## Launch Criteria

This is a documentation PRD for an implemented system. The criteria for keeping it current are:

- Updated within one sprint of any change to `layoutAlgorithms.ts`, the `compiler/layout/` modules, `layoutResolver.ts`, `types.ts` layout interfaces, or any DSL layout component props.
- All DSL types and resolved types referenced in this document remain in sync with the source of truth in `packages/diagram/src/elements/diagram/`.
- Authoring examples compile without TypeScript errors against the current package.
- `resolveLayout`, `resolveLayoutWithGroups`, and the four extracted algorithm functions (`resolveFlowLayout`, `resolveGridLayout`, `resolveHierarchicalLayout`, `computeBounds`) maintain >= 95% branch coverage in Vitest.
