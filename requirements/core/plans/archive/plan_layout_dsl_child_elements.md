---
title: "Layout as Child DSL Elements"
doc_type: plan
owner: architect
status: complete
updated: 2026-02-28
---

# Plan: Layout as Child DSL Elements

## Summary

Replace flat `layout` / `layoutSpacing` props on `<Diagram>` and `<DiagramGroup>` with dedicated child DSL element nodes: `<GridLayout>`, `<HierarchicalLayout>`, and `<ManualLayout>`. Layout configuration cascades through the ancestor tree using overlay semantics. This plan adds margin, alignment, directional hierarchical layout, disconnected-node placement control, connection affinity for hierarchical layouts, and configurable group padding.

This is a **breaking change** at the DSL authoring surface. All internal compilation and algorithm logic changes are backward-compatible in behavior (existing defaults are preserved).

---

## Design Decisions (locked)

| Question | Decision |
|---|---|
| Cascade chain | Full chain — Diagram → Group → SubGroup → … |
| DiagramCanvas layout | Not modified — canvas has no layout algorithm |
| Manual layout | Explicit `<ManualLayout />` DSL element |
| Grid columns param | `columns?: number \| 'auto'` — rows flow as needed |
| Margin vs spacing | CSS box model: margin expands each node's footprint; spacing is gap between footprints |
| Alignment fill reference | Widest row/level is the reference for all rows/levels |
| Disconnected default | `'next-to'` (declaration-order interleaving) |
| Overlay semantics | Same kind → merge (child props win, `undefined` falls through to parent). Different kind → use child only with its own defaults. |
| Connection affinity | Always-on in hierarchical; implemented as a post-processing refinement pass |

---

## Files Changed

### Modified
1. `packages/diagram/src/elements/diagram/types.ts`
2. `packages/diagram/src/elements/diagram/dsl.tsx`
3. `packages/diagram/src/compiler/handlers.ts`
4. `packages/diagram/src/elements/diagram/compile.ts`
5. `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`
6. `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts`
7. `packages/diagram/src/elements/diagram/compiler/groupConstants.ts`
8. `packages/diagram/src/elements/diagram/compiler/__tests__/layoutAlgorithms.test.ts`
9. `apps/examples/lucid/scenes/scene_llm_filter.tsx` (migration)

### New
10. `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts`

---

## Phase 1 — `types.ts`: New Layout Type System

Add the following types **before** the `DiagramNodeDSL` section, after the existing `DiagramPivot` / `DiagramEasing` types.

### 1.1 New types to add

```ts
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

/**
 * Alignment of nodes within a grid row or hierarchical level.
 * 'left'   — pack left (grid default)
 * 'center' — pack and center (hierarchical default)
 * 'right'  — pack right
 * 'fill'   — distribute nodes evenly across the widest-row reference width
 */
export type LayoutAlignment = 'left' | 'center' | 'right' | 'fill';

/**
 * Placement policy for nodes with no incoming or outgoing edges.
 * 'next-to' — maintain declaration order; disconnected nodes appear inline
 *             with connected nodes at their declaration position (default)
 * 'after'   — all connected nodes positioned first; disconnected appended after
 */
export type LayoutDisconnected = 'next-to' | 'after';

/**
 * Properties shared by GridLayoutDSL and HierarchicalLayoutDSL.
 * All fields optional in DSL; resolved defaults are applied by layoutResolver.ts.
 */
export interface BaseLayoutDSL {
  /**
   * Gap between adjacent node footprints [colGap, rowGap] in diagram units.
   * CSS box model: spacing is the gap between expanded footprints (see margin).
   * Default: [2, 2]
   */
  readonly spacing?: readonly [number, number];
  /**
   * Per-node breathing room in diagram units.
   * Expands each node's claimed bounding box before spacing is applied.
   * number     → uniform margin on all axes
   * [h, v]     → separate horizontal (x) and vertical (y) margin
   * Default: 0
   */
  readonly margin?: number | readonly [number, number];
  /**
   * Padding inside the group boundary box in diagram units (CSS shorthand).
   * Replaces the hardcoded GROUP_PADDING = 1.5 constant per group.
   * Default: 1.5 (all sides)
   */
  readonly groupPadding?: LayoutPadding;
  /**
   * Vertical gap in diagram units between the group title label
   * and the top of the group's content area.
   * Default: 0.5
   */
  readonly titleGap?: number;
  /**
   * Alignment of nodes within a grid row or hierarchical level.
   * Default: 'left' for grid, 'center' for hierarchical.
   */
  readonly alignment?: LayoutAlignment;
  /**
   * Placement policy for nodes with no edges.
   * Default: 'next-to'
   */
  readonly disconnected?: LayoutDisconnected;
}

/**
 * DSL props for <GridLayout>.
 * The `kind: 'grid'` discriminant is implicit from the component type;
 * authors do not specify `kind` directly.
 */
export interface GridLayoutDSL extends BaseLayoutDSL {
  readonly kind: 'grid';
  /**
   * Number of columns, or 'auto' to use the default (currently 4).
   * Rows expand as needed. Default: 'auto'
   */
  readonly columns?: number | 'auto';
}

/**
 * DSL props for <HierarchicalLayout>.
 * The `kind: 'hierarchical'` discriminant is implicit from the component type.
 */
export interface HierarchicalLayoutDSL extends BaseLayoutDSL {
  readonly kind: 'hierarchical';
  /**
   * Primary layout axis.
   * 'top-down'   — roots at top, leaves below (default)
   * 'left-right' — roots at left, leaves to the right
   */
  readonly direction?: 'top-down' | 'left-right';
}

/**
 * DSL props for <ManualLayout>.
 * All non-ghost nodes must have explicit positions; a compile-time error is
 * thrown for any labeled node that lacks a position.
 * Spacing/margin/alignment props are inapplicable and intentionally absent.
 */
export interface ManualLayoutDSL {
  readonly kind: 'manual';
  /** Padding inside group boundary boxes. Default: 1.5 */
  readonly groupPadding?: LayoutPadding;
  /** Gap between group title label and content area. Default: 0.5 */
  readonly titleGap?: number;
}

/** Discriminated union of all layout DSL types. */
export type LayoutDSL = GridLayoutDSL | HierarchicalLayoutDSL | ManualLayoutDSL;
```

### 1.2 Update `DiagramDSL`

Remove:
```ts
readonly layout: 'manual' | 'grid' | 'hierarchical';
readonly layoutSpacing: readonly [number, number];
```

Add (replace with):
```ts
/**
 * Layout configuration extracted from a <GridLayout>, <HierarchicalLayout>,
 * or <ManualLayout> child element, if present.
 * Absent = default grid layout (columns: 'auto', spacing: [2,2]).
 */
readonly layout?: LayoutDSL;
```

### 1.3 Update `DiagramGroupDSL`

Remove:
```ts
readonly layout?: 'grid' | 'hierarchical';
readonly layoutSpacing?: readonly [number, number];
```

Add (replace with):
```ts
/**
 * Layout configuration extracted from a layout child element of this group.
 * Cascades from parent: same-kind merges, different-kind replaces, absent inherits.
 */
readonly layout?: LayoutDSL;
```

### 1.4 Update `DiagramGroupState.bounds`

Change `padding: number` to `padding: readonly [number, number, number, number]` and add `titleGap`:

```ts
readonly bounds: {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /**
   * Resolved group padding [top, right, bottom, left] in diagram units.
   * The bounds x/y/w/h already incorporate this padding.
   * Stored for informational use by renderers.
   */
  readonly padding: readonly [number, number, number, number];
  /**
   * Gap between group title label and content area in diagram units.
   * Used by GroupRenderer to offset the title text.
   */
  readonly titleGap: number;
};
```

---

## Phase 2 — `dsl.tsx`: New Layout DSL Components

### 2.1 Add imports

In the imports section of `dsl.tsx`, add:
```ts
import type {
  LayoutAlignment,
  LayoutDisconnected,
  LayoutPadding,
} from './types';
```

### 2.2 New component props and functions

Add before the `<Diagram>` section:

```ts
// ─── <GridLayout> ─────────────────────────────────────────────────────────────

export interface GridLayoutProps {
  /** Number of grid columns, or 'auto' (default 4). Rows expand as needed. */
  columns?: number | 'auto';
  /** Gap between node footprints [colGap, rowGap]. Default: [2, 2] */
  spacing?: [number, number];
  /** Per-node margin [h, v] expanding each node's footprint. Default: 0 */
  margin?: number | [number, number];
  /** Padding inside group boundary boxes. Default: 1.5 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content. Default: 0.5 */
  titleGap?: number;
  /** Row alignment. Default: 'left' */
  alignment?: LayoutAlignment;
  /** Disconnected node placement. Default: 'next-to' */
  disconnected?: LayoutDisconnected;
}

/**
 * Declares a grid auto-layout for the parent <Diagram> or <DiagramGroup>.
 * Must be a direct child of <Diagram> or <DiagramGroup>. At most one layout
 * element per container. Cascades with parent layouts of the same kind.
 */
export function GridLayout(_props: GridLayoutProps): null {
  return null;
}

// ─── <HierarchicalLayout> ─────────────────────────────────────────────────────

export interface HierarchicalLayoutProps {
  /** Layout axis direction. Default: 'top-down' */
  direction?: 'top-down' | 'left-right';
  /** Gap between node footprints [colGap, rowGap]. Default: [2, 2] */
  spacing?: [number, number];
  /** Per-node margin [h, v] expanding each node's footprint. Default: 0 */
  margin?: number | [number, number];
  /** Padding inside group boundary boxes. Default: 1.5 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content. Default: 0.5 */
  titleGap?: number;
  /** Level alignment. Default: 'center' */
  alignment?: LayoutAlignment;
  /** Disconnected node placement. Default: 'next-to' */
  disconnected?: LayoutDisconnected;
}

/**
 * Declares a topological (edge-driven) auto-layout for the parent
 * <Diagram> or <DiagramGroup>. Must be a direct child of either container.
 * At most one layout element per container. Cascades with parent layouts
 * of the same kind.
 */
export function HierarchicalLayout(_props: HierarchicalLayoutProps): null {
  return null;
}

// ─── <ManualLayout> ───────────────────────────────────────────────────────────

export interface ManualLayoutProps {
  /** Padding inside group boundary boxes. Default: 1.5 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content. Default: 0.5 */
  titleGap?: number;
}

/**
 * Declares that all node positions are manually specified.
 * Non-ghost nodes (those with a label) that lack an explicit position
 * will throw a compile-time error.
 */
export function ManualLayout(_props: ManualLayoutProps): null {
  return null;
}
```

### 2.3 Remove from `DiagramProps`

Remove `layout` and `layoutSpacing` fields from `DiagramProps`:
```ts
// DELETE these two fields:
layout?: 'manual' | 'grid' | 'hierarchical';
layoutSpacing?: [number, number];
```

### 2.4 Remove from `DiagramGroupProps`

Remove `layout` and `layoutSpacing` fields from `DiagramGroupProps`:
```ts
// DELETE these two fields:
layout?: 'grid' | 'hierarchical';
layoutSpacing?: [number, number];
```

---

## Phase 3 — New File: `compiler/layoutResolver.ts`

Create `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts`.

This file owns: the fully-resolved layout types (no optional fields), default values, normalization helpers, and the cascade algorithm. It has no imports from Three.js, React, or any sibling compiler file. It only imports from `../types`.

### 3.1 Fully resolved types

```ts
// Resolved layout types — all fields required (no optionals).
// Produced by resolveEffectiveLayout(); consumed by layout algorithms.

export interface ResolvedBaseLayout {
  readonly spacing: readonly [number, number];
  readonly margin: readonly [number, number]; // normalized from number|[h,v]
  readonly groupPadding: readonly [number, number, number, number]; // [top,right,bottom,left]
  readonly titleGap: number;
  readonly alignment: 'left' | 'center' | 'right' | 'fill';
  readonly disconnected: 'next-to' | 'after';
}

export interface ResolvedGridLayout extends ResolvedBaseLayout {
  readonly kind: 'grid';
  readonly columns: number | 'auto';
}

export interface ResolvedHierarchicalLayout extends ResolvedBaseLayout {
  readonly kind: 'hierarchical';
  readonly direction: 'top-down' | 'left-right';
}

export interface ResolvedManualLayout {
  readonly kind: 'manual';
  readonly groupPadding: readonly [number, number, number, number];
  readonly titleGap: number;
}

export type ResolvedLayout = ResolvedGridLayout | ResolvedHierarchicalLayout | ResolvedManualLayout;
```

### 3.2 Normalization helpers

```ts
/**
 * Normalizes LayoutPadding to [top, right, bottom, left] tuple.
 * Follows CSS shorthand semantics:
 *   number        → [n, n, n, n]
 *   [v, h]        → [v, h, v, h]
 *   [t, h, b]     → [t, h, b, h]
 *   [t, r, b, l]  → [t, r, b, l]
 */
export function normalizeGroupPadding(
  p: LayoutPadding,
): readonly [number, number, number, number] {
  if (typeof p === 'number') return [p, p, p, p];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  if (p.length === 3) return [p[0], p[1], p[2], p[1]];
  return [p[0], p[1], p[2], p[3]];
}

/**
 * Normalizes margin to [horizontal, vertical] tuple.
 * number    → [n, n]
 * [h, v]    → [h, v]
 */
export function normalizeMargin(
  m: number | readonly [number, number],
): readonly [number, number] {
  return typeof m === 'number' ? [m, m] : [m[0], m[1]];
}
```

### 3.3 Default values

```ts
const DEFAULT_GROUP_PADDING_NORMALIZED: readonly [number, number, number, number] = [1.5, 1.5, 1.5, 1.5];
const DEFAULT_TITLE_GAP = 0.5;
const DEFAULT_SPACING: readonly [number, number] = [2, 2];
const DEFAULT_MARGIN: readonly [number, number] = [0, 0];

export const DEFAULT_RESOLVED_GRID: ResolvedGridLayout = {
  kind: 'grid',
  columns: 'auto',
  spacing: DEFAULT_SPACING,
  margin: DEFAULT_MARGIN,
  groupPadding: DEFAULT_GROUP_PADDING_NORMALIZED,
  titleGap: DEFAULT_TITLE_GAP,
  alignment: 'left',
  disconnected: 'next-to',
};

export const DEFAULT_RESOLVED_HIERARCHICAL: ResolvedHierarchicalLayout = {
  kind: 'hierarchical',
  direction: 'top-down',
  spacing: DEFAULT_SPACING,
  margin: DEFAULT_MARGIN,
  groupPadding: DEFAULT_GROUP_PADDING_NORMALIZED,
  titleGap: DEFAULT_TITLE_GAP,
  alignment: 'center',
  disconnected: 'next-to',
};

export const DEFAULT_RESOLVED_MANUAL: ResolvedManualLayout = {
  kind: 'manual',
  groupPadding: DEFAULT_GROUP_PADDING_NORMALIZED,
  titleGap: DEFAULT_TITLE_GAP,
};
```

### 3.4 Cascade functions

```ts
import type { LayoutDSL, LayoutPadding } from '../types';

/**
 * Applies LayoutDSL props over a kind-specific default, producing a ResolvedLayout.
 * Used when no parent exists or when the parent is a different kind.
 */
export function applyLayoutDefaults(own: LayoutDSL): ResolvedLayout {
  if (own.kind === 'manual') {
    return {
      kind: 'manual',
      groupPadding: own.groupPadding !== undefined
        ? normalizeGroupPadding(own.groupPadding)
        : DEFAULT_GROUP_PADDING_NORMALIZED,
      titleGap: own.titleGap ?? DEFAULT_TITLE_GAP,
    };
  }
  const base = own.kind === 'grid' ? DEFAULT_RESOLVED_GRID : DEFAULT_RESOLVED_HIERARCHICAL;
  return {
    ...base,
    ...(own.spacing !== undefined && { spacing: own.spacing }),
    ...(own.margin !== undefined && { margin: normalizeMargin(own.margin) }),
    ...(own.groupPadding !== undefined && { groupPadding: normalizeGroupPadding(own.groupPadding) }),
    ...(own.titleGap !== undefined && { titleGap: own.titleGap }),
    ...(own.alignment !== undefined && { alignment: own.alignment }),
    ...(own.disconnected !== undefined && { disconnected: own.disconnected }),
    // kind-specific fields:
    ...(own.kind === 'grid' && own.columns !== undefined && { columns: own.columns }),
    ...(own.kind === 'hierarchical' && own.direction !== undefined && { direction: own.direction }),
  } as ResolvedLayout;
}

/**
 * Merges a same-kind child LayoutDSL onto a resolved parent.
 * Child props win over parent; undefined props fall through to parent.
 * Only called when own.kind === parent.kind.
 */
export function mergeResolvedLayouts(
  parent: ResolvedLayout,
  child: LayoutDSL,
): ResolvedLayout {
  // parent and child have same kind — spread parent, override with child non-undefined props
  const result = { ...parent } as Record<string, unknown>;
  if (child.kind === 'manual') {
    if (child.groupPadding !== undefined) result['groupPadding'] = normalizeGroupPadding(child.groupPadding);
    if (child.titleGap !== undefined) result['titleGap'] = child.titleGap;
    return result as ResolvedLayout;
  }
  if (child.spacing !== undefined) result['spacing'] = child.spacing;
  if (child.margin !== undefined) result['margin'] = normalizeMargin(child.margin);
  if (child.groupPadding !== undefined) result['groupPadding'] = normalizeGroupPadding(child.groupPadding);
  if (child.titleGap !== undefined) result['titleGap'] = child.titleGap;
  if (child.alignment !== undefined) result['alignment'] = child.alignment;
  if (child.disconnected !== undefined) result['disconnected'] = child.disconnected;
  if (child.kind === 'grid' && child.columns !== undefined) result['columns'] = child.columns;
  if (child.kind === 'hierarchical' && child.direction !== undefined) result['direction'] = child.direction;
  return result as ResolvedLayout;
}

/**
 * Resolves the effective layout for a single node in the cascade chain.
 *
 * Rules:
 *   own absent           → inherit parent as-is (or default grid if no parent)
 *   own.kind !== parent  → apply own over kind-specific defaults (no inheritance)
 *   own.kind === parent  → merge: parent provides defaults, own overrides specified props
 */
export function resolveEffectiveLayout(
  own: LayoutDSL | undefined,
  parent: ResolvedLayout | undefined,
): ResolvedLayout {
  const base = parent ?? DEFAULT_RESOLVED_GRID;
  if (!own) return base;
  if (!parent || own.kind !== parent.kind) return applyLayoutDefaults(own);
  return mergeResolvedLayouts(base, own);
}

/**
 * Builds a map of groupId → ResolvedLayout for every group in the tree,
 * cascading from the root diagram layout through the parent chain.
 *
 * Groups with no parentId cascade directly from rootLayout.
 * Nested groups cascade from their parent group's resolved layout.
 */
export function resolveGroupLayouts(
  groups: ReadonlyArray<{ id: string; parentId?: string; layout?: LayoutDSL }>,
  rootLayout: ResolvedLayout,
): Map<string, ResolvedLayout> {
  const result = new Map<string, ResolvedLayout>();
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const resolve = (groupId: string): ResolvedLayout => {
    const cached = result.get(groupId);
    if (cached) return cached;
    const group = groupById.get(groupId);
    if (!group) return rootLayout;
    const parentLayout = group.parentId ? resolve(group.parentId) : rootLayout;
    const resolved = resolveEffectiveLayout(group.layout, parentLayout);
    result.set(groupId, resolved);
    return resolved;
  };

  groups.forEach((g) => resolve(g.id));
  return result;
}
```

---

## Phase 4 — `compiler/groupConstants.ts`: Update

Change the file to export the constant as the default value (not the sole value):

```ts
// Default group padding in diagram units. Used as the resolved default
// when no groupPadding is specified in any layout ancestor.
export const DEFAULT_GROUP_PADDING = 1.5;
```

Remove or deprecate the old `GROUP_PADDING` export. If anything outside `layoutResolver.ts` still imports it, update those imports. After this plan is implemented, `GROUP_PADDING` should no longer be used directly in layout/bounds computation — only `ResolvedLayout.groupPadding` should be used.

---

## Phase 5 — `compiler/layoutAlgorithms.ts`: Algorithm Updates

### 5.1 Import changes

Add import:
```ts
import type { ResolvedLayout, ResolvedGridLayout, ResolvedHierarchicalLayout } from './layoutResolver';
```

Remove the `GROUP_PADDING` import from `./groupConstants`.

### 5.2 Update `resolveLayout` signature

Old:
```ts
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: 'manual' | 'grid' | 'hierarchical',
  spacing: [number, number],
): Map<string, readonly [number, number, number]>
```

New:
```ts
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedLayout,
): Map<string, readonly [number, number, number]>
```

### 5.3 `resolveLayout` — manual branch

Change:
```ts
if (layout === 'manual') {
```
to:
```ts
if (layout.kind === 'manual') {
```
(same behavior: ghost nodes allowed, labeled nodes without positions throw)

### 5.4 `resolveLayout` — grid branch

Replace the grid section with the full new implementation:

```ts
if (layout.kind === 'grid') {
  const { spacing, margin: rawMargin, columns: rawColumns, alignment, disconnected } = layout as ResolvedGridLayout;
  const cols = rawColumns === 'auto' || rawColumns === undefined ? 4 : rawColumns;
  const margin = rawMargin; // already normalized: [h, v]

  // Separate connected vs disconnected nodes when placement is 'after'
  const connectedNodeIds = new Set<string>();
  edges.forEach((e) => { connectedNodeIds.add(e.from); connectedNodeIds.add(e.to); });
  const orderedMissing = disconnected === 'after'
    ? [
        ...missing.filter((n) => connectedNodeIds.has(n.id)),
        ...missing.filter((n) => !connectedNodeIds.has(n.id)),
      ]
    : missing; // 'next-to': preserve declaration order

  // Effective node footprint = node size + 2 * margin per axis
  const effectiveWidth = maxWidth + 2 * margin[0];
  const effectiveHeight = maxHeight + 2 * margin[1];
  const colStep = effectiveWidth + spacing[0];
  const rowStep = effectiveHeight + spacing[1];

  // Compute row widths for alignment
  const rowCount = Math.ceil(orderedMissing.length / cols);
  const rowWidths: number[] = [];
  for (let r = 0; r < rowCount; r++) {
    const nodesInRow = Math.min(cols, orderedMissing.length - r * cols);
    rowWidths.push(nodesInRow * effectiveWidth + (nodesInRow - 1) * spacing[0]);
  }
  const widestRowWidth = Math.max(...rowWidths);

  orderedMissing.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const nodesInRow = Math.min(cols, orderedMissing.length - row * cols);
    const rowWidth = nodesInRow * effectiveWidth + (nodesInRow - 1) * spacing[0];

    let rowOffset = 0;
    if (alignment === 'center') {
      rowOffset = (widestRowWidth - rowWidth) / 2;
    } else if (alignment === 'right') {
      rowOffset = widestRowWidth - rowWidth;
    } else if (alignment === 'fill' && nodesInRow > 1) {
      // fill: distribute nodes evenly across widest row width
      const fillStep = widestRowWidth / (nodesInRow - 1);
      const x = col * fillStep + rowOffset;
      const y = -row * rowStep;
      const z = node.position?.[2] ?? 0;
      positions.set(node.id, [x, y, z]);
      return; // skip standard colStep calculation below
    }
    // fill with single node: center it
    if (alignment === 'fill' && nodesInRow === 1) {
      rowOffset = (widestRowWidth - effectiveWidth) / 2;
    }

    const x = rowOffset + col * colStep;
    const y = -row * rowStep;
    const z = node.position?.[2] ?? 0;
    positions.set(node.id, [x, y, z]);
  });
  return positions;
}
```

### 5.5 `resolveLayout` — hierarchical branch

The hierarchical branch changes are:
- Replace `spacing[0]`, `spacing[1]` references with `layout.spacing[0]`, `layout.spacing[1]`
- Apply `margin` to level spacing: the gap between level bottom-edge and next level top-edge is `spacing[1]`, where each level's half-height is `levelMaxH/2 + margin[1]`
- Add `disconnected` handling: nodes with no edges get `level = 0` by default ('next-to'); with 'after', they're placed at `maxLevel + 1`
- Add `alignment` for horizontal distribution within each level
- Add `direction: 'left-right'` support

**Full hierarchical branch replacement:**

```ts
// layout.kind === 'hierarchical'
const { spacing, margin: rawMargin, alignment, disconnected, direction } = layout as ResolvedHierarchicalLayout;
const margin = rawMargin;

// Build in-degree and adjacency for topological sort
const nodeIds = nodes.map((n) => n.id);
const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
const adjacency = new Map<string, string[]>();
edges.forEach((edge) => {
  if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
  adjacency.get(edge.from)!.push(edge.to);
  if (inDegree.has(edge.to)) inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
});

// Determine which nodes are "disconnected" (no edges at all)
const connectedNodeIds = new Set<string>();
edges.forEach((e) => { connectedNodeIds.add(e.from); connectedNodeIds.add(e.to); });
const isDisconnected = (id: string): boolean => !connectedNodeIds.has(id);

// Topological level assignment (same as current logic)
// ... [keep the existing level/queue/BFS logic unchanged] ...

// Handle disconnected nodes per policy
const maxLevel = level.size > 0 ? Math.max(...level.values()) : 0;
if (disconnected === 'after') {
  // Place disconnected nodes at maxLevel + 1 (or level 0 if no connected nodes)
  missing.forEach((node) => {
    if (isDisconnected(node.id)) {
      level.set(node.id, maxLevel + 1);
    }
  });
} else {
  // 'next-to': disconnected nodes get level 0 (current default behavior)
  nodeIds.forEach((id) => {
    if (!level.has(id)) level.set(id, 0);
  });
}

// Group missing nodes by level, preserving declaration order within each level
const levels = new Map<number, DiagramNodeDSL[]>();
missing.forEach((node) => {
  const l = level.get(node.id) ?? 0;
  if (!levels.has(l)) levels.set(l, []);
  levels.get(l)!.push(node);
});

// Compute per-level max dimension (applying margin)
const allLevelKeys = [...new Set(nodeIds.map((id) => level.get(id) ?? 0))].sort((a, b) => a - b);
const isPrimary = direction === 'left-right'; // if true, X is the depth axis

// For top-down: primary = Y (depth), secondary = X (position within level)
// For left-right: primary = X (depth), secondary = Y (position within level)
const levelMaxPrimaryHalf = new Map<number, number>(); // half-height (top-down) or half-width (left-right)
const levelMaxSecondaryDim = new Map<number, number>(); // full width (top-down) or full height (left-right)
nodes.forEach((node) => {
  const l = level.get(node.id) ?? 0;
  const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
  const primaryHalf = isPrimary ? (w / 2 + margin[0]) : (h / 2 + margin[1]);
  const secondaryDim = isPrimary ? (h + 2 * margin[1]) : (w + 2 * margin[0]);
  levelMaxPrimaryHalf.set(l, Math.max(levelMaxPrimaryHalf.get(l) ?? 0, primaryHalf));
  levelMaxSecondaryDim.set(l, Math.max(levelMaxSecondaryDim.get(l) ?? 0, secondaryDim));
});

// Compute level center positions along the primary axis
// [Keep existing anchor-level logic, adapted for isPrimary / axis selection]
// For top-down:  levelCenterY[l] = primary-axis center for depth l
// For left-right: levelCenterX[l] = primary-axis center for depth l
// Gap between levels: spacing[1] for top-down (row gap), spacing[0] for left-right (col gap)
const levelGap = isPrimary ? spacing[0] : spacing[1];
const levelCenterPrimary = new Map<number, number>();
// ... [keep the existing anchor-level logic, substituting levelGap for spacing[1] and
//      primaryHalf for levelMaxH/2] ...
// For top-down: sign is negative (lower Y = deeper level)
// For left-right: sign is positive (higher X = deeper level)
// levelCenterPrimary.set(currL, prevCenter ∓ prevPrimaryHalf - levelGap - currPrimaryHalf)
// Use negative for top-down, positive for left-right.

// Position nodes within each level along the secondary axis
levels.forEach((levelNodes, l) => {
  const count = levelNodes.length;
  const secDim = levelMaxSecondaryDim.get(l) ?? DEFAULT_NODE_SIZE[isPrimary ? 1 : 0];
  const secGap = isPrimary ? spacing[1] : spacing[0];
  const totalSecWidth = count * secDim + (count - 1) * secGap;
  const widestLevelWidth = getWidestLevelWidth(levels, levelMaxSecondaryDim, secGap); // computed ahead

  let levelAlignOffset = 0;
  if (alignment === 'center') levelAlignOffset = -totalSecWidth / 2 + secDim / 2;
  else if (alignment === 'left') levelAlignOffset = -widestLevelWidth / 2 + secDim / 2;
  else if (alignment === 'right') levelAlignOffset = widestLevelWidth / 2 - totalSecWidth + secDim / 2;

  levelNodes.forEach((node, index) => {
    const primaryVal = levelCenterPrimary.get(l) ?? 0;
    let secVal: number;
    if (alignment === 'fill' && count > 1) {
      secVal = -widestLevelWidth / 2 + index * (widestLevelWidth / (count - 1));
    } else if (alignment === 'fill' && count === 1) {
      secVal = 0;
    } else {
      secVal = levelAlignOffset + index * (secDim + secGap);
    }
    const z = node.position?.[2] ?? 0;
    const [x, y] = isPrimary ? [primaryVal, secVal] : [secVal, primaryVal];
    positions.set(node.id, [x, y, z]);
  });
});
```

> **Implementation note:** The "widest level width" for alignment must be pre-computed before the per-level positioning loop. Add a local helper:
> ```ts
> const getWidestLevelWidth = (
>   levels: Map<number, DiagramNodeDSL[]>,
>   levelMaxSecDim: Map<number, number>,
>   secGap: number,
> ): number => {
>   let widest = 0;
>   levels.forEach((lvlNodes, l) => {
>     const secDim = levelMaxSecDim.get(l) ?? 0;
>     const w = lvlNodes.length * secDim + (lvlNodes.length - 1) * secGap;
>     if (w > widest) widest = w;
>   });
>   return widest;
> };
> ```

### 5.6 Update `resolveLayoutWithGroups` signature

Old:
```ts
export function resolveLayoutWithGroups(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  groups: ReadonlyArray<DiagramGroupDSL>,
  layout: 'manual' | 'grid' | 'hierarchical',
  spacing: [number, number],
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
): Map<string, readonly [number, number, number]>
```

New:
```ts
export function resolveLayoutWithGroups(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  groups: ReadonlyArray<DiagramGroupDSL>,
  rootLayout: ResolvedLayout,
  groupLayouts: Map<string, ResolvedLayout>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
): Map<string, readonly [number, number, number]>
```

### 5.7 Internal changes to `resolveLayoutWithGroups`

**Line 326 — early-exit for manual/no-groups:**
```ts
if (rootLayout.kind === 'manual' || groups.length === 0) {
  return resolveLayout(nodes, edges, rootLayout);
}
```

**Line 385-388 — group layout selection:**
Replace:
```ts
const groupLayout: 'grid' | 'hierarchical' = group.layout ?? layout;
const groupSpacing: [number, number] = group.layoutSpacing
  ? [group.layoutSpacing[0], group.layoutSpacing[1]]
  : spacing;
```
With:
```ts
const groupLayout = groupLayouts.get(group.id) ?? rootLayout;
```

**Line 446 — inner resolveLayout call:**
Replace:
```ts
const rawLocalPositions = resolveLayout(virtualNodes, virtualEdges, groupLayout, groupSpacing);
```
With:
```ts
const rawLocalPositions = resolveLayout(virtualNodes, virtualEdges, groupLayout);
```

**Lines 478-479 — padded size for group synthetic block:**
Replace:
```ts
const paddedW = bounds.w + GROUP_PADDING * 2;
const paddedH = bounds.h + GROUP_PADDING * 2;
```
With:
```ts
const gl = groupLayouts.get(group.id) ?? rootLayout;
const [pt, pr, pb, pl] = gl.kind !== 'manual' ? gl.groupPadding : gl.groupPadding;
const paddedW = bounds.w + pl + pr;
const paddedH = bounds.h + pb + pt;
```

**Line 575 — top-level resolveLayout call:**
Replace:
```ts
const topLevelPositions = resolveLayout(topLevelLayoutNodes, topLevelEdges, layout, spacing);
```
With:
```ts
const topLevelPositions = resolveLayout(topLevelLayoutNodes, topLevelEdges, rootLayout);
```

### 5.8 Connection affinity refinement pass

**Location:** Add after `const topLevelPositions = resolveLayout(...)` (line ~575) and before the `// ─── Combine all positions` section.

This pass only runs when `rootLayout.kind === 'hierarchical'`. It refines the X (or Y for left-right) position of any top-level ungrouped node that has edges targeting specific sub-nodes of a top-level group.

```ts
// ─── Connection affinity refinement (hierarchical only) ──────────────────────
//
// For each ungrouped node A that has edges to sub-nodes of a top-level group G,
// adjust A's cross-axis position toward the centroid of the specifically-targeted
// sub-nodes rather than G's synthetic block center.
//
// This is a single-pass post-processing step. It only modifies the cross-axis
// (X for top-down, Y for left-right). Level (depth axis) is unchanged.

if (rootLayout.kind === 'hierarchical') {
  const isLR = (rootLayout as ResolvedHierarchicalLayout).direction === 'left-right';
  // affinityTargets: for each ungrouped node, accumulate refined cross-axis values
  const affinityTargets = new Map<string, number[]>();

  edges.forEach((edge) => {
    // 'from' must be an ungrouped top-level node (not inside a group)
    if (topLevelGroupByDescendant.has(edge.from)) return; // from is inside a group
    if (topLevelSynthIdForGroup.has(edge.from)) return;   // from is a group reference

    // 'to' must be a sub-node of a top-level group (not the group itself, a node inside it)
    const toGroupId = topLevelGroupByDescendant.get(edge.to);
    if (!toGroupId) return; // to is ungrouped or unknown

    const groupInfo = groupInfoMap.get(toGroupId);
    if (!groupInfo) return;

    // Get the group synthetic block's cross-axis position from the computed layout
    const groupBlockPos = topLevelPositions.get(groupNodeId(toGroupId));
    if (!groupBlockPos) return;
    const groupBlockCrossAxis = isLR ? groupBlockPos[1] : groupBlockPos[0];

    // Get the specific sub-node's local cross-axis offset within the group
    const localPos = groupInfo.localPositions.get(edge.to);
    if (!localPos) return;
    const localCrossAxis = isLR ? localPos[1] : localPos[0];

    // The specific target's estimated diagram-space cross-axis position
    const refinedCrossAxis = groupBlockCrossAxis + localCrossAxis;

    if (!affinityTargets.has(edge.from)) affinityTargets.set(edge.from, []);
    affinityTargets.get(edge.from)!.push(refinedCrossAxis);
  });

  // Apply refined cross-axis positions
  affinityTargets.forEach((refinedValues, nodeId) => {
    const pos = topLevelPositions.get(nodeId);
    if (!pos) return;
    const meanRefined = refinedValues.reduce((s, v) => s + v, 0) / refinedValues.length;
    const [x, y, z] = pos;
    topLevelPositions.set(nodeId, isLR ? [x, meanRefined, z] : [meanRefined, y, z]);
  });
}
```

---

## Phase 6 — `compiler/groupCompiler.ts`: Padding Updates

### 6.1 Update `GroupBounds` type

```ts
export type GroupBounds = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Resolved padding [top, right, bottom, left] in diagram units. */
  readonly padding: readonly [number, number, number, number];
  /** Gap between group title label and content, in diagram units. */
  readonly titleGap: number;
};
```

### 6.2 Update `resolveGroupBoundsMap` signature

Old:
```ts
export function resolveGroupBoundsMap(
  groups: ReadonlyArray<DiagramGroupDSL>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
): Map<string, GroupBounds>
```

New:
```ts
import type { ResolvedLayout } from './layoutResolver';

export function resolveGroupBoundsMap(
  groups: ReadonlyArray<DiagramGroupDSL>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
  groupLayouts: Map<string, ResolvedLayout>,
): Map<string, GroupBounds>
```

### 6.3 Update padding application

Replace the `GROUP_PADDING` constant usage in `computeGroupBounds`:

```ts
// OLD:
const padding = GROUP_PADDING;
const padded = {
  x: base.x - padding,
  y: base.y - padding,
  w: base.w + padding * 2,
  h: base.h + padding * 2,
  padding,
};

// NEW:
const gl = groupLayouts.get(groupId);
const [pt, pr, pb, pl] = gl?.groupPadding ?? [1.5, 1.5, 1.5, 1.5];
const titleGap = gl?.titleGap ?? 0.5;
const padded: GroupBounds = {
  x: base.x - pl,
  y: base.y - pb,        // minY = bottom edge, pb expands downward
  w: base.w + pl + pr,
  h: base.h + pb + pt,
  padding: [pt, pr, pb, pl],
  titleGap,
};
```

Also update the "empty / cycle guard" returns to use `[1.5, 1.5, 1.5, 1.5]` as the default padding tuple (was `GROUP_PADDING`):
```ts
// In the cycle guard and missing group returns:
return { x: 0, y: 0, w: 0, h: 0, padding: [1.5, 1.5, 1.5, 1.5], titleGap: 0.5 };
```

### 6.4 Remove `GROUP_PADDING` import

Remove:
```ts
import { GROUP_PADDING } from './groupConstants';
```

---

## Phase 7 — `compile.ts`: Wire Up New Pipeline

### 7.1 Add imports

```ts
import { resolveEffectiveLayout, resolveGroupLayouts } from './compiler/layoutResolver';
import type { ResolvedLayout } from './compiler/layoutResolver';
```

### 7.2 Update `compileDiagram` body

After building the `sizeMap` and before calling `resolveLayoutWithGroups`, add:

```ts
// Resolve the cascade layout for the diagram root and all groups
const rootLayout: ResolvedLayout = resolveEffectiveLayout(dsl.layout, undefined);
const groupLayouts = resolveGroupLayouts(dsl.groups, rootLayout);
```

Update the call to `resolveLayoutWithGroups`:

Old:
```ts
const positionMap = resolveLayoutWithGroups(
  dsl.nodes, dsl.edges, dsl.groups, dsl.layout, dsl.layoutSpacing ?? [2, 2], sizeMap,
);
```
New:
```ts
const positionMap = resolveLayoutWithGroups(
  dsl.nodes, dsl.edges, dsl.groups, rootLayout, groupLayouts, sizeMap,
);
```

Update the call to `resolveGroupBoundsMap`:

Old:
```ts
const groupBoundsMap = resolveGroupBoundsMap(dsl.groups, positionMap, sizeMap);
```
New:
```ts
const groupBoundsMap = resolveGroupBoundsMap(dsl.groups, positionMap, sizeMap, groupLayouts);
```

---

## Phase 8 — `handlers.ts`: React Children Walking

### 8.1 Add imports

```ts
import { GridLayout, HierarchicalLayout, ManualLayout } from '../elements/diagram/dsl';
import type { LayoutDSL } from '../elements/diagram/types';
```

### 8.2 Register layout components as no-op primitives

In `registerDiagramHandlers`, add alongside the existing registerNode calls:

```ts
registerNode(GridLayout, () => {});
registerNode(HierarchicalLayout, () => {});
registerNode(ManualLayout, () => {});
```

### 8.3 Layout extraction in `extractDiagramDSL`

Add layout extraction at the top of `extractDiagramDSL` (alongside `exitDSL` / `enterDSL`):

```ts
let layoutDSL: LayoutDSL | undefined;
```

In the `for (const child of allChildren)` loop, add before/alongside the `Exit`/`Enter` checks:

```ts
} else if (el.type === GridLayout) {
  const p = el.props as Record<string, unknown>;
  layoutDSL = {
    kind: 'grid',
    ...(p.columns !== undefined && { columns: p.columns as number | 'auto' }),
    ...(p.spacing !== undefined && { spacing: p.spacing as [number, number] }),
    ...(p.margin !== undefined && { margin: p.margin as number | [number, number] }),
    ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding as import('../elements/diagram/types').LayoutPadding }),
    ...(p.titleGap !== undefined && { titleGap: p.titleGap as number }),
    ...(p.alignment !== undefined && { alignment: p.alignment as import('../elements/diagram/types').LayoutAlignment }),
    ...(p.disconnected !== undefined && { disconnected: p.disconnected as import('../elements/diagram/types').LayoutDisconnected }),
  };
} else if (el.type === HierarchicalLayout) {
  const p = el.props as Record<string, unknown>;
  layoutDSL = {
    kind: 'hierarchical',
    ...(p.direction !== undefined && { direction: p.direction as 'top-down' | 'left-right' }),
    ...(p.spacing !== undefined && { spacing: p.spacing as [number, number] }),
    ...(p.margin !== undefined && { margin: p.margin as number | [number, number] }),
    ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding as import('../elements/diagram/types').LayoutPadding }),
    ...(p.titleGap !== undefined && { titleGap: p.titleGap as number }),
    ...(p.alignment !== undefined && { alignment: p.alignment as import('../elements/diagram/types').LayoutAlignment }),
    ...(p.disconnected !== undefined && { disconnected: p.disconnected as import('../elements/diagram/types').LayoutDisconnected }),
  };
} else if (el.type === ManualLayout) {
  const p = el.props as Record<string, unknown>;
  layoutDSL = {
    kind: 'manual',
    ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding as import('../elements/diagram/types').LayoutPadding }),
    ...(p.titleGap !== undefined && { titleGap: p.titleGap as number }),
  };
}
```

### 8.4 Update the returned `DiagramDSL` object

Replace:
```ts
layout: (props.layout ?? 'grid') as DiagramDSL['layout'],
layoutSpacing: (props.layoutSpacing ?? [2, 2]) as [number, number],
```
With:
```ts
layout: layoutDSL,
```

### 8.5 Layout extraction in `collectGroup`

Add layout extraction inside `collectGroup`, scanning `groupChildren`:

```ts
let groupLayoutDSL: LayoutDSL | undefined;
for (const gc of groupChildren) {
  // ... existing DiagramNode / DiagramGroup checks ...
  if (gEl.type === GridLayout) {
    const p = gEl.props as Record<string, unknown>;
    groupLayoutDSL = { kind: 'grid', ...extractLayoutProps(p) };
  } else if (gEl.type === HierarchicalLayout) {
    const p = gEl.props as Record<string, unknown>;
    groupLayoutDSL = { kind: 'hierarchical', ...extractLayoutProps(p) };
  } else if (gEl.type === ManualLayout) {
    const p = gEl.props as Record<string, unknown>;
    groupLayoutDSL = { kind: 'manual', ...extractManualLayoutProps(p) };
  }
}
```

Extract the prop-copying into a local helper to avoid repetition:

```ts
const extractLayoutProps = (p: Record<string, unknown>) => ({
  ...(p.spacing !== undefined && { spacing: p.spacing }),
  ...(p.margin !== undefined && { margin: p.margin }),
  ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding }),
  ...(p.titleGap !== undefined && { titleGap: p.titleGap }),
  ...(p.alignment !== undefined && { alignment: p.alignment }),
  ...(p.disconnected !== undefined && { disconnected: p.disconnected }),
  ...(p.columns !== undefined && { columns: p.columns }),
  ...(p.direction !== undefined && { direction: p.direction }),
});
const extractManualLayoutProps = (p: Record<string, unknown>) => ({
  ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding }),
  ...(p.titleGap !== undefined && { titleGap: p.titleGap }),
});
```

In the `groups.push({ ... })` call, replace:
```ts
layout: elProps.layout as DiagramGroupDSL['layout'],
layoutSpacing: elProps.layoutSpacing as DiagramGroupDSL['layoutSpacing'],
```
With:
```ts
layout: groupLayoutDSL,
```

---

## Phase 9 — Migration: `scene_llm_filter.tsx`

The scene currently has:
```tsx
<Diagram id="llm-filter" layout="hierarchical" layoutSpacing={[1, 1]}>
```

Migrate to:
```tsx
<Diagram id="llm-filter">
  <HierarchicalLayout spacing={[1, 1]} />
  ...
</Diagram>
```

Any `<DiagramGroup>` elements with `layout=` or `layoutSpacing=` props must also be migrated. Audit the file for all occurrences.

Search the entire codebase for other usages:
```bash
pnpm --filter @brewsite/diagram grep "layout=" --include="*.tsx"
pnpm --filter @brewsite/examples grep "layoutSpacing=" --include="*.tsx"
```

Migrate each occurrence.

---

## Phase 10 — Tests: `compiler/__tests__/layoutAlgorithms.test.ts`

All existing tests that call `resolveLayout` or `resolveLayoutWithGroups` must be updated to pass `ResolvedLayout` objects instead of separate `layout` string + `spacing` tuple.

Helper test factories to add at the top of the test file:
```ts
import {
  DEFAULT_RESOLVED_GRID,
  DEFAULT_RESOLVED_HIERARCHICAL,
  DEFAULT_RESOLVED_MANUAL,
  ResolvedGridLayout,
  ResolvedHierarchicalLayout,
  ResolvedManualLayout,
} from '../layoutResolver';

const grid = (overrides: Partial<ResolvedGridLayout> = {}): ResolvedGridLayout =>
  ({ ...DEFAULT_RESOLVED_GRID, ...overrides });

const hierarchical = (overrides: Partial<ResolvedHierarchicalLayout> = {}): ResolvedHierarchicalLayout =>
  ({ ...DEFAULT_RESOLVED_HIERARCHICAL, ...overrides });

const manual = (): ResolvedManualLayout => ({ ...DEFAULT_RESOLVED_MANUAL });
```

### Required new test cases (add to the test file)

#### A. Cascade resolver tests (import `resolveEffectiveLayout`, `resolveGroupLayouts`)

```ts
describe('resolveEffectiveLayout', () => {
  it('absent own → inherits parent as-is', ...);
  it('absent own, absent parent → returns default grid', ...);
  it('grid parent + grid child → merges: child columns win, parent spacing inherited', ...);
  it('hierarchical parent + hierarchical child → merges specified props only', ...);
  it('grid parent + hierarchical child → uses hierarchical defaults (no inheritance)', ...);
  it('hierarchical parent + grid child → uses grid defaults (no inheritance)', ...);
  it('manual layout → groupPadding and titleGap from child, rest not applicable', ...);
  it('undefined prop in child does not override parent value', ...);
});

describe('resolveGroupLayouts', () => {
  it('top-level group without own layout → inherits root', ...);
  it('top-level group with same-kind layout → merges', ...);
  it('nested group inherits through parent chain (3 levels)', ...);
  it('different-kind at nested level breaks chain — grandchild inherits from parent not grandparent', ...);
});
```

#### B. Grid layout — new parameter tests

```ts
describe('resolveLayout — grid', () => {
  it('columns: 2 → 2-column grid', ...);
  it('columns: auto → 4-column grid (current default)', ...);
  it('margin: [1, 0] → nodes offset by margin on X axis', ...);
  it('alignment: center → rows centered around widest row', ...);
  it('alignment: right → rows right-aligned', ...);
  it('alignment: fill → nodes spread to widest row width', ...);
  it('alignment: fill with single node per row → node centered', ...);
  it('disconnected: after → connected nodes first, disconnected appended', ...);
  it('disconnected: next-to → declaration order preserved', ...);
});
```

#### C. Hierarchical layout — new parameter tests

```ts
describe('resolveLayout — hierarchical', () => {
  it('direction: left-right → depth on X axis, levels on Y axis', ...);
  it('alignment: left → all levels left-aligned', ...);
  it('alignment: right → all levels right-aligned', ...);
  it('alignment: fill → nodes spread to widest level', ...);
  it('disconnected: after → disconnected nodes at maxLevel + 1', ...);
  it('disconnected: next-to → disconnected nodes at level 0 (current behavior)', ...);
  it('margin: [0.5, 0.5] → level spacing accounts for margin', ...);
});
```

#### D. Group padding tests

```ts
describe('resolveGroupBoundsMap', () => {
  it('groupPadding: 2 → uniform 2 on all sides', ...);
  it('groupPadding: [1, 2] → top/bottom=1, left/right=2', ...);
  it('groupPadding: [1, 2, 3, 4] → explicit per-side padding', ...);
  it('titleGap propagates to GroupBounds.titleGap', ...);
  it('bounds.padding is [top, right, bottom, left] tuple', ...);
});
```

#### E. Connection affinity test

```ts
describe('resolveLayoutWithGroups — connection affinity', () => {
  it('ungrouped node A connecting to sub-nodes B+C inside group G is centered over B+C centroid, not G center', () => {
    // Setup: G contains nodes B (localX=-1) and C (localX=+1) and D (localX=+3)
    // A has edges to B and C only
    // Expected: A.x ≈ mean(G.center.x + (-1), G.center.x + 1) = G.center.x
    // vs without affinity: A.x = G.center.x (which happens to be same in this symmetric case)
    // Use asymmetric case: B at localX=-1, C at localX=+1, D at localX=+3
    // G.center.x = 1 (centroid of 3 nodes at -1, 1, 3)
    // Affinity: A.x = G.center.x + mean(-1, 1) = 1 + 0 = 1
    // Without affinity: A.x = G.center.x = 1 → same in this case
    // Use: B at localX=0, C at localX=1, D at localX=4
    // G.center.x = 5/3 ≈ 1.67
    // Affinity: A.x = 1.67 + mean(0, 1) - (G.center.x in local = 0)
    // Actually: G synthetic block is at some outer X, A.x = G.syntheticX + mean(B.localX, C.localX)
    // Test that A.x ≠ G.syntheticX (would be the case without affinity)
    // and A.x = G.syntheticX + mean(B.localX, C.localX)
  });
});
```

#### F. Update all existing tests

All existing calls of the form:
```ts
resolveLayout(nodes, edges, 'grid', [2, 2])
resolveLayout(nodes, edges, 'hierarchical', [2, 2])
resolveLayoutWithGroups(nodes, edges, groups, 'hierarchical', [2, 2], sizes)
resolveGroupBoundsMap(groups, positions, sizes)
```
Must be updated to:
```ts
resolveLayout(nodes, edges, grid())
resolveLayout(nodes, edges, hierarchical())
resolveLayoutWithGroups(nodes, edges, groups, hierarchical(), new Map(), sizes)
resolveGroupBoundsMap(groups, positions, sizes, new Map())
```

---

## Phase 11 — Rendering: `GroupRenderer` (minor, informational)

The `GroupRenderer` (in `packages/diagram/src/elements/diagram/rendering/`) renders the group boundary box and label. After this plan:

1. `bounds.padding` changes from `number` to `readonly [number, number, number, number]`. If the renderer applies padding to re-expand the box (double-applying it), this is a bug. Verify the renderer uses `bounds.x/y/w/h` directly and does NOT add `bounds.padding` again (since bounds already incorporate it).

2. `bounds.titleGap` is a new field. The renderer should use it to offset the group title label from the group's top edge. Current behavior likely uses a hardcoded offset. Update to: `titleY = bounds.y + bounds.h - bounds.padding[0] - bounds.titleGap` (i.e., below the top padding band, with titleGap as the distance from padding's inner edge to the title center).

These are render.ts changes and are excluded from unit test coverage per project convention. Verify visually in the dev environment.

---

## Error Handling

- `ManualLayout` compile error (existing): non-ghost nodes without positions throw with a clear message — keep this behavior.
- Multiple layout elements (e.g., both `<GridLayout>` and `<HierarchicalLayout>` as children of one container): last one wins (declaration order). Consider `console.warn` if more than one layout element is detected per container.
- Unknown `layout.kind` in any switch: `console.warn` and fall back to default grid behavior — never silent failure.

---

## Dependency Rules Compliance Check

| File | Allowed imports | Actual imports after change |
|---|---|---|
| `types.ts` | No runtime, no React, no Three.js | No change — passes ✓ |
| `dsl.tsx` | React, types.ts only | Adds `LayoutAlignment`, `LayoutDisconnected`, `LayoutPadding` from `./types` ✓ |
| `layoutResolver.ts` | `../types` only | Imports `LayoutDSL`, `LayoutPadding` from `../types` ✓ |
| `layoutAlgorithms.ts` | `../types`, `./layoutResolver`, `./groupConstants` | Removes `GROUP_PADDING`, adds `ResolvedLayout` from `./layoutResolver` ✓ |
| `groupCompiler.ts` | `../types`, `./nodeCompiler`, `./layoutAlgorithms`, `./layoutResolver` | Adds `ResolvedLayout`, removes `GROUP_PADDING` ✓ |
| `compile.ts` | All compiler files, no Three.js | Adds `resolveEffectiveLayout`, `resolveGroupLayouts` ✓ |
| `handlers.ts` | Everything except render.ts files | Adds `GridLayout`, `HierarchicalLayout`, `ManualLayout`, `LayoutDSL` ✓ |

---

## Build & Verification Commands

```bash
pnpm typecheck                                   # zero TS errors expected
pnpm --filter @brewsite/diagram test             # all tests pass
pnpm --filter @brewsite/core test                # regression: no core tests break
pnpm dev                                         # scene_llm_filter renders correctly
```
