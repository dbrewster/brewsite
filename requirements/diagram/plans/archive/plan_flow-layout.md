---
title: "Flow Layout Implementation Plan"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-04
---

# Flow Layout Implementation Plan

## Overview

This plan implements the `FlowLayout` sequential layout strategy for the `@brewsite/diagram` package. Flow layout arranges all items at a container level (diagram root or group) in a single line along a direction axis, in their JSX declaration order, with an edge-to-edge gap between adjacent items.

**Package affected:** `@brewsite/diagram` only. Zero changes to `@brewsite/core`.

**High-level scope of changes:**

| File | Type of change |
|---|---|
| `packages/diagram/src/elements/diagram/types.ts` | Add `FlowLayoutDSL`, `childrenOrder` fields, extend unions |
| `packages/diagram/src/elements/diagram/dsl.tsx` | Add `FlowLayout` component and `FlowLayoutProps` |
| `packages/diagram/src/compiler/handlers.ts` | Detect `FlowLayout`, populate `childrenOrder` |
| `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts` | Add `ResolvedFlowLayout`, `DEFAULT_RESOLVED_FLOW`, update cascade functions |
| `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts` | Add `resolveFlowLayout`, update dispatch guard, add `childrenOrder` param |
| `packages/diagram/src/elements/diagram/compile.ts` | Pass `childrenOrder` and `groupChildrenOrders` into `resolveLayoutWithGroups` |
| `packages/diagram/src/elements/diagram/compiler/__tests__/layoutAlgorithms.test.ts` | New `describe` block for `resolveFlowLayout` |
| `packages/diagram/src/elements/diagram/compiler/__tests__/layoutResolver.test.ts` | **Create new file** — tests for flow cascade, dispatch guard, defaults, merge |

---

## File-by-File Changes

### 1. `packages/diagram/src/elements/diagram/types.ts`

**Current state:** `LayoutDSL = GridLayoutDSL | HierarchicalLayoutDSL | ManualLayoutDSL`. `DiagramGroupDSL` has `nodeIds` and `childGroupIds` but no `childrenOrder`. `DiagramThemeLayoutConfig.defaultKind` is `'grid' | 'hierarchical' | 'manual'`.

**Changes required:**

#### 1a. Add `FlowLayoutDSL` interface

Add after `ManualLayoutDSL` (around line 413):

```typescript
/**
 * DSL props for <FlowLayout>.
 * Arranges all items at this container level in a single sequential line,
 * in their JSX declaration order, along the specified direction axis.
 * Does not extend BaseLayoutDSL — it uses a single `gap` instead of `spacing`/`margin`.
 */
export interface FlowLayoutDSL {
  readonly kind: 'flow';
  /**
   * Primary layout axis direction.
   * 'top-down'   — items stacked vertically; first item at top (y = 0), subsequent items at decreasing Y.
   * 'left-right' — items stacked horizontally; first item at x = 0, subsequent items at increasing X.
   * Default: 'top-down'
   */
  readonly direction?: 'top-down' | 'left-right';
  /**
   * Edge-to-edge gap between adjacent item footprints in diagram units.
   * Not center-to-center. Default: 2.
   */
  readonly gap?: number;
  /**
   * Padding inside group boundary boxes in diagram units (CSS shorthand).
   * Default: 1.5 (all sides)
   */
  readonly groupPadding?: LayoutPadding;
  /**
   * Gap between group title label and group content area in diagram units.
   * Default: 1
   */
  readonly titleGap?: number;
}
```

#### 1b. Extend `LayoutDSL` union

Replace current union definition (line 416):

```typescript
// Before:
export type LayoutDSL = GridLayoutDSL | HierarchicalLayoutDSL | ManualLayoutDSL;

// After:
export type LayoutDSL = GridLayoutDSL | HierarchicalLayoutDSL | ManualLayoutDSL | FlowLayoutDSL;
```

#### 1c. Add `childrenOrder` to `DiagramGroupDSL`

Add field to `DiagramGroupDSL` interface (after `childGroupIds`, around line 990):

```typescript
/**
 * Interleaved declaration order of direct children (node IDs and group IDs).
 * Populated by handlers.ts during DSL extraction.
 * Optional for backward compatibility — test helpers that construct DiagramGroupDSL
 * directly (e.g. makeGroup) do not need to supply this field.
 * resolveFlowLayout falls back to node-array order when absent.
 * Used by resolveFlowLayout to sequence items in JSX declaration order.
 */
readonly childrenOrder?: ReadonlyArray<string>;
```

#### 1d. Add `childrenOrder` to `DiagramDSL`

Add field to `DiagramDSL` interface (after `groups`, around line 1032):

```typescript
/**
 * Interleaved declaration order of direct top-level children (node IDs and group IDs).
 * Populated by handlers.ts during DSL extraction.
 * Optional for backward compatibility — see DiagramGroupDSL.childrenOrder.
 * resolveFlowLayout falls back to node-array order when absent.
 * Used by resolveFlowLayout to sequence root-level items in JSX declaration order.
 */
readonly childrenOrder?: ReadonlyArray<string>;
```

#### 1e. Extend `DiagramThemeLayoutConfig`

Modify `DiagramThemeLayoutConfig` interface (around line 141):

```typescript
export interface DiagramThemeLayoutConfig {
  // Change from:
  readonly defaultKind?: 'grid' | 'hierarchical' | 'manual';
  // To:
  readonly defaultKind?: 'grid' | 'hierarchical' | 'manual' | 'flow';

  // ... existing grid, hierarchical, manual fields unchanged ...

  /** Defaults applied when resolving a flow layout. */
  readonly flow?: {
    readonly direction?: 'top-down' | 'left-right';
    readonly gap?: number;
    readonly groupPadding?: LayoutPadding;
    readonly titleGap?: number;
  };
}
```

---

### 2. `packages/diagram/src/elements/diagram/dsl.tsx`

**Current state:** Exports `GridLayout`, `HierarchicalLayout`, `ManualLayout` components. No `FlowLayout`.

**Changes required:**

#### 2a. Add `FlowLayoutProps` interface and `FlowLayout` component

Add after `ManualLayout` (after line 350), before the `<Diagram>` section:

```typescript
// ─── <FlowLayout> ─────────────────────────────────────────────────────────────

export interface FlowLayoutProps {
  /**
   * Primary layout axis direction.
   * 'top-down'   — items stacked vertically (decreasing Y). Default.
   * 'left-right' — items stacked horizontally (increasing X).
   */
  direction?: 'top-down' | 'left-right';
  /**
   * Edge-to-edge gap between adjacent items in diagram units. Default: 2.
   */
  gap?: number;
  /** Padding inside group boundary boxes. Default: 1.5 (all sides) */
  groupPadding?: LayoutPadding;
  /** Gap between group title and content area. Default: 1 */
  titleGap?: number;
}

/**
 * Declares a sequential flow auto-layout for the parent <Diagram> or <DiagramGroup>.
 * Places all direct children in a single line in their JSX declaration order.
 * Items are positioned along the direction axis with edge-to-edge gap spacing.
 * Secondary axis (cross-axis) position is always 0 — items are center-aligned.
 * Must be a direct child of <Diagram> or <DiagramGroup>. At most one layout
 * element per container. Cascades with parent layouts of the same kind.
 *
 * @example
 * <Diagram id="pipeline">
 *   <FlowLayout direction="top-down" gap={2} />
 *   <DiagramNode id="input" label="Input" />
 *   <DiagramGroup id="processing">
 *     <GridLayout columns={3} />
 *     <DiagramNode id="p1" label="Step 1" />
 *   </DiagramGroup>
 *   <DiagramNode id="output" label="Output" />
 * </Diagram>
 */
export function FlowLayout(_props: FlowLayoutProps): null {
  return null;
}
```

---

### 3. `packages/diagram/src/compiler/handlers.ts`

**Current state:** `extractDiagramDSL` iterates children for `GridLayout`, `HierarchicalLayout`, `ManualLayout`. `collectGroup` does the same inside groups. Neither populates a `childrenOrder` field; the returned `DiagramDSL` and `DiagramGroupDSL` objects have no such field today.

**Changes required:**

#### 3a. Import `FlowLayout`

In the import block from `'../elements/diagram/dsl'` (around line 28–38), add `FlowLayout`:

```typescript
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  DiagramExit,
  DiagramEnter,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  FlowLayout,                        // ADD
} from '../elements/diagram/dsl';
```

#### 3b. Add `extractFlowLayoutProps` helper

Add alongside `extractLayoutProps` and `extractManualLayoutProps` inside `extractDiagramDSL` (around line 55):

```typescript
const extractFlowLayoutProps = (p: Record<string, unknown>) => ({
  ...(p.gap !== undefined && { gap: p.gap }),
  ...(p.direction !== undefined && { direction: p.direction }),
  ...(p.groupPadding !== undefined && { groupPadding: p.groupPadding }),
  ...(p.titleGap !== undefined && { titleGap: p.titleGap }),
});
```

#### 3c. Modify `collectGroup` to populate `childrenOrder` and detect `FlowLayout`

In `collectGroup` (starting at line 70), add a `childrenOrder: string[]` local array and push into it during child iteration. Also add `FlowLayout` detection alongside the other layout types.

**Complete replacement of the `collectGroup` for-loop body:**

```typescript
const collectGroup = (el: ReactElement, parentId?: string, warnFn?: DiagramWarnFn): string => {
  const elProps = el.props as Record<string, unknown>;
  const groupId = String(elProps.id);
  const nodeIds: string[] = [];
  const childGroupIds: string[] = [];
  const childrenOrder: string[] = [];       // NEW
  let groupLayoutDSL: LayoutDSL | undefined;
  const groupChildren = helpers.collectChildren(el);
  for (const gc of groupChildren) {
    if (!gc || typeof gc !== 'object' || !('type' in (gc as object))) continue;
    const gEl = gc as ReactElement;
    if (gEl.type === DiagramNode) {
      const nodeId = String((gEl.props as Record<string, unknown>).id);
      nodeIds.push(nodeId);
      childrenOrder.push(nodeId);           // NEW — push in declaration order
      groupedNodeIds.add(nodeId);
      nodes.push({ ...(gEl.props as DiagramNodeDSL), groupId });
    } else if (gEl.type === DiagramGroup) {
      const childId = collectGroup(gEl, groupId, warnFn);
      childGroupIds.push(childId);
      childrenOrder.push(childId);          // NEW — push in declaration order
    } else if (gEl.type === GridLayout) {
      const p = gEl.props as Record<string, unknown>;
      if (groupLayoutDSL) {
        console.warn(`Diagram collectGroup: multiple layout elements detected for group ${groupId}. Using the last one.`);
      }
      groupLayoutDSL = { kind: 'grid', ...extractLayoutProps(p) } as LayoutDSL;
    } else if (gEl.type === HierarchicalLayout) {
      const p = gEl.props as Record<string, unknown>;
      if (groupLayoutDSL) {
        console.warn(`Diagram collectGroup: multiple layout elements detected for group ${groupId}. Using the last one.`);
      }
      groupLayoutDSL = { kind: 'hierarchical', ...extractLayoutProps(p) } as LayoutDSL;
    } else if (gEl.type === ManualLayout) {
      const p = gEl.props as Record<string, unknown>;
      if (groupLayoutDSL) {
        console.warn(`Diagram collectGroup: multiple layout elements detected for group ${groupId}. Using the last one.`);
      }
      groupLayoutDSL = { kind: 'manual', ...extractManualLayoutProps(p) } as LayoutDSL;
    } else if (gEl.type === FlowLayout) {                           // NEW
      const p = gEl.props as Record<string, unknown>;
      if (groupLayoutDSL) {
        console.warn(`Diagram collectGroup: multiple layout elements detected for group ${groupId}. Using the last one.`);
      }
      groupLayoutDSL = { kind: 'flow', ...extractFlowLayoutProps(p) } as LayoutDSL;
    } else if (gEl.type === DiagramEnter || gEl.type === DiagramExit) {
      const componentName = gEl.type === DiagramEnter ? 'DiagramEnter' : 'DiagramExit';
      warnFn?.(
        'MISPLACED_DIAGRAM_TRANSITION',
        `<${componentName}> found inside <DiagramGroup id="${groupId}">. ` +
          `<${componentName}> must be a direct child of <Diagram>, not nested inside a group. ` +
          `Move it to be a sibling of the top-level <DiagramNode> and <DiagramGroup> elements.`,
      );
    }
  }

  groups.push({
    id: groupId,
    label: elProps.label !== undefined ? String(elProps.label) : undefined,
    variant: elProps.variant as DiagramGroupDSL['variant'],
    orientation: elProps.orientation as DiagramGroupDSL['orientation'],
    color: elProps.color as string | undefined,
    borderColor: elProps.borderColor as string | undefined,
    borderStyle: elProps.borderStyle as DiagramGroupDSL['borderStyle'],
    fillOpacity: elProps.fillOpacity as number | undefined,
    borderOpacity: elProps.borderOpacity as number | undefined,
    borderEmissiveColor: elProps.borderEmissiveColor as string | undefined,
    borderEmissiveIntensity: elProps.borderEmissiveIntensity as number | undefined,
    onMouseEnter: elProps.onMouseEnter as DiagramGroupDSL['onMouseEnter'],
    onMouseLeave: elProps.onMouseLeave as DiagramGroupDSL['onMouseLeave'],
    edgeLights: elProps.edgeLights as DiagramGroupDSL['edgeLights'],
    nodeIds,
    childGroupIds: childGroupIds.length > 0 ? childGroupIds : undefined,
    childrenOrder,                     // NEW
    parentId,
    layout: groupLayoutDSL,
  });

  return groupId;
};
```

#### 3d. Modify `extractDiagramDSL` to populate `childrenOrder` and detect `FlowLayout`

The existing code iterates children in two passes: first for layout/groups/transitions, then for nodes/edges. The `childrenOrder` for the diagram root must capture the interleaved node-and-group order from **one sequential pass** that sees all children in declaration order.

**Strategy:** Use a single preliminary pass that records declaration order, then keep the existing two-pass structure for the actual construction. More precisely: iterate `allChildren` once up front to record `childrenOrder`, then run the existing two passes unchanged (they don't need modification except to add `FlowLayout` detection in the first pass).

Alternatively — and this is simpler given the existing two-pass structure — add a pre-pass that just walks `allChildren` and appends to `childrenOrder`:

```typescript
// In extractDiagramDSL, after declaring allChildren and before the layout-detection pass:
const childrenOrder: string[] = [];
for (const child of allChildren) {
  if (!child || typeof child !== 'object' || !('type' in (child as object))) continue;
  const el = child as ReactElement;
  if (el.type === DiagramNode) {
    const id = String((el.props as Record<string, unknown>).id);
    childrenOrder.push(id);
  } else if (el.type === DiagramGroup) {
    const groupId = String((el.props as Record<string, unknown>).id);
    childrenOrder.push(groupId);
  }
}
```

**Add `FlowLayout` detection in the existing first pass** (alongside `GridLayout`, `HierarchicalLayout`, `ManualLayout`):

```typescript
} else if (el.type === FlowLayout) {
  const p = el.props as Record<string, unknown>;
  if (layoutDSL) {
    console.warn(`Diagram extractDiagramDSL: multiple layout elements detected for diagram ${String(props.id)}. Using the last one.`);
  }
  layoutDSL = { kind: 'flow', ...extractFlowLayoutProps(p) } as LayoutDSL;
}
```

**Add `childrenOrder` to the returned `DiagramDSL` object** (around line 190–203):

```typescript
return {
  id: String(props.id),
  layout: layoutDSL,
  nodes,
  edges,
  groups,
  childrenOrder,                  // NEW
  position: props.position as readonly [number, number, number] | undefined,
  rotation: props.rotation as readonly [number, number, number] | undefined,
  scale: props.scale as number | undefined,
  pivot: (props.pivot ?? 'center') as DiagramPivot,
  exit: exitDSL,
  enter: enterDSL,
  theme,
};
```

**Note on declaration order for `DiagramNode` at root level:** The current code processes nodes in a second pass (lines 177–188) because it needs to know which node IDs are `groupedNodeIds` before emitting top-level nodes. The `childrenOrder` pre-pass fires before both passes and records the declaration order from `allChildren` directly — this is correct because `allChildren` is already in JSX declaration order. The groupedness check only affects whether the node is emitted to the `nodes` array, not the order it was declared.

---

### 4. `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts`

**Current state:** `ResolvedLayout = ResolvedGridLayout | ResolvedHierarchicalLayout | ResolvedManualLayout`. Three corresponding defaults. `applyLayoutDefaultsWithTheme` uses `own.kind === 'grid' ? defaults.grid : defaults.hierarchical`. `mergeResolvedLayouts` falls through to generic field-spreading for non-manual kinds. `resolveThemeLayoutDefaults` produces `{ root, grid, hierarchical, manual }`. `ResolvedLayoutDefaults` has four fields.

**Changes required:**

#### 4a. Add `ResolvedFlowLayout` interface

Add after `ResolvedManualLayout` (after line 29):

```typescript
/** Fully resolved layout config for FlowLayout — all fields required. */
export interface ResolvedFlowLayout {
  readonly kind: 'flow';
  /** Primary layout axis. Default: 'top-down'. */
  readonly direction: 'top-down' | 'left-right';
  /** Edge-to-edge gap between adjacent items in diagram units. Default: 2. */
  readonly gap: number;
  /** Normalized group padding [top, right, bottom, left]. Default: [1.5, 1.5, 1.5, 1.5]. */
  readonly groupPadding: readonly [number, number, number, number];
  /** Gap between group title and content area in diagram units. Default: 1. */
  readonly titleGap: number;
}
```

#### 4b. Extend `ResolvedLayout` union

```typescript
// Before:
export type ResolvedLayout = ResolvedGridLayout | ResolvedHierarchicalLayout | ResolvedManualLayout;

// After:
export type ResolvedLayout = ResolvedGridLayout | ResolvedHierarchicalLayout | ResolvedManualLayout | ResolvedFlowLayout;
```

#### 4c. Add `DEFAULT_RESOLVED_FLOW` constant

Add after `DEFAULT_RESOLVED_MANUAL`:

```typescript
export const DEFAULT_RESOLVED_FLOW: ResolvedFlowLayout = {
  kind: 'flow',
  direction: 'top-down',
  gap: 2,
  groupPadding: DEFAULT_GROUP_PADDING_NORMALIZED,
  titleGap: DEFAULT_TITLE_GAP,
};
```

#### 4d. Extend `ResolvedLayoutDefaults` interface

```typescript
// Before:
export interface ResolvedLayoutDefaults {
  readonly root: ResolvedLayout;
  readonly grid: ResolvedGridLayout;
  readonly hierarchical: ResolvedHierarchicalLayout;
  readonly manual: ResolvedManualLayout;
}

// After:
export interface ResolvedLayoutDefaults {
  readonly root: ResolvedLayout;
  readonly grid: ResolvedGridLayout;
  readonly hierarchical: ResolvedHierarchicalLayout;
  readonly manual: ResolvedManualLayout;
  readonly flow: ResolvedFlowLayout;                    // ADD
}
```

#### 4e. Update `BASE_RESOLVED_LAYOUT_DEFAULTS`

```typescript
const BASE_RESOLVED_LAYOUT_DEFAULTS: ResolvedLayoutDefaults = {
  root: DEFAULT_RESOLVED_GRID,
  grid: DEFAULT_RESOLVED_GRID,
  hierarchical: DEFAULT_RESOLVED_HIERARCHICAL,
  manual: DEFAULT_RESOLVED_MANUAL,
  flow: DEFAULT_RESOLVED_FLOW,                          // ADD
};
```

#### 4f. Update `resolveThemeLayoutDefaults`

Add `flowDefaults` construction and update the returned object and the `root` resolution:

```typescript
export function resolveThemeLayoutDefaults(
  themeLayout: DiagramThemeLayoutConfig | undefined,
): ResolvedLayoutDefaults {
  // ... existing gridDefaults, hierarchicalDefaults, manualDefaults constructions unchanged ...

  const flowDefaults: ResolvedFlowLayout = {              // ADD
    ...DEFAULT_RESOLVED_FLOW,
    ...(themeLayout?.flow?.direction !== undefined && { direction: themeLayout.flow.direction }),
    ...(themeLayout?.flow?.gap !== undefined && { gap: themeLayout.flow.gap }),
    ...(themeLayout?.flow?.groupPadding !== undefined && { groupPadding: normalizeGroupPadding(themeLayout.flow.groupPadding) }),
    ...(themeLayout?.flow?.titleGap !== undefined && { titleGap: themeLayout.flow.titleGap }),
  };

  const root: ResolvedLayout = themeLayout?.defaultKind === 'hierarchical'
    ? hierarchicalDefaults
    : themeLayout?.defaultKind === 'manual'
      ? manualDefaults
      : themeLayout?.defaultKind === 'flow'           // ADD branch
        ? flowDefaults
        : gridDefaults;

  return {
    root,
    grid: gridDefaults,
    hierarchical: hierarchicalDefaults,
    manual: manualDefaults,
    flow: flowDefaults,                               // ADD
  };
}
```

#### 4g. Update `applyLayoutDefaultsWithTheme`

Add explicit `flow` branch to prevent silent inheritance of hierarchical fields:

```typescript
export function applyLayoutDefaultsWithTheme(
  own: LayoutDSL,
  defaults: ResolvedLayoutDefaults,
): ResolvedLayout {
  if (own.kind === 'manual') {
    return {
      ...defaults.manual,
      groupPadding: own.groupPadding !== undefined
        ? normalizeGroupPadding(own.groupPadding)
        : defaults.manual.groupPadding,
      titleGap: own.titleGap ?? defaults.manual.titleGap,
    };
  }
  if (own.kind === 'flow') {                           // ADD — explicit branch
    return {
      ...defaults.flow,
      ...(own.direction !== undefined && { direction: own.direction }),
      ...(own.gap !== undefined && { gap: own.gap }),
      ...(own.groupPadding !== undefined && { groupPadding: normalizeGroupPadding(own.groupPadding) }),
      ...(own.titleGap !== undefined && { titleGap: own.titleGap }),
    };
  }
  // Existing: 'grid' | 'hierarchical'
  const base = own.kind === 'grid' ? defaults.grid : defaults.hierarchical;
  return {
    ...base,
    ...(own.spacing !== undefined && { spacing: own.spacing }),
    ...(own.margin !== undefined && { margin: normalizeMargin(own.margin) }),
    ...(own.groupPadding !== undefined && { groupPadding: normalizeGroupPadding(own.groupPadding) }),
    ...(own.titleGap !== undefined && { titleGap: own.titleGap }),
    ...(own.alignment !== undefined && { alignment: own.alignment }),
    ...(own.disconnected !== undefined && { disconnected: own.disconnected }),
    ...(own.kind === 'grid' && own.columns !== undefined && { columns: own.columns }),
    ...(own.kind === 'hierarchical' && own.direction !== undefined && { direction: own.direction }),
  } as ResolvedLayout;
}
```

#### 4h. Update `mergeResolvedLayouts`

Add explicit `flow` branch before the generic field-spreading code. Without this, `FlowLayoutDSL.gap` is not present on `BaseLayoutDSL`, and TypeScript's `child.spacing` access on a `FlowLayoutDSL` would be a type error (it has no `spacing`):

```typescript
export function mergeResolvedLayouts(
  parent: ResolvedLayout,
  child: LayoutDSL,
): ResolvedLayout {
  const result = { ...parent } as Record<string, unknown>;
  if (child.kind === 'manual') {
    if (child.groupPadding !== undefined) result['groupPadding'] = normalizeGroupPadding(child.groupPadding);
    if (child.titleGap !== undefined) result['titleGap'] = child.titleGap;
    return result as unknown as ResolvedLayout;
  }
  if (child.kind === 'flow') {                          // ADD — explicit branch
    if (child.gap !== undefined) result['gap'] = child.gap;
    if (child.direction !== undefined) result['direction'] = child.direction;
    if (child.groupPadding !== undefined) result['groupPadding'] = normalizeGroupPadding(child.groupPadding);
    if (child.titleGap !== undefined) result['titleGap'] = child.titleGap;
    return result as unknown as ResolvedLayout;
  }
  // Existing: 'grid' | 'hierarchical'
  if (child.spacing !== undefined) result['spacing'] = child.spacing;
  if (child.margin !== undefined) result['margin'] = normalizeMargin(child.margin);
  if (child.groupPadding !== undefined) result['groupPadding'] = normalizeGroupPadding(child.groupPadding);
  if (child.titleGap !== undefined) result['titleGap'] = child.titleGap;
  if (child.alignment !== undefined) result['alignment'] = child.alignment;
  if (child.disconnected !== undefined) result['disconnected'] = child.disconnected;
  if (child.kind === 'grid' && child.columns !== undefined) result['columns'] = child.columns;
  if (child.kind === 'hierarchical' && child.direction !== undefined) result['direction'] = child.direction;
  return result as unknown as ResolvedLayout;
}
```

**Note:** `resolveEffectiveLayout` and `resolveGroupLayouts` require no logic changes — they call `applyLayoutDefaultsWithTheme` and `mergeResolvedLayouts` which now correctly handle `kind: 'flow'`. The discriminated union and cascade rules work identically for flow as for the existing kinds.

---

### 5. `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`

**Current state:** `resolveLayout` has a known-kinds guard at line 24 that falls back to grid for unknown kinds. `resolveLayoutWithGroups` calls `resolveLayout` at two sites — intra-group (line 623) and top-level (line 749) — without passing `childrenOrder`. No `resolveFlowLayout` function exists.

**Changes required:**

#### 5a. Add `ResolvedFlowLayout` to the import

At the top of the file, update the `layoutResolver` import:

```typescript
import type { ResolvedLayout, ResolvedGridLayout, ResolvedHierarchicalLayout, ResolvedFlowLayout } from './layoutResolver';
import {
  DEFAULT_RESOLVED_GRID,
} from './layoutResolver';
```

#### 5b. Update the dispatch guard at line 24

```typescript
// Before:
if (layoutKind !== 'manual' && layoutKind !== 'grid' && layoutKind !== 'hierarchical') {

// After:
if (layoutKind !== 'manual' && layoutKind !== 'grid' && layoutKind !== 'hierarchical' && layoutKind !== 'flow') {
```

Without this, any `kind: 'flow'` layout silently falls back to grid — a hard bug.

#### 5c. Update `resolveLayout` signature to accept `childrenOrder`

```typescript
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedLayout,
  onWarn?: DiagramWarnFn,
  childrenOrder?: ReadonlyArray<string>,                 // ADD optional param
): Map<string, readonly [number, number, number]> {
```

#### 5d. Add `flow` dispatch inside `resolveLayout`

After the dispatch guard and before `if (layout.kind === 'manual')`, add:

```typescript
  if (layout.kind === 'flow') {
    return resolveFlowLayout(nodes, layout as ResolvedFlowLayout, childrenOrder ?? nodes.map((n) => n.id));
  }
```

The full function body for the existing `'manual'` and `'grid'` branches is unchanged.

#### 5e. Add `resolveFlowLayout` function

Add this function **before** `resolveLayout` (so it can be called from within `resolveLayout` without forward-reference issues, though in TypeScript function declarations hoist — either order is fine):

```typescript
/**
 * Assigns [x, y, z] positions to all items in declaration order along a single axis.
 * Items are placed edge-to-edge with `layout.gap` empty space between adjacent footprints.
 * Secondary axis is always 0 (center-aligned).
 *
 * Items with explicit positions are preserved. The cursor advances past their footprint
 * so that subsequent auto-placed items maintain correct edge-to-edge spacing.
 *
 * Items present in `nodes` but absent from `childrenOrder` are appended defensively
 * in node-array order (handles old compiled data without childrenOrder).
 */
export function resolveFlowLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  layout: ResolvedFlowLayout,
  childrenOrder: ReadonlyArray<string>,
): Map<string, readonly [number, number, number]> {
  const positions = new Map<string, readonly [number, number, number]>();
  const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2];
  const isTopDown = layout.direction !== 'left-right';
  const gap = layout.gap;

  // Build a lookup for O(1) access.
  const nodeById = new Map<string, DiagramNodeDSL>(nodes.map((n) => [n.id, n]));

  // Seed explicit positions.
  for (const n of nodes) {
    if (n.position) positions.set(n.id, n.position);
  }

  // Sort items by childrenOrder, restricted to ids present in this layout invocation.
  const nodeIdSet = new Set<string>(nodes.map((n) => n.id));
  const orderedIds: string[] = childrenOrder.filter((id) => nodeIdSet.has(id));

  // Defensive: append any ids present in nodes but absent from childrenOrder.
  for (const n of nodes) {
    if (!orderedIds.includes(n.id)) orderedIds.push(n.id);
  }

  // Place items sequentially.
  // cursor tracks the leading edge (in diagram units) along the primary axis consumed so far.
  // top-down: Y decreases, cursor tracks distance moved downward (always ≥ 0).
  // left-right: X increases, cursor tracks distance moved rightward (always ≥ 0).
  let cursor = 0;

  for (const id of orderedIds) {
    const node = nodeById.get(id);
    if (!node) continue;

    const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
    const primarySize = isTopDown ? h : w;
    const halfPrimary = primarySize / 2;

    if (node.position) {
      // Explicit position: do not overwrite, but advance cursor past this item's footprint.
      // For top-down: the item occupies from (primaryPos - halfPrimary) to (primaryPos + halfPrimary)
      // in absolute Y. We track cursor as "how many units down from origin have we consumed".
      // The item occupies from -primaryPos - halfPrimary to -primaryPos + halfPrimary in decreasing-Y space.
      // Simplest conservative approach: advance cursor to max(cursor, distance_to_item_trailing_edge + gap).
      // We skip the cursor advance for explicit items to avoid needing their absolute coordinate
      // system reconciliation — explicit items are assumed to be placed by the author with awareness
      // of surrounding context. cursor only advances for auto-placed items.
      // The gap between an explicit item and the next auto-placed item is therefore determined
      // by where the auto-placer's cursor ends up, which may overlap if the explicit item is
      // not near the cursor. This is the same behavior as grid/hierarchical for explicit items.
      continue;
    }

    // Auto-place: center of item on primary axis.
    // top-down: center Y = -(cursor + halfPrimary)  [decreasing Y, first item at y=0 when cursor=0]
    // left-right: center X = cursor + halfPrimary   [increasing X, first item at x=0 when cursor=0]
    const centerPrimary = isTopDown
      ? -(cursor + halfPrimary)    // top-down: negative Y
      : (cursor + halfPrimary);    // left-right: positive X

    const x = isTopDown ? 0 : centerPrimary;
    const y = isTopDown ? centerPrimary : 0;
    const z = 0;

    positions.set(id, [x, y, z]);
    cursor += primarySize + gap;
  }

  return positions;
}
```

**Algorithm correctness notes:**

- **top-down, 2-unit-high nodes, gap=2, first 3 nodes:**
  - Node 0: cursor=0, half=1, centerY = -(0+1) = -1 → NOT -1. Wait — first item Y should be 0 per the spec ("first item at top, y = 0").

  Re-reading the note: "first item is at the top (y = 0)" means the item's CENTER is at y = 0. So for the first item of height 2:
  - half = 1, cursor = 0, centerY = -(0 + 1) = -1. That's not y=0.

  The spec says "first item at y=0" meaning center y=0. Let me reconcile: if cursor starts at 0 and the first item has halfPrimary=1, then placing center at -(0 + halfPrimary) = -1 puts the item centered at y=-1, top edge at y=0. The TOP of the item is at y=0.

  Looking at the grid algorithm: `rowCenterY[0] = 0` — the first row's CENTER is at y=0, and subsequent rows go negative. So first item CENTER is at y=0 for grid. For hierarchical: first level is at y=0.

  Flow should match: first item CENTER at y=0. For top-down with first item height h:
  - cursor = 0 → centerY = 0 (the item center), trailing edge = -(h/2)
  - Next item cursor = h + gap, centerY = -(h + gap + h2/2)

  **Corrected algorithm:** The cursor represents the trailing edge of the last placed item (absolute Y value going negative). Starting cursor = 0 means "we start at y=0 for center of first item":

  ```
  // For top-down:
  // cursor = current "bottom edge" in decreasing-Y space (starts at 0 = center of first item's top)
  // Actually simpler: cursor tracks center of first item = 0.
  // After placing item N at centerY = -cursor (where cursor accumulates h/2 + gap + h_next/2)
  ```

  Cleanest formulation with cursor as the Y-center of the current item (only for top-down):
  - cursor = 0 for first item (center at y=0)
  - After placing item i: cursor = cursor - (h_i/2 + gap + h_{i+1}/2)

  But this requires lookahead. Instead, track the "leading edge" (top edge of next item to place):
  - leadingEdge = 0 (top edge of first item when first item center y = h/2)

  Actually the simplest approach consistent with the note's example: "top-down: first item at y=0, subsequent items at decreasing Y" means center of first item = 0:

  ```
  let cursor = 0; // next item center on primary axis (Y for top-down)
  // top-down: center Y = cursor, then advance: cursor -= (h_i/2 + gap + h_next/2)
  ```

  But this also requires lookahead. **Best approach:** cursor tracks the "far edge" of the last placed item. For top-down (decreasing Y), "far edge" = bottom edge:

  ```
  let cursor = 0; // next item's top edge (Y coord, for top-down: first item's top edge = 0, center = -h/2)
  // Wait, we want first item center = 0.
  ```

  **Final decision — tracking CUMULATIVE distance from origin:**

  Use `accum` as the total primary-axis distance consumed from the origin (always non-negative):
  - accum=0 before first item
  - top-down: center Y of item = -(accum + halfPrimary); after placing: accum += primarySize + gap
  - left-right: center X of item = accum + halfPrimary; after placing: accum += primarySize + gap

  For first item (accum=0, halfPrimary=1 for h=2): centerY = -(0+1) = -1. That places center at y=-1, top edge at y=0. **The top edge of the first item is at y=0**, which is consistent with how grid places its first row center at y=0 (a 2-unit-high node has top edge at y=1).

  Actually re-reading grid: `rowCenterY[0] = 0` — first row center is at y=0. The first item center is at y=0 for grid. For flow to be consistent with grid's convention (first item center at y=0), we need center = 0 for first item.

  **Revised formula:** Let `accum` start at `halfPrimary` for the first item:
  - centerY = -accum (top-down)
  - After placing: accum += halfPrimary + gap + halfPrimary_next

  This requires next item's size. Instead, use the simpler approach where:
  - centerY = -(accum + halfPrimary) with accum=0 gives center at -(0+h/2) = -h/2
  - This is inconsistent with grid (center=0 for first item)

  **Resolution:** The note's test expectations say:
  > "top-down basic sequence: 3 nodes, gap=2, expect y = 0, -3, -6 (assuming default 2-unit-high nodes)"

  With 2-unit-high nodes (h=2, half=1) and gap=2:
  - Item 0: y = 0. accum must be 0 when we want center = 0. So: centerY = -(accum), not -(accum + half).
  - After item 0: accum += h + gap = 2 + 2 = 4? Then item 1 center = -4? But expected -3.
  - Expected: y0=0, y1=-3, y2=-6. Difference = 3 = h + gap = 2 + 1? But gap=2, so 2+2=4≠3.

  Wait, gap=2 and h=2: first item center y=0 (top edge y=1, bottom edge y=-1). Second item center y=-3 (top edge y=-2, bottom edge y=-4). Gap between bottom edge of item 0 (y=-1) and top edge of item 1 (y=-2) = 1 unit. But gap=2?

  Actually: gap in the spec is "edge-to-edge distance", and with h=2 nodes: top edge of first item at y=1, bottom edge at y=-1. Second item top edge at y=-3, bottom edge at y=-5. Gap between y=-1 and y=-3 is 2 units — correct! So center to center = 3 = h + gap = 2 + 2? No, 2 + 2 = 4 ≠ 3.

  Wait: h=2, gap=1 gives center-to-center = h + gap = 3. But the spec says default gap=2. Let me re-read the test expectation: "expect y = 0, -3, -6 (assuming default 2-unit-high nodes)". gap=2, h=2, y-separation=3. 3 = h + gap - 1? That doesn't make sense dimensionally.

  Actually: if first item center is at y=0, top edge = +1, bottom edge = -1. With edge-to-edge gap = 2, the next item's top edge = -1 - 2 = -3. Second item center = -3 - 1 (halfHeight) = -4. But the expected value is -3 for center.

  Hmm. Let me try: if the first item's TOP edge is at y=0 (not center):
  - Item 0: top = 0, center = -1 (h=2, half=1), bottom = -2
  - Gap = 2 → next top = -2 - 2 = -4, center = -5 — doesn't match -3 either.

  Let me try the note's left-right expectation: "expect x = 0, 6, 12 (assuming default 4-unit-wide nodes)" with gap=2.
  - x-separation = 6. w=4, gap=2, separation = 4 + 2 = 6. ✓ center-to-center distance = w + gap.
  - Item 0 center at x=0, item 1 center at x=6, item 2 center at x=12.
  - Item 0 left edge = -2, right edge = +2.
  - Gap between item 0 right (x=2) and item 1 left (x=6-2=4) = 2. ✓ edge-to-edge gap = 2.

  So for left-right with first center at x=0: center_i = i * (w + gap).

  Back to top-down: "expect y = 0, -3, -6" with h=2, gap=2. Separation = 3. But w+gap = 2+2 = 4 ≠ 3. So the test expectations in the note use gap=1? Or h=2 and gap=1?

  Actually re-reading: "expect y = 0, -3, -6 (assuming default 2-unit-high nodes)". Default gap is 2. h=2, gap=2, center-to-center = h+gap = 4. So y would be 0, -4, -8, not 0, -3, -6.

  The note's test expectations may have an error, or they're using a different gap. Let me use gap=1 for that test case (not the default): "3 nodes, gap=1, 2-unit-high → y=0,-3,-6" — 3 = h + gap = 2 + 1. That works.

  The plan should specify the test cases correctly. I'll spec the tests with explicit gap values to avoid ambiguity. For the algorithm:

  **Correct algorithm for first item center at y=0 (top-down) / x=0 (left-right):**
  - `accum` = cumulative primary-axis distance from origin to LEADING EDGE of current item
  - top-down: center Y = -(accum + halfPrimary); first item: accum=0, halfPrimary=h/2, centerY = -h/2
  - But we want centerY = 0 for first item. That requires accum = -h/2 initially — doesn't make sense.

  **Alternative: start accum at 0, but define "center of item = accum":**
  - top-down: centerY_i = -accum; after placing: accum += h_i/2 + gap + h_{i+1}/2
  - Item 0: accum=0, centerY=0. After: accum += 1 + gap + 1 = 2 + gap.
  - Item 1: accum = 2+gap, centerY = -(2+gap). For gap=2: centerY = -4. For gap=1: centerY = -3.

  For gap=1: y0=0, y1=-3, y2=-6 ✓ (matches note's test expectation if gap=1).

  This requires the next item's halfPrimary in the advance step — lookahead. This is clean but needs the next item's size before we process it.

  **Simpler: track LEADING EDGE only, compute center from it.**
  - `leadingEdge` = 0 initially (this is the "start" position on primary axis, going into negative Y for top-down)
  - top-down: center Y = -(leadingEdge + halfPrimary); after: leadingEdge += primarySize + gap
  - Item 0: leadingEdge=0, center=-halfPrimary. For h=2: center=-1. Not 0.

  For center=0 we need leadingEdge = -halfPrimary initially. For h=2: leadingEdge = -1. Doesn't generalize.

  **Conclusion:** The cleanest formulation that matches left-right (x=0 for first item center) and is symmetric is to track the RUNNING center (not edge):
  - top-down: center_0 = 0, center_{i+1} = center_i - (h_i/2 + gap + h_{i+1}/2)
  - left-right: center_0 = 0, center_{i+1} = center_i + (w_i/2 + gap + w_{i+1}/2)

  This is slightly non-trivial to implement without lookahead. A clean equivalent:
  - Track `accum` = absolute primary-axis distance from origin to center of current item.
  - Initialize: accum = 0.
  - After placing item i at center=accum: accumulate to next by: accum += primarySize_i/2 + gap + primarySize_{i+1}/2.
  - But we need size of next item during the current iteration → lookahead.

  **Practical implementation (cleaner, no lookahead):**

  Track `nextLeading` = the PRIMARY-AXIS coordinate of the LEADING EDGE of the next item to place (for top-down, the Y-coord of the top edge; for left-right, the X-coord of the left edge). Leading edge is where the next item starts.

  ```typescript
  // top-down: leading edge descends (more negative Y over time)
  // left-right: leading edge advances (more positive X over time)
  let nextLeading = 0; // for top-down: top edge of first item at y=0; for left-right: left edge at x=0

  for (const id of orderedIds) {
    const node = nodeById.get(id);
    if (!node) continue;
    const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
    const primarySize = isTopDown ? h : w;
    const halfPrimary = primarySize / 2;

    if (node.position) continue; // explicit: skip auto-placement (don't update nextLeading)

    if (isTopDown) {
      // Leading edge = nextLeading (the top edge, at y = nextLeading or equivalently at +nextLeading from origin,
      // but since Y decreases, "top" of item means most-positive Y).
      // Center Y = nextLeading - halfPrimary  (first item: nextLeading=0, centerY = -halfPrimary)
      const centerY = nextLeading - halfPrimary;
      positions.set(id, [0, centerY, 0]);
      nextLeading = centerY - halfPrimary - gap; // = nextLeading - primarySize - gap
    } else {
      // Leading edge = nextLeading (left edge at x = nextLeading)
      const centerX = nextLeading + halfPrimary;
      positions.set(id, [centerX, 0, 0]);
      nextLeading = centerX + halfPrimary + gap; // = nextLeading + primarySize + gap
    }
  }
  ```

  With this formulation for top-down, h=2, gap=1, nextLeading starts at 0:
  - Item 0: centerY = 0 - 1 = -1; nextLeading = -1 - 1 - 1 = -3
  - Item 1: centerY = -3 - 1 = -4; nextLeading = -4 - 1 - 1 = -6
  - Item 2: centerY = -6 - 1 = -7

  That gives y = -1, -4, -7, not 0, -3, -6. The note's expectation of y=0 for first item is NOT achieved.

  Let me try the grid convention: first row center at y=0. For flow to match this:
  - nextLeading = halfPrimary initially (so first item center = nextLeading - halfPrimary = 0)
  - top-down with h=2: nextLeading = 1, centerY = 1-1=0 ✓
  - After: nextLeading = 0 - 1 - gap = -1 - gap
  - Item 1: centerY = -1 - gap - 1 = -(2 + gap) = -(h + gap). For gap=1: -3. For gap=2: -4.

  **This works!** Initialize `nextLeading = halfPrimary_of_first_item`. But first item's halfPrimary is unknown until we read the first item. Simple fix: process the list once to get first item's halfPrimary, or use a running approach.

  Actually, the simplest and most correct approach:

  ```typescript
  // Determine initial nextLeading from first auto-placed item
  // We do this by pre-computing: nextLeading = halfPrimary of first auto item.
  // Simpler: don't use nextLeading, just track accum = "total primary-axis span consumed so far"
  // and compute center from half of current item + accum.

  // accum = total span consumed (always non-negative)
  // top-down: center_i = -(accum + halfPrimary_i), then accum += primarySize_i + gap
  // left-right: center_i = accum + halfPrimary_i, then accum += primarySize_i + gap

  // For first item (accum=0, h=2, half=1): center_top_down = -(0+1) = -1
  // For grid, first center = 0. These disagree.
  ```

  The key question: does the note REQUIRE first item at center y=0, or at top-edge y=0?

  The note says: "first item is at the top (y = 0)" — this is ambiguous. Looking at the left-right spec: "First item is at x = 0; subsequent items at increasing X." For left-right with w=4, first center at x=0, nextLeading starts at 0 and center = 0 + halfW = 2. That's center x=2, not x=0.

  **The note means the center is at 0 for the first item in left-right too.** The example "expect x = 0, 6, 12" confirms this (center x=0 for first item of width 4 — its left edge is at x=-2).

  So the spec is: center of first item = [0, 0] in the primary axis. For top-down: center_0.Y = 0. For left-right: center_0.X = 0.

  Implementation with this requirement:

  ```typescript
  // accum tracks "center position of next item" on primary axis
  // top-down: starts at 0, goes negative
  // left-right: starts at 0, goes positive

  let primaryCenter = 0; // center of the NEXT item to place on primary axis

  for (const id of orderedIds) {
    const node = nodeById.get(id);
    if (!node) continue;
    const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
    const primarySize = isTopDown ? h : w;
    const halfPrimary = primarySize / 2;

    if (node.position) continue;

    if (isTopDown) {
      positions.set(id, [0, primaryCenter, 0]);
      primaryCenter -= primarySize + gap;
    } else {
      positions.set(id, [primaryCenter, 0, 0]);
      primaryCenter += primarySize + gap;
    }
  }
  ```

  Checking with h=2, gap=1, top-down: centers = 0, -3, -6. ✓ (matches note)
  Checking with w=4, gap=2, left-right: centers = 0, 6, 12. ✓ (matches note)

  **This is the correct algorithm.** The `primaryCenter` variable directly tracks the center coordinate of the next item. The advance is `primarySize + gap` (center-to-center distance = size + edge-to-edge-gap — this is correct because center-to-center = half_i + gap + half_{i+1} = h_i/2 + gap + h_i/2 = h_i + gap when all items have the same size, but for mixed sizes: center_i to center_{i+1} = h_i/2 + gap + h_{i+1}/2).

  **For mixed sizes, `primaryCenter += primarySize + gap` is WRONG.** It assumes uniform size. Correct advance:
  `primaryCenter_{i+1} = primaryCenter_i ± (halfPrimary_i + gap + halfPrimary_{i+1})` — requires lookahead.

  The correct no-lookahead formulation: track the TRAILING EDGE of the last placed item.

  ```typescript
  let trailingEdge = 0; // primary-axis coord of the trailing edge of the last item placed
                        // top-down: most-negative Y reached; left-right: most-positive X reached
  let firstItem = true;

  for (const id of orderedIds) {
    const node = nodeById.get(id);
    if (!node) continue;
    const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
    const primarySize = isTopDown ? h : w;
    const halfPrimary = primarySize / 2;

    if (node.position) continue;

    let center: number;
    if (firstItem) {
      center = 0; // first item always centered at 0 on primary axis
      firstItem = false;
    } else {
      // Leading edge of this item = trailingEdge ± gap
      // center = leadingEdge ± halfPrimary
      if (isTopDown) {
        // Leading edge = trailingEdge - gap (going negative)
        center = trailingEdge - gap - halfPrimary;
      } else {
        // Leading edge = trailingEdge + gap (going positive)
        center = trailingEdge + gap + halfPrimary;
      }
    }

    // Update trailing edge
    if (isTopDown) {
      trailingEdge = center - halfPrimary; // bottom edge (most negative Y)
    } else {
      trailingEdge = center + halfPrimary; // right edge (most positive X)
    }

    positions.set(id, isTopDown ? [0, center, 0] : [center, 0, 0]);
  }
  ```

  Checking top-down, nodes h=[2,4,2], gap=1:
  - Item 0 (h=2): center=0, half=1, trailing=-1
  - Item 1 (h=4): center=-1-1-2=-4, half=2, trailing=-4-2=-6
  - Item 2 (h=2): center=-6-1-1=-8, half=1, trailing=-9
  - Edge-to-edge gaps: (-1) to (-4-2=-6? No: item1 top = -4+2=-2, gap from -1 to -2 = 1 ✓
  - Item 1 bottom = -4-2=-6. Item 2 top = -8+1=-7. Gap from -6 to -7 = 1 ✓

  Checking top-down, nodes h=[2,2,2], gap=1:
  - Item 0: center=0, trailing=-1
  - Item 1: center=-1-1-1=-3, trailing=-4
  - Item 2: center=-4-1-1=-6, trailing=-7
  - Centers: 0, -3, -6 ✓

  Checking left-right, nodes w=[4,4,4], gap=2:
  - Item 0: center=0, trailing=2
  - Item 1: center=2+2+2=6, trailing=8
  - Item 2: center=8+2+2=12, trailing=14
  - Centers: 0, 6, 12 ✓

  **This is the correct algorithm.** The plan must use this formulation.

The correct `resolveFlowLayout` implementation is:

```typescript
export function resolveFlowLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  layout: ResolvedFlowLayout,
  childrenOrder: ReadonlyArray<string>,
): Map<string, readonly [number, number, number]> {
  const positions = new Map<string, readonly [number, number, number]>();
  const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2];
  const isTopDown = layout.direction !== 'left-right';
  const gap = layout.gap;

  const nodeById = new Map<string, DiagramNodeDSL>(nodes.map((n) => [n.id, n]));

  // Seed explicit positions.
  for (const n of nodes) {
    if (n.position) positions.set(n.id, n.position);
  }

  // Build ordered list: childrenOrder filtered to ids present in this level, then append any missing.
  const nodeIdSet = new Set<string>(nodes.map((n) => n.id));
  const orderedIds: string[] = childrenOrder.filter((id) => nodeIdSet.has(id));
  // Defensive: append any ids present in nodes but absent from childrenOrder (O(n), not O(n²)).
  const orderedIdSet = new Set<string>(orderedIds);
  for (const n of nodes) {
    if (!orderedIdSet.has(n.id)) {
      orderedIds.push(n.id);
      orderedIdSet.add(n.id);
    }
  }

  // Place items sequentially.
  // trailingEdge = the primary-axis coordinate of the TRAILING edge of the last auto-placed item.
  // top-down: trailing edge is the bottom edge (most negative Y value reached).
  // left-right: trailing edge is the right edge (most positive X value reached).
  let trailingEdge = 0;
  let firstAutoItem = true;

  for (const id of orderedIds) {
    const node = nodeById.get(id);
    if (!node) continue;

    const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
    const primarySize = isTopDown ? h : w;
    const halfPrimary = primarySize / 2;

    if (node.position) {
      // Explicit position: preserve it and skip auto-placement.
      // Do not update trailingEdge; explicit items are assumed placed by the author.
      continue;
    }

    let center: number;
    if (firstAutoItem) {
      // First auto-placed item is centered at the primary-axis origin.
      center = 0;
      firstAutoItem = false;
    } else {
      // Subsequent items: leading edge = trailingEdge ± gap, center = leading ± half.
      if (isTopDown) {
        center = trailingEdge - gap - halfPrimary;
      } else {
        center = trailingEdge + gap + halfPrimary;
      }
    }

    // Update trailing edge for the next item.
    trailingEdge = isTopDown
      ? center - halfPrimary   // bottom edge (most negative Y)
      : center + halfPrimary;  // right edge (most positive X)

    const x = isTopDown ? 0 : center;
    const y = isTopDown ? center : 0;
    positions.set(id, [x, y, 0]);
  }

  return positions;
}
```

**Edge-case behaviour (document in tests and implementation):**
- **Zero items:** If `nodes` is empty, `orderedIds` is empty, the for-loop body never executes, and the function returns an empty `Map`. Correct by construction — no special case needed.
- **Phantom IDs in `childrenOrder`:** IDs in `childrenOrder` that are not present in `nodes` are filtered out by the `nodeIdSet.has(id)` check before cursor placement begins. They are silently dropped — no crash, no warning. The resulting positions map only contains IDs that appear in `nodes`.

#### 5f. Update `resolveLayoutWithGroups` to thread `childrenOrder` through

`resolveLayoutWithGroups` calls `resolveLayout` at two sites. Both need `childrenOrder` passed in.

**New signature for `resolveLayoutWithGroups`:**

```typescript
export function resolveLayoutWithGroups(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  groups: ReadonlyArray<DiagramGroupDSL>,
  rootLayout: ResolvedLayout,
  groupLayouts: Map<string, ResolvedLayout>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
  onWarn?: DiagramWarnFn,
  rootChildrenOrder?: ReadonlyArray<string>,             // NEW — for top-level flow
  groupChildrenOrders?: Map<string, ReadonlyArray<string>>,  // NEW — per-group childrenOrder
): Map<string, readonly [number, number, number]>
```

**Intra-group call (line 623):**
```typescript
// Before:
const rawLocalPositions = resolveLayout(virtualNodes, virtualEdges, groupLayout, onWarn);

// After:
const groupOrder = groupChildrenOrders?.get(group.id);
const rawLocalPositions = resolveLayout(virtualNodes, virtualEdges, groupLayout, onWarn, groupOrder);
```

**Top-level call (line 749):**
```typescript
// Before:
const topLevelPositions = resolveLayout(topLevelLayoutNodes, topLevelEdges, rootLayout, onWarn);

// After:
const topLevelPositions = resolveLayout(topLevelLayoutNodes, topLevelEdges, rootLayout, onWarn, rootChildrenOrder);
```

**The early-return for manual/no-groups (line 513):**
```typescript
// Before:
if (rootLayout.kind === 'manual' || groups.length === 0) {
  return resolveLayout(nodes, edges, rootLayout, onWarn);
}

// After:
if (rootLayout.kind === 'manual' || groups.length === 0) {
  return resolveLayout(nodes, edges, rootLayout, onWarn, rootChildrenOrder);
}
```

**childrenOrder for virtualNodes:** When building `virtualNodes` (synthetic nodes for the group layout pass), the `childrenOrder` for that group contains IDs of real nodes AND group IDs (e.g., `['node1', 'childGroup1', 'node2']`). The synthetic node for a child group has ID `__group__::childGroupId`. The `resolveFlowLayout` function filters its input `nodes` to `nodeIdSet` — the synthetic node ID won't match the group ID from `childrenOrder`.

To handle this correctly: when building `groupChildrenOrders`, remap group IDs in `childrenOrder` to their synthetic node IDs (`__group__::groupId`). This remapping must happen in `resolveLayoutWithGroups` when threading the order to the intra-group `resolveLayout` call:

```typescript
const groupOrder = groupChildrenOrders?.get(group.id);
const remappedGroupOrder = groupOrder?.map((id) =>
  childGroupIdSet.has(id) ? groupNodeId(id) : id,
);
const rawLocalPositions = resolveLayout(virtualNodes, virtualEdges, groupLayout, onWarn, remappedGroupOrder);
```

Similarly for the top-level pass: the `rootChildrenOrder` contains real node IDs and top-level group IDs; the synthetic nodes use `groupNodeId(groupId)`. Remap:

```typescript
const remappedRootOrder = rootChildrenOrder?.map((id) =>
  topLevelGroups.some((g) => g.id === id) ? groupNodeId(id) : id,
);
const topLevelPositions = resolveLayout(topLevelLayoutNodes, topLevelEdges, rootLayout, onWarn, remappedRootOrder);
```

---

### 6. `packages/diagram/src/elements/diagram/compile.ts`

**Current state:** `compileDiagram` calls `resolveLayoutWithGroups(dsl.nodes, dsl.edges, dsl.groups, rootLayout, groupLayouts, sizeWithDepthMap, onWarn)` — 7 arguments.

**Changes required:**

Build `groupChildrenOrders` from `dsl.groups` and pass both it and `dsl.childrenOrder` to `resolveLayoutWithGroups`:

```typescript
// After the groupLayouts computation (around line 100):
// childrenOrder is optional on DiagramGroupDSL — use nullish fallback for absent field.
const groupChildrenOrders = new Map<string, ReadonlyArray<string>>(
  dsl.groups.map((g) => [g.id, g.childrenOrder ?? []]),
);

// Update the resolveLayoutWithGroups call (around line 125):
const positions = resolveLayoutWithGroups(
  dsl.nodes,
  dsl.edges,
  dsl.groups,
  rootLayout,
  groupLayouts,
  sizeWithDepthMap,
  onWarn,
  dsl.childrenOrder ?? [],       // NEW — childrenOrder is optional; empty array triggers defensive fallback
  groupChildrenOrders,           // NEW
);
```

---

## Sequencing Dependency: Bottom-Up Group Resolution

**Q: Does `resolveFlowLayout` at a parent container level need child groups' bounding boxes before it runs?**

**A: Yes, and the existing `resolveLayoutWithGroups` already handles this correctly.**

`resolveLayoutWithGroups` processes groups in **bottom-up topological order** (leaves first, parents last) via `topologicalSortGroups`. By the time a parent group's intra-group layout pass runs, all child groups already have their `GroupInfo` with `size` (the padded bounding box `[paddedW, paddedH]`). The child groups are represented as synthetic `__group__::id` nodes with that size. Flow layout treats them identically to regular nodes — it reads their size and places them sequentially.

No change to the ordering logic is required. `resolveFlowLayout` is completely compatible with the existing bottom-up sequencing.

**Q: Does the top-level flow pass need group sizes?**

Yes — by the time the top-level pass runs (after the group loop), all `groupInfoMap` entries exist and synthetic nodes for top-level groups are built from `info.size`. The top-level flow pass (via `resolveLayout` → `resolveFlowLayout`) sees only `DiagramNodeDSL` items (real nodes and synthetic group nodes), all with sizes already determined. This is correct.

---

## Test Strategy

### File: `packages/diagram/src/elements/diagram/compiler/__tests__/layoutAlgorithms.test.ts`

Add a new `describe('resolveFlowLayout', ...)` block. Import `resolveFlowLayout` and `DEFAULT_RESOLVED_FLOW`.

```typescript
import { resolveLayout, resolveLayoutWithGroups, computeBounds, resolveFlowLayout } from '../layoutAlgorithms';
import { DEFAULT_RESOLVED_FLOW } from '../layoutResolver';
import type { ResolvedFlowLayout } from '../layoutResolver';

const flow = (overrides: Partial<ResolvedFlowLayout> = {}): ResolvedFlowLayout =>
  ({ ...DEFAULT_RESOLVED_FLOW, ...overrides });
```

#### Tests to write:

**Test 1 — top-down, 3 uniform nodes, gap=1:**
```typescript
it('top-down: places 3 uniform nodes with centers at 0, -3, -6 (h=2, gap=1)', () => {
  const nodes = [makeNode('a', { size: [4, 2] }), makeNode('b', { size: [4, 2] }), makeNode('c', { size: [4, 2] })];
  const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap: 1 }), ['a', 'b', 'c']);
  expect(result.get('a')).toEqual([0, 0, 0]);
  expect(result.get('b')).toEqual([0, -3, 0]);
  expect(result.get('c')).toEqual([0, -6, 0]);
});
```

**Test 2 — left-right, 3 uniform nodes, gap=2:**
```typescript
it('left-right: places 3 uniform nodes with centers at 0, 6, 12 (w=4, gap=2)', () => {
  const nodes = [makeNode('a', { size: [4, 2] }), makeNode('b', { size: [4, 2] }), makeNode('c', { size: [4, 2] })];
  const result = resolveFlowLayout(nodes, flow({ direction: 'left-right', gap: 2 }), ['a', 'b', 'c']);
  expect(result.get('a')).toEqual([0, 0, 0]);
  expect(result.get('b')).toEqual([6, 0, 0]);
  expect(result.get('c')).toEqual([12, 0, 0]);
});
```

**Test 3 — top-down, mixed heights, gap=2:**
```typescript
it('top-down: mixed heights maintain correct edge-to-edge gap', () => {
  const nodes = [makeNode('a', { size: [4, 2] }), makeNode('b', { size: [4, 4] }), makeNode('c', { size: [4, 2] })];
  const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap: 2 }), ['a', 'b', 'c']);
  // a: center=0, half=1, bottom=-1
  // b: center=-1-2-2=-5, half=2, bottom=-7
  // c: center=-7-2-1=-10, half=1, bottom=-11
  expect(result.get('a')).toEqual([0, 0, 0]);
  expect(result.get('b')).toEqual([0, -5, 0]);
  expect(result.get('c')).toEqual([0, -10, 0]);
  // Verify edge-to-edge gaps:
  // a bottom = 0 - 1 = -1; b top = -5 + 2 = -3; gap = |-3 - (-1)| = 2 ✓
  // b bottom = -5 - 2 = -7; c top = -10 + 1 = -9; gap = |-9 - (-7)| = 2 ✓
});
```

**Test 4 — gap=0 edge case:**
```typescript
it('gap=0: items placed immediately adjacent (no space between)', () => {
  const nodes = [makeNode('a', { size: [4, 2] }), makeNode('b', { size: [4, 2] })];
  const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap: 0 }), ['a', 'b']);
  expect(result.get('a')).toEqual([0, 0, 0]);
  // a: center=0, half=1, bottom=-1; b: center=-1-0-1=-2
  expect(result.get('b')).toEqual([0, -2, 0]);
});
```

**Test 5 — single item:**
```typescript
it('single item: placed at primary axis origin', () => {
  const nodes = [makeNode('solo', { size: [6, 3] })];
  const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap: 2 }), ['solo']);
  expect(result.get('solo')).toEqual([0, 0, 0]);
});
```

**Test 6 — childrenOrder sorts items correctly:**
```typescript
it('childrenOrder determines placement sequence regardless of nodes array order', () => {
  const nodes = [makeNode('c'), makeNode('a'), makeNode('b')];
  const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap: 1 }), ['a', 'b', 'c']);
  // a placed first (center=0), b second, c third
  const aY = result.get('a')![1];
  const bY = result.get('b')![1];
  const cY = result.get('c')![1];
  expect(aY).toBeGreaterThan(bY!); // a is above b (higher Y = more positive)
  expect(bY).toBeGreaterThan(cY!); // b is above c
});
```

**Test 7 — synthetic group block in flow sequence:**
```typescript
it('synthetic group block (__group__::id) is treated as a regular node by size', () => {
  // Flow layout receives synthetic nodes for child groups with their padded sizes.
  const nodes = [
    makeNode('a', { size: [4, 2] }),
    makeNode('__group__::grp', { size: [8, 6], label: '__group__::grp' }),
    makeNode('b', { size: [4, 2] }),
  ];
  const result = resolveFlowLayout(
    nodes,
    flow({ direction: 'top-down', gap: 2 }),
    ['a', '__group__::grp', 'b'],
  );
  expect(result.get('a')).toEqual([0, 0, 0]);
  // a: center=0, half=1, bottom=-1; grp: center=-1-2-3=-6, half=3, bottom=-9
  expect(result.get('__group__::grp')).toEqual([0, -6, 0]);
  // grp bottom=-9; b: center=-9-2-1=-12
  expect(result.get('b')).toEqual([0, -12, 0]);
});
```

**Test 8 — explicit position preserved, cursor continues:**
```typescript
it('explicit position preserved; subsequent auto-placed items continue from where cursor left off', () => {
  const nodes = [
    makeNode('a', { size: [4, 2] }),
    makeNode('b', { size: [4, 2], position: [10, 5, 0] as [number, number, number] }),
    makeNode('c', { size: [4, 2] }),
  ];
  const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap: 1 }), ['a', 'b', 'c']);
  // a: auto-placed at center=0 (first auto item)
  expect(result.get('a')).toEqual([0, 0, 0]);
  // b: explicit, preserved
  expect(result.get('b')).toEqual([10, 5, 0]);
  // c: next auto item after a; b is explicit so cursor only advances after a.
  // After a: trailingEdge = -1; c: center = -1-1-1 = -3
  expect(result.get('c')).toEqual([0, -3, 0]);
});
```

**Test 9 — childrenOrder partial (defensive fallback):**
```typescript
it('items missing from childrenOrder are appended after ordered items', () => {
  const nodes = [makeNode('a'), makeNode('b'), makeNode('orphan')];
  const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap: 1 }), ['a', 'b']);
  // a and b placed in order; orphan appended after
  const aY = result.get('a')![1];
  const bY = result.get('b')![1];
  const orphanY = result.get('orphan')![1];
  expect(aY).toBeGreaterThan(bY!);
  expect(bY).toBeGreaterThan(orphanY!);
});
```

**Test 10 — dispatch guard: placed in a new `describe('resolveLayout — flow dispatch', ...)` block (separate from `resolveFlowLayout` tests, since this tests the dispatch layer, not the algorithm directly):**
```typescript
describe('resolveLayout — flow dispatch', () => {
  it('resolveLayout dispatches to flow behavior for kind=flow (not grid fallback)', () => {
    const nodes = [makeNode('a', { size: [4, 2] }), makeNode('b', { size: [4, 2] })];
    const result = resolveLayout(nodes, [], DEFAULT_RESOLVED_FLOW, undefined, ['a', 'b']);
    // Flow top-down: a at y=0 (first auto item), b at y=-4 (trailingEdge=-1, center=-1-2-1=-4).
    // Grid would place both at y=0 with different x values — this verifies flow dispatch.
    expect(result.get('a')).toEqual([0, 0, 0]);
    expect(result.get('b')).toEqual([0, -4, 0]);
  });
});
```

**Tests 11–12 — placed inside the `resolveFlowLayout` describe block:**

```typescript
it('empty nodes array returns empty positions map', () => {
  const result = resolveFlowLayout([], flow({ direction: 'top-down', gap: 2 }), []);
  expect(result.size).toBe(0);
});

it('childrenOrder entries not present in nodes are silently dropped', () => {
  const nodes = [makeNode('a', { size: [4, 2] }), makeNode('b', { size: [4, 2] })];
  const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap: 1 }), ['a', 'phantom', 'b']);
  // a above b; phantom not in result
  expect(result.get('a')![1]).toBeGreaterThan(result.get('b')![1]);
  expect(result.has('phantom')).toBe(false);
  expect(result.size).toBe(2);
});
```

**Test 13 — `resolveLayoutWithGroups` integration: placed in a new `describe('resolveLayoutWithGroups with FlowLayout', ...)` block alongside the existing `resolveLayoutWithGroups` describe. Call `resolveLayoutWithGroups` directly — do NOT modify the `resolveWithGroups` test wrapper.**

```typescript
describe('resolveLayoutWithGroups with FlowLayout', () => {
  it('flow root with [node, group, node] in childrenOrder: correct top-down sequencing', () => {
    const nodes = [
      makeNode('a', { size: [4, 2] }),
      makeNode('b', { size: [4, 2] }),   // inside group g1
      makeNode('c', { size: [4, 2] }),
    ];
    const groups: DiagramGroupDSL[] = [
      { id: 'g1', label: 'g1', nodeIds: ['b'], childrenOrder: ['b'] },
    ];
    const rootLayout: ResolvedFlowLayout = { ...DEFAULT_RESOLVED_FLOW, direction: 'top-down', gap: 2 };
    const groupLayouts = new Map<string, ResolvedLayout>();
    const sizes = new Map<string, readonly [number, number]>([
      ['a', [4, 2]], ['b', [4, 2]], ['c', [4, 2]],
    ]);
    const rootChildrenOrder = ['a', 'g1', 'c'];
    const groupChildrenOrders = new Map([['g1', ['b']]]);

    const result = resolveLayoutWithGroups(
      nodes, [], groups, rootLayout, groupLayouts, sizes, undefined,
      rootChildrenOrder, groupChildrenOrders,
    );

    // top-down: a at top (most positive Y), then g1 block, then c
    const aY = result.get('a')![1];
    const bY = result.get('b')![1];   // b's absolute Y is determined by g1's placement
    const cY = result.get('c')![1];

    expect(aY).toBeGreaterThan(bY);   // a above g1's content
    expect(bY).toBeGreaterThan(cY);   // g1's content above c
  });
});
```

Note: this test directly verifies the group-ID→synthetic-node-ID remapping (`childGroupIdSet.has(id) ? groupNodeId(id) : id`) that the isolated unit tests cannot cover.

### File: `packages/diagram/src/elements/diagram/compiler/__tests__/layoutResolver.test.ts`

**This file does not exist — create it.** Developer B2 (Stream B2, Phase 1) creates this file.

```typescript
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RESOLVED_FLOW,
  DEFAULT_RESOLVED_GRID,
  DEFAULT_RESOLVED_HIERARCHICAL,
  applyLayoutDefaultsWithTheme,
  mergeResolvedLayouts,
  resolveEffectiveLayout,
  resolveThemeLayoutDefaults,
} from '../layoutResolver';
import type { ResolvedFlowLayout, ResolvedGridLayout } from '../layoutResolver';
import type { DiagramThemeLayoutConfig } from '../../types';
```

**Note on `BASE_RESOLVED_LAYOUT_DEFAULTS`:** This constant is currently unexported from `layoutResolver.ts`. Do **not** export it to satisfy tests. Instead, call `resolveThemeLayoutDefaults(undefined)` to obtain a baseline defaults object wherever a test needs to call `applyLayoutDefaultsWithTheme` with unthemed defaults. This keeps the exported surface clean.

Tests:
1. `DEFAULT_RESOLVED_FLOW` has correct defaults: kind='flow', direction='top-down', gap=2
2. `applyLayoutDefaultsWithTheme` with `kind: 'flow'` returns `ResolvedFlowLayout` with only flow fields (no `spacing`, `margin`, `alignment`, `disconnected`)
3. `applyLayoutDefaultsWithTheme` with `kind: 'flow'` does NOT silently inherit hierarchical defaults
4. `mergeResolvedLayouts` with flow parent + flow child: child `gap` wins, parent `direction` preserved when child omits it
5. `resolveEffectiveLayout` with flow parent + absent child: inherits flow parent as-is
6. `resolveEffectiveLayout` with grid parent + flow child: flow defaults applied (no grid fields inherited)
7. `resolveThemeLayoutDefaults` with `defaultKind: 'flow'`: `root` is `ResolvedFlowLayout`
8. `resolveThemeLayoutDefaults` with `flow: { gap: 3 }`: flow defaults have gap=3

---

## Parallelization Schedule

### Work Streams (5 independent tracks)

The 5 files that can be worked in parallel map to 3 independent streams with 1 sequential dependency.

```
PHASE 1 (all parallel — no shared files):
  Stream A:  types.ts + dsl.tsx
  Stream B:  layoutResolver.ts
  Stream B2: layoutResolver.test.ts (NEW FILE — create)
  Stream C:  layoutAlgorithms.test.ts (write tests first; algorithm will be added later)

PHASE 2 (depends on Phase 1 completing):
  Stream D: layoutAlgorithms.ts (depends on types.ts for FlowLayoutDSL, layoutResolver.ts for ResolvedFlowLayout)
  Stream E: handlers.ts (depends on types.ts for DiagramGroupDSL.childrenOrder, dsl.tsx for FlowLayout)

PHASE 3 (depends on Phase 2 completing):
  Stream F: compile.ts (depends on layoutAlgorithms.ts new signature, types.ts for DiagramDSL.childrenOrder)
```

### Stream A — types.ts + dsl.tsx (Phase 1)

**Developer A** works on:
- `packages/diagram/src/elements/diagram/types.ts` — add `FlowLayoutDSL`, extend `LayoutDSL`, add `childrenOrder` to `DiagramGroupDSL` and `DiagramDSL`, extend `DiagramThemeLayoutConfig`
- `packages/diagram/src/elements/diagram/dsl.tsx` — add `FlowLayoutProps` and `FlowLayout` component

These two files are tightly coupled (dsl.tsx uses types from types.ts), so they belong to one developer.

### Stream B — layoutResolver.ts (Phase 1)

**Developer B** works on:
- `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts` — add `ResolvedFlowLayout`, `DEFAULT_RESOLVED_FLOW`, extend `ResolvedLayoutDefaults`, update `resolveThemeLayoutDefaults`, `applyLayoutDefaultsWithTheme`, `mergeResolvedLayouts`

**Dependency check:** `mergeResolvedLayouts(parent, child: LayoutDSL)` — if `LayoutDSL` is updated to include `FlowLayoutDSL` (Stream A), TypeScript will enforce the correct narrowing. Stream B can safely write the code now; it just won't typecheck until Stream A merges. For a development workflow, Streams A and B can proceed simultaneously but must be integrated before running `typecheck`.

### Stream B2 — layoutResolver.test.ts (Phase 1, NEW FILE)

**Developer B2** works on:
- `packages/diagram/src/elements/diagram/compiler/__tests__/layoutResolver.test.ts` — **CREATE NEW FILE**. Write all 8 tests specified in the `layoutResolver.test.ts` section above (default constant shape, cascade-from-theme, merge behaviour for flow, `resolveThemeLayoutDefaults` with flow kind and custom defaults). See that section for the complete test list and import paths.

Stream B2 can be authored simultaneously with Stream B, but will fail typecheck until Stream B delivers `ResolvedFlowLayout` and the flow exports. Integrate after Stream B in the final typecheck pass.

**Dependency check:** Depends on Stream B (`ResolvedFlowLayout`, `DEFAULT_RESOLVED_FLOW`) and Stream A (`FlowLayoutDSL` in `LayoutDSL` union for `mergeResolvedLayouts` narrowing). Authoring can proceed immediately; typechecking requires both A and B to be merged first.

### Stream C — layoutAlgorithms.test.ts (Phase 1)

**Developer C** writes the `resolveFlowLayout` test suite. Tests can be written against the interface defined in this plan before `resolveFlowLayout` is implemented. They will fail until Stream D delivers the implementation.

### Stream D — layoutAlgorithms.ts (Phase 2)

**Developer D** works on:
- `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts` — add `resolveFlowLayout` function, update dispatch guard, update `resolveLayout` and `resolveLayoutWithGroups` signatures

Depends on: Stream A (`FlowLayoutDSL` in types.ts), Stream B (`ResolvedFlowLayout` from layoutResolver.ts).

### Stream E — handlers.ts (Phase 2)

**Developer E** works on:
- `packages/diagram/src/compiler/handlers.ts` — import `FlowLayout`, add `extractFlowLayoutProps`, update `collectGroup` to track `childrenOrder`, update `extractDiagramDSL` to track `childrenOrder` and detect `FlowLayout`

Depends on: Stream A (`FlowLayout` from dsl.tsx, `childrenOrder` fields in types.ts).

### Stream F — compile.ts (Phase 3)

**Developer F** works on:
- `packages/diagram/src/elements/diagram/compile.ts` — build `groupChildrenOrders`, pass `dsl.childrenOrder` and `groupChildrenOrders` to `resolveLayoutWithGroups`

Depends on: Stream D (new `resolveLayoutWithGroups` signature), Stream E (`dsl.childrenOrder` field populated by handlers.ts).

### Dependency Graph

```
Stream A ──┬──→ Stream D ──→ Stream F
           │
Stream B ──┘
           │
Stream B2 ─┘  (authoring only; needs A+B merged to typecheck)

Stream C (tests, independent — runs and fails until Stream D complete)

Stream E (depends on A only) ──→ Stream F
```

### File Ownership Table

| File | Stream | Phase |
|---|---|---|
| `types.ts` | A | 1 |
| `dsl.tsx` | A | 1 |
| `layoutResolver.ts` | B | 1 |
| `layoutResolver.test.ts` **(NEW FILE)** | B2 | 1 |
| `layoutAlgorithms.test.ts` | C | 1 |
| `layoutAlgorithms.ts` | D | 2 |
| `compiler/handlers.ts` | E | 2 |
| `compile.ts` | F | 3 |

No two streams modify the same file simultaneously. Zero merge conflicts if streams stay on their assigned files.

---

## TypeScript Exhaustiveness Audit

Any switch or conditional on `ResolvedLayout.kind` or `LayoutDSL.kind` must be updated to handle `'flow'`:

**In `layoutAlgorithms.ts`:**
- The dispatch guard (line 24): updated per section 5b.
- The if-chain for `layout.kind`: `if (layout.kind === 'flow')` added per section 5d.

**In `layoutResolver.ts`:**
- `applyLayoutDefaultsWithTheme`: explicit flow branch added per section 4g.
- `mergeResolvedLayouts`: explicit flow branch added per section 4h.
- `resolveThemeLayoutDefaults`: root resolution chain updated per section 4f.

**In `compile.ts`:**
- No switch on `ResolvedLayout.kind` exists in compile.ts — it passes the resolved layout opaquely to `resolveLayoutWithGroups`. No change needed.

**In `layoutResolver.ts → resolveEffectiveLayout`:**
- No switch — the function calls `mergeResolvedLayouts` or `applyLayoutDefaultsWithTheme`, both of which now handle `'flow'`. No additional change.

**In `layoutResolver.ts → resolveGroupLayouts`:**
- No switch — calls `resolveEffectiveLayout`. No additional change.

---

## Constraints Verified

1. ✅ `resolveLayout` unknown-kind fallback guard updated to include `'flow'` — no silent fallback to grid.
2. ✅ Existing grid/hierarchical/manual tests untouched — `resolveFlowLayout` is a new function, dispatch guard addition is additive.
3. ✅ `resolveLayoutWithGroups` group-as-block mechanism unchanged — synthetic `__group__::id` nodes work identically for flow.
4. ✅ Explicit positions always preserved — `resolveFlowLayout` skips auto-placement for `node.position` non-null.
5. ✅ `allExplicit` fast path in `resolveLayoutWithGroups` — unaffected (it skips the `resolveLayout` call entirely; no flow code runs).
6. ✅ Cascade merge rules — `mergeResolvedLayouts` flow branch correctly threads `direction` and `gap`.
7. ✅ TypeScript discriminated union exhaustiveness — all `kind`-switches audited above.
8. ✅ `DiagramThemeLayoutConfig.defaultKind` extension is additive — existing themes unaffected.
9. ✅ `childrenOrder` backward compatibility — `resolveFlowLayout` appends items missing from `childrenOrder` in node-array order.

---

## Summary

Seven files change. Three independent development streams can run in Phase 1 (types+dsl, layoutResolver, tests). Two streams run in Phase 2 (algorithm, handlers). One stream integrates in Phase 3 (compile). The entire feature can ship with zero regressions against existing tests and zero changes to `@brewsite/core`.
