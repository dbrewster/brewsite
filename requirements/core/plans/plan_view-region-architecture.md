---
title: "Implementation Plan: View/Region Architecture"
doc_type: plan
owner: Toolkit Architecture
status: active
updated: 2026-03-12
---

# Implementation Plan: View/Region Architecture

## Table of Contents

1. [Overview](#1-overview)
2. [Work Stream Map](#2-work-stream-map)
3. [Stream A — Core Layout Types Extension](#3-stream-a--core-layout-types-extension)
4. [Stream B — Core Compiler DSL + Handlers](#4-stream-b--core-compiler-dsl--handlers)
5. [Stream C — Diagram groupCompiler Refactor](#5-stream-c--diagram-groupcompiler-refactor)
6. [Stream D — Chart + Model Bounds Composition](#6-stream-d--chart--model-bounds-composition)
7. [Stream E — Backward Compatibility Snapshots + Examples](#7-stream-e--backward-compatibility-snapshots--examples)
8. [Cross-Stream File Ownership Matrix](#8-cross-stream-file-ownership-matrix)
9. [Dependency Graph](#9-dependency-graph)

---

## 1. Overview

This plan implements the View/Region Architecture as specified in `requirements/core/notes/note_view-region-architecture.md`. The work is decomposed into five streams (A–E) designed for parallel execution by up to five developers. No two streams touch the same file.

**Milestones from the note map to streams as follows:**

| Note Milestone | Stream(s) | Description |
|---|---|---|
| Milestone 1 (shared region infra) | A, C | Types + helpers in core; diagram groupCompiler refactor |
| Milestone 2 (View + ViewLayout DSL) | B | DSL blocks, handlers, `composeBounds` on CompileApi |
| Milestone 3 (cross-package integration) | D | Chart + Model composeBounds integration |
| Backward compatibility verification | E | Snapshot tests, integration examples |

**Milestone 4 (slides)** is out of scope per the note's conditional status.

---

## 2. Work Stream Map

```
Stream A (Core Layout Types)
    │
    ├── Stream B (Core Compiler DSL + Handlers)  ── depends on A
    ├── Stream C (Diagram groupCompiler Refactor) ── depends on A
    └── Stream D (Chart + Model Bounds)           ── depends on A AND B
                │
                └── Stream E (Snapshots + Examples) ── depends on B, C, D
```

**Stream A** must complete before B, C, D can start. **Stream B** must complete before Stream D can start (D's widget handler changes call `api.composeBounds`, which is not on `CompileApi` until B lands the type change — TypeScript strict mode rejects access to undeclared properties). **Stream C** is parallel with B. Stream D's pure-function work in `compile.ts` (adding the optional `composeBoundsFn` parameter) has no type dependency on B and can be written speculatively, but the widget handler call sites (`ChartWidget.ts`, `ModelWidget.ts`) and their tests cannot typecheck until B merges. Stream E waits for all of B, C, D.

---

## 3. Stream A — Core Layout Types Extension

**Goal:** Add region type primitives and pure helper functions to `packages/core/src/layout/`. No DSL, no compiler changes, no Three.js.

### Files to Create

#### 3.1 `packages/core/src/layout/regionTypes.ts`

Single responsibility: Region type contracts — no runtime, no Three.js, no React.

```typescript
// Region type contracts for spatial composition.
// No runtime, no Three.js, no React.

import type { NVSRect } from './types';

/**
 * RegionBounds is NVSRect — not a parallel concept.
 * All region math operates on NVSRect directly.
 */
export type RegionBounds = NVSRect;

/**
 * Padding specification for a region.
 * Can be a single uniform value, a [vertical, horizontal] pair,
 * or a full [top, right, bottom, left] tuple.
 *
 * All values are NVS fractions [0..1] relative to the parent region.
 */
export type RegionPadding =
  | number
  | readonly [number, number]
  | readonly [number, number, number, number];

/**
 * Normalized padding — always a 4-tuple [top, right, bottom, left].
 * All values are NVS fractions.
 */
export type NormalizedPadding = readonly [number, number, number, number];

/**
 * Static contract for a region's spatial configuration.
 * Used by the compiler to resolve a region's effective bounds.
 */
export type RegionContract = {
  /** The NVS bounds of this region within its parent (or viewport if root). */
  readonly bounds: NVSRect;
  /** Padding inset from bounds edges. */
  readonly padding: RegionPadding;
};

/**
 * A fully resolved region with computed content area.
 * Produced by resolveRegion() from a RegionContract.
 */
export type ResolvedRegion = {
  /** Outer bounds (same as input RegionContract.bounds). */
  readonly outerBounds: NVSRect;
  /** Inner content bounds after padding is applied. */
  readonly contentBounds: NVSRect;
  /** Resolved padding [top, right, bottom, left]. */
  readonly padding: NormalizedPadding;
  /**
   * Z-order layer for overlapping views. Default: 0.
   * Higher values render in front of lower values.
   * Set by layout managers (e.g., carousel active = highest layer).
   */
  readonly layer: number;
};

/**
 * Layout policy discriminator for ViewLayout.
 */
export type ViewLayoutKind = 'stack' | 'carousel';

/**
 * Configuration for the 'stack' layout policy.
 */
export type StackLayoutConfig = {
  readonly kind: 'stack';
  /** Direction of stacking. Default: 'horizontal'. */
  readonly direction?: 'horizontal' | 'vertical';
  /** NVS gap between views. Default: 0. */
  readonly gap?: number;
};

/**
 * Configuration for the 'carousel' layout policy.
 */
export type CarouselLayoutConfig = {
  readonly kind: 'carousel';
  /** 0-indexed active view. */
  readonly activeIndex: number;
  /** NVS gap between adjacent views. Default: 0.04. */
  readonly gap?: number;
  /** Scale factor for inactive views. Default: 0.75. */
  readonly inactiveScale?: number;
  /** NVS z-step per position from active. Default: 0.1. */
  readonly zStep?: number;
};

/**
 * Union of all layout policy configurations.
 */
export type ViewLayoutConfig = StackLayoutConfig | CarouselLayoutConfig;

/**
 * Result of layout resolution for a single view within a ViewLayout.
 */
export type ViewLayoutResult = {
  /** Resolved NVS bounds for this view. */
  readonly bounds: NVSRect;
  /** Layer (z-order) for this view. Higher = front. */
  readonly layer: number;
  /** Scale factor applied to this view (1.0 = full size). */
  readonly scale: number;
};
```

**Exports:** `RegionBounds`, `RegionPadding`, `NormalizedPadding`, `RegionContract`, `ResolvedRegion`, `ViewLayoutKind`, `StackLayoutConfig`, `CarouselLayoutConfig`, `ViewLayoutConfig`, `ViewLayoutResult`.

**Imports:** Only `NVSRect` from `./types`.

**Forbidden imports:** Three.js, React, runtime, compiler, any other element.

---

#### 3.2 `packages/core/src/layout/regionNormalize.ts`

Single responsibility: Pure functions for padding normalization, region resolution, and bounds composition.

```typescript
// Pure region helpers — padding normalization, inset computation, bounds composition.
// No Three.js, no React.

import type { NVSRect } from './types';
import type {
  RegionPadding,
  NormalizedPadding,
  RegionContract,
  ResolvedRegion,
} from './regionTypes';
```

**Exported functions:**

##### `normalizePadding(padding: RegionPadding): NormalizedPadding`

Converts any `RegionPadding` variant to a `[top, right, bottom, left]` tuple.

- `number` → `[n, n, n, n]`
- `[v, h]` → `[v, h, v, h]`
- `[t, r, b, l]` → `[t, r, b, l]`

Returns `[0, 0, 0, 0]` for `0` or any invalid input.

##### `applyPaddingToRect(rect: NVSRect, padding: NormalizedPadding): NVSRect`

Returns the inner content rect after applying padding insets. Clamps to non-negative width/height.

```
result.x = rect.x + padding[3]         // left
result.y = rect.y + padding[0]         // top
result.w = max(0, rect.w - padding[1] - padding[3])  // right + left
result.h = max(0, rect.h - padding[0] - padding[2])  // top + bottom
```

##### `resolveRegion(contract: RegionContract): ResolvedRegion`

Combines `normalizePadding` + `applyPaddingToRect` into a `ResolvedRegion` with `layer: 0`.

##### `composeBoundsIntoParent(localRect: NVSRect, parentRect: NVSRect): NVSRect`

Maps a child's local [0..1] coordinates into the parent's absolute NVS sub-rect.

```
absolute.x = parent.x + local.x * parent.w
absolute.y = parent.y + local.y * parent.h
absolute.w = local.w * parent.w
absolute.h = local.h * parent.h
```

This is the mathematical kernel of `api.composeBounds()`. The identity case (no parent) is handled by the caller passing `{ x: 0, y: 0, w: 1, h: 1 }` as `parentRect`.

##### `unionBounds(a: NVSRect, b: NVSRect): NVSRect`

Returns the smallest axis-aligned bounding rect containing both `a` and `b`. Extracted from diagram's `groupCompiler.ts` as a shared primitive.

```
minX = min(a.x, b.x)
minY = min(a.y, b.y)
maxX = max(a.x + a.w, b.x + b.w)
maxY = max(a.y + a.h, b.y + b.h)
result = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
```

**Imports:** `NVSRect` from `./types`; region types from `./regionTypes`.

**Forbidden imports:** Three.js, React, compiler, runtime.

---

#### 3.3 `packages/core/src/layout/regionLayout.ts`

Single responsibility: Layout policy resolution — computes per-view placement from a layout config and child size hints.

```typescript
// Layout policy resolution for ViewLayout — pure math, no Three.js, no React.

import type { NVSRect } from './types';
import type {
  ViewLayoutConfig,
  ViewLayoutResult,
  StackLayoutConfig,
  CarouselLayoutConfig,
} from './regionTypes';
```

**Exported functions:**

##### `resolveLayout(config: ViewLayoutConfig, containerBounds: NVSRect, childSizeHints: ReadonlyArray<{ w: number; h: number }>): ReadonlyArray<ViewLayoutResult>`

Dispatches to `resolveStackLayout` or `resolveCarouselLayout` based on `config.kind`.

- `childSizeHints` is an array parallel to the views. Each entry provides the authored `w`/`h` for that view. Views without explicit size hints use equal distribution within the container.
- Returns one `ViewLayoutResult` per child.

##### `resolveStackLayout(config: StackLayoutConfig, containerBounds: NVSRect, childSizeHints: ReadonlyArray<{ w: number; h: number }>): ReadonlyArray<ViewLayoutResult>`

Stack layout algorithm:

1. Determine axis: horizontal → x-axis placement; vertical → y-axis placement.
2. Resolve gap: `config.gap ?? 0`.
3. For horizontal:
   - Total gap space = `(N - 1) * gap` where N = child count.
   - If all children have explicit `w`, use those widths. Otherwise, distribute remaining space equally among children without explicit `w`.
   - Place child N at x = `containerBounds.x + sum(widths[0..N-1]) + N * gap`.
   - Each child gets `y = containerBounds.y`, `h = containerBounds.h`.
4. For vertical: same logic along y-axis with heights.
5. All views get `layer: 0`, `scale: 1.0`.

##### `resolveCarouselLayout(config: CarouselLayoutConfig, containerBounds: NVSRect, childSizeHints: ReadonlyArray<{ w: number; h: number }>): ReadonlyArray<ViewLayoutResult>`

Carousel layout algorithm:

1. Resolve defaults: `gap = config.gap ?? 0.04`, `inactiveScale = config.inactiveScale ?? 0.75`, `zStep = config.zStep ?? 0.1`.
2. Clamp `activeIndex` to `[0, N-1]`.
3. For each child at index `i`:
   - `distance = |i - activeIndex|` (positions from active).
   - `scale = distance === 0 ? 1.0 : inactiveScale ** distance`.
   - `layer = N - distance` (active gets highest layer).
4. Compute horizontal placement:
   - Active view: centered within `containerBounds` at `x = containerBounds.x + (containerBounds.w - activeWidth) / 2`.
   - Views to the left of active (i < activeIndex): placed rightward from the left edge of the active view, offset by cumulative `(scaledWidth / 2 + gap)` for each step away.
   - Views to the right: mirror pattern.
   - Concrete formula for child `i`:
     - `effectiveW = childW * scale`
     - `effectiveH = childH * scale` (for height centering)
     - `centerX_active = containerBounds.x + containerBounds.w / 2`
     - `offset = sign(i - activeIndex) * (sum of half-widths and gaps between active and i)`
     - `child.x = centerX_active + offset - effectiveW / 2`
     - `child.y = containerBounds.y + (containerBounds.h - effectiveH) / 2` (vertically centered)
     - `child.w = effectiveW`
     - `child.h = effectiveH`
5. Return `ViewLayoutResult[]` with `bounds`, `layer`, `scale`.

**Imports:** `NVSRect` from `./types`; layout types from `./regionTypes`.

**Forbidden imports:** Three.js, React, compiler, runtime.

---

#### 3.4 `packages/core/src/layout/__tests__/regionNormalize.test.ts`

Test file for `regionNormalize.ts`.

**Test cases:**

- `normalizePadding`:
  - uniform `0.1` → `[0.1, 0.1, 0.1, 0.1]`
  - pair `[0.05, 0.1]` → `[0.05, 0.1, 0.05, 0.1]`
  - full tuple passthrough
  - `0` → `[0, 0, 0, 0]`

- `applyPaddingToRect`:
  - full viewport with padding → correct inset
  - padding exceeds rect → clamp to zero w/h
  - zero padding → identity

- `resolveRegion`:
  - combines normalizePadding and applyPaddingToRect correctly
  - layer defaults to 0

- `composeBoundsIntoParent`:
  - child `{ x: 0, y: 0, w: 1, h: 1 }` in any parent → equals parent bounds (fullscreen child = parent)
  - child `{ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }` in `{ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }` → `{ x: 0.3, y: 0.3, w: 0.4, h: 0.4 }`
  - identity parent `{ x: 0, y: 0, w: 1, h: 1 }` → returns localRect unchanged
  - nested composition (compose into already-composed parent) → correct absolute bounds

- `unionBounds`:
  - non-overlapping rects → enclosing rect
  - overlapping rects → smallest enclosing
  - one rect fully inside the other → outer rect
  - identical rects → same rect

---

#### 3.5 `packages/core/src/layout/__tests__/regionLayout.test.ts`

Test file for `regionLayout.ts`.

**Test cases for `resolveStackLayout`:**

- 2 equal-width views, horizontal, no gap → each gets half the container
- 3 views with explicit widths, horizontal, gap=0.02 → correct placement with gap
- vertical stacking → y-axis placement, x/w inherited from container
- single view → occupies full container
- 0 views → empty array

**Test cases for `resolveCarouselLayout`:**

- 3 views, activeIndex=0 → first view centered at scale 1.0, others offset right with inactiveScale
- 3 views, activeIndex=1 → middle view centered, flanking views at inactiveScale
- 5 views, activeIndex=2 → symmetric arrangement, cumulative scale reduction
- activeIndex out of range → clamped to valid range
- layer assignment: active = N, adjacent = N-1, etc.
- default gap/scale/zStep used when config omits them
- single view → occupies full container regardless of activeIndex
- all views have `scale: 1.0` only for the active view

---

#### 3.6 Modify `packages/core/src/layout/index.ts`

Add exports for the new files:

```typescript
// Existing exports remain unchanged.

// Region types
export type {
  RegionBounds,
  RegionPadding,
  NormalizedPadding,
  RegionContract,
  ResolvedRegion,
  ViewLayoutKind,
  StackLayoutConfig,
  CarouselLayoutConfig,
  ViewLayoutConfig,
  ViewLayoutResult,
} from './regionTypes';

// Region helpers
export {
  normalizePadding,
  applyPaddingToRect,
  resolveRegion,
  composeBoundsIntoParent,
  unionBounds,
} from './regionNormalize';

// Layout resolution
export { resolveLayout, resolveStackLayout, resolveCarouselLayout } from './regionLayout';
```

---

#### 3.7 Modify `packages/core/src/index.ts`

Add re-exports for all new layout types and functions. The exact location in the file is the existing layout export section. Add the new symbols alongside the existing `NVSRect`, `NVSPosition`, `INVSBounded` exports.

---

### Stream A File Summary

| File | Action | Owns |
|---|---|---|
| `packages/core/src/layout/regionTypes.ts` | CREATE | Stream A |
| `packages/core/src/layout/regionNormalize.ts` | CREATE | Stream A |
| `packages/core/src/layout/regionLayout.ts` | CREATE | Stream A |
| `packages/core/src/layout/__tests__/regionNormalize.test.ts` | CREATE | Stream A |
| `packages/core/src/layout/__tests__/regionLayout.test.ts` | CREATE | Stream A |
| `packages/core/src/layout/index.ts` | MODIFY | Stream A |
| `packages/core/src/index.ts` | MODIFY | Stream A |

---

## 4. Stream B — Core Compiler DSL + Handlers

**Goal:** Implement `<View>` and `<ViewLayout>` DSL components, their NodeHandlers, the `composeBounds` method on `CompileApi`, and view-specific compiler state types.

**Depends on:** Stream A (uses `NVSRect`, `RegionBounds`, `ResolvedRegion`, `ViewLayoutConfig`, `ViewLayoutResult`, `composeBoundsIntoParent`, `resolveLayout`, `normalizePadding`, `applyPaddingToRect`).

### Files to Create

#### 4.1 `packages/core/src/compiler/viewTypes.ts`

Single responsibility: Compiler-internal state types for view/viewLayout compilation.

```typescript
// Compiler state contracts for View and ViewLayout DSL nodes.
// No Three.js, no React, no runtime.

import type { NVSRect } from '../layout/types';
import type { ViewLayoutKind, NormalizedPadding } from '../layout/regionTypes';
```

**Exported types:**

##### `ViewState`

```typescript
/**
 * Compiled state for a single View, stored on SceneFrame.widgets
 * keyed by the view's id.
 */
export type ViewState = {
  /** The view's stable identity. */
  readonly id: string;
  /** Resolved absolute NVS bounds for this view. */
  readonly bounds: NVSRect;
  /** Padding applied to this view's bounds. */
  readonly padding: NormalizedPadding;
  /** Content bounds (bounds after padding). */
  readonly contentBounds: NVSRect;
  /** Z-order layer. 0 = default. */
  readonly layer: number;
  /** Scale factor applied by layout manager. 1.0 when standalone. */
  readonly scale: number;
  /** ID of the parent ViewLayout, if any. */
  readonly layoutId?: string;
};
```

##### `ViewLayoutState`

```typescript
/**
 * Compiled state for a ViewLayout, stored on SceneFrame.widgets
 * keyed by the layout's id.
 */
export type ViewLayoutState = {
  readonly id: string;
  readonly kind: ViewLayoutKind;
  /** Absolute NVS bounds of the layout container. */
  readonly bounds: NVSRect;
  /** Ordered list of child view IDs. */
  readonly viewIds: readonly string[];
};
```

**Imports:** `NVSRect` from `../layout/types`; `ViewLayoutKind`, `NormalizedPadding` from `../layout/regionTypes`.

**Forbidden imports:** Three.js, React, runtime.

---

#### 4.2 `packages/core/src/compiler/blocks/viewDsl.tsx`

Single responsibility: `<View>` DSL component — null-returning React component.

```typescript
// <View> DSL component for spatial composition.
// Null-returning component consumed by the compiler.

export type ViewProps = {
  /** Stable view identity. Required. */
  id: string;
  /**
   * NVS x position [0..1]. Used for standalone views (no parent ViewLayout).
   * Ignored when inside a ViewLayout.
   */
  x?: number;
  /**
   * NVS y position [0..1]. Used for standalone views (no parent ViewLayout).
   * Ignored when inside a ViewLayout.
   */
  y?: number;
  /** NVS width [0..1]. Size hint when inside a ViewLayout. Default: auto. */
  w?: number;
  /** NVS height [0..1]. Size hint when inside a ViewLayout. Default: auto. */
  h?: number;
  /** Padding inset. */
  padding?: import('../../layout/regionTypes').RegionPadding;
  /** React children — exactly one renderable DSL element. */
  children?: import('react').ReactNode;
};

export const View = (_props: ViewProps): null => null;
View.displayName = 'View';
```

**Exports:** `View`, `ViewProps`.

---

#### 4.3 `packages/core/src/compiler/blocks/viewLayoutDsl.tsx`

Single responsibility: `<ViewLayout>` DSL component — null-returning React component.

```typescript
// <ViewLayout> DSL component for multi-view arrangement.
// Null-returning component consumed by the compiler.

import type { ViewLayoutKind } from '../../layout/regionTypes';

export type ViewLayoutProps = {
  /** Stable layout identity. Default: auto-generated from kind + scene index. */
  id?: string;
  /** Layout policy. */
  kind: ViewLayoutKind;
  /** NVS x position [0..1] of the layout container. Default: 0. */
  x?: number;
  /** NVS y position [0..1] of the layout container. Default: 0. */
  y?: number;
  /** NVS width [0..1] of the layout container. Default: 1. */
  w?: number;
  /** NVS height [0..1] of the layout container. Default: 1. */
  h?: number;
  /** NVS gap between views. */
  gap?: number;

  // Stack-specific:
  /** Stack direction. Only used when kind='stack'. Default: 'horizontal'. */
  direction?: 'horizontal' | 'vertical';

  // Carousel-specific:
  /** 0-indexed active view. Only used when kind='carousel'. Default: 0. */
  activeIndex?: number;
  /** Scale factor for inactive views. Only used when kind='carousel'. Default: 0.75. */
  inactiveScale?: number;
  /** NVS z-step per position from active. Only used when kind='carousel'. Default: 0.1. */
  zStep?: number;

  /** React children — <View> elements. */
  children?: import('react').ReactNode;
};

export const ViewLayout = (_props: ViewLayoutProps): null => null;
ViewLayout.displayName = 'ViewLayout';
```

**Exports:** `ViewLayout`, `ViewLayoutProps`.

---

#### 4.4 `packages/core/src/compiler/blocks/viewHandlers.ts`

Single responsibility: NodeHandler implementations for `<View>` and `<ViewLayout>`.

This file contains the handler functions but does NOT register them. Registration happens in `coreHandlers.ts`.

```typescript
// NodeHandler implementations for <View> and <ViewLayout>.
// Handlers are pure — no Three.js, no side effects beyond api.state writes.

import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement } from 'react';
import type { CompileApi, CompileHelpers, NodeHandler } from '../sceneDslTypes';
import { createChildApi } from '../sceneDslCompiler';
import type { NVSRect } from '../../layout/types';
import type { ViewLayoutConfig, ViewLayoutResult, RegionPadding } from '../../layout/regionTypes';
import type { ViewState, ViewLayoutState } from '../viewTypes';
import { View } from './viewDsl';
import { resolveLayout } from '../../layout/regionLayout';
import { composeBoundsIntoParent, normalizePadding, applyPaddingToRect } from '../../layout/regionNormalize';
```

**Exported functions:**

##### `viewHandler: NodeHandler`

Step-by-step logic:

1. Extract props: `id`, `x`, `y`, `w`, `h`, `padding`, `children`.
2. Validate `id` is a non-empty string. Error if missing.
3. Check if this view is inside a ViewLayout by inspecting `layoutContextMap.get(api)` (the module-scoped `WeakMap` — see "ViewLayout → View context propagation" below). If a layout context exists and contains a result for this view's `id`:
   - Emit warning if `x` or `y` are explicitly set: `"View '${id}' is inside a ViewLayout; x/y will be ignored. The layout manager controls positioning."`
   - Use the bounds from `layoutContextMap.get(api)!.viewResults.get(id)!.bounds`.
   - Use the layer and scale from the layout result.
4. If standalone (no layout context):
   - `bounds = { x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1 }`
   - `layer = 0`, `scale = 1.0`
5. Resolve padding: `normalizePadding(padding ?? 0)`.
6. Compute content bounds: `applyPaddingToRect(bounds, normalizedPadding)`.
7. Create a child `CompileApi` with `composeBounds` that maps child local [0..1] into this view's `contentBounds`:
   - The child api is a wrapper that delegates all methods to the parent api, except:
   - `composeBounds(localRect)` → `composeBoundsIntoParent(localRect, contentBounds)` chained through any existing parent `composeBounds`.
8. Compile child DSL nodes using the child api: `helpers.compileChildren(node, childApi)`.
9. Build `ViewState` and store: `api.setWidgetState(id, viewState)`.

##### `viewLayoutHandler: NodeHandler`

Step-by-step logic:

1. Extract props: `id`, `kind`, `x`, `y`, `w`, `h`, `gap`, `direction`, `activeIndex`, `inactiveScale`, `zStep`.
2. Generate id if not provided: `__viewLayout_${kind}_${api.context.sceneIndex}`.
3. Resolve container bounds: `{ x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1 }`.
4. Compose container bounds through any parent region: `api.composeBounds(containerBounds)` — this supports nested ViewLayouts.
5. Collect `<View>` children. For each child, extract its `id`, `w`, `h` props as size hints.
   - Non-View children: emit warning `"ViewLayout '${layoutId}' contains non-View child; only <View> children are supported."` and skip.
   - Views without `id`: emit error `"<View> inside ViewLayout requires an 'id' prop."`.
6. Build `ViewLayoutConfig`:
   - If `kind === 'stack'`: `{ kind: 'stack', direction: direction ?? 'horizontal', gap }`
   - If `kind === 'carousel'`: `{ kind: 'carousel', activeIndex: activeIndex ?? 0, gap, inactiveScale, zStep }`
7. Call `resolveLayout(config, composedContainerBounds, childSizeHints)` → `ViewLayoutResult[]`.
8. Build a `ViewLayoutContext` with a `Map<string, ViewLayoutResult>` mapping each view's id to its resolved result.
9. Save any previous layout context: `const previousContext = layoutContextMap.get(api)`.
10. Set the new context: `layoutContextMap.set(api, { layoutId, viewResults })`.
11. Compile child `<View>` nodes via `helpers.compileChildren(node, api)` — each child's `viewHandler` reads its assigned bounds from `layoutContextMap.get(api)?.viewResults.get(id)`.
12. Restore previous context (critical for nested ViewLayouts): `if (previousContext) layoutContextMap.set(api, previousContext); else layoutContextMap.delete(api);`.
13. Store `ViewLayoutState`: `api.setWidgetState(layoutId, { id: layoutId, kind, bounds: composedContainerBounds, viewIds })`.

##### `CompileApi` Extension: `composeBounds`

The key architectural change. The existing `CompileApi` type in `sceneDslTypes.ts` gains:

```typescript
composeBounds: (localRect: NVSRect) => NVSRect;
```

**Default behavior:** identity — returns `localRect` unchanged.

**When inside a View:** the view handler creates a wrapped api whose `composeBounds` calls `composeBoundsIntoParent(localRect, contentBounds)` and chains with the parent's `composeBounds`.

**Implementation detail — ViewLayout → View context propagation:**

The `viewLayoutHandler` needs to communicate resolved bounds to child `viewHandler` calls. This is done via a **module-scoped `WeakMap`** in `viewHandlers.ts`, keyed by `CompileApi` instance:

```typescript
// Module-level — not on CompileApi, avoids polluting the SDK type.
type ViewLayoutContext = {
  layoutId: string;
  viewResults: Map<string, ViewLayoutResult>;
};
const layoutContextMap = new WeakMap<CompileApi, ViewLayoutContext>();
```

The `viewLayoutHandler` sets the context before compiling children and **saves/restores** any previous context to support nested ViewLayouts:

```typescript
// In viewLayoutHandler, before compileChildren:
const previousContext = layoutContextMap.get(api);
layoutContextMap.set(api, { layoutId, viewResults });
helpers.compileChildren(node, api);
// Restore previous context (supports nested ViewLayouts):
if (previousContext) {
  layoutContextMap.set(api, previousContext);
} else {
  layoutContextMap.delete(api);
}
```

The `viewHandler` reads its assigned bounds via `layoutContextMap.get(api)?.viewResults.get(id)`.

**Why WeakMap instead of a field on CompileApi:**
- `CompileApi` is a public SDK type. Adding `__viewLayoutContext` would require declaring it on the type (TypeScript strict mode rejects undeclared property access), polluting the SDK surface with an internal concern.
- `WeakMap` is keyed by object identity, GC-friendly, and invisible to the SDK contract.

**Why save/restore is critical for nested ViewLayouts:**
Consider `<ViewLayout (outer)> <View id="v1"> <ViewLayout (inner)> ... </ViewLayout> </View> <View id="v2">...</View> </ViewLayout>`. Without save/restore, the inner ViewLayout overwrites the outer context. When the outer returns to compiling `v2`, the context is gone. Save/restore ensures each nesting level preserves the parent context.

---

#### 4.5 Modify `packages/core/src/compiler/sceneDslTypes.ts`

Add `composeBounds` to the `CompileApi` type:

```typescript
import type { NVSRect } from '../layout/types';

export type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
  pushWarning: (warning: CompileWarning) => void;
  /**
   * Composes a local NVS rect into the absolute NVS coordinate space.
   * Identity when no parent region/view is present.
   * When inside a View, maps local [0..1] into the view's content bounds.
   * Supports arbitrary nesting — each level chains with its parent.
   */
  composeBounds: (localRect: NVSRect) => NVSRect;
};
```

---

#### 4.6 Modify `packages/core/src/compiler/sceneDslCompiler.ts`

In the `createApi` function (line ~270), add the default `composeBounds`:

```typescript
const createApi = (
  context: SceneSnapshotContext,
  pushWarning?: (warning: CompileWarning) => void,
  getBreadcrumbs?: () => readonly DslBreadcrumb[],
): CompileApi => {
  const state: SceneFrame = {
    id: '',
    scrollProgress: 0,
    widgets: {},
  };
  return {
    context,
    state,
    setWidgetState: (widgetId, widgetState) => {
      state.widgets[widgetId] = widgetState;
    },
    setSceneMeta: (meta) => {
      if (meta.id) state.id = meta.id;
      if (meta.meta) state.meta = meta.meta;
    },
    pushWarning: (warning) => {
      const enriched: CompileWarning = getBreadcrumbs
        ? { ...warning, elementAncestry: getBreadcrumbs() }
        : warning;
      pushWarning?.(enriched);
    },
    // Default composeBounds is identity — returns localRect unchanged.
    composeBounds: (localRect) => localRect,
  };
};
```

Also add a helper function (not exported from the module; internal to the file) for creating a child CompileApi with scoped composeBounds:

```typescript
/**
 * Creates a child CompileApi that delegates to the parent but overrides composeBounds
 * to compose local coordinates into the given parentContentBounds.
 *
 * Used by viewHandler to create scoped compilation contexts for view children.
 */
export function createChildApi(
  parentApi: CompileApi,
  parentContentBounds: NVSRect,
): CompileApi {
  return {
    ...parentApi,
    composeBounds: (localRect: NVSRect): NVSRect => {
      const composed = composeBoundsIntoParent(localRect, parentContentBounds);
      return parentApi.composeBounds(composed);
    },
  };
}
```

This `createChildApi` is exported from `sceneDslCompiler.ts` (not from `compiler/index.ts` — it is infrastructure, not DSL surface). The `viewHandlers.ts` file imports it directly.

---

#### 4.7 Modify `packages/core/src/compiler/coreHandlers.ts`

Add registration for `<View>` and `<ViewLayout>`:

```typescript
import { View } from './blocks/viewDsl';
import { ViewLayout } from './blocks/viewLayoutDsl';
import { viewHandler, viewLayoutHandler } from './blocks/viewHandlers';

// Inside registerCoreHandlers():
if (!getNodeHandler(View)) {
  registerNode(View, viewHandler);
}
if (!getNodeHandler(ViewLayout)) {
  registerNode(ViewLayout, viewLayoutHandler);
}
```

---

#### 4.8 Modify `packages/core/src/compiler/index.ts`

Add DSL authoring surface exports for `View` and `ViewLayout`:

```typescript
export { View } from './blocks/viewDsl';
export type { ViewProps } from './blocks/viewDsl';
export { ViewLayout } from './blocks/viewLayoutDsl';
export type { ViewLayoutProps } from './blocks/viewLayoutDsl';
```

Also export `createChildApi` — **NO**. `createChildApi` is infrastructure, not DSL surface. It is imported directly by `viewHandlers.ts` from `sceneDslCompiler.ts`. No export from `compiler/index.ts`.

**`ViewState.layer` and `ViewState.scale` — v1 scope:**

These fields are compiled and stored on `ViewState` but are **not consumed by any renderer in v1**. They exist so that:
1. Scene authors can read them from widget state (e.g., for conditional overlay rendering based on which view is "active").
2. Future rendering integration (a `ViewWidget` that wraps child rendering and applies `renderOrder` for layer and `Object3D.scale` for scale) can consume them without recompiling.

In v1, all rendering is delegated entirely to the child element's existing `IRenderable.apply()` path. The child element receives composed `nvsBounds` via `composeBounds` and positions itself accordingly. The `scale` field from carousel layout affects the *bounds* (the `ViewLayoutResult.bounds` already reflects the scaled width/height), not a separate Three.js scale transform. The `layer` field has no Three.js effect in v1.

This is an explicit design choice: v1 proves the compilation pipeline and bounds composition end-to-end. Rendering integration (z-ordering via `renderOrder`, explicit scale transforms for carousel visual effects beyond bounds shrinkage) is deferred to a follow-up plan.

Export `ViewState` and `ViewLayoutState` types from `compiler/index.ts`:

```typescript
export type { ViewState, ViewLayoutState } from './viewTypes';
```

---

#### 4.9 `packages/core/src/compiler/__tests__/viewHandlers.test.tsx`

Test file for the view and viewLayout handlers.

**Test strategy:** Construct real `CompileApi` (via `createApi` from `sceneDslCompiler.ts`), real `CompileHelpers` (via `createHelpers`), register handlers via `registerCoreHandlers()`, then invoke `resolveSceneFromDsl()` with JSX trees containing `<View>` and `<ViewLayout>`.

**Test cases for viewHandler:**

- Standalone view: `<Scene><View id="v1" x={0.1} y={0.1} w={0.8} h={0.8}><BarChart ... /></View></Scene>` → `ViewState` stored in `frame.widgets['v1']` with correct bounds.
- Standalone view defaults: `<Scene><View id="v1"><BarChart ... /></View></Scene>` → fullscreen bounds `{ x: 0, y: 0, w: 1, h: 1 }`.
- View with padding: → contentBounds correctly inset from outerBounds.
- Child widget receives composed bounds: Register a mock widget that reads `api.composeBounds({ x: 0, y: 0, w: 1, h: 1 })` and stores the result. Inside `<View x={0.1} y={0.1} w={0.8} h={0.8}>`, the mock should receive `{ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }`.
- Nested views: `<View id="outer" x={0.1} y={0.1} w={0.8} h={0.8}><View id="inner" x={0.25} y={0.25} w={0.5} h={0.5}>...</View></View>` → inner bounds = `{ x: 0.3, y: 0.3, w: 0.4, h: 0.4 }`.
- Missing id → error.
- `composeBounds` is identity when no parent view: mock widget calling `api.composeBounds({ x: 0, y: 0, w: 1, h: 1 })` outside any view → returns `{ x: 0, y: 0, w: 1, h: 1 }`.

**Test cases for viewLayoutHandler:**

- Stack layout: `<ViewLayout kind="stack" direction="horizontal" gap={0.02}><View id="v1" w={0.48} h={1}>..</View><View id="v2" w={0.48} h={1}>..</View></ViewLayout>` → views placed side by side with gap.
- Carousel layout: `<ViewLayout kind="carousel" activeIndex={1}><View id="v1">..</View><View id="v2">..</View><View id="v3">..</View></ViewLayout>` → middle view centered at scale 1.0, others at inactiveScale.
- Managed view ignores x/y: View inside layout with explicit x/y → warning emitted, x/y ignored.
- ViewLayout with composed bounds: `<View id="outer" x={0.1} y={0.1} w={0.8} h={0.8}><ViewLayout kind="stack" ...>...</ViewLayout></View>` → layout container bounds composed into outer view.
- Non-View children → warning.
- `ViewLayoutState` stored correctly with kind, bounds, viewIds.
- Degenerate: single-child carousel — `<ViewLayout kind="carousel" activeIndex={0}><View id="v1">...</View></ViewLayout>` → v1 centered at full scale, layer = 1.
- Degenerate: single-child stack — `<ViewLayout kind="stack"><View id="v1">...</View></ViewLayout>` → v1 occupies full container, layer = 0, scale = 1.0.
- Nested ViewLayouts: `<ViewLayout kind="stack"><View id="v1"><ViewLayout kind="carousel" activeIndex={0}><View id="inner1">...</View><View id="inner2">...</View></ViewLayout></View><View id="v2">...</View></ViewLayout>` → outer layout correctly resumes after inner layout compiles; v2 gets correct bounds from the outer layout, not the cleared inner layout context.

---

### Stream B File Summary

| File | Action | Owns |
|---|---|---|
| `packages/core/src/compiler/viewTypes.ts` | CREATE | Stream B |
| `packages/core/src/compiler/blocks/viewDsl.tsx` | CREATE | Stream B |
| `packages/core/src/compiler/blocks/viewLayoutDsl.tsx` | CREATE | Stream B |
| `packages/core/src/compiler/blocks/viewHandlers.ts` | CREATE | Stream B |
| `packages/core/src/compiler/__tests__/viewHandlers.test.tsx` | CREATE | Stream B |
| `packages/core/src/compiler/sceneDslTypes.ts` | MODIFY | Stream B |
| `packages/core/src/compiler/sceneDslCompiler.ts` | MODIFY | Stream B |
| `packages/core/src/compiler/coreHandlers.ts` | MODIFY | Stream B |
| `packages/core/src/compiler/index.ts` | MODIFY | Stream B |

**Note on shared file modification (index.ts, coreHandlers.ts):** Stream A modifies `packages/core/src/layout/index.ts` and `packages/core/src/index.ts`. Stream B modifies `packages/core/src/compiler/index.ts`, `packages/core/src/compiler/coreHandlers.ts`, `packages/core/src/compiler/sceneDslTypes.ts`, and `packages/core/src/compiler/sceneDslCompiler.ts`. These are disjoint file sets — no conflict.

---

## 5. Stream C — Diagram groupCompiler Refactor

**Goal:** Refactor `groupCompiler.ts` to use the shared `unionBounds` from `packages/core/src/layout/regionNormalize.ts` instead of its local copy. Also consider using `normalizePadding` for the padding resolution path.

**Depends on:** Stream A (uses `unionBounds` from `packages/core/src/layout/regionNormalize`).

### Files to Modify

#### 5.1 `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts`

**Changes:**

1. **Import `unionBounds` from core:**
   ```typescript
   import { unionBounds } from '@brewsite/core';
   ```

2. **Remove local `unionBounds` function** (lines 39–48 in the current file). The shared version has identical semantics.

3. **Keep all diagram-specific code unchanged:**
   - `GroupBounds` type stays (it has `padding` and `titleGap` fields beyond `NVSRect`).
   - `resolveGroupBoundsMap()` stays — the recursive group computation and Y-up → NVS conversion are diagram-specific.
   - `compileGroup()` stays.
   - `compileEdgeLights()` stays.
   - `DEFAULT_GROUP_PADDING`, `DEFAULT_TITLE_GAP` imports from `diagramLayoutConstants` stay.

4. **Do NOT change** the coordinate-space semantics. Diagram groups work in diagram-unit Y-up space pre-normalization. The shared `unionBounds` works on any `{ x, y, w, h }` — it is coordinate-space agnostic.

**What is NOT extracted in this phase:**
- Padding normalization: Diagram groups use a `[top, right, bottom, left]` tuple directly from `ResolvedLayout.groupPadding`. The shared `normalizePadding` from core handles the same tuple format, but the diagram padding comes from a different source (diagram layout constants, not `RegionPadding`). Extracting this would add a dependency for no immediate benefit. Defer to a future cleanup pass.
- `computeGroupBounds` inner function: Stays diagram-specific because it operates on diagram-unit space and integrates with `computeBounds` from `layoutAlgorithms`.

---

#### 5.2 `packages/diagram/src/elements/diagram/compiler/__tests__/groupCompiler.test.ts`

**If this file exists:** Add a regression test confirming that `resolveGroupBoundsMap` produces identical output after the refactor. If it does not exist, create it.

**Test strategy:** Call `resolveGroupBoundsMap()` with known inputs (groups, positions, sizes, groupLayouts maps) and assert the returned `Map<string, GroupBounds>` matches expected values.

**Test cases:**

- Single group with 2 nodes → bounds envelope + padding applied.
- Nested groups (parent with child group) → recursive bounds computation.
- Empty group (no nodes, no children) → `{ x: 0, y: 0, w: 0, h: 0 }`.
- Circular group reference → does not infinite-loop (existing `visiting` set guard).
- `compileGroup()` with darkGlass theme → correct defaults applied, edgeLights computed.

---

### Stream C File Summary

| File | Action | Owns |
|---|---|---|
| `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts` | MODIFY | Stream C |
| `packages/diagram/src/elements/diagram/compiler/__tests__/groupCompiler.test.ts` | CREATE or MODIFY | Stream C |

---

## 6. Stream D — Chart + Model Bounds Composition

**Goal:** Integrate `api.composeBounds()` into chart and model compilation paths so that when these elements are nested inside a `<View>`, their NVS bounds are composed into the view's absolute coordinate space.

**Depends on:** Stream A (uses `NVSRect` types). Also logically depends on Stream B for the `composeBounds` method on `CompileApi`, but since the method has identity semantics by default, the chart/model code can be written and tested independently — calling `api.composeBounds(localRect)` returns `localRect` when no view is present.

### 6.1 Chart Package

#### Modify `packages/charts/src/elements/chart/compile.ts`

In `compileChart()` (line ~228–309):

**Current code (lines 228–234):**
```typescript
const x = dsl.x ?? 0;
const y = dsl.y ?? 0;
const w = dsl.w ?? 1;
const h = dsl.h ?? 1;
const nvsBounds: NVSRect = { x, y, w, h };
```

**New code:**
```typescript
const x = dsl.x ?? 0;
const y = dsl.y ?? 0;
const w = dsl.w ?? 1;
const h = dsl.h ?? 1;
const localBounds: NVSRect = { x, y, w, h };

// Compose into parent view/region if present. Identity when no parent.
const nvsBounds: NVSRect = composeBoundsFn
  ? composeBoundsFn(localBounds)
  : localBounds;
```

The `compileChart` function gains an optional parameter:

```typescript
export function compileChart(
  dsl: BaseChartDSL,
  kind: ChartType,
  typeOptions: ChartTypeOptions,
  dataDsl: ChartDataDSL | null,
  axisDsls: readonly ChartAxisDSL[],
  seriesDsls: readonly ChartSeriesDSL[],
  legendDsl: ChartLegendDSL | null,
  dataLabelsDsl: ChartDataLabelsDSL | null,
  referenceLineDsls: readonly ReferenceLineDSL[],
  tooltipDsl: ChartTooltipDSL | null = null,
  composeBoundsFn?: (localRect: NVSRect) => NVSRect,
): ChartState {
```

**Center-point recomputation (critical):**

The return block (lines 278–309) must use the composed `nvsBounds` for derived fields:

```typescript
return {
  type: kind,
  nvsX: nvsBounds.x + nvsBounds.w / 2,    // was: x + w / 2
  nvsY: nvsBounds.y + nvsBounds.h / 2,    // was: y + h / 2
  // ...
  bounds: {
    width: nvsBounds.w,     // was: boundsWidth (= w)
    height: nvsBounds.h,    // was: boundsHeight (= h)
    depth: boundsDepth,
  },
  // ...
  nvsBounds,
  // ...
};
```

**Validation must use the composed rect:**
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSRect(nvsBounds, `<Chart id="${dsl.id}">`);
}
```

---

#### Modify `packages/charts/src/elements/chart/ChartWidget.ts`

In the chart widget's `CUSTOM_NODE_HANDLER` (or wherever the handler calls `compileChart`), pass `api.composeBounds` as the last argument:

```typescript
const state = compileChart(
  dsl, kind, typeOptions, dataDsl, axisDsls, seriesDsls,
  legendDsl, dataLabelsDsl, referenceLineDsls, tooltipDsl,
  api.composeBounds,  // NEW — compose into parent view
);
```

If the handler is not in `ChartWidget.ts` but in the plugin's `configureRegistry`, the call site is wherever `compileChart()` is invoked with DSL props.

---

#### Modify `packages/charts/src/elements/chart/__tests__/compile.test.ts`

Add test cases:

- `compileChart` without `composeBoundsFn` → behaves exactly as before (identity).
- `compileChart` with `composeBoundsFn` that maps local into a half-viewport:
  ```typescript
  const compose = (r: NVSRect) => ({ x: 0.1 + r.x * 0.8, y: 0.1 + r.y * 0.8, w: r.w * 0.8, h: r.h * 0.8 });
  const state = compileChart(dsl, 'bar', typeOpts, null, [], [], null, null, [], null, compose);
  expect(state.nvsBounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  expect(state.nvsX).toBeCloseTo(0.5);
  expect(state.nvsY).toBeCloseTo(0.5);
  expect(state.bounds.width).toBeCloseTo(0.8);
  expect(state.bounds.height).toBeCloseTo(0.8);
  ```

---

### 6.2 Model Package

#### Modify `packages/model/src/elements/model/ModelWidget.ts`

In the `CUSTOM_NODE_HANDLER` implementation (around lines 632–677):

**Current code (lines 632–677):**
```typescript
const nvsX = (props.x ?? 0) + (props.w ?? 1) / 2;
const nvsY = (props.y ?? 0) + (props.h ?? 1) / 2;
// ...
nvsBounds: {
  x: props.x ?? 0,
  y: props.y ?? 0,
  w: props.w ?? 1,
  h: props.h ?? 1,
},
```

**New code:**
```typescript
const localBounds: NVSRect = {
  x: props.x !== undefined ? (props.x as number) : 0,
  y: props.y !== undefined ? (props.y as number) : 0,
  w: props.w !== undefined ? (props.w as number) : 1,
  h: props.h !== undefined ? (props.h as number) : 1,
};
// Compose into parent view/region if present. Identity when no parent.
const nvsBounds = api.composeBounds(localBounds);

const nvsX = nvsBounds.x + nvsBounds.w / 2;
const nvsY = nvsBounds.y + nvsBounds.h / 2;
```

And in the state assignment:
```typescript
nvsBounds,  // was: { x: props.x ?? 0, y: props.y ?? 0, w: props.w ?? 1, h: props.h ?? 1 }
```

Validation uses the composed rect:
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSScalar(nvsX, 'nvsX', `<Model id="${this.widgetId}">`);
  validateNVSScalar(nvsY, 'nvsY', `<Model id="${this.widgetId}">`);
  validateNVSRect(nvsBounds, `<Model id="${this.widgetId}">`);
}
```

The `mergeSnapshot` method (line ~696) also builds nvsBounds. Apply the same pattern there — but `mergeSnapshot` does not have access to `CompileApi`. Review the merge logic: if `mergeSnapshot` only falls back to the defaultState's nvsBounds when the next snapshot omits bounds, and the next snapshot's nvsBounds is already composed by the handler, then no change is needed in `mergeSnapshot`. Verify this during implementation.

---

#### Create `packages/model/src/elements/model/__tests__/composeBounds.test.ts`

Test that the model handler correctly composes bounds when `api.composeBounds` is non-identity.

**Test strategy:** Create a minimal `CompileApi` with a custom `composeBounds`, invoke the model's `CUSTOM_NODE_HANDLER` directly (or through `resolveSceneFromDsl` with a `<View>` wrapper), and assert:

- `nvsBounds` on the stored state matches the composed rect.
- `model.nvsX` and `model.nvsY` are derived from the composed rect's center.
- Without composition (identity `composeBounds`) → behavior is identical to current.

---

### Stream D File Summary

| File | Action | Owns |
|---|---|---|
| `packages/charts/src/elements/chart/compile.ts` | MODIFY | Stream D |
| `packages/charts/src/elements/chart/ChartWidget.ts` | MODIFY | Stream D |
| `packages/charts/src/elements/chart/__tests__/compile.test.ts` | MODIFY | Stream D |
| `packages/model/src/elements/model/ModelWidget.ts` | MODIFY | Stream D |
| `packages/model/src/elements/model/__tests__/composeBounds.test.ts` | CREATE | Stream D |

---

## 7. Stream E — Backward Compatibility Snapshots + Examples

**Goal:** Verify that all existing scenes compile to identical `SceneTrack` output after streams A–D land. Add example scenes demonstrating the new View/ViewLayout DSL.

**Depends on:** Streams B, C, D (all must be complete).

### 7.1 Backward Compatibility Snapshot Tests

#### Create `packages/core/src/compiler/__tests__/viewBackwardCompat.test.ts`

**Test strategy:** For a representative set of existing scene patterns (no Views, no ViewLayouts), compile through `resolveSceneFromDsl()` and assert:

1. `api.composeBounds({ x: 0, y: 0, w: 1, h: 1 })` returns `{ x: 0, y: 0, w: 1, h: 1 }` (identity).
2. Existing widget state in `SceneFrame.widgets` is byte-for-byte identical to pre-refactor output.

**Concrete test cases:**

- Scene with Lighting + Camera + Background → no `ViewState` in widgets; all existing state unchanged.
- Scene with InputController → inputController state unchanged.
- Scene with ProgressManager → progressManager spec unchanged.
- Scene with Transition children → no interference.

#### Create `apps/examples/src/__tests__/snapshotBaseline.test.ts`

**Important note:** This file is in the apps directory, which is private and not published. It is acceptable for integration tests.

**Scene import pattern:** Example scene files export JSX DSL arrays (e.g., `const scenes = [<Scene key="s1">...</Scene>, <Scene key="s2">...</Scene>]`), not `getFrame` functions. The test must wrap these arrays into `SceneDefinition[]` compatible with `compileSceneTrack()`. The pattern is:

```typescript
import { compileSceneTrack } from '@brewsite/core/compiler/sceneTrackCompiler';
import { sampleSceneTrack } from '@brewsite/core/compiler/sceneTrackSampler';
// Import the scene JSX array from the example
import { scenes } from '../diagram/scenes/diagramOverview';
// ... set up WidgetRegistry with appropriate plugins ...

const track = compileSceneTrack({ scenes: sceneDefinitions, widgetRegistry, blockSize: 10 });
```

**Snapshot target:** The snapshot must capture **compiled widget state**, not just scene window metadata. For each compiled track:

1. Sample the track at representative progress values: for each scene `i` in `0..N-1`, sample at `sceneStart`, `sceneMid`, and `sceneEnd` progress values.
2. For each sample, snapshot `sampledFrame.widgets` — the full widget state map.
3. Use a custom JSON serializer that strips functions (replace with `'[function]'`) and React elements (replace with `'[react]'`) for stable, deterministic snapshots.
4. Use Vitest's `toMatchSnapshot()`.

```typescript
// For each scene window:
for (const window of track.windows) {
  const midProgress = (window.startProgress + window.endProgress) / 2;
  const frame = sampleSceneTrack(track, midProgress);
  expect(serializeForSnapshot(frame.widgets)).toMatchSnapshot(
    `scene-${window.id}-widgets`
  );
}
```

Any snapshot mismatch = regression. Developer must fix or explicitly update with justification in the commit message.

**Scope:** Covers representative scenes from `diagram`, `chart`, `simple`, `complex` directories. Not every scene file — select 2-3 per directory that exercise the most widget types. The implementer should choose scenes that collectively cover: Lighting, Camera, Background, Floor, Model, Diagram, Chart, InputController.

---

### 7.2 Integration Examples

#### Create `apps/examples/src/views/` directory

This directory contains example scenes demonstrating View/ViewLayout usage.

##### `apps/examples/src/views/scenes/scene1-standalone-views.tsx`

Side-by-side standalone views:
```tsx
<Scene id="side-by-side">
  <View id="left" x={0.02} y={0.05} w={0.46} h={0.9}>
    {/* Diagram or chart element */}
  </View>
  <View id="right" x={0.52} y={0.05} w={0.46} h={0.9}>
    {/* Another element */}
  </View>
</Scene>
```

##### `apps/examples/src/views/scenes/scene2-stack-layout.tsx`

Stack layout with gap:
```tsx
<Scene id="stacked">
  <ViewLayout kind="stack" direction="horizontal" gap={0.02}>
    <View id="v1"><BarChart id="chart1" ... /></View>
    <View id="v2"><BarChart id="chart2" ... /></View>
    <View id="v3"><BarChart id="chart3" ... /></View>
  </ViewLayout>
</Scene>
```

##### `apps/examples/src/views/scenes/scene3-carousel.tsx`

Carousel cycling across scenes:
```tsx
const carouselViews = <>
  <View id="v1"><Diagram id="arch" /></View>
  <View id="v2"><BarChart id="metrics" /></View>
  <View id="v3"><Model id="product" /></View>
</>;

<Scene id="carousel-1">
  <ViewLayout kind="carousel" activeIndex={0} gap={0.04}>
    {carouselViews}
  </ViewLayout>
</Scene>

<Scene id="carousel-2">
  <ViewLayout kind="carousel" activeIndex={1} gap={0.04}>
    {carouselViews}
  </ViewLayout>
</Scene>

<Scene id="carousel-3">
  <ViewLayout kind="carousel" activeIndex={2} gap={0.04}>
    {carouselViews}
  </ViewLayout>
</Scene>
```

##### `apps/examples/src/views/scenes/scene4-nested-views.tsx`

Nested views demonstrating composition chaining:
```tsx
<Scene id="nested">
  <View id="outer" x={0.05} y={0.05} w={0.9} h={0.9} padding={0.02}>
    <View id="inner" x={0.0} y={0.0} w={1} h={1}>
      <BarChart id="chart" />
    </View>
  </View>
</Scene>
```

##### `apps/examples/src/views/ViewDemoPage.tsx`

Route page component wiring up ScenePlayer with the view example scenes.

##### Wire into `apps/examples/src/App.tsx`

Add a route for `/views` pointing to `ViewDemoPage`.

---

### Stream E File Summary

| File | Action | Owns |
|---|---|---|
| `packages/core/src/compiler/__tests__/viewBackwardCompat.test.ts` | CREATE | Stream E |
| `apps/examples/src/__tests__/snapshotBaseline.test.ts` | CREATE | Stream E |
| `apps/examples/src/views/scenes/scene1-standalone-views.tsx` | CREATE | Stream E |
| `apps/examples/src/views/scenes/scene2-stack-layout.tsx` | CREATE | Stream E |
| `apps/examples/src/views/scenes/scene3-carousel.tsx` | CREATE | Stream E |
| `apps/examples/src/views/scenes/scene4-nested-views.tsx` | CREATE | Stream E |
| `apps/examples/src/views/ViewDemoPage.tsx` | CREATE | Stream E |
| `apps/examples/src/App.tsx` | MODIFY | Stream E |

---

## 8. Cross-Stream File Ownership Matrix

Every file in the plan is owned by exactly one stream. No two streams touch the same file.

| File | Stream |
|---|---|
| `packages/core/src/layout/regionTypes.ts` | A |
| `packages/core/src/layout/regionNormalize.ts` | A |
| `packages/core/src/layout/regionLayout.ts` | A |
| `packages/core/src/layout/__tests__/regionNormalize.test.ts` | A |
| `packages/core/src/layout/__tests__/regionLayout.test.ts` | A |
| `packages/core/src/layout/index.ts` | A |
| `packages/core/src/index.ts` | A |
| `packages/core/src/compiler/viewTypes.ts` | B |
| `packages/core/src/compiler/blocks/viewDsl.tsx` | B |
| `packages/core/src/compiler/blocks/viewLayoutDsl.tsx` | B |
| `packages/core/src/compiler/blocks/viewHandlers.ts` | B |
| `packages/core/src/compiler/__tests__/viewHandlers.test.tsx` | B |
| `packages/core/src/compiler/sceneDslTypes.ts` | B |
| `packages/core/src/compiler/sceneDslCompiler.ts` | B |
| `packages/core/src/compiler/coreHandlers.ts` | B |
| `packages/core/src/compiler/index.ts` | B |
| `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts` | C |
| `packages/diagram/src/elements/diagram/compiler/__tests__/groupCompiler.test.ts` | C |
| `packages/charts/src/elements/chart/compile.ts` | D |
| `packages/charts/src/elements/chart/ChartWidget.ts` | D |
| `packages/charts/src/elements/chart/__tests__/compile.test.ts` | D |
| `packages/model/src/elements/model/ModelWidget.ts` | D |
| `packages/model/src/elements/model/__tests__/composeBounds.test.ts` | D |
| `packages/core/src/compiler/__tests__/viewBackwardCompat.test.ts` | E |
| `apps/examples/src/__tests__/snapshotBaseline.test.ts` | E |
| `apps/examples/src/views/scenes/scene1-standalone-views.tsx` | E |
| `apps/examples/src/views/scenes/scene2-stack-layout.tsx` | E |
| `apps/examples/src/views/scenes/scene3-carousel.tsx` | E |
| `apps/examples/src/views/scenes/scene4-nested-views.tsx` | E |
| `apps/examples/src/views/ViewDemoPage.tsx` | E |
| `apps/examples/src/App.tsx` | E |

---

## 9. Dependency Graph

```
Stream A: Core Layout Types Extension
  ├─ No dependencies
  ├─ Tests: pnpm --filter @brewsite/core vitest run src/layout/__tests__/regionNormalize.test.ts
  └─ Tests: pnpm --filter @brewsite/core vitest run src/layout/__tests__/regionLayout.test.ts

Stream B: Core Compiler DSL + Handlers (BLOCKED BY: Stream A)
  ├─ Requires: regionTypes.ts, regionNormalize.ts, regionLayout.ts from Stream A
  ├─ Tests: pnpm --filter @brewsite/core vitest run src/compiler/__tests__/viewHandlers.test.tsx
  └─ Typecheck: pnpm --filter @brewsite/core typecheck

Stream C: Diagram groupCompiler Refactor (BLOCKED BY: Stream A)
  ├─ Requires: unionBounds export from Stream A's regionNormalize.ts
  ├─ Tests: pnpm --filter @brewsite/diagram vitest run src/elements/diagram/compiler/__tests__/groupCompiler.test.ts
  └─ Typecheck: pnpm --filter @brewsite/diagram typecheck

Stream D: Chart + Model Bounds Composition (BLOCKED BY: Streams A AND B)
  ├─ Requires: NVSRect types (Stream A); composeBounds on CompileApi type (Stream B)
  │   The widget handler changes in ChartWidget.ts and ModelWidget.ts call api.composeBounds(),
  │   which is not on CompileApi until Stream B modifies sceneDslTypes.ts. TypeScript strict
  │   mode rejects access to undeclared properties, so Stream D cannot typecheck until B merges.
  │   The pure-function change in compile.ts (optional composeBoundsFn parameter) has no type
  │   dependency on B and can be written speculatively, but tests for widget handlers require B.
  ├─ Tests: pnpm --filter @brewsite/charts vitest run src/elements/chart/__tests__/compile.test.ts
  ├─ Tests: pnpm --filter @brewsite/model vitest run src/elements/model/__tests__/composeBounds.test.ts
  └─ Typecheck: pnpm --filter @brewsite/charts typecheck && pnpm --filter @brewsite/model typecheck

Stream E: Snapshots + Examples (BLOCKED BY: Streams B, C, D)
  ├─ Requires: All streams complete — full compilation pipeline functional
  ├─ Tests: pnpm --filter @brewsite/core vitest run src/compiler/__tests__/viewBackwardCompat.test.ts
  ├─ Tests: pnpm --filter @brewsite/examples vitest run src/__tests__/snapshotBaseline.test.ts
  └─ Manual: pnpm dev → navigate to /views → verify rendering
```

### Verification Commands (All Streams Complete)

```bash
# Full typecheck across all packages
pnpm typecheck

# Full test suite
pnpm test

# Build all packages (ensures no import violations)
pnpm build
```
