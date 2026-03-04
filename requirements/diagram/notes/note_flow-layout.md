---
title: "Flow Layout Feature Note"
doc_type: note
owner: pm
status: implemented
updated: 2026-03-04
---

# Flow Layout Feature Note

## Problem Statement

The diagram layout system currently offers three strategies:

- **ManualLayout** — every node requires an explicit position. Precise but verbose; fragile when nodes are added or removed.
- **GridLayout** — places nodes left-to-right in rows of a fixed column count. Good for homogeneous grids, but produces counter-intuitive results for sequential or vertical stacks: a 3-node pipeline becomes a horizontal row, not a vertical column.
- **HierarchicalLayout** — topological sort driven by edge connectivity. Correct for data-flow graphs with explicit edges, but requires edges to determine order. When nodes are not connected by edges, they all collapse to level 0.

**The gap:** there is no way to declare "arrange these items in a line, in the order I wrote them, with a fixed gap between them" without either providing manual coordinates or adding dummy edges. Authors who want a simple top-to-bottom stack of items — e.g., a group of nodes presented as a bullet list, a vertical swimlane of phases, an ordered row of pipeline icons — have no clean layout tool for this.

GridLayout technically handles some of these cases (set `columns={1}` for a vertical stack), but its API expresses that badly: `columns={1}` is an incidental trick rather than an authorial intent signal, and the concept of "rows" and "columns" implies a 2D grid rather than a linear sequence. It also lacks a direct `direction` prop to flip the primary axis without reshaping the whole mental model.

Flow layout is a direct-intent primitive: "lay my items out sequentially in this direction, with this gap between them."

---

## Proposed Solution

Add a **`FlowLayout`** DSL component that arranges all items at the current container level in a single line (sequence), in their declaration order, along a specified direction axis. The gap between adjacent items is a single numeric value (the space between their edges, not their centers).

### Behavior Description

- Items are placed one after another along the direction axis, in their **declaration order** within the container (diagram root or group). Declaration order is the order items appear in JSX source, interleaving nodes and groups.
- Only items at the **current container level** are affected. Nested groups are treated as opaque blocks — they occupy space determined by their own padded bounds, but their internal layout is resolved by their own layout spec (unchanged).
- Items with explicit `position` props are preserved in-place, identical to how `GridLayout` and `HierarchicalLayout` handle explicit positions.
- Direction controls which axis is the primary (stacking) axis:
  - `'top-down'`: items are stacked vertically (Y axis). First item is at the top (y = 0); subsequent items are placed at decreasing Y values (Y decreases downward in Three.js space, matching the existing grid and hierarchical conventions).
  - `'left-right'`: items are stacked horizontally (X axis). First item is at x = 0; subsequent items are placed at increasing X values.
- The **secondary-axis position** for all items is `0`. For `top-down`, each item's X coordinate is `0` (center-aligned on the column). For `left-right`, each item's Y coordinate is `0` (center-aligned on the row). Items of different sizes are center-aligned on the cross axis.
- Gap is the edge-to-edge distance between adjacent item footprints in diagram units. It is not center-to-center.
- **Default direction: `'top-down'`** — consistent with `HierarchicalLayout`'s default and the most common "ordered list" visual metaphor (bullet list, vertical swimlane, pipeline phases).

### Direction Value Names

The existing codebase uses exactly `'top-down'` and `'left-right'` in two places:

1. `HierarchicalLayoutDSL.direction?: 'top-down' | 'left-right'` — in `types.ts`
2. `ResolvedHierarchicalLayout.direction: 'top-down' | 'left-right'` — in `layoutResolver.ts`

Flow layout **must use the same values**: `'top-down' | 'left-right'`. No new direction strings. This keeps the direction vocabulary consistent across the entire layout system and makes the type `'top-down' | 'left-right'` a meaningful shared concept rather than a per-algorithm quirk.

### Gap Semantics

Gap is **edge-to-edge** (not center-to-center). This is the most intuitive interpretation — "gap = 1" means 1 diagram unit of empty space between the right edge of item N and the left edge of item N+1 (for `left-right`), or between the bottom edge of item N and the top edge of item N+1 (for `top-down`).

The existing layout system uses a `margin` concept (per-node breathing room that expands the claimed bounding box) plus `spacing` (gap between expanded footprints). Flow layout simplifies this to a single `gap` value. The semantic is: `gap = spacing` with `margin = 0`. Authors who need per-item breathing room can use `gap` to achieve the same visual effect.

**Default gap:** `2` diagram units — consistent with the existing default spacing values (`DEFAULT_GRID_SPACING = [2, 2]` and `DEFAULT_HIERARCHICAL_SPACING = [1.5, 1.5]`). A value in the same range prevents visual surprise when switching layout types.

### Declaration Order and `childrenOrder`

FlowLayout's core premise — items placed in the order the author wrote them — requires preserving the interleaved declaration order of nodes and groups within a container. The existing `DiagramGroupDSL` stores `nodeIds` and `childGroupIds` as **separate arrays**, losing the relative order of nodes vs groups.

To fix this, both `DiagramGroupDSL` and `DiagramDSL` gain a `childrenOrder` field:

```typescript
readonly childrenOrder: ReadonlyArray<string>;
```

Each entry is a node ID or group ID in the order the child appeared in the JSX source. JSX children are processed in declaration order by `helpers.collectChildren(el)` (a standard React children iteration); the handler records the interleaved sequence into `childrenOrder` as it iterates. This field is **always populated** by the compiler (not conditionally on FlowLayout being present), since the cost is negligible and it future-proofs the compiled representation.

`resolveFlowLayout` receives the full set of virtual nodes (direct members + synthetic group blocks) and `childrenOrder`, and uses `childrenOrder` to sort the items into their intended sequence before performing sequential placement.

**Example:**

```tsx
<Diagram id="pipeline">
  <FlowLayout direction="top-down" gap={2} />
  <DiagramNode id="input" label="Input" />
  <DiagramGroup id="processing">
    <GridLayout columns={3} />                     {/* internal layout: grid */}
    <DiagramNode id="p1" label="Step 1" />
    <DiagramNode id="p2" label="Step 2" />
    <DiagramNode id="p3" label="Step 3" />
  </DiagramGroup>
  <DiagramNode id="output" label="Output" />
</Diagram>
```

`childrenOrder` at the diagram root: `['input', 'processing', 'output']`

Result of Flow top-down at root level:
- `input` node at top (y = 0)
- `processing` group block placed below `input` with `gap=2` edge-to-edge clearance (its internal `[p1, p2, p3]` are arranged in a 3-column grid inside the group)
- `output` node placed below the `processing` group with `gap=2` edge-to-edge clearance

This is the core interaction that motivated the feature.

### "Same Level" Hierarchy Rule

Flow layout applies to all items at the **current container level only**. The hierarchy works exactly like `GridLayout` and `HierarchicalLayout`:

- At the diagram root: all top-level nodes and top-level groups are the items. Each group is a single block whose size is its padded bounding box. The group's internal layout is computed separately.
- Inside a group: all direct-member nodes and direct-child groups of that group are the items.
- Nested group items: a `<DiagramGroup>` nested inside a `FlowLayout` container is treated as a single block. Its internal nodes are positioned by that group's own layout, not by the parent's flow.

Groups are processed bottom-up in `resolveLayoutWithGroups`. When flow runs at a parent level, the child group's size (padded bounding box: `bounds.w + padding.left + padding.right` by `bounds.h + padding.top + padding.bottom`) is already fully computed. Flow treats the group as an opaque block of that size.

---

## Key Design Decisions

### 1. Direction values: reuse `'top-down' | 'left-right'`

Rationale: these values already exist in `HierarchicalLayoutDSL` and `ResolvedHierarchicalLayout`. Introducing synonyms (`'vertical'`, `'horizontal'`, `'column'`, `'row'`) would create an inconsistency where the same spatial concept has multiple names depending on which layout kind you're using. The existing values are clear and directional — they describe where items flow TO, not what axis they sit on.

### 2. `gap` not `spacing`

The existing `spacing` field on `BaseLayoutDSL` is a `[number, number]` tuple `[colGap, rowGap]` — it supports two-axis gaps. Flow layout is fundamentally a single-axis primitive. A single `gap: number` is simpler, carries less cognitive load, and prevents a nonsensical situation where someone passes `spacing={[2, 3]}` to a one-dimensional layout.

However: this means `FlowLayout` does NOT extend `BaseLayoutDSL`. It is a distinct type that shares only the `groupPadding` and `titleGap` props (which apply at the group level, not per-item).

### 3. `groupPadding` and `titleGap` still apply

Groups with `FlowLayout` still need `groupPadding` and `titleGap` — these control the group's own visual boundary, not the inter-item gap. These should be supported with the same defaults as the other layout types: `groupPadding = 1.5`, `titleGap = 1`.

### 4. No `alignment` prop in v1

`GridLayout` and `HierarchicalLayout` both have an `alignment` prop (`'left' | 'center' | 'right' | 'fill'`) that controls secondary-axis alignment within rows/levels. Flow layout always centers items on the secondary axis (position = 0). Secondary-axis alignment is not a relevant concept for a single-line sequence in v1. Can be added later without a breaking change.

### 5. No `disconnected` prop

Flow layout places items in declaration order, not by edge connectivity. The `disconnected: 'next-to' | 'after'` policy is meaningful only for `GridLayout` and `HierarchicalLayout`, which have edge-aware position assignment. It does not apply here.

### 6. Integration with existing cascade model

Flow layout participates in the **same cascade model** as the existing strategies (Rules 1–3 in `layoutResolver.ts`):
- Same kind as parent → merge
- Different kind from parent → replace from kind-specific defaults
- Absent → inherit

This requires `FlowLayoutDSL` to have `kind: 'flow'` as a discriminant, and `ResolvedFlowLayout` to be added to the `ResolvedLayout` union.

The theme's `DiagramThemeLayoutConfig.defaultKind` should be extended to accept `'flow'` as a new option.

### 7. Interaction with `resolveLayoutWithGroups`

The existing `resolveLayoutWithGroups` function delegates to `resolveLayout` for the intra-group layout pass (line 623) and the top-level layout pass (line 749). Both calls must handle `kind: 'flow'`. The new `resolveFlowLayout` (dispatched from `resolveLayout`) handles the sequential placement.

`resolveLayoutWithGroups` builds synthetic `__group__::id` blocks for child groups — this mechanism works identically for flow layout. A child group becomes a single block item in the parent flow sequence, positioned per `childrenOrder`.

---

## Scope: Files That Will Need to Change

### `packages/diagram/src/elements/diagram/types.ts`

1. Add `childrenOrder` to `DiagramGroupDSL`:
   ```typescript
   readonly childrenOrder: ReadonlyArray<string>;
   ```
2. Add `childrenOrder` to `DiagramDSL`:
   ```typescript
   readonly childrenOrder: ReadonlyArray<string>;
   ```
3. Add `FlowLayoutDSL` interface:
   ```typescript
   export interface FlowLayoutDSL {
     readonly kind: 'flow';
     readonly direction?: 'top-down' | 'left-right';
     readonly gap?: number;
     readonly groupPadding?: LayoutPadding;
     readonly titleGap?: number;
   }
   ```
4. Extend `LayoutDSL` discriminated union:
   ```typescript
   export type LayoutDSL = GridLayoutDSL | HierarchicalLayoutDSL | ManualLayoutDSL | FlowLayoutDSL;
   ```
5. Extend `DiagramThemeLayoutConfig.defaultKind`:
   ```typescript
   readonly defaultKind?: 'grid' | 'hierarchical' | 'manual' | 'flow';
   ```
6. Add theme defaults for flow layout inside `DiagramThemeLayoutConfig`:
   ```typescript
   readonly flow?: {
     readonly direction?: 'top-down' | 'left-right';
     readonly gap?: number;
     readonly groupPadding?: LayoutPadding;
     readonly titleGap?: number;
   };
   ```

### `packages/diagram/src/compiler/handlers.ts`

1. Add `FlowLayout` to the layout component detection in both `extractDiagramDSL` and `collectGroup`. Detect `gEl.type === FlowLayout` and extract `{ kind: 'flow', gap, direction, groupPadding, titleGap }` into `layoutDSL`.

2. **Populate `childrenOrder`** in both `extractDiagramDSL` and `collectGroup`. As children are iterated in declaration order, push each child's ID into a local `childrenOrder: string[]` array when the child is a `DiagramNode` or `DiagramGroup` (skip layout elements, enter/exit, edges). Include this array in the constructed `DiagramGroupDSL` and `DiagramDSL` objects.

   ```typescript
   // in collectGroup, add alongside nodeIds/childGroupIds:
   const childrenOrder: string[] = [];
   // ... in the child iteration loop:
   if (gEl.type === DiagramNode) {
     childrenOrder.push(nodeId);
     nodeIds.push(nodeId);
     // ...
   } else if (gEl.type === DiagramGroup) {
     const childId = collectGroup(gEl, groupId, warnFn);
     childrenOrder.push(childId);
     childGroupIds.push(childId);
   }
   // ... and in the DiagramGroupDSL object:
   childrenOrder,
   ```

3. Import `FlowLayout` from `dsl.tsx`.

### `packages/diagram/src/elements/diagram/dsl.tsx`

1. Add `FlowLayoutProps` interface and `FlowLayout` component:
   ```typescript
   export interface FlowLayoutProps {
     direction?: 'top-down' | 'left-right';
     gap?: number;
     groupPadding?: LayoutPadding;
     titleGap?: number;
   }
   export function FlowLayout(_props: FlowLayoutProps): null { return null; }
   ```
2. Export `FlowLayout` and `FlowLayoutProps` from the module.

### `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts`

1. Add `ResolvedFlowLayout` interface:
   ```typescript
   export interface ResolvedFlowLayout {
     readonly kind: 'flow';
     readonly direction: 'top-down' | 'left-right';
     readonly gap: number;
     readonly groupPadding: readonly [number, number, number, number];
     readonly titleGap: number;
   }
   ```
2. Extend `ResolvedLayout` union:
   ```typescript
   export type ResolvedLayout = ResolvedGridLayout | ResolvedHierarchicalLayout | ResolvedManualLayout | ResolvedFlowLayout;
   ```
3. Add `DEFAULT_RESOLVED_FLOW` constant:
   ```typescript
   export const DEFAULT_RESOLVED_FLOW: ResolvedFlowLayout = {
     kind: 'flow',
     direction: 'top-down',
     gap: 2,
     groupPadding: DEFAULT_GROUP_PADDING_NORMALIZED,
     titleGap: DEFAULT_TITLE_GAP,
   };
   ```
4. Extend `ResolvedLayoutDefaults` to include a `flow` field:
   ```typescript
   export interface ResolvedLayoutDefaults {
     readonly root: ResolvedLayout;
     readonly grid: ResolvedGridLayout;
     readonly hierarchical: ResolvedHierarchicalLayout;
     readonly manual: ResolvedManualLayout;
     readonly flow: ResolvedFlowLayout;
   }
   ```
5. Update `resolveThemeLayoutDefaults` to build and return `flowDefaults` using theme overrides, and include it in the returned object.

6. **Update `applyLayoutDefaultsWithTheme`** — add an explicit branch for `kind: 'flow'` to avoid silently falling through to hierarchical defaults:
   ```typescript
   // Before (current):
   const base = own.kind === 'grid' ? defaults.grid : defaults.hierarchical;

   // After:
   const base = own.kind === 'grid' ? defaults.grid
     : own.kind === 'flow' ? defaults.flow
     : defaults.hierarchical;
   ```
   Without this explicit branch, `kind: 'flow'` silently picks up `spacing`, `margin`, `alignment`, `disconnected` from hierarchical defaults — fields that don't exist on `ResolvedFlowLayout`.

7. **Update `mergeResolvedLayouts`** — add an explicit `kind: 'flow'` branch before the generic field-spreading code, because `FlowLayoutDSL` has none of the `spacing`/`margin`/`alignment`/`disconnected` fields that the existing generic path accesses:
   ```typescript
   if (child.kind === 'flow') {
     if (child.gap !== undefined) result['gap'] = child.gap;
     if (child.direction !== undefined) result['direction'] = child.direction;
     if (child.groupPadding !== undefined) result['groupPadding'] = normalizeGroupPadding(child.groupPadding);
     if (child.titleGap !== undefined) result['titleGap'] = child.titleGap;
     return result as unknown as ResolvedLayout;
   }
   ```

8. Update `resolveEffectiveLayout` and `resolveGroupLayouts` — no logic change needed if the dispatch is correct.

### `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`

1. **Update the dispatch guard at line 24** — the current condition explicitly enumerates known kinds and falls back to grid for anything else. `'flow'` must be added to the known-kinds list:
   ```typescript
   // Before:
   if (layoutKind !== 'manual' && layoutKind !== 'grid' && layoutKind !== 'hierarchical') {
   // After:
   if (layoutKind !== 'manual' && layoutKind !== 'grid' && layoutKind !== 'hierarchical' && layoutKind !== 'flow') {
   ```
   Without this update, any `kind: 'flow'` layout silently falls back to grid.

2. Add `resolveFlowLayout` function:

   ```typescript
   export function resolveFlowLayout(
     nodes: ReadonlyArray<DiagramNodeDSL>,
     layout: ResolvedFlowLayout,
     childrenOrder: ReadonlyArray<string>,
   ): Map<string, readonly [number, number, number]> {
     const positions = new Map<string, readonly [number, number, number]>();
     const DEFAULT_NODE_SIZE: [number, number] = [4, 2];
     const isTopDown = layout.direction !== 'left-right';
     const gap = layout.gap;

     // Preserve explicit positions.
     const nodeById = new Map(nodes.map((n) => [n.id, n]));
     nodes.forEach((n) => { if (n.position) positions.set(n.id, n.position); });

     // Sort items by childrenOrder, filtering to only ids present in this layout's nodes.
     const nodeIdSet = new Set(nodes.map((n) => n.id));
     const orderedIds = childrenOrder.filter((id) => nodeIdSet.has(id));
     // Append any ids in nodes but missing from childrenOrder (defensive fallback).
     nodes.forEach((n) => { if (!orderedIds.includes(n.id)) orderedIds.push(n.id); });

     // Place items sequentially. Skip items with explicit positions but still account for
     // their footprint in the running cursor so subsequent items are placed correctly.
     let cursor = 0; // current leading edge on the primary axis
     for (const id of orderedIds) {
       const node = nodeById.get(id);
       if (!node) continue;
       const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
       const primarySize = isTopDown ? h : w;
       const halfPrimary = primarySize / 2;

       if (node.position) {
         // Explicit: advance cursor past this item, but don't overwrite position.
         const primaryPos = isTopDown ? node.position[1] : node.position[0];
         cursor = Math.max(cursor, -primaryPos + halfPrimary); // top-down: cursor tracks distance gone
         continue;
       }

       const centerPrimary = -(cursor + halfPrimary); // top-down goes negative Y
       const [x, y] = isTopDown ? [0, centerPrimary] : [-centerPrimary, 0];
       positions.set(id, [x, y, node.position?.[2] ?? 0]);
       cursor += primarySize + gap;
     }

     return positions;
   }
   ```

   **Algorithm notes:**
   - Primary axis: Y for `top-down` (decreasing), X for `left-right` (increasing). Matches the existing grid and hierarchical sign conventions.
   - Secondary axis: always `0`. Items are center-aligned on the cross axis.
   - Explicit positions are preserved; the cursor advances past their footprint.
   - Items present in `nodes` but absent from `childrenOrder` are appended defensively (handles edge cases from old compiled data without `childrenOrder`).

3. Update `resolveLayout` dispatch to route `kind: 'flow'` to `resolveFlowLayout`. The function signature requires passing `childrenOrder`, so `resolveLayout` must accept `childrenOrder` as an optional parameter:
   ```typescript
   export function resolveLayout(
     nodes: ReadonlyArray<DiagramNodeDSL>,
     edges: ReadonlyArray<DiagramEdgeDSL>,
     layout: ResolvedLayout,
     onWarn?: DiagramWarnFn,
     childrenOrder?: ReadonlyArray<string>,
   ): Map<string, readonly [number, number, number]>
   ```
   When `kind === 'flow'`, dispatch to `resolveFlowLayout(nodes, layout, childrenOrder ?? nodes.map(n => n.id))`.

4. **Propagate `childrenOrder` through `resolveLayoutWithGroups`**: both the intra-group call (line 623) and the top-level call (line 749) must pass the appropriate `childrenOrder` slice. `resolveLayoutWithGroups` must accept `childrenOrder` (for the root) and `groupChildrenOrders: Map<string, ReadonlyArray<string>>` (per group, keyed by group ID) to look up the right sequence for each level.

### `packages/diagram/src/elements/diagram/compile.ts`

The compiler handler (in `compiler/handlers.ts`) extracts the layout DSL from children. It must recognize `FlowLayout` as a layout component and pass it through the same `extractLayout` path as `GridLayout`, `HierarchicalLayout`, and `ManualLayout`. It must also pass `childrenOrder` through to `DiagramDSL` and `DiagramGroupDSL`. Any call to `resolveLayoutWithGroups` in `compile.ts` must be updated to pass `childrenOrder` and `groupChildrenOrders`.

### Tests

- `packages/diagram/src/elements/diagram/compiler/__tests__/layoutAlgorithms.test.ts` — new `describe` block for `resolveFlowLayout` covering:
  - `top-down` basic sequence: 3 nodes, gap=2, expect y = 0, -3, -6 (assuming default 2-unit-high nodes)
  - `left-right` basic sequence: 3 nodes, gap=2, expect x = 0, 6, 12 (assuming default 4-unit-wide nodes)
  - Mixed-size nodes with correct edge-to-edge gap
  - Group-as-synthetic-block in flow sequence (correct size and placement)
  - Explicit position preservation: explicit node preserved, cursor advances past its footprint
  - Single-item degenerate case: one node at primary = 0
  - `childrenOrder` with interleaved nodes and groups: verify group synthetic block appears at the correct position in the sequence
  - `childrenOrder` absent / partial: defensive fallback appends missing ids

- `packages/diagram/src/elements/diagram/compiler/__tests__/layoutResolver.test.ts` — tests for:
  - `ResolvedFlowLayout` defaults via `DEFAULT_RESOLVED_FLOW`
  - `applyLayoutDefaultsWithTheme` with `kind: 'flow'` does NOT inherit hierarchical fields
  - `mergeResolvedLayouts` with `kind: 'flow'` merges only `gap`, `direction`, `groupPadding`, `titleGap`
  - Cascade: same-kind flow parent + flow child merges correctly
  - Cascade: flow child under grid parent replaces with flow defaults
  - Cascade: absent child under flow parent inherits flow

### Example scene

A new example scene in `apps/examples/` demonstrating Flow layout — a top-down pipeline where the diagram root uses FlowLayout and inner groups use GridLayout.

---

## Resolved Decisions

All of the following were open questions that have been resolved:

1. **Default direction: `'top-down'`** — consistent with `HierarchicalLayout`; most common ordered-list metaphor is vertical. Authors who need horizontal specify `direction="left-right"` explicitly.

2. **`margin` support: omitted from v1** — gap is already edge-to-edge. Adding `margin` would create confusing semantics (visual gap = `margin * 2 + gap`). Authors adjust `gap` directly. Can be added later without breaking changes.

3. **`alignment` for v2** — no known v1 consumer use case requires secondary-axis alignment beyond center. The secondary axis is always `0` (centered). Can be added later without breaking changes.

4. **`fill` distribution: v2+** — distributing total length across items has no known v1 use case.

5. **`disconnected` behavior** — FlowLayout ignores edges entirely. All items are placed in declaration order. No warning needed — FlowLayout is explicitly edge-agnostic.

6. **Y-axis sign convention: confirmed by code** — Grid rows go negative Y (line 122 of layoutAlgorithms.ts: `rowCenterY.push(prevY - ...)`). Hierarchical top-down goes negative Y (sign = -1). FlowLayout top-down follows the same convention: first item at y = 0, subsequent items at decreasing Y. For left-right: first item at x = 0, subsequent items at increasing X.

7. **Cascade with `ManualLayout` parent** — Rule 3 (different kind → replace with flow defaults) applies. The group gets FlowLayout with its own defaults, independent of the manual root. Verified in tests.

8. **`FlowLayout` as root theme `defaultKind`** — yes, valid. `DiagramThemeLayoutConfig.defaultKind` is extended to include `'flow'`.

---

## Constraints

The following existing behaviors must not break:

1. **`resolveLayout` unknown-kind fallback** — the guard at line 24 must include `'flow'` in its known-kinds check so that adding flow to the dispatch does not affect the fallback path for truly unknown kinds.
2. **All existing tests for `GridLayout`, `HierarchicalLayout`, and `ManualLayout`** — zero regressions allowed. The existing test suite in `layoutAlgorithms.test.ts` must pass unchanged.
3. **`resolveLayoutWithGroups` group-as-block mechanism** — the `__group__::id` synthetic node pattern works identically for `FlowLayout`. Group size is its already-computed padded bounding box. `childrenOrder` at the parent level includes the group's ID in the correct position.
4. **Explicit positions always preserved** — `FlowLayout` honors this invariant. A node with an explicit `position` prop is not moved; the cursor advances past its footprint to maintain correct spacing for subsequent items.
5. **`allExplicit` fast path in `resolveLayoutWithGroups`** — when every descendant in a group has an explicit position, the layout pass is skipped. This optimization is unaffected by `FlowLayout` being the group's resolved layout kind.
6. **Cascade merge rules** — `mergeResolvedLayouts` for `kind: 'flow'` must correctly carry forward `direction` and `gap` from a parent `ResolvedFlowLayout` when the child specifies only one of them.
7. **TypeScript discriminated union exhaustiveness** — any switch statement on `ResolvedLayout.kind` must either handle `'flow'` or the TypeScript compiler must produce an error. The architect must audit all such switches in `layoutAlgorithms.ts`, `layoutResolver.ts`, and `compile.ts`.
8. **`DiagramThemeLayoutConfig.defaultKind`** — extending this to include `'flow'` is additive (minor version bump); it must not break existing themes that use `'grid'`, `'hierarchical'`, or `'manual'`.
9. **`childrenOrder` backward compatibility** — `childrenOrder` is always populated by `handlers.ts` going forward. `resolveFlowLayout` must handle the defensive case where items appear in `nodes` but not in `childrenOrder` (append them in node-array order).
