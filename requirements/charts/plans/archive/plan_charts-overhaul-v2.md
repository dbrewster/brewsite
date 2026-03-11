---
title: Charts Overhaul v2 Implementation Plan
doc_type: plan
owner: architecture
status: active
updated: 2026-03-11
revision: 3
revision_notes: |
  Rev 2 (issues 1–6): parallelization fixes, _resetInlineRef removed, ChartRenderInput to
  Phase 1, LegendRenderer/DataLabelRenderer assigned to Stream E, ChartRendererDouble test
  strategy, Map-based O(n) morph lookup.
  Rev 3 (issues 7–10):
  - Issue 7: useChartData read-side extension explicitly deferred to V2.2 with rationale
    (filter-engine subscription model does not fire on registerInline; new inline listener
    registry needed in V2.2).
  - Issue 8: Migration safety audits added to Stream C (ChartState direct constructions)
    and Stream D (AxisRenderState direct constructions + AxesRenderer.update() call sites).
  - Issue 9: ChartRenderer.update() full ChartRenderContext construction shown in §5.3,
    explicitly threading entryT and accessors from ChartRenderInput into ChartRenderContext.
  - Issue 10: Gridlines fallback chain fully specified (theme.gridlines?.color ??
    theme.background.gridColor ?? '#4a6080') with LineDashedMaterial logic for dashSize.
  PM-2 final edit: corrected two stale test-strategy table rows — removed _resetInlineRef
  reference (replaced with deregister callback description) and replaced private-field
  currentEntryT access with ChartRendererDouble.lastInput.entryT per Issue 5 resolution.
  Plan locked.
---

# Charts Overhaul V2.1 — Implementation Plan

## Overview

This plan implements all five feature areas in `@brewsite/charts` V2.1. It derives from the finalized feature note `requirements/charts/notes/note_charts-overhaul-v2.md` and the prior implementation plan `requirements/charts/plans/archive/plan_charts-overhaul.md`. The semver impact is **minor** (`2.0.0` → `2.1.0`): all new fields on `ChartState` and `ChartTheme` are optional, all new exports are additive, no existing public signatures change.

The plan is organized in two phases:
- **Phase 1 — Foundation Types** (1 developer, ~half day): type-only changes to `data/types.ts`, `elements/chart/types.ts`, `renderers/shared/IChartRenderer.ts`, `themes/types.ts`, `elements/chart/render.ts` (ChartRenderInput type only), and `player/chartPlugin.ts` (ChartPluginInstance type only). No runtime behavior changes. All Phase 2 streams depend on Phase 1 completing first.
- **Phase 2 — Parallel Streams** (up to 5 developers): each stream touches a disjoint set of files with no shared-file conflicts.

> **Parallelization guarantee**: Phase 2 streams are independently typeable from day one because Phase 1 delivers all cross-stream type contracts — `ChartPluginInstance` (with `accessorRegistry`), `ChartRenderInput` (with `entryT` and `accessors`), `ChartAccessorFunctions`, `FittedMargins`, and all theme token types. Stream A hooks import from `chartPlugin.ts` and `ChartRenderInput` — both are stable after Phase 1. Stream C implements runtime behavior against those already-defined types.

---

## Open Questions Resolved

### OQ-1: `useLiveChartData` signature

**Decision: Pass `chartsPlugin` (the full `ChartPluginInstance`).**

Rationale: Consistent with `ChartProvider` (which also receives `chartsPlugin`). The hook internally accesses `plugin.store` for `registerInline`/`deregisterInline`/`hasLiveOverride`. The store is already a stable public property on `ChartPluginInstance`. Passing `plugin.store` directly would require consumers to know the internal property name and would diverge from the established hook pattern.

```typescript
// Correct:
useLiveChartData(chartsPlugin, 'revenue-chart', revenueRows);

// Not:
useLiveChartData(chartsPlugin.store, 'revenue-chart', revenueRows);
```

### OQ-2: Pie morph in V2.1

**Decision: Out of scope. Deferred to V2.2.**

Pie morphing requires interpolating both start and end angles of each d3-shape arc, matched by `keyField`. `d3-shape.arc()` produces SVG path data, not geometry coordinates; Three.js `ExtrudeGeometry` would need to be rebuilt on every morph frame, violating the O(1) frame cost model. `MorphContext` is not passed to `PieRenderer` in V2.1. `PieRenderer.update()` is unchanged.

### OQ-3: `FittedMargins` type placement

**Decision: Define in `renderers/shared/IChartRenderer.ts`.**

`elements/chart/layout.ts` already imports `ChartAxisState` and `ChartSeriesState` from `renderers/shared/IChartRenderer.ts` (confirmed in source). This import direction (layout → IChartRenderer) is already established. Adding `FittedMargins` to `IChartRenderer.ts` allows `layout.ts` to import it from the same location without creating any new dependency direction. `AxesRenderer.ts` already imports from `IChartRenderer.ts`. No circular dependency, no new file required.

### OQ-4: `titleFontSize` implementation

**Decision: Add `titleFontSize?: number` to the existing `ChartAxisTokens` type in `themes/types.ts`.**

Rationale: `AxesRenderer.updateTicks()` already receives the full `ChartTheme` (and therefore `theme.axis`). Adding `titleFontSize` as an optional field on the existing `ChartAxisTokens` group requires zero changes to the `ChartTheme` shape (no new top-level field) and minimal renderer change. Creating a new `ChartHeaderTokens` type for a single field would add structural complexity without benefit. The `AxesRenderer` already reads `theme.axis.fontSize` for tick labels — it will now also read `theme.axis.titleFontSize ?? theme.axis.fontSize * 1.1` for axis titles.

---

## Feature Area 1: Reactive Data Binding (`useLiveChartData`)

### 1.1 `ChartDataStore` — New Methods

**File:** `packages/charts/src/data/ChartDataStore.ts`

**What changes:**
- Add private field: `private readonly liveOverrides = new Set<string>();` — tracks widget IDs that have an active live-hook override.
- Add public method `hasLiveOverride(widgetId: string): boolean` — returns `this.liveOverrides.has(widgetId)`.
- Add public method `deregisterInline(widgetId: string): void` — removes the override flag and the data entry:
  ```typescript
  deregisterInline(widgetId: string): void {
    this.liveOverrides.delete(widgetId);
    this.unregister(`__inline__${widgetId}`);
  }
  ```
- Modify existing `registerInline(widgetId, rows)` — when called from `useLiveChartData` context, the hook sets the override flag separately. `registerInline` itself does NOT set `liveOverrides` — that is done by `useLiveChartData` which calls both `store.registerInline()` and then manually sets the override via a new companion method `setLiveOverride(widgetId: string): void` (alternative: the hook calls `registerInline` then `setLiveOverride` as two calls). **Simpler approach chosen**: `registerInline` remains as-is; `useLiveChartData` calls `store.registerInline(widgetId, normalizedRows)` then `store.setLiveOverride(widgetId)`.
- Add public method `setLiveOverride(widgetId: string): void` — sets `this.liveOverrides.add(widgetId)`.

**New private fields:**
```typescript
private readonly liveOverrides = new Set<string>();
/** Cleanup callbacks registered by ChartWidget at construction time. Keyed by widgetId. */
private readonly deregisterCallbacks = new Map<string, () => void>();
```

**Complete new method signatures:**
```typescript
/** Mark widgetId as having an active live hook. Called by useLiveChartData after registerInline(). */
setLiveOverride(widgetId: string): void {
  this.liveOverrides.add(widgetId);
}

/** Returns true when useLiveChartData has registered for this widget and not yet unmounted. */
hasLiveOverride(widgetId: string): boolean {
  return this.liveOverrides.has(widgetId);
}

/**
 * Remove data and override flag registered by useLiveChartData.
 * Called on hook unmount. Invokes the cleanup callback registered by ChartWidget
 * (which resets lastInlineRowsRef so the next apply() re-registers SceneTrack rows).
 */
deregisterInline(widgetId: string): void {
  this.liveOverrides.delete(widgetId);
  this.unregister(`__inline__${widgetId}`);
  this.deregisterCallbacks.get(widgetId)?.();
}

/**
 * Register a callback invoked by deregisterInline(). Called once by ChartWidget constructor.
 * Returns an unsubscribe function — ChartWidget.dispose() calls it to prevent stale callbacks.
 */
onDeregisterInline(widgetId: string, cb: () => void): () => void {
  this.deregisterCallbacks.set(widgetId, cb);
  return () => { this.deregisterCallbacks.delete(widgetId); };
}
```

**Test strategy** (`data/__tests__/ChartDataStore.test.ts`):
- After `setLiveOverride('w1')`, assert `hasLiveOverride('w1') === true`.
- After `deregisterInline('w1')`, assert `hasLiveOverride('w1') === false` and `resolve('__inline__w1', [])` returns `EMPTY_FRAME`.
- Register a callback via `onDeregisterInline('w1', cb)`. Call `deregisterInline('w1')` → assert `cb` was invoked.
- After the unsubscribe function is called, `deregisterInline` on that widgetId must NOT invoke the callback.
- Confirm `deregisterInline` on an unregistered widgetId does not throw.

### 1.2 `ChartWidget.apply()` — Inline Guard Update

**File:** `packages/charts/src/elements/chart/ChartWidget.ts`

**What changes — inline data registration block:**

Replace the current V2.0 block:
```typescript
if (state.dataSource.type === 'inline') {
  if (state.dataSource.rows !== this.lastInlineRowsRef) {
    this.store.register(`__inline__${this.widgetId}`, state.dataSource.rows);
    this.lastInlineRowsRef = state.dataSource.rows;
  }
}
```

With:
```typescript
if (state.dataSource.type === 'inline') {
  if (this.store.hasLiveOverride(this.widgetId)) {
    // useLiveChartData owns this widget's data — skip SceneTrack-baked write.
    // store.registerInline() + setLiveOverride() already called by hook.
  } else {
    // No live hook active — V2 behavior: write SceneTrack rows to store.
    if (state.dataSource.rows !== this.lastInlineRowsRef) {
      this.store.registerInline(this.widgetId, state.dataSource.rows);
      this.lastInlineRowsRef = state.dataSource.rows;
    }
  }
}
```

Additionally, when `deregisterInline()` is called on the store, `lastInlineRowsRef` must be reset so the next `apply()` re-registers the SceneTrack rows. If not reset, `state.dataSource.rows !== this.lastInlineRowsRef` would be `false` (the baked rows reference hasn't changed) and the store would never get re-registered after the hook unmounts.

**Fix — callback registration at widget construction (no public `_resetInlineRef` method):**

In `ChartWidget` constructor, register a cleanup callback with the store:
```typescript
constructor(widgetId: string, store: ChartDataStore, accessorRegistry: Map<string, ChartAccessorFunctions>) {
  this.widgetId = widgetId;
  this.store = store;
  this.accessorRegistry = accessorRegistry;
  this.chartRenderer = new ChartRenderer(store);

  // Register cleanup callback — store calls this when deregisterInline() fires.
  // This resets lastInlineRowsRef so the next apply() re-registers SceneTrack rows.
  this.unsubscribeDeregister = store.onDeregisterInline(widgetId, () => {
    this.lastInlineRowsRef = null;
  });
}

private readonly unsubscribeDeregister: () => void;
```

In `ChartWidget.dispose()`, call the unsubscribe function:
```typescript
dispose(): void {
  this.unsubscribeDeregister();
  // ... existing dispose code ...
}
```

`useLiveChartData` on unmount calls only `store.deregisterInline(widgetId)`. The store invokes the callback automatically. **`_resetInlineRef()` is not a method on `ChartWidget` and is not exposed on `getWidget()`.** `getWidget()` return type remains `Pick<ChartWidget, 'onHover' | 'onSelect'>` — no change to the existing public API.

**`ChartPluginInstance.getWidget` return type — no change from V2.0:**
```typescript
getWidget(id: string): Pick<ChartWidget, 'onHover' | 'onSelect'> | undefined;
```

**Test strategy** (`elements/chart/__tests__/ChartWidget.test.ts`):
- Construct a `ChartWidget` with a real `ChartDataStore`.
- Call `apply()` with inline state → assert store has inline rows.
- Call `store.setLiveOverride(widgetId)` → call `apply()` again with different inline state → assert store data is NOT updated (live override active).
- Call `store.deregisterInline(widgetId)` (the store invokes the registered callback) → call `apply()` → assert store data IS updated with SceneTrack rows (callback reset `lastInlineRowsRef`).
- Call `widget.dispose()` then `store.deregisterInline(widgetId)` → assert NO callback is invoked (unsubscribed).

### 1.3 `useLiveChartData` Hook — New File

**File:** `packages/charts/src/player/useLiveChartData.ts`

**Responsibility:** Bridges React state changes to `ChartDataStore` without touching the SceneTrack lifecycle.

**Full implementation contract:**
```typescript
import { useEffect, useRef } from 'react';
import { normalizeDataInput } from '../data/transforms';
import type { DataInput } from '../data/types';
import type { ChartPluginInstance } from './chartPlugin';

/**
 * Registers `data` as a live override for the chart identified by `chartId`.
 *
 * On every render where the `data` reference changes, the hook calls:
 *   store.registerInline(widgetId, normalizedRows)
 *   store.setLiveOverride(widgetId)
 *
 * On unmount:
 *   store.deregisterInline(widgetId)
 *   (The store automatically invokes the ChartWidget cleanup callback registered at
 *   widget construction — no direct widget reference needed in this hook.)
 *
 * Ordering: `useEffect` fires after paint. The first frame may render SceneTrack-baked
 * initialRows before the hook fires. This single-frame delta is acceptable (see note §2.1).
 *
 * Scope: Only effective when the chart's SceneTrack dataSource.type === 'inline'.
 * Has no effect on named or async data sources.
 *
 * @param plugin - The ChartPluginInstance returned by chartPlugin().
 * @param chartId - The `id` prop of the target chart DSL element.
 * @param data - Inline DataInput. Reference identity is the change signal.
 */
export function useLiveChartData(
  plugin: ChartPluginInstance,
  chartId: string,
  data: DataInput,
): void {
  const dataRef = useRef<DataInput>(data);
  const mountedRef = useRef(false);

  useEffect(() => {
    const store = plugin.store;
    const widgetId = chartId;
    const rows = normalizeDataInput(data);

    store.registerInline(widgetId, rows);
    store.setLiveOverride(widgetId);
    dataRef.current = data;
    mountedRef.current = true;

    return () => {
      // deregisterInline automatically triggers ChartWidget's cleanup callback
      // (registered in the widget constructor via store.onDeregisterInline).
      // No widget reference needed here — all cleanup is coordinated through the store.
      store.deregisterInline(widgetId);
      mountedRef.current = false;
    };
  }, [plugin, chartId, data]); // data reference identity is the change signal
}
```

**Export from `packages/charts/src/index.ts`:** `export { useLiveChartData } from './player/useLiveChartData';`

**Test strategy** (`player/__tests__/useLiveChartData.test.tsx`):
- Use `@testing-library/react` `renderHook` with a real `ChartDataStore` and real `ChartPluginInstance` stub.
- Assert that on initial render, `store.hasLiveOverride('chart1') === true` and store resolves live rows.
- Re-render with new data reference → assert store updated.
- Unmount → assert `store.hasLiveOverride('chart1') === false` and store has no data for inline key.

### 1.4 `ChartAccessorRegistry` and `useChartAccessors` Hook

**File (new type):** `packages/charts/src/player/chartPlugin.ts` — add `ChartAccessorFunctions` type and extend `ChartPluginInstance`.

**New type definitions (add to `chartPlugin.ts` internal types, re-export from `index.ts`):**
```typescript
import type { DataRow } from '../data/types';

/** Function-based data accessor registry for a single chart. Bypasses SceneTrack serialization. */
export type ChartAccessorFunctions = {
  /** Accessor for the X axis numeric channel. Overrides Number(row[xField]). */
  readonly xAccessor?: (row: DataRow) => number;
  /** Accessor for the Y axis numeric channel. Overrides Number(row[yField]). */
  readonly yAccessor?: (row: DataRow) => number;
  /** Accessor for the size channel (scatter). Overrides Number(row[sizeField]). */
  readonly sizeAccessor?: (row: DataRow) => number;
  /** Accessor for the color channel (scatter). Overrides field lookup. */
  readonly colorAccessor?: (row: DataRow) => number | string;
};
```

**`ChartPluginInstance` extended type** (Phase 1 type change in `chartPlugin.ts` — runtime implementation in Stream C):
```typescript
export type ChartPluginInstance = WidgetPlugin & {
  readonly store: ChartDataStore;
  /**
   * Accessor registry for useChartAccessors(). Keyed by chart ID (= widgetId).
   * Exposed publicly so the hook can read/write it directly.
   */
  readonly accessorRegistry: Map<string, ChartAccessorFunctions>;
  /** getWidget return type is unchanged from V2.0 — _resetInlineRef is NOT exposed. */
  getWidget(id: string): Pick<ChartWidget, 'onHover' | 'onSelect'> | undefined;
};
```

**Phase 1 scope for `chartPlugin.ts`**: Only the *type definition* of `ChartPluginInstance` changes in Phase 1. The runtime implementation (instantiating `accessorRegistry`, updating `registerChartWidget` to pass it to `ChartWidget`, etc.) belongs to Stream C. Phase 1 for `chartPlugin.ts` is a type-only edit — add `accessorRegistry` to the exported type and import `ChartAccessorFunctions` from `IChartRenderer.ts`.

**`chartPlugin()` factory — add to returned object:**
```typescript
const accessorRegistry = new Map<string, ChartAccessorFunctions>();

return {
  store,
  accessorRegistry,
  getWidget(id: string) { return widgetMap.get(id); },
  // ... existing fields unchanged
};
```

**`ChartWidget` constructor — add accessor registry parameter:**

`ChartWidget` needs access to the accessor registry at `apply()` time. The cleanest approach is to pass the `accessorRegistry` map to the constructor.

Modify `ChartWidget` constructor:
```typescript
constructor(
  widgetId: string,
  store: ChartDataStore,
  accessorRegistry?: Map<string, ChartAccessorFunctions>,
) {
  this.widgetId = widgetId;
  this.store = store;
  this.accessorRegistry = accessorRegistry ?? null;
  this.chartRenderer = new ChartRenderer(store);
}

private readonly accessorRegistry: Map<string, ChartAccessorFunctions> | null;
```

In `chartPlugin.ts`, update `registerChartWidget`:
```typescript
const widget = new ChartWidget(chartId, store, accessorRegistry);
```

**`ChartWidget.apply()` — pass accessors to `ChartRenderer.update()`:**
```typescript
this.chartRenderer.update({
  ...state,
  bounds: { width: worldW, height: worldH, depth: state.bounds.depth },
  position: worldPos,
  entryT: this.currentEntryT < 1.0 ? this.currentEntryT : undefined,
  accessors: this.accessorRegistry?.get(this.widgetId),
}, this.widgetId);
```

**File (new hook):** `packages/charts/src/player/useChartAccessors.ts`

```typescript
import { useEffect } from 'react';
import type { ChartPluginInstance, ChartAccessorFunctions } from './chartPlugin';

/**
 * Registers function-based data accessors for a chart by ID.
 *
 * Accessors are stored in the plugin's accessorRegistry (not in the SceneTrack).
 * Renderers check for registered accessors before falling back to Number(row[field]).
 *
 * The registry entry persists for the lifetime of the hook (across scenes using the same chart ID).
 * On unmount, accessors are removed and renderers fall back to field-name lookup.
 *
 * @param plugin - The ChartPluginInstance returned by chartPlugin().
 * @param chartId - The `id` prop on the target chart DSL element.
 * @param accessors - Function accessors for one or more data channels.
 */
export function useChartAccessors(
  plugin: ChartPluginInstance,
  chartId: string,
  accessors: ChartAccessorFunctions,
): void {
  useEffect(() => {
    plugin.accessorRegistry.set(chartId, accessors);
    return () => {
      plugin.accessorRegistry.delete(chartId);
    };
  }, [plugin, chartId, accessors]);
}
```

**`ChartRenderContext` — add `accessors` field (Phase 1 type change in `IChartRenderer.ts`):**
```typescript
export type ChartRenderContext = {
  // ... all existing fields ...
  readonly entryT?: number;  // NEW — 0..1 entry animation progress; absent or 1.0 = fully rendered
  readonly accessors?: ChartAccessorFunctions;  // NEW — function accessors from useChartAccessors
};
```

**Renderer usage pattern for accessor functions:**

All renderers that map data to visual channels must check for accessor functions. Pattern:
```typescript
// Example from ScatterRenderer — resolving X position
const xValue = ctx.accessors?.xAccessor
  ? ctx.accessors.xAccessor(row)
  : (Number(row[xField]) || 0);
```

Renderers affected: `ScatterRenderer` (xAccessor, yAccessor, sizeAccessor, colorAccessor), `BarRenderer` (yAccessor for bar height), `LineRenderer` (yAccessor). `PieRenderer`, `AreaRenderer`, `HeatmapRenderer` are NOT changed — accessor support is scoped to the chart types where it adds clear value.

**Export from `index.ts`:**
```typescript
export { useLiveChartData } from './player/useLiveChartData';
export { useChartAccessors } from './player/useChartAccessors';
export type { ChartAccessorFunctions } from './player/chartPlugin';
```

**Test strategy** (`player/__tests__/useChartAccessors.test.tsx`):
- `renderHook` with real plugin instance.
- Assert `plugin.accessorRegistry.get('scatter-chart')` returns the registered accessor object.
- Unmount → assert `plugin.accessorRegistry.has('scatter-chart') === false`.

### 1.5 `useChartData` Read-Side Extension — Explicitly Deferred to V2.2

The finalized feature note (§2.1) mentions extending `useChartData` (or adding a sibling hook) to support reading inline live data by widget ID — e.g., `useChartWidgetData(plugin, chartId)` that returns the `ResolvedDataFrame` currently registered under `__inline__${chartId}` and re-renders when that data changes.

**Decision: Defer to V2.2.** Rationale:

The existing `useChartData(sourceName)` hook subscribes via `store.subscribeToSource()`, which routes through the filter engine's subscriber map. Filter engine listeners fire on filter-group state changes — not on `register()` / `registerInline()` / `deregisterInline()` calls. A read-side hook for inline data therefore requires a new inline-specific subscription mechanism in `ChartDataStore` (a `Map<string, Set<() => void>>` of per-widgetId listeners, fired by `registerInline` and `deregisterInline`). This is a non-trivial addition to the store's internal event model and is orthogonal to all five feature areas in V2.1.

The write side (`useLiveChartData`) is the high-value, high-priority item in V2.1 and ships in Stream A. The read side is a convenience layer for consumers who want reactive UI components outside the 3D scene to mirror chart data. No V2.1 use case requires it. V2.2 will add:
- `ChartDataStore.subscribeToInline(widgetId, cb): () => void` — fires on `registerInline` / `deregisterInline`
- `ChartDataStore.resolveInline(widgetId): ResolvedDataFrame` — reads `__inline__${widgetId}` without the full `resolve()` path
- `useChartWidgetData(plugin, chartId): ResolvedDataFrame` — uses `useSyncExternalStore` against the above two methods

No files in V2.1 are blocked by this deferral.

---

## Feature Area 2: Axis Mapping Functions / Compute Transforms

### 2.1 `ComputeTransform` Type — Phase 1

**File:** `packages/charts/src/data/types.ts`

Add after `BinTransform`:
```typescript
/**
 * Derives a new computed column from an existing numeric field.
 * All operations are serializable — no function references.
 * Stored in ChartState.transforms[] and evaluated at runtime by ChartDataStore.resolve().
 */
export type ComputeTransform = {
  readonly type: 'compute';
  /** Name of the new computed output field added to each row. */
  readonly outputField: string;
  readonly operation:
    | { readonly fn: 'log'; readonly inputField: string; readonly base?: number }
    | { readonly fn: 'sqrt'; readonly inputField: string }
    | { readonly fn: 'normalize'; readonly inputField: string }  // output: [0, 1] over dataset range
    | { readonly fn: 'scale'; readonly inputField: string; readonly factor: number }
    | { readonly fn: 'add'; readonly inputField: string; readonly value: number };
};

/** Union of all supported data transforms. All are serializable — no function references. */
export type DataTransform =
  | FilterTransform
  | GroupByTransform
  | SortTransform
  | BinTransform
  | ComputeTransform;  // V2.1 addition
```

Also export `ComputeTransform` from `data/types.ts` — it will be re-exported from `index.ts`.

### 2.2 `applyCompute` Function

**File:** `packages/charts/src/data/transforms.ts`

Add import:
```typescript
import type { ComputeTransform, DataTransform, /* existing */ } from './types';
import { min, max } from 'd3-array';  // already imported
```

Add new function:
```typescript
/**
 * Applies a ComputeTransform to rows — derives a new column from an existing numeric field.
 * For 'normalize': uses the min/max of the CURRENT rows array (dataset range, not fixed domain).
 * This means normalize re-computes its range when filtered data changes — intended behavior.
 */
export function applyCompute(rows: ReadonlyArray<Row>, transform: ComputeTransform): Row[] {
  const { outputField, operation } = transform;
  const inputValues = rows.map((r) => Number(r[operation.inputField]) || 0);

  let normalMin = 0;
  let normalMax = 1;
  if (operation.fn === 'normalize') {
    normalMin = min(inputValues) ?? 0;
    normalMax = max(inputValues) ?? 1;
  }

  return rows.map((r) => {
    const v = Number(r[operation.inputField]) || 0;
    let computed: number;
    switch (operation.fn) {
      case 'log': {
        const base = operation.base ?? Math.E;
        computed = Math.log(Math.max(v, Number.EPSILON)) / Math.log(base);
        break;
      }
      case 'sqrt':
        computed = Math.sqrt(Math.max(v, 0));
        break;
      case 'normalize': {
        const range = normalMax - normalMin;
        computed = range === 0 ? 0 : (v - normalMin) / range;
        break;
      }
      case 'scale':
        computed = v * operation.factor;
        break;
      case 'add':
        computed = v + operation.value;
        break;
      default: {
        const _exhaustive: never = operation;
        console.warn(`[charts/transforms] Unknown compute fn: ${String((_exhaustive as { fn: string }).fn)}`);
        computed = v;
      }
    }
    return { ...r, [outputField]: computed };
  });
}
```

Update `applyTransforms()` to handle `'compute'`:
```typescript
export function applyTransforms(
  rows: ReadonlyArray<Row>,
  transforms: readonly DataTransform[],
): Row[] {
  let result: Row[] = rows as Row[];
  for (const t of transforms) {
    switch (t.type) {
      case 'filter':  result = applyFilter(result, t);  break;
      case 'groupBy': result = applyGroupBy(result, t); break;
      case 'sort':    result = applySort(result, t);    break;
      case 'bin':     result = applyBin(result, t);     break;
      case 'compute': result = applyCompute(result, t); break;  // V2.1 addition
      default: {
        const _exhaustive: never = t;
        console.warn(`[charts/transforms] Unknown transform type: ${String((_exhaustive as DataTransform).type)}`);
      }
    }
  }
  return result;
}
```

**Exhaustive switch audit** — all sites that switch on `DataTransform.type` that must be updated:
1. `data/transforms.ts` — `applyTransforms()` — done above.
2. `data/__tests__/transforms.test.ts` — add `'compute'` test cases (Stream A).
3. Any codec or serialization layer — audit: `data/types.ts` export only, no separate serialization. `ChartDataStore.resolve()` calls `applyTransforms` which now handles `'compute'`. No other exhaustive switches found.

**Export from `index.ts`:**
```typescript
export type { ComputeTransform } from './data/types';  // add to existing DataTransform exports
```

**Test strategy** (`data/__tests__/transforms.test.ts`):
- `applyCompute` with `fn: 'log'`, `fn: 'sqrt'`, `fn: 'normalize'`, `fn: 'scale'`, `fn: 'add'` — assert output field added to each row with correct computed value.
- `normalize` with all-same-value input → assert returns 0 (range=0 edge case).
- `log` with `base: 10` → assert `log10(100) = 2`.
- `applyTransforms` with a `compute` transform in the array → assert end-to-end.
- Add `'compute'` transform in integration test (`data/__tests__/ChartDataStoreIntegration.test.ts`) — `store.resolve()` with a compute transform in the array.

---

## Feature Area 3: Data Animations & Entry Animations

### 3.1 New Fields on `ChartState` — Phase 1

**File:** `packages/charts/src/elements/chart/types.ts`

Add to `ChartState`:
```typescript
export type ChartState = {
  // ... all existing fields unchanged ...

  /**
   * V2.1: Whether bars animate upward from y=0 on scene entry.
   * Driven by blockProgress via ChartWidget.onTick(). Currently scoped to BarRenderer only.
   * Default: false.
   */
  readonly animateEntry: boolean;

  /**
   * V2.1: Duration of the entry animation as a fraction of blockProgress [0..1].
   * At blockProgress = animationDuration, entryT reaches 1.0 (full height).
   * Values outside [0.01..1.0] are clamped.
   * Default: 0.4
   */
  readonly animationDuration: number;
};
```

Update `DEFAULT_CHART_STATE`:
```typescript
export const DEFAULT_CHART_STATE: ChartState = {
  // ... all existing fields ...
  animateEntry: false,
  animationDuration: 0.4,
};
```

### 3.2 New DSL Props on `BaseChartDSL`

**File:** `packages/charts/src/elements/chart/dsl.tsx`

Add to `BaseChartDSL` type:
```typescript
export type BaseChartDSL = {
  // ... all existing fields ...
  /** Enable bar-grow entry animation driven by blockProgress. Scoped to BarRenderer in V2.1. */
  readonly animateEntry?: boolean;
  /**
   * Duration of entry animation as a fraction of blockProgress [0..1].
   * Animation completes when blockProgress reaches this value. Default: 0.4.
   */
  readonly animationDuration?: number;
};
```

No changes to per-type DSL types (`BarChartDSL`, `LineChartDSL`, etc.) — these fields are on `BaseChartDSL` which all per-type DSL types extend.

### 3.3 `compile.ts` — Compile `animateEntry` and `animationDuration`

**File:** `packages/charts/src/elements/chart/compile.ts`

In `compileChart()`, add to the returned `ChartState` object:
```typescript
animateEntry: props.animateEntry ?? false,
animationDuration: Math.min(Math.max(props.animationDuration ?? 0.4, 0.01), 1.0),
```

`props` is typed as `BaseChartDSL` for all per-type chart components (their DSL types extend it). No type assertion needed.

**Test strategy** (`elements/chart/__tests__/compile.test.ts`):
- Assert `animateEntry` defaults to `false` when not specified.
- Assert `animationDuration` defaults to `0.4` when not specified.
- Assert `animationDuration` of `1.5` is clamped to `1.0`.
- Assert `animationDuration` of `0` is clamped to `0.01`.

### 3.4 `IChartRenderer.ts` — Add `entryT` to `ChartRenderContext` — Phase 1

**File:** `packages/charts/src/renderers/shared/IChartRenderer.ts`

Add to `ChartRenderContext`:
```typescript
export type ChartRenderContext = {
  // ... all existing fields unchanged ...

  /**
   * V2.1: Entry animation progress [0..1].
   * Present only when animateEntry=true and the animation is in progress.
   * Absent (or 1.0) = bars at full height. Currently consumed by BarRenderer only.
   */
  readonly entryT?: number;

  /**
   * V2.1: Function accessors from useChartAccessors. May override field-name lookups.
   * Renderers check for accessors before falling back to Number(row[field]).
   */
  readonly accessors?: ChartAccessorFunctions;
};
```

`ChartAccessorFunctions` import: `import type { ChartAccessorFunctions } from '../../player/chartPlugin';` — but this creates a dependency from `renderers/shared/IChartRenderer.ts` → `player/chartPlugin.ts`. The accessor types logically belong to the plugin layer, but this creates a layering concern. **Resolution**: Move `ChartAccessorFunctions` type to `data/types.ts` or a new `types/accessorTypes.ts` near the shared boundary. **Decision**: Define `ChartAccessorFunctions` directly in `renderers/shared/IChartRenderer.ts` since `IChartRenderer.ts` is already the shared type hub for the renderer layer, and `chartPlugin.ts` can import it from there (not the reverse). This is the correct dependency direction: `player` imports from `renderers/shared`, not the other way.

```typescript
// In IChartRenderer.ts — before ChartRenderContext:

import type { DataRow } from '../../data/types';

/**
 * V2.1: Function-based data accessors registered by useChartAccessors().
 * These bypass the SceneTrack and override field-name-based value lookup in renderers.
 * Defined here (shared renderer type hub) so both renderers and the plugin layer can import
 * this type without creating a circular dependency.
 */
export type ChartAccessorFunctions = {
  readonly xAccessor?: (row: DataRow) => number;
  readonly yAccessor?: (row: DataRow) => number;
  readonly sizeAccessor?: (row: DataRow) => number;
  readonly colorAccessor?: (row: DataRow) => number | string;
};
```

Then in `chartPlugin.ts`:
```typescript
import type { ChartAccessorFunctions } from '../renderers/shared/IChartRenderer';
export type { ChartAccessorFunctions };  // re-export for useChartAccessors and index.ts
```

### 3.5 `ChartWidget.ts` — Entry Animation State and `onTick()` Update

**File:** `packages/charts/src/elements/chart/ChartWidget.ts`

**New private field:**
```typescript
/** Entry animation progress [0..1]. 1.0 = complete (default — geometry at full size). */
private currentEntryT: number = 1.0;
```

**Updated `onTick()` method:**

The existing `onTick()` handles heatmap animation. Add entry animation handling for all non-heatmap types:

```typescript
onTick(ctx: AnimationTickContext): void {
  if (!this.lastState) return;
  const state = this.lastState;

  // ── Entry animation (all chart types, rendered by BarRenderer only in V2.1) ──
  if (state.animateEntry) {
    const blockProgress = ctx.tick?.blockProgress ?? 0;
    const duration = state.animationDuration;
    this.currentEntryT = duration > 0 ? Math.min(blockProgress / duration, 1.0) : 1.0;
  } else {
    this.currentEntryT = 1.0;
  }

  // ── Heatmap time-slice animation ─────────────────────────────────────────
  if (state.typeConfig.kind !== 'heatmap') return;
  // ... existing heatmap code unchanged ...
}
```

**Updated `apply()` — pass `entryT` and `accessors` to `ChartRenderer`:**
```typescript
this.chartRenderer.update({
  ...state,
  bounds: { width: worldW, height: worldH, depth: state.bounds.depth },
  position: worldPos,
  entryT: this.currentEntryT < 1.0 ? this.currentEntryT : undefined,
  accessors: this.accessorRegistry.get(this.widgetId),
}, this.widgetId);
```

**`ChartRenderInput` type — Phase 1 deliverable, defined in `elements/chart/types.ts`:**

`ChartRenderInput` is the boundary contract between `ChartWidget` (Stream C) and `ChartRenderer` (Stream D — `render.ts`). Both streams depend on it. Moving it to `types.ts` and delivering it in Phase 1 eliminates the cross-stream compile dependency. `render.ts` imports it from `types.ts`; `ChartWidget.ts` imports it from `types.ts`.

```typescript
// In packages/charts/src/elements/chart/types.ts — add after ChartState:

import type { ChartAccessorFunctions } from '../../renderers/shared/IChartRenderer';

/**
 * Input type for ChartRenderer.update(). Extends ChartState with world-space bounds,
 * world-space position, and runtime-only fields (entryT, accessors) that are not
 * SceneTrack-serializable. Defined in types.ts (not render.ts) so ChartWidget.ts and
 * render.ts both resolve it from the same Phase 1 source.
 */
export type ChartRenderInput = Omit<ChartState, 'nvsX' | 'nvsY' | 'z'> & {
  readonly position: readonly [number, number, number];
  /** V2.1: Entry animation progress from ChartWidget.onTick(). Absent or 1.0 = full size. */
  readonly entryT?: number;
  /** V2.1: Function accessors from useChartAccessors(). Absent = no override. */
  readonly accessors?: ChartAccessorFunctions;
};
```

Stream C (`ChartWidget.ts`) and Stream D (`render.ts`) both import `ChartRenderInput` from `./types`. `render.ts` must remove any existing local `ChartRenderInput` definition if one exists and replace it with the import.

**Test strategy for `onTick()` entry animation** (`elements/chart/__tests__/ChartWidget.test.ts`):

`currentEntryT` is a `private` field. Testing it by exposing it directly or via a mock violates the project's interface-based stateful testing convention. Instead, test it through observable output: construct a real `ChartRendererDouble` that records its last-received `ChartRenderInput`, call `onTick()` + `apply()`, then assert on `rendererDouble.lastInput.entryT`.

The `ChartRendererDouble` is a minimal class that implements the `ChartRenderer`'s public surface (`update()`, `dispose()`, etc.) but records arguments instead of rendering:

```typescript
// In ChartWidget.test.ts:
class ChartRendererDouble {
  lastInput: ChartRenderInput | null = null;
  update(input: ChartRenderInput): void { this.lastInput = input; }
  mount(_scene: unknown): void {}
  dispose(_scene: unknown): void {}
  updateHeatmapSlice(_sliceIndex: number, _input: ChartRenderInput, _widgetId: string): void {}
  getInteractiveObjects(): unknown[] { return []; }
  resolveHoverInfo(): null { return null; }
}
```

Inject the double by making `ChartWidget.chartRenderer` injectable (add an optional 4th constructor argument `rendererOverride?: ChartRendererDouble`). This seam is minimal and explicitly test-only.

Test assertions:
- Call `onTick({ tick: { blockProgress: 0.2 } })` with `lastState.animateEntry = true, animationDuration = 0.4`.
- Call `apply(state, ctx)`.
- Assert `rendererDouble.lastInput?.entryT ≈ 0.5` (0.2 / 0.4 = 0.5).
- Call `onTick({ tick: { blockProgress: 0.4 } })` then `apply()` → assert `lastInput.entryT === undefined` (1.0 → absent).
- Call with `animateEntry = false` → assert `lastInput.entryT === undefined` regardless of blockProgress.

### 3.6 `BarRenderer.ts` — Entry Animation via `mesh.scale.y`

**File:** `packages/charts/src/renderers/bar/BarRenderer.ts`

**Geometry origin anchoring requirement (confirmed in note §3.6):**

`BoxGeometry` centers geometry at origin by default. For entry animation to grow bars from y=0 upward, the geometry must be anchored at the bottom. This requires `geometry.translate(0, height/2, 0)` at creation time. **This is a change to existing bar geometry creation** — apply it in `buildGroupedBars()` and `buildStackedBars()` for every `BoxGeometry` created.

Before this change, bar `mesh.position.y` was set to `barY + barHeight/2`. After this change with the geometry translated, `mesh.position.y` is set to `barY` (bottom of bar, not center). Existing tests that assert on `mesh.position.y` values MUST be updated.

**Entry animation application in `update()`:**

After geometry is built/updated, apply `entryT` scaling:
```typescript
// After building bars:
const entryT = ctx.entryT ?? 1.0;
if (entryT < 1.0) {
  const eased = easeOutCubic(entryT);
  for (const mesh of this.barMeshes) {
    mesh.scale.y = eased;
  }
} else {
  // Ensure scale is reset to 1.0 when animation completes
  for (const mesh of this.barMeshes) {
    mesh.scale.y = 1.0;
  }
}
```

**Add easing function in `BarRenderer.ts`:**
```typescript
/** Cubic ease-out: fast at start, decelerates to final value. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
```

**Accessor integration in `BarRenderer.update()`:**

When computing bar height from the Y field, check for `yAccessor` first:
```typescript
// Before:
const yValue = Number(row[yField]) || 0;

// After:
const yValue = ctx.accessors?.yAccessor
  ? ctx.accessors.yAccessor(row as DataRow)
  : (Number(row[yField]) || 0);
```

**Test strategy** (`renderers/bar/__tests__/BarRenderer.test.ts`):
- Build `BarRenderer`, call `update()` with `ctx.entryT = 0.0` → assert `barMeshes[0].scale.y === 0` (or `easeOutCubic(0) = 0`).
- Call with `ctx.entryT = 0.5` → assert `scale.y ≈ easeOutCubic(0.5) ≈ 0.875`.
- Call with `ctx.entryT = undefined` → assert `scale.y === 1.0`.
- Verify geometry origin: assert first bar mesh `position.y` equals `barBottom` (not `barBottom + height/2`).
- Update any existing position.y assertions that were asserting center-based positions.

### 3.7 Cross-Scene Morphing — Extend to `LineRenderer` and `AreaRenderer`

**File:** `packages/charts/src/renderers/line/LineRenderer.ts`

**What changes:** When `ctx.morphCtx` is present, interpolate Y positions of line points between `fromData` and `toData` using `morphCtx.t` and `morphCtx.keyField`.

**Performance requirement — O(n) total, not O(n²):** Build a `Map` keyed by `keyField` values from `fromData.rows` ONCE before the per-row loop. Do NOT use `Array.find()` inside the loop — that would be O(n²) and is unacceptable for line charts with 200+ data points (200 rows × 200 find() calls = 40,000 comparisons per frame during a transition).

```typescript
// In LineRenderer.update(), BEFORE the per-row loop:
type Row = Record<string, unknown>;
const morphFromMap: Map<unknown, Row> | null = ctx.morphCtx
  ? new Map<unknown, Row>(
      ctx.morphCtx.fromData.rows.map((r) => [r[ctx.morphCtx!.keyField], r as Row])
    )
  : null;

// Inside the per-row loop, resolving each point's Y value:
const toY = Number(row[yField]) || 0;
const yValue = (() => {
  if (!morphFromMap || !ctx.morphCtx) return toY;
  const fromRow = morphFromMap.get(row[ctx.morphCtx.keyField]);
  const fromY = fromRow ? (Number(fromRow[yField]) || 0) : toY; // fall back to toY if unmatched
  return lerp(fromY, toY, ctx.morphCtx.t);
})();
```

Apply the `morphFromMap` pattern to both point positions (if `showPoints = true`) and the curve geometry construction. The map is built once per `update()` call — O(n) — and each row lookup is O(1).

**File:** `packages/charts/src/renderers/area/AreaRenderer.ts`

**What changes:** Same `Map`-based pattern — build a `morphFromMap` before the loop over `toData` rows. Interpolate upper boundary points and, when `bandField` is set, lower boundary points too:

```typescript
// Before the per-row loop in AreaRenderer.update():
const morphFromMap: Map<unknown, Row> | null = ctx.morphCtx
  ? new Map<unknown, Row>(
      ctx.morphCtx.fromData.rows.map((r) => [r[ctx.morphCtx!.keyField], r as Row])
    )
  : null;

// Inside the per-row loop — upper boundary:
const toUpperY = Number(row[seriesField]) || 0;
const upperY = (() => {
  if (!morphFromMap || !ctx.morphCtx) return toUpperY;
  const fromRow = morphFromMap.get(row[ctx.morphCtx.keyField]);
  const fromUpperY = fromRow ? (Number(fromRow[seriesField]) || 0) : toUpperY;
  return lerp(fromUpperY, toUpperY, ctx.morphCtx.t);
})();

// Inside the per-row loop — lower boundary (bandField only):
const toLowerY = bandField ? (Number(row[bandField]) || 0) : 0;
const lowerY = (() => {
  if (!morphFromMap || !bandField || !ctx.morphCtx) return toLowerY;
  const fromRow = morphFromMap.get(row[ctx.morphCtx.keyField]);
  const fromLowerY = fromRow ? (Number(fromRow[bandField]) || 0) : toLowerY;
  return lerp(fromLowerY, toLowerY, ctx.morphCtx.t);
})();
```

**Test strategy:**
- `LineRenderer.test.ts`: construct `morphCtx` with `fromData` (5 rows), `toData` (5 rows, same keys), `t=0.5`. After `update()`, assert each line point Y is the midpoint between from and to values. Use a dataset large enough to detect O(n²) performance regressions if they occur (≥50 rows).
- `AreaRenderer.test.ts`: same pattern; additionally assert lower boundary points when `bandField` is set.
- Both: assert unmatched keys in `fromData` fall back to `toY`/`toLowerY` (no NaN, no crash).

---

## Feature Area 4: Full Theme Coverage

### 4.1 New Token Types — Phase 1

**File:** `packages/charts/src/themes/types.ts`

**Additions to existing types:**

Add `titleFontSize?` to `ChartAxisTokens`:
```typescript
export type ChartAxisTokens = {
  // ... all existing fields ...
  /**
   * V2.1: Font size for axis title labels, independent of tick label fontSize.
   * Default (when absent): theme.axis.fontSize * 1.1.
   */
  readonly titleFontSize?: number;
};
```

Add `textOpacity?` to `ChartLegendTokens`:
```typescript
export type ChartLegendTokens = {
  // ... all existing fields ...
  /**
   * V2.1: Opacity for legend label text [0..1].
   * Separate from textColor — allows tinting while keeping the same color.
   * Default: 1.0.
   */
  readonly textOpacity?: number;
};
```

**New token group types (add after `ChartInteractionTokens`):**

```typescript
/**
 * V2.1: Bar chart theme defaults. Used when DSL barPadding is not specified.
 * Falls back to barPadding=0.2 when absent.
 */
export type ChartBarTokens = {
  /** Padding ratio between bar groups [0..1]. Default: 0.2. */
  readonly padding: number;
};

/**
 * V2.1: Area chart theme defaults. Used when DSL fillOpacity is not specified.
 * Falls back to fillOpacity=0.7 when absent.
 */
export type ChartAreaTokens = {
  /** Area fill opacity [0..1]. Default: 0.7. */
  readonly fillOpacity: number;
};

/**
 * V2.1: Gridline visual tokens.
 * When present, takes precedence over ChartBackgroundTokens.gridColor (which is deprecated).
 * When absent, ChartBackgroundTokens.gridColor is used for backward compatibility.
 */
export type ChartGridlinesTokens = {
  readonly color: string;
  /** Gridline opacity [0..1]. Default: 0.15. */
  readonly opacity: number;
  /**
   * Whether gridlines are visible by default for this theme.
   * Per-axis DSL gridlines prop overrides this. Default: false.
   */
  readonly visible: boolean;
  /**
   * Dash segment length in world units. Requires LineDashedMaterial + computeLineDistances().
   * Absent = solid line (LineBasicMaterial). Note: linewidth is WebGL1-capped at 1px;
   * dashed gridlines are decorative only and the cap is acceptable.
   */
  readonly dashSize?: number;
  /** Gap between dash segments in world units. Only meaningful when dashSize is set. */
  readonly gapSize?: number;
};

/**
 * V2.1: Data label theme tokens. Applied when <ChartDataLabels> is present in DSL.
 */
export type ChartDataLabelsTokens = {
  /** Font size in world units. */
  readonly fontSize: number;
  /** Label text color (CSS hex). */
  readonly color: string;
  /** Optional pill background color (CSS hex). Absent = no background. */
  readonly background?: string;
};

/**
 * V2.1: Reference line theme tokens.
 * Applied when ReferenceLine.color or lineWidth is not specified in the DSL.
 *
 * Implementation note: lineWidth is world-space width of a thin BoxGeometry plane,
 * NOT a Three.js linewidth property. BoxGeometry is more portable than LineBasicMaterial
 * for reference lines where linewidth > 1px WebGL1 cap matters. AxesRenderer (for gridlines)
 * continues to use LineBasicMaterial or LineDashedMaterial for decorative lines.
 */
export type ChartReferenceLineTokens = {
  /** Default line color (CSS hex) when not specified on <ReferenceLine>. */
  readonly defaultColor: string;
  /** World-space width of the reference line BoxGeometry geometry. Default: 0.005. */
  readonly lineWidth: number;
  /** Line opacity [0..1]. Default: 0.85. */
  readonly lineOpacity: number;
};
```

**Updated `ChartTheme` — add optional new groups:**
```typescript
export type ChartTheme = {
  readonly name: string;
  readonly series: readonly ChartSeriesMaterialTokens[];
  readonly axis: ChartAxisTokens;
  readonly background: ChartBackgroundTokens;
  readonly legend: ChartLegendTokens;
  readonly line: ChartLineTokens;
  readonly pie: ChartPieTokens;
  readonly interaction: ChartInteractionTokens;
  readonly sceneTheme?: SceneTheme;
  // V2.1 additions — all optional, renderers have documented fallback defaults:
  readonly bar?: ChartBarTokens;
  readonly area?: ChartAreaTokens;
  readonly gridlines?: ChartGridlinesTokens;
  readonly dataLabels?: ChartDataLabelsTokens;
  readonly referenceLines?: ChartReferenceLineTokens;
};
```

### 4.2 Built-in Theme Updates

**Files:**
- `packages/charts/src/themes/darkGlass.ts`
- `packages/charts/src/themes/neonCyber.ts`
- `packages/charts/src/themes/enterprise.ts`
- `packages/charts/src/themes/lightMinimal.ts`

Each built-in theme object must be updated to include explicit values for all new optional token groups. This documents the defaults clearly and allows consumers to use `createChartTheme()` with targeted overrides.

**`darkGlass` additions:**
```typescript
axis: {
  // ... existing ...
  titleFontSize: 0.065,  // existing fontSize * 1.18
},
legend: {
  // ... existing ...
  textOpacity: 1.0,
},
bar:  { padding: 0.2 },
area: { fillOpacity: 0.7 },
gridlines: { color: '#4a6080', opacity: 0.18, visible: false },
dataLabels: { fontSize: 0.05, color: '#e0e8ff' },
referenceLines: { defaultColor: '#ff8844', lineWidth: 0.005, lineOpacity: 0.85 },
```

**`neonCyber` additions:**
```typescript
axis: { /* existing */ titleFontSize: 0.06 },
legend: { /* existing */ textOpacity: 1.0 },
bar:  { padding: 0.15 },
area: { fillOpacity: 0.65 },
gridlines: { color: '#00ffcc', opacity: 0.12, visible: false, dashSize: 0.03, gapSize: 0.02 },
dataLabels: { fontSize: 0.048, color: '#00ffff' },
referenceLines: { defaultColor: '#ff00aa', lineWidth: 0.005, lineOpacity: 0.9 },
```

**`enterprise` additions:**
```typescript
axis: { /* existing */ titleFontSize: 0.055 },
legend: { /* existing */ textOpacity: 0.9 },
bar:  { padding: 0.25 },
area: { fillOpacity: 0.6 },
gridlines: { color: '#c8d0d8', opacity: 0.2, visible: false },
dataLabels: { fontSize: 0.045, color: '#2a3a4a' },
referenceLines: { defaultColor: '#e05020', lineWidth: 0.004, lineOpacity: 0.8 },
```

**`lightMinimal` additions:**
```typescript
axis: { /* existing */ titleFontSize: 0.052 },
legend: { /* existing */ textOpacity: 1.0 },
bar:  { padding: 0.22 },
area: { fillOpacity: 0.72 },
gridlines: { color: '#b0b8c0', opacity: 0.25, visible: false },
dataLabels: { fontSize: 0.044, color: '#222233' },
referenceLines: { defaultColor: '#cc4400', lineWidth: 0.004, lineOpacity: 0.8 },
```

### 4.3 `createChartTheme.ts` — Support New Fields

**File:** `packages/charts/src/themes/createChartTheme.ts`

`ChartThemeOverrides` must include all new optional fields so `createChartTheme()` callers can override them:
```typescript
export type ChartThemeOverrides = Partial<{
  // ... existing overrides ...
  axis: Partial<ChartAxisTokens>;
  legend: Partial<ChartLegendTokens>;
  bar: Partial<ChartBarTokens>;
  area: Partial<ChartAreaTokens>;
  gridlines: Partial<ChartGridlinesTokens>;
  dataLabels: Partial<ChartDataLabelsTokens>;
  referenceLines: Partial<ChartReferenceLineTokens>;
}>;
```

Deep-merge the new optional groups:
```typescript
return {
  ...base,
  axis: { ...base.axis, ...overrides.axis },
  legend: { ...base.legend, ...overrides.legend },
  bar: overrides.bar ? { ...base.bar, ...overrides.bar } : base.bar,
  area: overrides.area ? { ...base.area, ...overrides.area } : base.area,
  gridlines: overrides.gridlines ? { ...base.gridlines, ...overrides.gridlines } : base.gridlines,
  dataLabels: overrides.dataLabels ? { ...base.dataLabels, ...overrides.dataLabels } : base.dataLabels,
  referenceLines: overrides.referenceLines
    ? { ...base.referenceLines, ...overrides.referenceLines }
    : base.referenceLines,
};
```

### 4.4 Renderer Updates for Theme Tokens

**`BarRenderer.ts` — read `barPadding` from theme:**
```typescript
// Before:
const barPadding = barOptions.barPadding ?? 0.2;

// After:
const barPadding = barOptions.barPadding ?? theme.bar?.padding ?? 0.2;
```

**`AreaRenderer.ts` — read `fillOpacity` from theme:**
```typescript
// Before:
const fillOpacity = areaOptions.fillOpacity ?? 0.7;

// After:
const fillOpacity = areaOptions.fillOpacity ?? theme.area?.fillOpacity ?? 0.7;
```

**`AxesRenderer.ts` — `titleFontSize`, gridline fallback chain, and dash support:**

In `updateTicks()`, when sizing axis titles:
```typescript
// Before:
const titleFontSize = theme.axis.fontSize;

// After:
const titleFontSize = theme.axis.titleFontSize ?? theme.axis.fontSize * 1.1;
```

**Gridlines fallback chain** — in `AxesRenderer`'s gridline-drawing method (or inside `updateTicks()` where gridlines are built). `ChartGridlinesTokens.color` is required within the group but the group itself is optional. Fallback to the deprecated `ChartBackgroundTokens.gridColor` when the group is absent, then to a hardcoded safe default:

```typescript
// Gridline color — in AxesRenderer.update() or a private updateGridlines() helper:
const gridColor: string =
  theme.gridlines?.color ??
  theme.background.gridColor ??
  '#4a6080';   // hardcoded fallback matches darkGlass default

const gridOpacity: number = theme.gridlines?.opacity ?? 0.15;

// Gridlines visible: resolve from theme token, then per-axis DSL prop (which overrides),
// then the chart-level gridlines shorthand. Priority chain:
//   ctx.gridlines (chart-level DSL) > axis.gridlines (per-axis DSL) > theme.gridlines.visible > false
// The existing gridline visibility logic already handles ctx.gridlines and axis.gridlines.
// Add theme.gridlines.visible as the new baseline when neither DSL prop is set:
const themeGridlinesVisible: boolean = theme.gridlines?.visible ?? false;

// Dash pattern: only applies when theme.gridlines.dashSize is set.
// Use LineDashedMaterial when dashSize is present, LineBasicMaterial otherwise:
const useDash: boolean = (theme.gridlines?.dashSize ?? 0) > 0;
const dashSize: number = theme.gridlines?.dashSize ?? 0;
const gapSize: number = theme.gridlines?.gapSize ?? dashSize; // default gap = dashSize
```

The insertion point is wherever `AxesRenderer` currently builds gridline `Line` objects. Currently `AxesRenderer` uses `ChartBackgroundTokens.gridColor` for gridlines. That fallback remains — `theme.gridlines?.color ?? theme.background.gridColor ?? '#4a6080'` ensures backward compatibility for themes that only set `gridColor` on `background`.

When `useDash` is `true`, replace the existing `LineBasicMaterial` with `LineDashedMaterial`:
```typescript
const gridMat = useDash
  ? new THREE.LineDashedMaterial({ color: gridColor, opacity: gridOpacity * opacity,
      transparent: true, dashSize, gapSize })
  : new THREE.LineBasicMaterial({ color: gridColor, opacity: gridOpacity * opacity,
      transparent: true });

// For LineDashedMaterial: must call line.computeLineDistances() after setting geometry.
if (useDash) gridLine.computeLineDistances();
```

For `ChartLegendTokens.textOpacity` in `LegendRenderer.ts`:
```typescript
// When setting text opacity on legend label Text objects:
const textOpacity = (theme.legend.textOpacity ?? 1.0) * opacity;
```

For `ChartDataLabelsTokens` in `DataLabelRenderer.ts`:
The existing `DataLabelRenderer` receives font size and color from the renderer context. Update it to check `theme.dataLabels`:
```typescript
const fontSize = theme.dataLabels?.fontSize ?? 0.05;
const labelColor = theme.dataLabels?.color ?? '#ffffff';
```

**`ChartReferenceLineTokens` in `AxesRenderer.ts` (Stream D):**

Reference lines are drawn inside `AxesRenderer.updateTicks()` (or a sibling `updateReferenceLines()` helper if one exists). The exact insertion point is the loop over `ctx.referenceLines` (passed via `AxisRenderState.referenceLines`). Add `referenceLines?: ReadonlyArray<ReferenceLineState>` to `AxisRenderState` and pass them from `ChartRenderer.update()` in `render.ts`.

In the reference line rendering loop in `AxesRenderer.ts`:
```typescript
for (const refLine of state.referenceLines ?? []) {
  const lineColor = refLine.color ?? state.theme.referenceLines?.defaultColor ?? '#ff8844';
  const lineWidth = state.theme.referenceLines?.lineWidth ?? 0.005;
  const lineOpacity = (state.theme.referenceLines?.lineOpacity ?? 0.85) * state.opacity;
  // ... build or update a BoxGeometry plane for the reference line at the given axis value ...
}
```

**Stream D file ownership addition:** Add `renderers/shared/AxesRenderer.ts` reference-line token consumption to Stream D's work items (already listed, now explicit for reference lines).

**Test strategy** (`themes/__tests__/createChartTheme.test.ts`):
- `createChartTheme(darkGlassChartTheme, { bar: { padding: 0.3 } })` → assert `result.bar.padding === 0.3`.
- Assert all built-in themes have defined `bar`, `area`, `gridlines`, `dataLabels`, `referenceLines`.
- Assert `titleFontSize` is present on all four theme `axis` objects.
- Assert `textOpacity` is present on all four theme `legend` objects.

**Exports to add to `index.ts`:**
```typescript
export type {
  ChartBarTokens,
  ChartAreaTokens,
  ChartGridlinesTokens,
  ChartDataLabelsTokens,
  ChartReferenceLineTokens,
  ChartAxisTokens,    // already exported — include titleFontSize
  ChartLegendTokens,  // already exported — include textOpacity
} from './themes/types';
```

---

## Feature Area 5: Chart Bounding Fix

### 5.1 `FittedMargins` Type — Phase 1

**File:** `packages/charts/src/renderers/shared/IChartRenderer.ts`

Add before `ChartRenderContext`:
```typescript
/**
 * V2.1: Actual margin values produced by fitMargins() in computeChartLayout().
 * These may be smaller than raw theme values when the chart is narrow.
 * AxesRenderer uses these for all axis decoration positioning — not raw theme margin values.
 * Defined here (shared renderer type hub) so both layout.ts and AxesRenderer.ts can import it
 * without creating a circular dependency.
 */
export type FittedMargins = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};
```

### 5.2 `layout.ts` — Return `fittedMargins` from `computeChartLayout()`

**File:** `packages/charts/src/elements/chart/layout.ts`

**Import `FittedMargins`:**
```typescript
import type { FittedMargins } from '../../renderers/shared/IChartRenderer';
```

**Update `ChartLayout` type:**
```typescript
export type ChartLayout = {
  readonly plotFrame: ChartFrame;
  readonly legendAnchor: { readonly x: number; readonly y: number } | null;
  /**
   * V2.1: Actual fitted margin values in world units.
   * AxesRenderer MUST use these for axis title and tick label positioning.
   * These values may be smaller than raw theme margin values when fitMargins() scaled them.
   */
  readonly fittedMargins: FittedMargins;
};
```

**Fix `minPlotWidth` — remove absolute `0.8` floor:**
```typescript
// Before:
const minPlotWidth = Math.max(bounds.width * 0.48, 0.8);
const minPlotHeight = Math.max(bounds.height * 0.42, 0.6);

// After:
const minPlotWidth = bounds.width * 0.48;   // 48% floor, purely relative
const minPlotHeight = bounds.height * 0.42; // 42% floor, purely relative
```

**Return `fittedMargins` in `computeChartLayout()`:**

After `fitMargins` calls, capture the fitted values:
```typescript
const [fittedLeft, fittedRight] = fitMargins(bounds.width, left, right, minPlotWidth);
const [fittedBottom, fittedTop] = fitMargins(bounds.height, bottom, top, minPlotHeight);
// Replace the old assignments:
// [left, right] = fitMargins(...) → use fittedLeft/fittedRight directly
// [bottom, top] = fitMargins(...) → use fittedBottom/fittedTop directly

const plotFrame: ChartFrame = {
  x: fittedLeft,
  y: fittedBottom,
  width: Math.max(bounds.width - fittedLeft - fittedRight, 0.01),
  height: Math.max(bounds.height - fittedBottom - fittedTop, 0.01),
};

const fittedMargins: FittedMargins = {
  left: fittedLeft,
  right: fittedRight,
  top: fittedTop,
  bottom: fittedBottom,
};
```

All `return` statements in `computeChartLayout()` must include `fittedMargins`:
```typescript
return { plotFrame, legendAnchor: null, fittedMargins };
// and:
return { plotFrame, legendAnchor: { x: ..., y: ... }, fittedMargins };
```

**Test strategy** (`elements/chart/__tests__/layout.test.ts`):
- Assert `computeChartLayout()` returns a `fittedMargins` object with `left`, `right`, `top`, `bottom` fields.
- Assert that for a large chart (wide bounds), `fittedMargins.left` equals the raw theme-computed left margin (no scaling needed).
- Assert that for a narrow chart (e.g., `bounds = { width: 0.5, height: 0.4 }`), `fittedMargins.left` is scaled down from the raw theme value.
- Assert `plotFrame.width > 0` and `plotFrame.height > 0` for `bounds = { width: 0.15, height: 0.12 }` (the edge case from the note).
- Assert `minPlotWidth = bounds.width * 0.48` — verify no absolute floor: with `bounds.width = 0.5`, assert `minPlotWidth = 0.24` (not `0.8`).

### 5.3 `render.ts` — Pass `fittedMargins`, `entryT`, and `accessors` through `ChartRenderer.update()`

**File:** `packages/charts/src/elements/chart/render.ts`

`ChartRenderer.update(state: ChartRenderInput, widgetId: string)` is responsible for:
1. Computing the layout (including `fittedMargins`)
2. Resolving data from the store
3. Building `ChartRenderContext` for the active renderer
4. Calling `activeRenderer.update(ctx)`

**Pass `fittedMargins` to `AxesRenderer`:**

```typescript
const layout = computeChartLayout({ bounds, typeConfig, theme, xAxis, yAxis, series, legend });

// Pass fittedMargins to AxesRenderer via AxisRenderState:
axesRendererInstance.update({
  xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis, fontUrl,
  fittedMargins: layout.fittedMargins,  // NEW — V2.1
  referenceLines: state.referenceLines, // NEW — V2.1 (for reference line token consumption)
});
```

**Pass `entryT` and `accessors` into `ChartRenderContext`:**

Inside `ChartRenderer.update()`, where it constructs the `ChartRenderContext` passed to `activeRenderer.update(ctx)`, add the two new fields from `ChartRenderInput`:

```typescript
// Inside ChartRenderer.update() — constructing ctx for the active renderer:
const ctx: ChartRenderContext = {
  seriesGroup:   this.seriesGroup,
  axesGroup:     this.axesGroup,
  legendGroup:   this.legendGroup,
  chartPosition: state.position,
  data,                        // resolved from store
  xAxis:         state.xAxis,
  yAxis:         state.yAxis,
  series:        state.series,
  referenceLines: state.referenceLines,
  legend:        state.legend,
  bounds:        state.bounds,
  theme,                       // resolved ChartTheme object
  opacity:       state.opacity,
  typeOptions:   state.typeConfig,
  dataLabels:    state.dataLabels ?? null,
  gridlines:     state.gridlines ?? null,
  fontUrl,
  morphCtx,                    // built internally from _morphT + lastFromData
  entryT:        state.entryT,        // V2.1 — pass through from ChartWidget.apply()
  accessors:     state.accessors,     // V2.1 — pass through from ChartWidget.apply()
};
activeRenderer.update(ctx);
```

The `entryT` and `accessors` fields are simply forwarded from `ChartRenderInput` to `ChartRenderContext`. `ChartRenderer.update()` does not use them itself — they are consumed by `BarRenderer` (entryT) and `ScatterRenderer`/`BarRenderer`/`LineRenderer` (accessors).

### 5.4 `AxesRenderer.ts` — Use `fittedMargins` for Axis Title Positioning

**File:** `packages/charts/src/renderers/shared/AxesRenderer.ts`

**Import `FittedMargins`:**
```typescript
import type { FittedMargins } from './IChartRenderer';
```

**Update `AxisRenderState` to include `fittedMargins`:**
```typescript
type AxisRenderState = {
  xTicks: TickEntry[];
  yTicks: TickEntry[];
  bounds: { width: number; height: number };
  theme: ChartTheme;
  opacity: number;
  xAxis: ChartAxisState | null;
  yAxis: ChartAxisState | null;
  fontUrl?: string;
  fittedMargins: FittedMargins;  // V2.1 addition
};
```

**Update `updateTicks()` — use `fittedMargins` for axis title positioning:**

Current problematic formula (uses raw theme values regardless of fitting):
```typescript
// Y axis title — OLD (uses raw theme margins):
obj.position.set(
  -(theme.axis.tickLength + theme.axis.gap + theme.axis.fontSize * 2.5),
  height / 2, AXIS_LABEL_Z_OFFSET
);
```

New formula (uses `fittedMargins`):
```typescript
// Y axis title — NEW:
const titlePad = titleFontSize * 0.5;
obj.position.set(
  -state.fittedMargins.left + titlePad,
  height / 2,
  AXIS_LABEL_Z_OFFSET
);

// X axis title — NEW:
titleObject.position.set(
  width / 2,
  -state.fittedMargins.bottom + titlePad,
  AXIS_LABEL_Z_OFFSET
);
```

Where `titleFontSize = theme.axis.titleFontSize ?? theme.axis.fontSize * 1.1`.

Tick label positioning along each axis is also updated to use `fittedMargins` as the reference for Y-axis label offset:
```typescript
// Y tick labels — position relative to y=0 axis line, offset by tick length + gap:
label.position.set(
  -(theme.axis.tickLength + theme.axis.gap),
  tickY,
  AXIS_LABEL_Z_OFFSET
);
// These are relative to the axis line (at x=0 of axesGroup), not to fittedMargins.
// No change needed for tick labels — only titles need the fitted margin reference.
```

**Test strategy** (`renderers/shared/__tests__/AxesRenderer.test.ts` — if it exists, or add):
- Construct `AxesRenderer` with an `axesGroup`.
- Call `update()` with `fittedMargins = { left: 0.2, right: 0.05, top: 0.05, bottom: 0.15 }`.
- Assert Y axis title text object `position.x` is near `-fittedMargins.left + titlePad` (not the raw theme value).
- Repeat with `fittedMargins = { left: 0.05, right: 0.02, top: 0.02, bottom: 0.05 }` (tightly fitted) and assert titles don't overflow.

### 5.5 `ScatterRenderer.ts` — Fix Scale Alignment

**File:** `packages/charts/src/renderers/scatter/ScatterRenderer.ts`

**Root Cause B fix — replace 10%/90% range padding with domain padding:**

```typescript
// Before (misaligned — ticks at 0-100%, points at 10-90%):
const xScale = scaleLinear().domain([xMin, xMax]).range([0.1 * bounds.width, 0.9 * bounds.width]);
const yScale = scaleLinear().domain([yMin, yMax]).range([0.1 * bounds.height, 0.9 * bounds.height]);

// After (aligned — both ticks and points use full range, whitespace via domain padding):
const xPad = xMin === xMax ? Math.abs(xMin) * 0.1 + 0.5 : (xMax - xMin) * 0.05;
const yPad = yMin === yMax ? Math.abs(yMin) * 0.1 + 0.5 : (yMax - yMin) * 0.05;
const xScale = scaleLinear()
  .domain([xMin - xPad, xMax + xPad])
  .range([0, bounds.width]);
const yScale = scaleLinear()
  .domain([yMin - yPad, yMax + yPad])
  .range([0, bounds.height]);
```

**Tick position alignment fix:**

Ticks must be generated from the SAME `xScale` and `yScale` used for point positions:
```typescript
// X ticks — aligned with xScale:
const xTickValues = xScale.ticks(6);
const xTicks = xTickValues.map((v) => ({
  value: v,
  position: xScale(v) / bounds.width,  // normalized [0..1]
}));

// Y ticks — aligned with yScale:
const yTickValues = yScale.ticks(5);
const yTicks = yTickValues.map((v) => ({
  value: v,
  position: yScale(v) / bounds.height,  // normalized [0..1]
}));
```

**Accessor integration in `ScatterRenderer.update()`:**
```typescript
const xValue = ctx.accessors?.xAccessor
  ? ctx.accessors.xAccessor(row as DataRow)
  : (Number(row[xField]) || 0);
const yValue = ctx.accessors?.yAccessor
  ? ctx.accessors.yAccessor(row as DataRow)
  : (Number(row[yField]) || 0);
const sizeValue = (sizeField && ctx.accessors?.sizeAccessor)
  ? ctx.accessors.sizeAccessor(row as DataRow)
  : (sizeField ? (Number(row[sizeField]) || 0) : 1.0);
```

**Test strategy** (`renderers/scatter/__tests__/ScatterRenderer.test.ts` — new file):
- Construct `ScatterRenderer` with simple 3-point dataset (`x: [0, 5, 10], y: [0, 5, 10]`).
- Call `update()`.
- Assert that the InstancedMesh instance matrix for the first point (x=0) has translation at `xScale(0) ≈ 0` (within padding domain), not `0.1 * bounds.width`.
- Assert the last point (x=10) position is near `bounds.width` (within domain padding), not `0.9 * bounds.width`.
- Assert `xTicks[0].position` corresponds to the same domain position as the minimum-X data point.

---

## Implementation Schedule

### Phase 1 — Foundation Types (Sequential, 1 Developer)

**Duration estimate:** Half day. All changes are type-only — no runtime behavior changes.

**Developer 1 — Type Foundation:**

1. `packages/charts/src/data/types.ts` — Add `ComputeTransform`, extend `DataTransform` union.
2. `packages/charts/src/elements/chart/types.ts` — Add `animateEntry: boolean`, `animationDuration: number` to `ChartState` and `DEFAULT_CHART_STATE`. **Also add `ChartRenderInput` type** (with `entryT?` and `accessors?` — see §3.5). `ChartRenderInput` is defined here rather than in `render.ts` so both `ChartWidget.ts` (Stream C) and `render.ts` (Stream D) can import it from the same Phase 1 source without cross-stream file conflicts.
3. `packages/charts/src/renderers/shared/IChartRenderer.ts` — Add `FittedMargins` type; add `entryT?: number` and `accessors?: ChartAccessorFunctions` to `ChartRenderContext`; define `ChartAccessorFunctions` type inline.
4. `packages/charts/src/themes/types.ts` — Add `ChartBarTokens`, `ChartAreaTokens`, `ChartGridlinesTokens`, `ChartDataLabelsTokens`, `ChartReferenceLineTokens`; add `titleFontSize?` to `ChartAxisTokens`; add `textOpacity?` to `ChartLegendTokens`; add optional fields to `ChartTheme`.
5. `packages/charts/src/player/chartPlugin.ts` — **Type-only edit**: add `accessorRegistry: Map<string, ChartAccessorFunctions>` to the `ChartPluginInstance` type definition. Import `ChartAccessorFunctions` from `'../renderers/shared/IChartRenderer'`. Do NOT implement any runtime changes to `chartPlugin()` — that belongs to Stream C. This ensures Stream A's hooks (`useLiveChartData.ts`, `useChartAccessors.ts`) can import a complete `ChartPluginInstance` type from day one of Phase 2.

**Completion gate:** `pnpm --filter @brewsite/charts typecheck` must pass with zero errors before Phase 2 begins.

---

### Phase 2 — Parallel Streams (Up to 5 Developers Simultaneously)

Each stream touches only its listed files. No file appears in more than one stream.

#### Stream A: Data Layer
**Files owned (exclusively):**
- `packages/charts/src/data/transforms.ts`
- `packages/charts/src/data/ChartDataStore.ts`
- `packages/charts/src/player/useLiveChartData.ts` (new file)
- `packages/charts/src/player/useChartAccessors.ts` (new file)
- `packages/charts/src/data/__tests__/transforms.test.ts`
- `packages/charts/src/data/__tests__/ChartDataStore.test.ts`
- `packages/charts/src/data/__tests__/ChartDataStoreIntegration.test.ts`
- `packages/charts/src/player/__tests__/useLiveChartData.test.tsx` (new)
- `packages/charts/src/player/__tests__/useChartAccessors.test.tsx` (new)

**Work items:**
1. Add `applyCompute()` to `transforms.ts`. Update `applyTransforms()` exhaustive switch.
2. Add `liveOverrides: Set<string>`, `setLiveOverride()`, `hasLiveOverride()`, `deregisterInline()` to `ChartDataStore`.
3. Write `useLiveChartData.ts` hook (see §1.3).
4. Write `useChartAccessors.ts` hook (see §1.4).
5. Add/update all tests.

#### Stream B: Theme Implementation
**Files owned (exclusively):**
- `packages/charts/src/themes/darkGlass.ts`
- `packages/charts/src/themes/neonCyber.ts`
- `packages/charts/src/themes/enterprise.ts`
- `packages/charts/src/themes/lightMinimal.ts`
- `packages/charts/src/themes/createChartTheme.ts`
- `packages/charts/src/themes/__tests__/createChartTheme.test.ts`

**Work items:**
1. Add all new token values to each of the 4 built-in themes (see §4.2).
2. Update `ChartThemeOverrides` in `createChartTheme.ts` and update the merge logic (see §4.3).
3. Update tests.

#### Stream C: Widget + Compile + Plugin
**Files owned (exclusively):**
- `packages/charts/src/elements/chart/dsl.tsx`
- `packages/charts/src/elements/chart/compile.ts`
- `packages/charts/src/elements/chart/ChartWidget.ts`
- `packages/charts/src/player/chartPlugin.ts`
- `packages/charts/src/elements/chart/__tests__/compile.test.ts`
- `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts`

**Work items:**
1. Add `animateEntry?`, `animationDuration?` to `BaseChartDSL` in `dsl.tsx`.
2. Compile `animateEntry`, `animationDuration` in `compile.ts`.
3. Update inline data guard in `ChartWidget.apply()` (§1.2).
4. Add `currentEntryT` private field and update `onTick()` for entry animation (§3.5).
5. Update `ChartWidget.apply()` to pass `entryT` and `accessors` via `ChartRenderInput` (§3.5). Import `ChartRenderInput` from `./types` (Phase 1).
6. Implement `onDeregisterInline` cleanup in `ChartWidget` constructor: call `store.onDeregisterInline(widgetId, () => { this.lastInlineRowsRef = null; })` and store the returned unsubscribe fn. Call it in `dispose()`. (§1.2). No `_resetInlineRef` method — see Issue 4 resolution.
7. Implement runtime `accessorRegistry` in `chartPlugin.ts` (Phase 1 added the type; Stream C adds the `new Map()` instantiation, passes it to `new ChartWidget(chartId, store, accessorRegistry)`, and adds it to the returned plugin object). Import `ChartAccessorFunctions` from `'../renderers/shared/IChartRenderer'`.
8. Add renderer override seam to `ChartWidget` constructor for testing (optional 4th param `rendererOverride?`) to support `ChartRendererDouble` in tests (§3.5 test strategy).
9. **Migration safety audit — `ChartState` direct constructions**: Search all files in `packages/charts/src/**/__tests__/` for object literals that construct a `ChartState` without using `DEFAULT_CHART_STATE` as a spread base (pattern: `const state: ChartState = {` or `const state = {` with explicit chart state fields). Every such object literal must add `animateEntry: false, animationDuration: 0.4`. Objects that use `{ ...DEFAULT_CHART_STATE, ... }` are safe — `DEFAULT_CHART_STATE` is updated in Phase 1 to include both new fields. Confirmed files most likely to have direct constructions: `compile.test.ts`, `ChartWidget.test.ts`, `chartPlugin.test.ts`.
10. Update all tests.

#### Stream D: Bounding Fix
**Files owned (exclusively):**
- `packages/charts/src/elements/chart/layout.ts`
- `packages/charts/src/elements/chart/render.ts`
- `packages/charts/src/renderers/shared/AxesRenderer.ts`
- `packages/charts/src/renderers/scatter/ScatterRenderer.ts`
- `packages/charts/src/elements/chart/__tests__/layout.test.ts`
- `packages/charts/src/renderers/scatter/__tests__/ScatterRenderer.test.ts` (new)

**Work items:**
1. Add `FittedMargins` to `ChartLayout` return type, fix `minPlotWidth`, return fitted values from `computeChartLayout()` (§5.2).
2. Update `render.ts` to construct the full `ChartRenderContext` with `entryT`, `accessors`, and pass `fittedMargins` + `referenceLines` to `AxesRenderer` via `AxisRenderState` (§5.3). Import `ChartRenderInput` from `elements/chart/types` (Phase 1).
3. Update `AxesRenderer.ts`: accept `fittedMargins` in `AxisRenderState`, use for title positioning; add gridlines fallback chain (`theme.gridlines?.color ?? theme.background.gridColor ?? '#4a6080'`); add `LineDashedMaterial` support when `dashSize > 0`; consume `ChartReferenceLineTokens` in reference-line loop; consume `titleFontSize` for axis titles (§5.4, §4.4).
4. Fix `ScatterRenderer.update()` scale/tick alignment (§5.5).
5. **Migration safety audit — `AxisRenderState` direct constructions**: `AxisRenderState` is a private type internal to `AxesRenderer.ts`. Search `packages/charts/src/**/__tests__/` for any file that calls `axesRenderer.update(...)` or constructs an `AxisRenderState` object literal. Every such call site must add `fittedMargins: { left: 0, right: 0, top: 0, bottom: 0 }` as a stub when `fittedMargins` is not the subject under test. Also add `referenceLines: []` stub for the new `referenceLines` field. Expected files to check: any `AxesRenderer.test.ts` that may exist, and integration tests that call `ChartRenderer.update()` directly.
6. Update/add all tests.

#### Stream E: BarRenderer + Line/Area Morphing + Legend/DataLabel Theme Tokens
**Files owned (exclusively):**
- `packages/charts/src/renderers/bar/BarRenderer.ts`
- `packages/charts/src/renderers/line/LineRenderer.ts`
- `packages/charts/src/renderers/area/AreaRenderer.ts`
- `packages/charts/src/renderers/shared/LegendRenderer.ts`
- `packages/charts/src/renderers/shared/DataLabelRenderer.ts`
- `packages/charts/src/renderers/bar/__tests__/BarRenderer.test.ts`
- `packages/charts/src/renderers/line/__tests__/LineRenderer.test.ts`
- `packages/charts/src/renderers/area/__tests__/AreaRenderer.test.ts`
- `packages/charts/src/renderers/shared/__tests__/DataLabelRenderer.test.ts`

**Work items:**
1. Update `BarRenderer.ts`: geometry origin anchoring (`geometry.translate(0, height/2, 0)`), entry animation via `ctx.entryT` + `easeOutCubic`, `barPadding` theme fallback from `theme.bar?.padding`, `yAccessor` support (§3.6, §4.4).
2. Extend `LineRenderer.ts` with Map-based `ctx.morphCtx` morphing for Y positions, `yAccessor` support (§3.7).
3. Extend `AreaRenderer.ts` with Map-based `ctx.morphCtx` morphing for upper/lower boundary, `fillOpacity` theme fallback from `theme.area?.fillOpacity` (§3.7, §4.4).
4. Update `LegendRenderer.ts` to read `theme.legend.textOpacity ?? 1.0` when setting troika-three-text opacity on legend label objects (§4.4). Apply as `(theme.legend.textOpacity ?? 1.0) * opacity` on the label `material.opacity` or text node `fillOpacity` property.
5. Update `DataLabelRenderer.ts` to read `theme.dataLabels?.fontSize ?? 0.05` and `theme.dataLabels?.color ?? '#ffffff'` instead of any hardcoded values (§4.4). Apply `theme.dataLabels?.background` as a pill background if present.
6. Update all renderer tests. Update any `position.y` assertions in `BarRenderer.test.ts` for the geometry origin change. Add `DataLabelRenderer.test.ts` cases for theme token consumption.

**Why Stream E owns `LegendRenderer` and `DataLabelRenderer`**: These are shared renderer files but have no dependency on the bounding fix (Stream D) or the type foundation beyond what Phase 1 delivers. They can be implemented concurrently with all other streams once Phase 1 types land.

---

### Phase 3 — Public API Integration (Sequential, 1 Developer, after all Phase 2 streams)

**File:** `packages/charts/src/index.ts`

**Additions:**
```typescript
// V2.1 additions:
export { useLiveChartData } from './player/useLiveChartData';
export { useChartAccessors } from './player/useChartAccessors';
export type { ChartAccessorFunctions } from './renderers/shared/IChartRenderer';
export type { ComputeTransform } from './data/types';
// Add ComputeTransform to the existing DataTransform union exports
export type {
  ChartBarTokens,
  ChartAreaTokens,
  ChartGridlinesTokens,
  ChartDataLabelsTokens,
  ChartReferenceLineTokens,
} from './themes/types';
// FittedMargins is internal — not exported from index.ts (renderer implementation detail)
```

**Completion gate:** `pnpm --filter @brewsite/charts test` passes all tests (including new ones from all streams). `pnpm --filter @brewsite/charts typecheck` passes with zero errors.

---

## Test Strategy

All tests follow the project's **interface-based stateful testing** convention: real inputs → real output assertions. No `vi.fn()` mocking of internal methods. Interface-conforming doubles only.

### Testing Approach by Module

| Module | Test approach | Key assertions |
|---|---|---|
| `data/transforms.ts` — `applyCompute` | Pure function — real rows in, real rows out | Output field added, computed value correct, exhaustive fn variants |
| `data/ChartDataStore.ts` — new methods | Real `ChartDataStore` instance, call methods, assert state | `hasLiveOverride` true after `setLiveOverride`, false after `deregisterInline` |
| `elements/chart/compile.ts` — new fields | Call `compileChart()` with DSL props, assert `ChartState` | `animateEntry` defaults, `animationDuration` clamped |
| `elements/chart/layout.ts` — `fittedMargins` | Call `computeChartLayout()` with various bounds, assert return shape | `fittedMargins` present, values match `fitMargins` output, narrow-chart edge case |
| `elements/chart/ChartWidget.ts` — inline guard | Construct real `ChartWidget` + `ChartDataStore`, call `apply()`, assert store state | Live override guard skips write; deregister callback resets ref and forces re-registration on next `apply()` |
| `elements/chart/ChartWidget.ts` — `onTick` | Call `onTick()` then `apply()` with `ChartRendererDouble`; assert `double.lastInput.entryT` | Progress ÷ duration, clamped at 1.0 |
| `renderers/bar/BarRenderer.ts` | Construct `BarRenderer`, call `update()` with `entryT`, inspect `mesh.scale.y` | `easeOutCubic` applied, geometry at y=0 origin |
| `renderers/scatter/ScatterRenderer.ts` | Construct `ScatterRenderer`, call `update()`, inspect InstancedMesh matrices and tick positions | Point positions and tick positions are co-aligned |
| `renderers/line/LineRenderer.ts` | Call `update()` with `morphCtx`, inspect point Y positions | `lerp(fromY, toY, t)` applied |
| `renderers/area/AreaRenderer.ts` | Call `update()` with `morphCtx`, inspect boundary vertex positions | Both upper and lower bounds interpolated |
| `themes/createChartTheme.ts` | Call `createChartTheme()` with overrides, assert merged result | New token groups merged correctly |
| Hook — `useLiveChartData` | `renderHook` with real plugin stub, assert store state transitions | Override active on mount, cleared on unmount |
| Hook — `useChartAccessors` | `renderHook`, assert `plugin.accessorRegistry` state | Registry populated on mount, cleared on unmount |

### Test Files to Create (New)

- `packages/charts/src/player/__tests__/useLiveChartData.test.tsx`
- `packages/charts/src/player/__tests__/useChartAccessors.test.tsx`
- `packages/charts/src/renderers/scatter/__tests__/ScatterRenderer.test.ts`

### Test Files Requiring Significant Updates

- `packages/charts/src/data/__tests__/transforms.test.ts` — add `'compute'` cases, update exhaustive switch coverage.
- `packages/charts/src/data/__tests__/ChartDataStore.test.ts` — add `setLiveOverride`, `hasLiveOverride`, `deregisterInline` cases.
- `packages/charts/src/data/__tests__/ChartDataStoreIntegration.test.ts` — add `ComputeTransform` end-to-end.
- `packages/charts/src/elements/chart/__tests__/layout.test.ts` — add `fittedMargins` assertions, remove/update `minPlotWidth` absolute-floor test, add narrow-chart edge case.
- `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts` — add inline guard, `onTick` entry animation, accessor registry tests.
- `packages/charts/src/elements/chart/__tests__/compile.test.ts` — add `animateEntry`, `animationDuration` cases.
- `packages/charts/src/renderers/bar/__tests__/BarRenderer.test.ts` — update `position.y` assertions for new geometry origin, add `entryT` animation test.
- `packages/charts/src/renderers/line/__tests__/LineRenderer.test.ts` — add `morphCtx` test.
- `packages/charts/src/renderers/area/__tests__/AreaRenderer.test.ts` — add `morphCtx` test.
- `packages/charts/src/themes/__tests__/createChartTheme.test.ts` — add new token group merge tests.

---

## Migration Guide

All changes in V2.1 are **backward-compatible additive** (minor semver). No migration is required for existing scenes.

### Opting in to reactive data

```typescript
// Before (V2.0): data baked at compile time, no runtime updates
<BarChart id="revenue" data={rows} />

// After (V2.1): add the hook to propagate React state changes
const [rows, setRows] = useState(initialRows);
useLiveChartData(chartsPlugin, 'revenue', rows);
// <BarChart id="revenue" data={initialRows} /> — initialRows seeds the SceneTrack
```

### Opting in to entry animation

```typescript
// Add animateEntry prop (no other changes required):
<BarChart id="revenue" data={rows} animateEntry animationDuration={0.5}>
  ...
</BarChart>
```

### Opting in to compute transforms

```typescript
// Add a compute transform to the ChartData child:
<ScatterPlotChart id="perf">
  <ChartData
    source="teams"
    transforms={[
      { type: 'compute', outputField: 'log_revenue', operation: { fn: 'log', inputField: 'revenue', base: 10 } },
    ]}
  />
  <ChartAxis axis="y" field="log_revenue" label="Revenue (log10)" />
</ScatterPlotChart>
```

### Opting in to custom theme tokens

```typescript
// createChartTheme supports all new token groups:
const myTheme = createChartTheme(darkGlassChartTheme, {
  bar: { padding: 0.3 },
  gridlines: { color: '#ff0000', opacity: 0.2, visible: true },
  referenceLines: { defaultColor: '#00ff00', lineWidth: 0.008, lineOpacity: 1.0 },
});
```

### Existing scenes

No changes required. All new `ChartState` fields (`animateEntry`, `animationDuration`) default to `false`/`0.4`. All new `ChartTheme` fields are optional. `ChartDataStore` backward-compatibility is preserved — existing `register()` and `registerInline()` calls are unchanged.

---

## Constraints and Risk Notes

### `deregisterInline()` atomicity

JavaScript is single-threaded. `ChartWidget.apply()` is synchronous and does not yield. `deregisterInline()` (called from React's `useEffect` cleanup) cannot interleave with an in-progress `apply()`. The race condition described in the note (§5 Constraints) cannot occur in practice. No additional locking is required.

### BarRenderer geometry origin change

`BoxGeometry` default center is at origin (height spans `-height/2` to `+height/2`). After `geometry.translate(0, barHeight/2, 0)`, the geometry spans `0` to `barHeight`. This means the mesh `position.y` for a bar starting at y=0 is simply `barY` (not `barY + barHeight/2`). **All existing assertions on bar mesh `position.y` in `BarRenderer.test.ts` MUST be updated.** This is a breaking change to the internal geometry model — it does not affect the public API but does affect any test that inspects Three.js object positions.

### `minPlotWidth = bounds.width * 0.48` — Verification

Without the absolute `0.8` floor, for a chart with `bounds.width = 0.15` NVS and `visibleWorldWidth ≈ 9.0` (typical camera config), world width = `0.15 * 9.0 = 1.35` world units. `minPlotWidth = 1.35 * 0.48 = 0.648`. Typical left margin = `0.3` world units, right margin = `0.04` world units. Total margins = `0.34`. Plot = `1.35 - 0.34 = 1.01 >> 0.648`. The 48% floor only activates for unusually wide margins (>52% of chart width). The narrow-chart unit test must verify `plotFrame.width > 0` for `bounds = { width: 0.15, height: 0.12 }`. Pass.

### `ChartGridlinesTokens.dashSize` and WebGL1 Limitations

`LineDashedMaterial.linewidth` is capped at 1px in most WebGL1 contexts (same limitation as `LineBasicMaterial`). Dashed gridlines using `LineDashedMaterial` with `dashSize`/`gapSize` will show correct dash patterns at 1px width. This is acceptable for decorative gridlines. **Reference lines** use thin `BoxGeometry` (world-space `lineWidth`), which is not subject to the WebGL1 linewidth cap. This distinction is documented in the `ChartReferenceLineTokens` JSDoc.

### `useChartAccessors` Stability

`useChartAccessors(plugin, chartId, accessors)` depends on `accessors` reference identity in `useEffect`. If the consumer creates a new object literal on every render (`useChartAccessors(plugin, 'chart', { xAccessor: r => r.x })`), the effect re-fires on every render, causing repeated registry updates. The hook does not prevent this — the consumer is responsible for stabilizing the `accessors` object (e.g., with `useMemo`). This should be documented in the hook's JSDoc.

### `ComputeTransform.normalize` Range

The `normalize` operation computes `[0, 1]` range over the **current filtered rows** (not a fixed domain). When a filter is applied to a named source, `normalize` will recompute its range over the filtered subset. This means the absolute values change when filters change — the normalization is relative to the visible data. This is intentional and matches common data-visualization semantics. Document in the JSDoc.

---

## Files Created or Modified — Summary

### Phase 1 (Sequential — Type Foundation)
| File | Status |
|---|---|
| `packages/charts/src/data/types.ts` | Modified — add `ComputeTransform`, extend `DataTransform` |
| `packages/charts/src/elements/chart/types.ts` | Modified — add `animateEntry`, `animationDuration`, **`ChartRenderInput`** (Issue 2 fix) |
| `packages/charts/src/renderers/shared/IChartRenderer.ts` | Modified — add `FittedMargins`, `ChartAccessorFunctions`, `entryT`, `accessors` on `ChartRenderContext` |
| `packages/charts/src/themes/types.ts` | Modified — add 5 new token types, extend `ChartAxisTokens`, `ChartLegendTokens`, `ChartTheme` |
| `packages/charts/src/player/chartPlugin.ts` | Modified (**type-only**) — add `accessorRegistry` to `ChartPluginInstance` type (Issue 1 fix) |

### Phase 2 — Stream A (Data Layer)
| File | Status |
|---|---|
| `packages/charts/src/data/transforms.ts` | Modified — add `applyCompute()`, update `applyTransforms()` |
| `packages/charts/src/data/ChartDataStore.ts` | Modified — add `setLiveOverride`, `hasLiveOverride`, `deregisterInline`, `liveOverrides` field |
| `packages/charts/src/player/useLiveChartData.ts` | New |
| `packages/charts/src/player/useChartAccessors.ts` | New |
| `packages/charts/src/data/__tests__/transforms.test.ts` | Modified |
| `packages/charts/src/data/__tests__/ChartDataStore.test.ts` | Modified |
| `packages/charts/src/data/__tests__/ChartDataStoreIntegration.test.ts` | Modified |
| `packages/charts/src/player/__tests__/useLiveChartData.test.tsx` | New |
| `packages/charts/src/player/__tests__/useChartAccessors.test.tsx` | New |

### Phase 2 — Stream B (Themes)
| File | Status |
|---|---|
| `packages/charts/src/themes/darkGlass.ts` | Modified |
| `packages/charts/src/themes/neonCyber.ts` | Modified |
| `packages/charts/src/themes/enterprise.ts` | Modified |
| `packages/charts/src/themes/lightMinimal.ts` | Modified |
| `packages/charts/src/themes/createChartTheme.ts` | Modified |
| `packages/charts/src/themes/__tests__/createChartTheme.test.ts` | Modified |

### Phase 2 — Stream C (Widget + Compile + Plugin)
| File | Status |
|---|---|
| `packages/charts/src/elements/chart/dsl.tsx` | Modified — add `animateEntry?`, `animationDuration?` to `BaseChartDSL` |
| `packages/charts/src/elements/chart/compile.ts` | Modified — compile `animateEntry`, `animationDuration` |
| `packages/charts/src/elements/chart/ChartWidget.ts` | Modified — inline guard with `hasLiveOverride`, `onDeregisterInline` callback in ctor/dispose, `currentEntryT` + `onTick` entry animation, accessor registry, renderer override seam for tests |
| `packages/charts/src/player/chartPlugin.ts` | Modified — runtime `accessorRegistry` instantiation and widget constructor update (type was changed in Phase 1) |
| `packages/charts/src/elements/chart/__tests__/compile.test.ts` | Modified |
| `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts` | Modified — uses `ChartRendererDouble` for `entryT` assertions |

### Phase 2 — Stream D (Bounding Fix)
| File | Status |
|---|---|
| `packages/charts/src/elements/chart/layout.ts` | Modified — `ChartLayout.fittedMargins`, fix `minPlotWidth`, return fitted values |
| `packages/charts/src/elements/chart/render.ts` | Modified — pass `fittedMargins` to `AxesRenderer` |
| `packages/charts/src/renderers/shared/AxesRenderer.ts` | Modified — `AxisRenderState.fittedMargins`, use for axis title positioning, `titleFontSize` |
| `packages/charts/src/renderers/scatter/ScatterRenderer.ts` | Modified — domain-padding approach, tick alignment fix |
| `packages/charts/src/elements/chart/__tests__/layout.test.ts` | Modified |
| `packages/charts/src/renderers/scatter/__tests__/ScatterRenderer.test.ts` | New |

### Phase 2 — Stream E (BarRenderer + Line/Area Morphing + Legend/DataLabel Theme Tokens)
| File | Status |
|---|---|
| `packages/charts/src/renderers/bar/BarRenderer.ts` | Modified — geometry anchoring, `entryT` animation, theme `barPadding`, `yAccessor` |
| `packages/charts/src/renderers/line/LineRenderer.ts` | Modified — Map-based `morphCtx` morphing, `yAccessor` |
| `packages/charts/src/renderers/area/AreaRenderer.ts` | Modified — Map-based `morphCtx` morphing, theme `fillOpacity` |
| `packages/charts/src/renderers/shared/LegendRenderer.ts` | Modified — consume `theme.legend.textOpacity` (Issue 3 fix) |
| `packages/charts/src/renderers/shared/DataLabelRenderer.ts` | Modified — consume `theme.dataLabels` tokens (Issue 3 fix) |
| `packages/charts/src/renderers/bar/__tests__/BarRenderer.test.ts` | Modified |
| `packages/charts/src/renderers/line/__tests__/LineRenderer.test.ts` | Modified |
| `packages/charts/src/renderers/area/__tests__/AreaRenderer.test.ts` | Modified |
| `packages/charts/src/renderers/shared/__tests__/DataLabelRenderer.test.ts` | Modified/Created |

### Phase 3 (Sequential — Public API)
| File | Status |
|---|---|
| `packages/charts/src/index.ts` | Modified — export new hooks, types, `ComputeTransform` |
