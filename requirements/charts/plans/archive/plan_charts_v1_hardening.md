---
title: "@brewsite/charts — V1 Hardening Plan"
doc_type: plan
owner: Toolkit Product
status: complete
updated: 2026-03-03
---

# @brewsite/charts — V1 Hardening Plan

## Purpose

This plan drives the charts package from a functional skeleton to a correct,
easy-to-use, production-grade library. Every issue uncovered in the PM production-
readiness review is addressed here with explicit file paths, complete type signatures,
and enough code-level detail that a coding bot can implement without additional
research or architecture decisions.

The work is organized into six work streams (A–F), ordered by severity. Each work
stream can be implemented sequentially in one pass.

---

## Work Stream A — Core Correctness (Blockers)

These are bugs that make shipped features silently wrong. Fix first, nothing else ships.

---

### A1. Fix hover: `ChartRenderer` must cache last resolved data

**Problem:** `render.ts:94` passes `{ rows: [], fields: [] }` to every renderer's
`resolveHoverInfo()`. Hover and click are completely broken for all chart types.

**Root cause:** Data is resolved inside `ChartRenderer.update()` but not stored.
`resolveHoverInfo()` is called from `ChartWidget.raycast()` asynchronously (on mouse
events), so it has no access to the data used in the last `update()` call.

**File:** `packages/charts/src/elements/chart/render.ts`

**Changes:**

1. Add `private lastData: ResolvedDataFrame = { rows: [], fields: [] };` field.
2. In `update()`, after `const data = this.store.resolve(...)`, add `this.lastData = data;`.
3. Replace the broken `resolveHoverInfo`:

```typescript
resolveHoverInfo(intersection: THREE.Intersection): ChartHitInfo | null {
  if (!this.activeRenderer || !this.lastType) return null;
  return this.activeRenderer.resolveHoverInfo(intersection, this.lastData);
}
```

Import: add `import type { ResolvedDataFrame } from '../../data/types';`

**Renderer hover fix scope after A1:**
- **BarRenderer** — already correct. Uses a `Map<Mesh, {seriesIndex, datumIndex, row}>`
  hitMap keyed by object reference. Ignores the `data` parameter. Works correctly after A1.
- **PieRenderer** — already correct. Uses a `SliceEntry[]` array keyed by slice mesh
  reference. Ignores the `data` parameter. Works correctly after A1.
- **ScatterRenderer** — already correct. Uses `intersection.instanceId` (set by Three.js
  for `InstancedMesh` hits) to index into a `hitRows` cache. Ignores the `data` parameter.
  Works correctly after A1.
- **LineRenderer** — requires A2. Returns `datumIndex: 0` always; needs nearest-point lookup.
- **AreaRenderer** — requires A3. Returns `datumIndex: 0` always; needs X-position lookup.

Do not add additional fixes to Bar, Pie, or Scatter — they are correct after A1.

---

### A2. Fix hover: `LineRenderer` must identify nearest data point

**Problem:** `LineRenderer.ts:129` returns `datumIndex: 0` for every tube hit.
Hover on a line chart always reports the first row.

**File:** `packages/charts/src/renderers/line/LineRenderer.ts`

**Changes:**

1. Add a stored series-points cache:
```typescript
private readonly seriesPoints: THREE.Vector3[][] = [];
```

2. In `buildLines()`, after the `points` array is constructed per series, push a copy:
```typescript
this.seriesPoints.push([...points]);
```

3. In `clearTubes()`, reset it:
```typescript
this.seriesPoints.length = 0;
```

4. Replace `resolveHoverInfo`:
```typescript
resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null {
  const meshIndex = this.tubeMeshes.indexOf(intersection.object as THREE.Mesh);
  if (meshIndex < 0) return null;

  const points = this.seriesPoints[meshIndex] ?? [];
  const p = intersection.point;
  let nearest = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = p.distanceTo(points[i]!);
    if (d < nearestDist) { nearestDist = d; nearest = i; }
  }

  const row = (data.rows[nearest] ?? {}) as Record<string, unknown>;
  return {
    seriesIndex: meshIndex,
    datumIndex: nearest,
    row,
    point: [p.x, p.y, p.z],
  };
}
```

---

### A3. Fix hover: `AreaRenderer` must identify nearest data point

**Problem:** `AreaRenderer.ts:142` returns `datumIndex: 0` for every area hit.

**File:** `packages/charts/src/renderers/area/AreaRenderer.ts`

**Changes:**

1. Add a field to cache the last bounds used for rendering:
```typescript
private lastBoundsWidth = 1;
```

2. In `buildAreas()`, capture the bounds width at the top:
```typescript
this.lastBoundsWidth = bounds.width;
```

3. Replace `resolveHoverInfo`:
```typescript
resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null {
  const meshIndex = this.areaMeshes.indexOf(intersection.object as THREE.Mesh);
  if (meshIndex < 0) return null;
  if (data.rows.length === 0) return null;

  // X coordinate maps linearly to data index
  const normalizedX = intersection.point.x / this.lastBoundsWidth;
  const datumIndex = Math.round(
    Math.max(0, Math.min(1, normalizedX)) * (data.rows.length - 1)
  );
  const row = (data.rows[datumIndex] ?? {}) as Record<string, unknown>;
  const p = intersection.point;
  return {
    seriesIndex: meshIndex,
    datumIndex,
    row,
    point: [p.x, p.y, p.z],
  };
}
```

---

### A4. Also fix `AreaRenderer` opacity inconsistency

**Problem:** The `AREA_OPACITY_FACTOR` (0.65) is hardcoded in two places: `buildAreas()`
(line 115) and the incremental update path (line 50). Both paths use direct assignment
(`=` not `*=`), so there is no compounding — but having the constant duplicated is a
maintenance hazard and will produce inconsistent results if either site is changed without
updating the other.

**Severity:** Non-blocker. The current behavior is visually correct on every frame.
This is a hardcoded constant duplication issue, not a runtime bug.

**Fix:** Centralize the 0.65 area-opacity multiplier in a constant and apply it
consistently in ONE place: always in the material update loop (not in `buildAreas`).
`buildAreas` sets `mat.opacity = 1.0` and `mat.transparent = true`; the update
loop then applies `opacity * AREA_OPACITY`.

```typescript
const AREA_OPACITY_FACTOR = 0.65;

// In update() incremental path:
mat.opacity = opacity * AREA_OPACITY_FACTOR;
mat.transparent = true;

// In buildAreas() material setup — set placeholder, update() will override:
mat.opacity = opacity * AREA_OPACITY_FACTOR;  // same formula, consistent
mat.transparent = true;
```

---

### A5. Validate required `<ChartData>` child in `chartPlugin`

**Problem:** Omitting `<ChartData>` inside `<Chart>` silently produces a blank chart
with `dataSource: ''`. No error is thrown at any stage.

**File:** `packages/charts/src/player/chartPlugin.ts`

**Change:** After the child-extraction loop (after line 76), add:

```typescript
if (!dataDsl) {
  throw new Error(
    `<Chart id="${chartId}"> is missing a required <ChartData> child. ` +
    `Add <ChartData source="your-source-name" /> as a direct child of <Chart>.`
  );
}
```

---

### A6. Eliminate fake-group anti-pattern in renderer `dispose()`

**Problem:** BarRenderer, LineRenderer, AreaRenderer, PieRenderer, and ScatterRenderer
all call their `clearXxx()` method from `dispose()` by passing a fake `{ children: [] }`
object. The same anti-pattern has been confirmed in `ScatterRenderer.ts:134`.
This prevents the `seriesGroup.remove(mesh)` call from working. Geometry is disposed
(good) but the orphaned meshes stay in the Three.js scene graph until
`ChartRenderer.clearGroups()` runs after.

**Fix pattern (same for all five renderers):**

Add a nullable reference to the last-known series group:
```typescript
private seriesGroupRef: THREE.Group | null = null;
```

In `update()`, capture it:
```typescript
this.seriesGroupRef = seriesGroup;
```

Refactor `clearXxx(group: THREE.Group)` → `clearXxx()` using `this.seriesGroupRef`:

```typescript
private clearBars(): void {
  const group = this.seriesGroupRef;
  for (const mesh of this.barMeshes) {
    group?.remove(mesh);
    mesh.geometry.dispose();
  }
  this.barMeshes.length = 0;
  this.hitMap.clear();
}
```

Update all call sites: `this.clearBars(seriesGroup)` → `this.clearBars()` (in `update`
rebuild path, set `this.seriesGroupRef = seriesGroup` first).

Call `dispose()`:
```typescript
dispose(): void {
  this.clearBars();  // No fake group needed
  ...
}
```

Apply the same pattern to `LineRenderer.clearTubes()`, `AreaRenderer.clearAreas()`,
`PieRenderer.clearSlices()`, and `ScatterRenderer.clearMesh()` (confirmed same
anti-pattern at `ScatterRenderer.ts:134`).

---

## Work Stream B — Data Layer Refactor

### B1. Introduce `IFilterEngine` abstraction

**Problem:** `crossfilter2` is used but only calls `filterFunction((v) => values.includes(v))`
— the simplest possible filtering. `registerWithFilter()` is defined but never called.
Crossfilter2 is a ~25 KB CommonJS bundle that doesn't tree-shake. The filtering
feature as a whole is architecturally incomplete.

**Design goal:** Remove crossfilter2 now. Provide `IFilterEngine` so a future
`CrossfilterFilterEngine` (or any other) can be injected without touching a single
line of consumer code. Consumer API — `ChartProvider`, `useChartData`,
`useChartFilter`, `<ChartData filterGroup="...">` — remains 100% identical.

---

#### B1a. Create `IFilterEngine` interface

**New file:** `packages/charts/src/data/IFilterEngine.ts`

```typescript
/**
 * IFilterEngine — abstract contract for multi-dimensional, multi-group filtering.
 *
 * Consumer code (ChartProvider, useChartData, useChartFilter) never references
 * this interface. It is injected into ChartDataStore via constructor.
 *
 * Swap implementations (e.g. CrossfilterFilterEngine for large datasets)
 * without changing any consumer code.
 */
export interface IFilterEngine {
  /**
   * Register a named data source. If filterGroupId is provided, the source
   * participates in group filtering: applyFilter(groupId, ...) will affect
   * what getRows(name) returns.
   */
  register(name: string, rows: ReadonlyArray<Record<string, unknown>>, filterGroupId?: string): void;

  /**
   * Unregister a source and release any associated filter state.
   */
  unregister(name: string): void;

  /**
   * Apply a value-set filter on a field for all sources in a group.
   * Passing values=[] removes the filter for that dimension (same as clearFilters
   * for that one dimension).
   *
   * Implementations MUST call all subscribe() listeners registered for groupId
   * after applying the filter.
   */
  applyFilter(groupId: string, dimension: string, values: ReadonlyArray<unknown>): void;

  /**
   * Remove all active filters for a group.
   * Implementations MUST notify all subscribers for groupId.
   */
  clearFilters(groupId: string): void;

  /**
   * Return the current rows for a source after applying all active filters
   * from the group the source belongs to (if any). Returns the full row array
   * if the source has no filter group or the group has no active filters.
   */
  getRows(name: string): ReadonlyArray<Record<string, unknown>>;

  /**
   * Return the filter group ID for a source, or undefined if none was set.
   * Used by ChartDataStore.subscribeToSource() to wire reactive subscriptions.
   */
  getFilterGroupForSource(name: string): string | undefined;

  /**
   * Return the current active filters for a group as a read-only map of
   * dimension → allowed value set. Returns an empty map if no filters are active.
   * Used by useChartFilter to expose reactive read access to current filter state.
   */
  getActiveFilters(groupId: string): ReadonlyMap<string, ReadonlySet<unknown>>;

  /**
   * Subscribe to filter-change notifications for a group.
   * Returns an unsubscribe function. Safe to call multiple times.
   */
  subscribe(groupId: string, listener: () => void): () => void;

  /**
   * Release all internal state. Called when ChartDataStore.clear() is invoked.
   */
  dispose(): void;
}
```

---

#### B1b. Create `SimpleFilterEngine` implementation

**New file:** `packages/charts/src/data/SimpleFilterEngine.ts`

This is the default implementation. No external dependencies. O(n×d) filtering
where n = row count and d = number of active dimensions.

```typescript
import type { IFilterEngine } from './IFilterEngine';

type Row = Record<string, unknown>;

/**
 * SimpleFilterEngine — built-in IFilterEngine with no external dependencies.
 *
 * Uses plain Map + Set structures for multi-dimensional, multi-group filtering.
 * Suitable for datasets up to ~100k rows at interactive frame rates.
 *
 * To use a more capable engine (e.g. crossfilter2 for large datasets), implement
 * IFilterEngine and pass an instance to ChartDataStore's constructor.
 */
export class SimpleFilterEngine implements IFilterEngine {
  // source name → filter group ID
  private readonly sourceGroups = new Map<string, string | undefined>();
  // source name → rows
  private readonly sourceRows = new Map<string, ReadonlyArray<Row>>();
  // group ID → (dimension field → set of allowed values)
  private readonly activeFilters = new Map<string, Map<string, Set<unknown>>>();
  // group ID → listener set
  private readonly listeners = new Map<string, Set<() => void>>();

  register(name: string, rows: ReadonlyArray<Row>, filterGroupId?: string): void {
    this.sourceRows.set(name, rows);
    this.sourceGroups.set(name, filterGroupId);
  }

  unregister(name: string): void {
    this.sourceRows.delete(name);
    this.sourceGroups.delete(name);
  }

  applyFilter(groupId: string, dimension: string, values: ReadonlyArray<unknown>): void {
    let dims = this.activeFilters.get(groupId);
    if (!dims) {
      dims = new Map();
      this.activeFilters.set(groupId, dims);
    }
    if (values.length === 0) {
      dims.delete(dimension);
    } else {
      dims.set(dimension, new Set(values));
    }
    this.notify(groupId);
  }

  clearFilters(groupId: string): void {
    this.activeFilters.delete(groupId);
    this.notify(groupId);
  }

  getRows(name: string): ReadonlyArray<Row> {
    const rows = this.sourceRows.get(name) ?? [];
    const groupId = this.sourceGroups.get(name);
    if (!groupId) return rows;
    const dims = this.activeFilters.get(groupId);
    if (!dims || dims.size === 0) return rows;
    return (rows as Row[]).filter((row) =>
      [...dims.entries()].every(([dim, vals]) => vals.has(row[dim]))
    );
  }

  getFilterGroupForSource(name: string): string | undefined {
    return this.sourceGroups.get(name);
  }

  getActiveFilters(groupId: string): ReadonlyMap<string, ReadonlySet<unknown>> {
    return this.activeFilters.get(groupId) ?? new Map();
  }

  subscribe(groupId: string, listener: () => void): () => void {
    let set = this.listeners.get(groupId);
    if (!set) {
      set = new Set();
      this.listeners.set(groupId, set);
    }
    set.add(listener);
    return () => {
      this.listeners.get(groupId)?.delete(listener);
    };
  }

  dispose(): void {
    this.sourceGroups.clear();
    this.sourceRows.clear();
    this.activeFilters.clear();
    this.listeners.clear();
  }

  private notify(groupId: string): void {
    this.listeners.get(groupId)?.forEach((fn) => fn());
  }
}
```

---

#### B1c. Refactor `ChartDataStore` to use `IFilterEngine`

**File:** `packages/charts/src/data/ChartDataStore.ts`

Complete replacement of the class body. Keep the same public method signatures
so all consumer code compiles unchanged.

```typescript
import { SimpleFilterEngine } from './SimpleFilterEngine';
import { applyTransforms } from './transforms';
import type { IFilterEngine } from './IFilterEngine';
import type { DataTransform, ResolvedDataFrame } from './types';

type Row = Record<string, unknown>;

const EMPTY_FRAME: ResolvedDataFrame = { rows: [], fields: [] };

function buildCacheKey(
  name: string,
  filteredRowCount: number,
  transforms: readonly DataTransform[],
): string {
  // Uses row count (not a content hash) for performance.
  // Stale-read is prevented because register() calls unregister() first,
  // which evicts the cache entry before new rows are stored.
  // applyFilter/clearFilters invalidate via invalidateCacheForGroup().
  return `${name}:${filteredRowCount}:${JSON.stringify(transforms)}`;
}

/**
 * Per-engine data registry for @brewsite/charts.
 *
 * One ChartDataStore is created per chartPlugin() call. Never shared across engines.
 *
 * Filtering is delegated to an IFilterEngine (default: SimpleFilterEngine).
 * To use a high-performance engine (e.g. crossfilter2 for large datasets),
 * construct ChartDataStore with a custom IFilterEngine instance.
 *
 * @example
 * // Default (SimpleFilterEngine):
 * const store = new ChartDataStore();
 *
 * // Custom engine:
 * const store = new ChartDataStore(new CrossfilterFilterEngine());
 */
export class ChartDataStore {
  private readonly filterEngine: IFilterEngine;
  // Tracks which sources are registered (separate from filterEngine for fast existence checks)
  private readonly registeredSources = new Set<string>();
  // Memoization cache: source name → { cacheKey, result }
  private readonly resolveCache = new Map<string, { key: string; result: ResolvedDataFrame }>();

  constructor(filterEngine: IFilterEngine = new SimpleFilterEngine()) {
    this.filterEngine = filterEngine;
  }

  /**
   * Register a data source by name.
   * If filterGroupId is provided, applyFilter(groupId, ...) will affect this source.
   *
   * @param name         Unique source name referenced in <ChartData source="..." />.
   * @param rows         Row data. Treated as immutable — do not mutate after registration.
   * @param filterGroupId  Optional filter group. Sources in the same group share filters.
   */
  register(
    name: string,
    rows: ReadonlyArray<Row>,
    filterGroupId?: string,
  ): void {
    this.unregister(name); // Clean up previous registration if any
    this.registeredSources.add(name);
    this.filterEngine.register(name, rows, filterGroupId);
    this.resolveCache.delete(name);
  }

  /** Remove a source and clean up filter state. */
  unregister(name: string): void {
    this.registeredSources.delete(name);
    this.filterEngine.unregister(name);
    this.resolveCache.delete(name);
  }

  /**
   * Resolve a data source, applying active group filters then serializable transforms.
   * Results are memoized by (name, filtered-row-count, transforms-hash) and
   * invalidated when filters change.
   */
  resolve(name: string, transforms: readonly DataTransform[]): ResolvedDataFrame {
    if (!this.registeredSources.has(name)) {
      console.warn(
        `[ChartDataStore] Unknown data source: "${name}". ` +
        `Did you register it via <ChartProvider data={{ ${name}: rows }} />?`
      );
      return EMPTY_FRAME;
    }

    const filteredRows = this.filterEngine.getRows(name);
    const cacheKey = buildCacheKey(name, filteredRows.length, transforms);
    const cached = this.resolveCache.get(name);
    if (cached?.key === cacheKey) return cached.result;

    const transformed = applyTransforms(filteredRows as Row[], transforms);
    const fields = transformed.length > 0
      ? Object.keys(transformed[0]!)
      : (filteredRows.length > 0 ? Object.keys(filteredRows[0]!) : []);
    const result: ResolvedDataFrame = { rows: transformed, fields };
    this.resolveCache.set(name, { key: cacheKey, result });
    return result;
  }

  /**
   * Get a time-slice of data by time-field value index.
   * Used by HeatmapRenderer for animated time-series animation.
   */
  getTimeSlice(
    name: string,
    timeField: string,
    sliceIndex: number,
  ): ResolvedDataFrame {
    if (!this.registeredSources.has(name)) return EMPTY_FRAME;
    const allRows = this.filterEngine.getRows(name);
    const uniqueValues = [...new Set(allRows.map((r) => r[timeField]))];
    const sliceValue = uniqueValues[sliceIndex];
    if (sliceValue === undefined) return EMPTY_FRAME;
    const rows = (allRows as Row[]).filter((r) => r[timeField] === sliceValue);
    const fields = rows.length > 0 ? Object.keys(rows[0]!) : [];
    return { rows, fields };
  }

  /**
   * Apply a value-set filter to all sources in a group.
   * Triggers reactive updates in useChartData hooks for affected sources.
   */
  applyFilter(groupId: string, dimension: string, values: ReadonlyArray<unknown>): void {
    this.filterEngine.applyFilter(groupId, dimension, values);
    this.invalidateCacheForGroup(groupId);
  }

  /** Clear all filters for a group and trigger reactive updates. */
  clearFilters(groupId: string): void {
    this.filterEngine.clearFilters(groupId);
    this.invalidateCacheForGroup(groupId);
  }

  /**
   * Subscribe to filter changes for a specific source.
   * Automatically subscribes to the source's filter group if one is set,
   * so linked-brush filter changes trigger re-renders in useChartData().
   *
   * Returns an unsubscribe function compatible with useSyncExternalStore.
   */
  subscribeToSource(name: string, listener: () => void): () => void {
    const groupId = this.filterEngine.getFilterGroupForSource(name) ?? name;
    return this.filterEngine.subscribe(groupId, listener);
  }

  /**
   * Return the current active filters for a group as a read-only map.
   * Used by useChartFilter to expose reactive read access to current filter state.
   */
  getActiveFilters(groupId: string): ReadonlyMap<string, ReadonlySet<unknown>> {
    return this.filterEngine.getActiveFilters(groupId);
  }

  /**
   * Subscribe directly to a filter group by ID.
   * Used by useChartFilter internally and advanced consumers.
   */
  subscribeToFilterGroup(groupId: string, listener: () => void): () => void {
    return this.filterEngine.subscribe(groupId, listener);
  }

  /** Release all sources, filters, and listeners. */
  clear(): void {
    for (const name of [...this.registeredSources]) {
      this.unregister(name);
    }
    this.resolveCache.clear();
    this.filterEngine.dispose();
  }

  private invalidateCacheForGroup(groupId: string): void {
    // Evict cached results for any source in this group
    for (const name of this.registeredSources) {
      if (this.filterEngine.getFilterGroupForSource(name) === groupId) {
        this.resolveCache.delete(name);
      }
    }
  }
}
```

---

#### B1d. Remove `crossfilter2` dependency from `package.json`

**File:** `packages/charts/package.json`

Remove from `"dependencies"`:
```json
"crossfilter2": "^1.5.4"
```

Remove from `"devDependencies"` (if present):
```
(none needed)
```

Delete `packages/charts/src/crossfilter2.d.ts` — no longer needed.

---

#### B1e. Fix `useChartData` to subscribe to the correct channel

**Problem:** `useChartData` passes `sourceName` to `subscribeToFilterGroup(sourceName, cb)`.
This subscribes to a group called `"sales"` even if the source's filter group is
`"linked-brush-1"`. Linked-brush filter changes never propagate to the hook.

**File:** `packages/charts/src/data/useChartData.ts`

Replace the `useSyncExternalStore` subscribe argument:

```typescript
// Before:
(cb) => store.subscribeToFilterGroup(sourceName, cb),

// After:
(cb) => store.subscribeToSource(sourceName, cb),
```

`subscribeToSource` looks up the source's actual filter group (if any) and subscribes
to that, so linked-brush changes propagate correctly. If the source has no filter group,
it falls back to the source name as the group key (preserving existing behavior).

---

#### B1f. Update `ChartProvider` to support per-source filter groups

**Problem:** `ChartProvider.data` only accepts `Record<string, ReadonlyArray<Row>>`.
There is no way for consumers to associate a filter group at registration time without
calling `store` directly.

**Design goal:** Keep the flat-array shorthand backward compatible. Add an object form
that allows `filterGroup` per source.

**File:** `packages/charts/src/player/ChartProvider.tsx`

```typescript
type Row = Record<string, unknown>;

/** Object form for a single data source with optional filter group. */
export type DataSourceConfig = {
  readonly rows: ReadonlyArray<Row>;
  readonly filterGroup?: string;
};

/**
 * Accepted value for each entry in ChartProviderProps.data.
 * - ReadonlyArray<Row>: flat shorthand (no filter group)
 * - DataSourceConfig: object form with optional filterGroup
 */
export type DataInput = ReadonlyArray<Row> | DataSourceConfig;

export type ChartProviderProps = {
  /**
   * Map of source name → data.
   *
   * Flat shorthand (backward compatible):
   *   data={{ sales: salesRows }}
   *
   * Object form with filter group:
   *   data={{ sales: { rows: salesRows, filterGroup: 'linked-brush-1' } }}
   *
   * Both forms can be mixed in the same ChartProvider.
   */
  data: Readonly<Record<string, DataInput>>;
  children: ReactNode;
};

function isDataSourceConfig(v: DataInput): v is DataSourceConfig {
  return !Array.isArray(v) && typeof v === 'object' && v !== null && 'rows' in v;
}

export function ChartProvider({ data, children }: ChartProviderProps): ReactNode {
  const store = useChartStore();

  useEffect(() => {
    for (const [name, input] of Object.entries(data)) {
      if (isDataSourceConfig(input)) {
        store.register(name, input.rows, input.filterGroup);
      } else {
        store.register(name, input);
      }
    }
    return () => {
      for (const name of Object.keys(data)) {
        store.unregister(name);
      }
    };
  }, [store, data]);

  return <>{children}</>;
}
```

---

#### B1g. Fix string/number coercion bug in `transforms.ts`

**Problem:** `evaluateFilterOp` with `'gt'`, `'gte'`, `'lt'`, `'lte'` falls back to
`String(a) > String(b)` when both are not numbers. `'2' > '10'` = `true` lexicographically,
which is wrong.

**File:** `packages/charts/src/data/transforms.ts`

Replace the comparison helpers:

```typescript
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  // Attempt numeric coercion
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) {
    return na - nb;
  }
  // String fallback
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
```

Use `compareValues` in the `gt`, `gte`, `lt`, `lte` cases:
```typescript
case 'gt':  return compareValues(fieldValue, compareValue) > 0;
case 'gte': return compareValues(fieldValue, compareValue) >= 0;
case 'lt':  return compareValues(fieldValue, compareValue) < 0;
case 'lte': return compareValues(fieldValue, compareValue) <= 0;
```

---

#### B1h. Export `IFilterEngine` and `SimpleFilterEngine` from `index.ts`

**File:** `packages/charts/src/index.ts`

Add to the data layer section:
```typescript
export type { IFilterEngine } from './data/IFilterEngine';
export { SimpleFilterEngine } from './data/SimpleFilterEngine';
```

This lets advanced consumers provide a custom filter engine (e.g. a crossfilter2-backed
one) without coupling to internal APIs.

---

#### B1i. Add reactive read to `useChartFilter`

**Problem:** `useChartFilter` only exposes write operations (`applyFilter`,
`clearFilters`). Consumers cannot read the current filter state reactively — they
have no way to reflect active filters in UI (e.g. highlighting active filter chips).

**File:** `packages/charts/src/data/useChartFilter.ts`

Add a `activeFilters` field returned by the hook, backed by `useSyncExternalStore`:

```typescript
import { useSyncExternalStore, useCallback } from 'react';
import { useChartStore } from './ChartStoreContext';

export type UseChartFilterResult = {
  /** Apply a value-set filter on a dimension within the group. */
  applyFilter(dimension: string, values: ReadonlyArray<unknown>): void;
  /** Clear all active filters for the group. */
  clearFilters(): void;
  /**
   * Current active filters for the group.
   * Map of dimension field → set of allowed values.
   * Empty map when no filters are active.
   * Reactive — updates synchronously when applyFilter/clearFilters are called.
   */
  activeFilters: ReadonlyMap<string, ReadonlySet<unknown>>;
};

export function useChartFilter(groupId: string): UseChartFilterResult {
  const store = useChartStore();

  const activeFilters = useSyncExternalStore(
    (cb) => store.subscribeToFilterGroup(groupId, cb),
    () => store.getActiveFilters(groupId),
  );

  const applyFilter = useCallback(
    (dimension: string, values: ReadonlyArray<unknown>) =>
      store.applyFilter(groupId, dimension, values),
    [store, groupId],
  );

  const clearFilters = useCallback(
    () => store.clearFilters(groupId),
    [store, groupId],
  );

  return { applyFilter, clearFilters, activeFilters };
}
```

---

## Work Stream C — Theme System

### C1. Extend `ChartTheme` with legend and interaction tokens

**Problem:** The theme has no tokens for legend appearance or hover/selection states.
These are hardcoded in renderers.

**File:** `packages/charts/src/themes/types.ts`

Add two new token types and add them to `ChartTheme`:

```typescript
/** Styling tokens for the chart legend. */
export type ChartLegendTokens = {
  /** Label text color. */
  readonly textColor: string;
  /** Font size for legend labels (world units). */
  readonly fontSize: number;
  /** Side length of each color swatch (world units). */
  readonly swatchSize: number;
  /** Vertical spacing between legend entries (world units). */
  readonly spacing: number;
};

/** Tokens for interactive hover and selection feedback. */
export type ChartInteractionTokens = {
  /** Color applied to a hovered element (hex). */
  readonly hoverColor: string;
  /** Emissive intensity multiplier for hovered elements. */
  readonly hoverEmissiveIntensity: number;
  /** Color applied to a selected element (hex). */
  readonly selectedColor: string;
};
```

Update `ChartTheme`:
```typescript
export type ChartTheme = {
  /** Name of this theme. String (not limited to ChartThemeName) to support custom themes. */
  readonly name: string;
  readonly series: readonly ChartSeriesMaterialTokens[];
  readonly axis: ChartAxisTokens;
  readonly background: ChartBackgroundTokens;
  readonly legend: ChartLegendTokens;
  readonly interaction: ChartInteractionTokens;
};
```

**Note:** `ChartThemeName` stays as `'darkGlass' | 'neonCyber' | 'enterprise' | 'lightMinimal'`
for DSL type safety. The `name` field in `ChartTheme` is widened to `string` so custom
themes can carry a custom name without TypeScript errors.

---

### C2. Update all four preset themes to include new tokens

Each theme file needs `legend` and `interaction` blocks added.

**Files:**
- `packages/charts/src/themes/darkGlass.ts`
- `packages/charts/src/themes/neonCyber.ts`
- `packages/charts/src/themes/enterprise.ts`
- `packages/charts/src/themes/lightMinimal.ts`

**darkGlass additions:**
```typescript
legend: {
  textColor: '#d0e8ff',
  fontSize: 0.09,
  swatchSize: 0.08,
  spacing: 0.14,
},
interaction: {
  hoverColor: '#ffffff',
  hoverEmissiveIntensity: 0.6,
  selectedColor: '#ffdd00',
},
```

**neonCyber additions:**
```typescript
legend: {
  textColor: '#00ff9d',
  fontSize: 0.09,
  swatchSize: 0.08,
  spacing: 0.14,
},
interaction: {
  hoverColor: '#ffffff',
  hoverEmissiveIntensity: 1.2,
  selectedColor: '#ff00ff',
},
```

**enterprise additions:**
```typescript
legend: {
  textColor: '#444466',
  fontSize: 0.09,
  swatchSize: 0.08,
  spacing: 0.14,
},
interaction: {
  hoverColor: '#2255cc',
  hoverEmissiveIntensity: 0.3,
  selectedColor: '#ff6600',
},
```

**lightMinimal additions:**
```typescript
legend: {
  textColor: '#333344',
  fontSize: 0.09,
  swatchSize: 0.08,
  spacing: 0.14,
},
interaction: {
  hoverColor: '#1144ee',
  hoverEmissiveIntensity: 0.2,
  selectedColor: '#ee4400',
},
```

---

### C3. Add `createChartTheme` factory for partial theme overrides

**New file:** `packages/charts/src/themes/createChartTheme.ts`

```typescript
import { darkGlassChartTheme } from './darkGlass';
import { neonCyberChartTheme } from './neonCyber';
import { enterpriseChartTheme } from './enterprise';
import { lightMinimalChartTheme } from './lightMinimal';
import type {
  ChartTheme,
  ChartThemeName,
  ChartSeriesMaterialTokens,
  ChartAxisTokens,
  ChartBackgroundTokens,
  ChartLegendTokens,
  ChartInteractionTokens,
} from './types';

const PRESET_MAP: Record<ChartThemeName, ChartTheme> = {
  darkGlass: darkGlassChartTheme,
  neonCyber: neonCyberChartTheme,
  enterprise: enterpriseChartTheme,
  lightMinimal: lightMinimalChartTheme,
};

/** Deep-partial type for ChartTheme overrides. */
export type ChartThemeOverrides = {
  readonly name?: string;
  readonly series?: ReadonlyArray<Partial<ChartSeriesMaterialTokens>>;
  readonly axis?: Partial<ChartAxisTokens>;
  readonly background?: Partial<ChartBackgroundTokens>;
  readonly legend?: Partial<ChartLegendTokens>;
  readonly interaction?: Partial<ChartInteractionTokens>;
};

/**
 * Creates a ChartTheme by merging overrides on top of a base preset.
 *
 * The base can be a preset name ('darkGlass', 'enterprise', etc.) or a full
 * ChartTheme object. Only the fields you override are changed — the rest
 * inherit from the base.
 *
 * @example
 * const brandTheme = createChartTheme('darkGlass', {
 *   name: 'brand',
 *   axis: { lineColor: '#ff4400', labelColor: '#ffffff' },
 *   series: [
 *     { color: '#ff4400', metalness: 0.3, roughness: 0.4, transmission: 0, emissiveIntensity: 0.1, depth: 0.3 },
 *   ],
 * });
 *
 * // Use in DSL:
 * <Chart id="c1" type="bar" theme={brandTheme}>
 *   <ChartData source="sales" />
 * </Chart>
 */
export function createChartTheme(
  base: ChartThemeName | ChartTheme,
  overrides: ChartThemeOverrides = {},
): ChartTheme {
  const baseTheme: ChartTheme =
    typeof base === 'string' ? PRESET_MAP[base] : base;

  const mergedSeries: readonly ChartSeriesMaterialTokens[] = overrides.series
    ? overrides.series.map((s, i) => ({
        ...baseTheme.series[i % baseTheme.series.length]!,
        ...s,
      }))
    : baseTheme.series;

  return {
    name: overrides.name ?? baseTheme.name,
    series: mergedSeries,
    axis: overrides.axis ? { ...baseTheme.axis, ...overrides.axis } : baseTheme.axis,
    background: overrides.background
      ? { ...baseTheme.background, ...overrides.background }
      : baseTheme.background,
    legend: overrides.legend
      ? { ...baseTheme.legend, ...overrides.legend }
      : baseTheme.legend,
    interaction: overrides.interaction
      ? { ...baseTheme.interaction, ...overrides.interaction }
      : baseTheme.interaction,
  };
}
```

---

### C4. Allow `ChartDSL.theme` to accept inline `ChartTheme` objects

**File:** `packages/charts/src/elements/chart/types.ts`

Change `ChartDSL.theme`:
```typescript
// Before:
readonly theme?: ChartThemeName;

// After:
readonly theme?: ChartThemeName | ChartTheme;
```

Change `ChartState.theme`:
```typescript
// Before:
readonly theme: ChartThemeName;

// After:
readonly theme: ChartThemeName | ChartTheme;
```

`ChartTheme` is a plain-data object (strings, numbers) so it is fully serializable.
No change to how `compileChart` handles it — `dsl.theme ?? 'darkGlass'` works for
both strings and objects.

**File:** `packages/charts/src/elements/chart/render.ts`

Update `THEME_MAP` lookup to handle inline themes:
```typescript
// Before:
const theme = THEME_MAP[state.theme] ?? darkGlassChartTheme;

// After:
const theme: ChartTheme =
  typeof state.theme === 'string'
    ? (THEME_MAP[state.theme as ChartThemeName] ?? darkGlassChartTheme)
    : state.theme;
```

---

### C5. Update `themes/index.ts` and `index.ts` exports

**File:** `packages/charts/src/themes/index.ts`

```typescript
export { darkGlassChartTheme } from './darkGlass';
export { neonCyberChartTheme } from './neonCyber';
export { enterpriseChartTheme } from './enterprise';
export { lightMinimalChartTheme } from './lightMinimal';
export { createChartTheme } from './createChartTheme';
export type { ChartThemeOverrides } from './createChartTheme';
export type {
  ChartTheme,
  ChartThemeName,
  ChartSeriesMaterialTokens,
  ChartAxisTokens,
  ChartBackgroundTokens,
  ChartLegendTokens,
  ChartInteractionTokens,
} from './types';

/** All built-in preset themes, keyed by name. Useful for dynamic theme switching. */
export const CHART_THEMES = {
  darkGlass: darkGlassChartTheme,
  neonCyber: neonCyberChartTheme,
  enterprise: enterpriseChartTheme,
  lightMinimal: lightMinimalChartTheme,
} as const;
```

**File:** `packages/charts/src/index.ts`

Add to themes section:
```typescript
export { createChartTheme, CHART_THEMES } from './themes/createChartTheme';
export type { ChartThemeOverrides } from './themes/createChartTheme';
export type {
  ChartLegendTokens,
  ChartInteractionTokens,
} from './themes/types';
```

---

## Work Stream D — API Surface Cleanup

### D1. Remove `ChartRenderer` from public exports

**Problem:** `ChartRenderer` is an internal implementation detail. It should not be
importable by consumers.

**File:** `packages/charts/src/index.ts`

Remove:
```typescript
export { ChartRenderer } from './elements/chart/render';
```

`ChartRenderer` becomes package-internal. It is already accessed only by `ChartWidget`.

---

### D2. Mark `ChartWidget` as internal, export `compileChart`

**Problem:** `ChartWidget` is auto-created by `chartPlugin()` and consumers have no
reason to import it. `compileChart` is useful for advanced testing and integration
but is not currently exported.

**File:** `packages/charts/src/index.ts`

Remove:
```typescript
export { ChartWidget } from './elements/chart/ChartWidget';
```

Keep:
```typescript
export type { ChartHoverInfo } from './elements/chart/ChartWidget';
```

Add:
```typescript
export { compileChart, functionalChartTransitionSpec } from './elements/chart/compile';
```

---

### D3. Add const arrays for programmatic access

**File:** `packages/charts/src/index.ts`

Add near the state types section:
```typescript
/** All supported chart types. Useful for building type-selector dropdowns or tests. */
export const CHART_TYPES = [
  'bar', 'line', 'area', 'pie', 'scatter', 'heatmap',
] as const satisfies readonly ChartType[];

/** All supported filter operators. */
export const FILTER_OPS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in',
] as const satisfies readonly FilterOp[];
```

---

### D4. Fix two-phase handler registration — remove side-effectful import

**Problem:** `src/index.ts` has `import './register'` which fires `registerChartHandlers()`
at module-load time as a side effect. This is fragile and happens before any `chartPlugin()`
is created, polluting the global handler registry unconditionally.

`chartPlugin().registerHandlers()` already calls `registerChartHandlers()`. The
import-time side effect is redundant and confusing.

**File:** `packages/charts/src/index.ts`

Remove:
```typescript
import './register';
```

**File:** `packages/charts/src/register.ts`

Add a JSDoc clarifying that this is only called by `chartPlugin()`:
```typescript
/**
 * Called by chartPlugin().registerHandlers().
 * Guard handlers fire if chart DSL child components appear outside <Chart>
 * when the compiler processes a scene.
 *
 * Do NOT call this directly — chartPlugin() handles registration.
 */
```

**Important:** The child guard handlers (ChartData, ChartAxis, etc.) are still effective.
They fire whenever the compiler encounters these DSL components at the scene root level —
which only happens if the scene is compiled with `chartPlugin()` active (since the plugin
calls `registerHandlers()`). If `chartPlugin()` is forgotten, the chart simply won't
compile at all (Chart node has no handler), which is a clear failure.

**Breaking change migration note:** Any consumer who relied on `import '@brewsite/charts'`
alone to trigger side-effect registration (without calling `chartPlugin()`) will break
after this change. They must update to use `chartPlugin()` explicitly. Since
`@brewsite/charts` is a pre-release package (< v1.0.0), this does not require a major
semver bump, but must be documented in the changelog and release notes with a clear
migration instruction:

> **Migration:** Remove any bare `import '@brewsite/charts'` used for side-effect
> registration. Pass `chartPlugin()` to `EngineProvider`'s `plugins` prop instead.
> This was always the intended usage pattern.

---

### D5. Fix misleading comment in `chartPlugin.ts`

**File:** `packages/charts/src/player/chartPlugin.ts`

Remove/replace the comment:
```typescript
// registerNode() is last-writer-wins — this overrides the guard installed by registerChartHandlers.
```

Replace with:
```typescript
// Register the main Chart handler. This is the only handler for Chart — child
// component guards (ChartData, ChartAxis, etc.) are registered separately in
// registerHandlers() and are never invoked for children collected by this handler.
```

---

### D6. Export `SCENE_CAMERA_KEY` from `@brewsite/core` and import in charts

**Problem:** Both `ChartWidget.ts` and `ChartTooltipOverlay.tsx` hardcode the magic
string `'__brewsite_camera'` inline. This string is owned by `CameraWidget` in
`@brewsite/core`. Defining it again in charts creates a silent coupling — if core ever
renames the key, charts breaks at runtime with no compile-time error.

**New file:** `packages/core/src/elements/camera/cameraKeys.ts`
```typescript
/**
 * Key under which CameraWidget stores the active Three.js camera on scene.userData.
 * Imported by packages that need to retrieve the camera (e.g. @brewsite/charts).
 */
export const SCENE_CAMERA_KEY = '__brewsite_camera' as const;
```

**File:** `packages/core/src/elements/camera/index.ts`
```typescript
// Add:
export { SCENE_CAMERA_KEY } from './cameraKeys';
```

**File:** `packages/core/src/index.ts` (camera section)
```typescript
// Add:
export { SCENE_CAMERA_KEY } from './elements/camera';
```

Ensure `CameraWidget.ts` imports `SCENE_CAMERA_KEY` from `./cameraKeys` — it must not
hardcode the string independently.

**File:** `packages/charts/src/elements/chart/ChartWidget.ts`

Replace:
```typescript
const cam = (this.scene.userData as Record<string, unknown>)['__brewsite_camera'];
```
With:
```typescript
import { SCENE_CAMERA_KEY } from '@brewsite/core';
// ...
const cam = (this.scene.userData as Record<string, unknown>)[SCENE_CAMERA_KEY];
```

Apply the same replacement in `packages/charts/src/player/ChartTooltipOverlay.tsx`.

**No separate `cameraKey.ts` in `@brewsite/charts`.** The constant lives in core only.

---

### D7. Enable Pie donut mode via `ChartState`

**Problem:** `PieRenderer` has `innerRadius` hardcoded to `0`. The code is written
to support donuts but the feature is disabled without explanation.

**File:** `packages/charts/src/elements/chart/types.ts`

Add to `ChartState`:
```typescript
/** Inner radius ratio for pie charts (0 = pie, 0.1–0.8 = donut). Default 0. */
readonly innerRadius?: number;
```

Add to `ChartDSL`:
```typescript
readonly innerRadius?: number;
```

**File:** `packages/charts/src/elements/chart/compile.ts`

Add to `compileChart` output:
```typescript
innerRadius: dsl.innerRadius ?? 0,
```

**File:** `packages/charts/src/renderers/shared/IChartRenderer.ts`

Add `innerRadius` to `ChartRenderContext`:
```typescript
readonly innerRadius: number;
```

**File:** `packages/charts/src/elements/chart/render.ts`

Pass it in `ChartRenderer.update()`:
```typescript
innerRadius: state.innerRadius ?? 0,
```

**File:** `packages/charts/src/renderers/pie/PieRenderer.ts`

Replace the hardcoded `0`:
```typescript
// Before:
const innerRadius = 0;

// After:
const innerRadius = ctx.innerRadius ?? 0;
```

---

### D8. Expose `getWidget` on `ChartPluginInstance` for event wiring

**Problem:** `ChartWidget` has public `onHover` and `onSelect` callback fields, and
they are fully wired to DOM events. However, `ChartPluginInstance` (the object returned
by `chartPlugin()`) only exposes `store` — there is no way for a consumer to retrieve
the widget instance to attach callbacks.

**File:** `packages/charts/src/player/chartPlugin.ts`

1. Update the `ChartPluginInstance` type:

```typescript
export type ChartPluginInstance = {
  /** The shared data store for this plugin instance. */
  store: ChartDataStore;
  /**
   * Retrieve a chart widget instance by chart ID to attach onHover/onSelect callbacks.
   * Returns undefined if the chart has not yet been initialized or the id is unknown.
   *
   * @example
   * const plugin = useMemo(() => chartPlugin(), []);
   * useEffect(() => {
   *   const widget = plugin.getWidget('revenue');
   *   if (widget) widget.onHover = (info) => console.log(info);
   * }, [plugin]);
   */
  getWidget(id: string): Pick<ChartWidget, 'onHover' | 'onSelect'> | undefined;
  registerHandlers(): void;
  createWidget(id: string, store: ChartDataStore): ChartWidget;
};
```

2. In the `chartPlugin()` factory closure, store a widget registry map and implement:

```typescript
function chartPlugin(): ChartPluginInstance {
  const store = new ChartDataStore();
  const widgetRegistry = new Map<string, ChartWidget>();

  return {
    store,
    getWidget(id: string) {
      return widgetRegistry.get(id);
    },
    createWidget(id: string, dataStore: ChartDataStore): ChartWidget {
      const widget = new ChartWidget(id, dataStore);
      widgetRegistry.set(id, widget);
      return widget;
    },
    registerHandlers() {
      registerChartHandlers();
    },
  };
}
```

3. Ensure the widget registry is cleaned up: when `ChartWidget.dispose()` is called,
   remove it from the registry. Add a `dispose` callback hook in `createWidget`:

```typescript
createWidget(id: string, dataStore: ChartDataStore): ChartWidget {
  const widget = new ChartWidget(id, dataStore);
  widgetRegistry.set(id, widget);
  const originalDispose = widget.dispose.bind(widget);
  widget.dispose = () => {
    widgetRegistry.delete(id);
    originalDispose();
  };
  return widget;
},
```

Update F1 §10 (Interactivity) to document `getWidget` usage alongside
`interactive={true}` and `ChartTooltipOverlay`.

---

## Work Stream E — Tests

### E1. Add `SimpleFilterEngine` unit tests

**New file:** `packages/charts/src/data/__tests__/SimpleFilterEngine.test.ts`

Test cases:
1. `register` + `getRows` with no filters returns all rows
2. `register` with `filterGroupId` + `applyFilter` returns only matching rows
3. `applyFilter` with multiple dimensions (AND logic)
4. `applyFilter` with `values=[]` clears that dimension
5. `clearFilters` removes all dimension filters for a group
6. `subscribe` listener fires on `applyFilter`
7. `subscribe` listener fires on `clearFilters`
8. Unsubscribe function stops notifications
9. Multiple sources in same group — filter affects all
10. Source with no filterGroup is unaffected by group filters
11. `dispose` clears all state

---

### E2. Add `ChartDataStore` caching and integration tests

**New file:** `packages/charts/src/data/__tests__/ChartDataStoreIntegration.test.ts`

Test cases:
1. `resolve()` returns memoized result on second call (same reference)
2. `resolve()` cache is invalidated after `applyFilter`
3. `register()` replaces existing source cleanly
4. `unregister()` evicts cache entry
5. `subscribeToSource()` fires when filter group changes
6. `subscribeToSource()` falls back to source-name group when no filterGroupId
7. Unknown source returns EMPTY_FRAME with console.warn
9. `getTimeSlice()` returns correct slice by field value index
10. Two ChartDataStore instances are fully isolated (no shared state)

---

### E3. Add `ChartWidget` lifecycle tests

**New file:** `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts`

Use Three.js mocks (no real GPU). Test cases:
1. `initialize()` mounts chart group into scene
2. `apply()` updates `lastState`
3. `apply()` with `interactive=true` attaches DOM listeners
4. `apply()` with `interactive=false` after true detaches DOM listeners
5. `onTick()` is a no-op if `lastState` is null (no crash)
6. `onTick()` re-invokes `chartRenderer.update` when type=heatmap + timeField set
7. `dispose()` removes chart group from scene and detaches listeners
8. `apply()` before `initialize()` does not throw

---

### E4. Add `LineRenderer` hover tests

**New file:** `packages/charts/src/renderers/line/__tests__/LineRenderer.test.ts`

Test cases:
1. `resolveHoverInfo()` returns nearest datumIndex (not always 0)
2. `resolveHoverInfo()` returns correct seriesIndex for multi-series
3. `resolveHoverInfo()` returns null for non-tube intersection
4. `resolveHoverInfo()` returns correct row from data.rows

---

### E5. Add `AreaRenderer` hover tests

**New file:** `packages/charts/src/renderers/area/__tests__/AreaRenderer.test.ts`

Test cases:
1. `resolveHoverInfo()` returns datumIndex proportional to X position
2. `resolveHoverInfo()` clamps datumIndex to [0, rows.length-1]
3. `resolveHoverInfo()` returns null for non-area intersection

---

### E6. Add integration test for `chartPlugin` compilation pipeline

**New file:** `packages/charts/src/compiler/__tests__/chartPlugin.test.ts`

Test cases:
1. Scene with `<Chart>` + all children compiles without error
2. Scene with `<Chart>` missing `<ChartData>` throws descriptive error
3. Scene with multiple `<Chart>` elements produces independent states
4. `<ChartData source="..." />` sets `dataSource` in compiled state
5. Guard handlers throw when child used outside `<Chart>` context

---

### E7. Add `ChartMaterialFactory` type-safety fix and tests

**File:** `packages/charts/src/renderers/shared/ChartMaterialFactory.ts`

Fix the cache to use `THREE.Material` as the value type instead of
`THREE.MeshPhysicalMaterial` (which requires unsafe casts):

```typescript
private readonly cache = new Map<MaterialKey, THREE.Material>();

getSeriesMaterial(theme: ChartTheme, seriesIndex: number): THREE.MeshPhysicalMaterial {
  // ...
  const mat = new THREE.MeshPhysicalMaterial({ ... });
  this.cache.set(key, mat);  // No cast needed
  return mat;
}

createAxisMaterial(theme: ChartTheme): THREE.LineBasicMaterial {
  // ...
  this.cache.set(key, mat);  // No cast needed
  return mat;
}

applyOpacity(opacity: number): void {
  for (const mat of this.cache.values()) {
    if (mat instanceof THREE.MeshPhysicalMaterial) {
      mat.opacity = Math.min(opacity, mat.transmission > 0 ? 0.85 : 1.0);
      mat.transparent = mat.transparent || opacity < 1;
    }
    // LineBasicMaterial and MeshStandardMaterial are intentionally excluded
  }
}

dispose(): void {
  for (const mat of this.cache.values()) mat.dispose();
  this.cache.clear();
}
```

**New file:** `packages/charts/src/renderers/shared/__tests__/ChartMaterialFactory.test.ts`

Test cases:
1. `getSeriesMaterial()` returns a `THREE.MeshPhysicalMaterial` with correct color from theme
2. `getSeriesMaterial()` with same theme + seriesIndex returns the same cached instance (memoized)
3. `applyOpacity(0.5)` on a non-transmissive material sets `mat.opacity = 0.5` (not `0.25`)
4. `applyOpacity(0.5)` on a transmissive material (`transmission > 0`) sets `mat.opacity = 0.5`
   capped at `0.85`, i.e. `Math.min(0.5, 0.85) = 0.5`

---

### E8. Add `createChartTheme` unit tests

**New file:** `packages/charts/src/themes/__tests__/createChartTheme.test.ts`

Test cases:
1. String base `'darkGlass'` resolves to the `darkGlassChartTheme` preset (reference equality)
2. `ChartTheme` object base passes through as-is when no overrides provided
3. `series` override with fewer entries than base wraps by modulo index
   (e.g. 1 override entry applied to a 4-series base produces a 1-entry series array)
4. `axis` partial override merges correctly — overridden fields replaced, rest inherited from base
5. `legend` partial override merges correctly
6. `interaction` partial override merges correctly
7. Inline `ChartTheme` object as base with partial overrides — overridden fields replaced,
   rest inherited from the passed theme object

---

## Work Stream F — Documentation and Examples

### F1. Write `packages/charts/README.md`

The README must cover:

**Sections:**
1. **Overview** — what the package does in 2 sentences
2. **Installation** — `pnpm add @brewsite/charts` + peer deps table
3. **Quick Start** — minimal working example showing ChartProvider + ScenePlayer + one `<Chart>`
4. **Plugin Setup** — how to wire `chartPlugin()` into `EngineProvider`
5. **Data Registration** — `ChartProvider` with flat-array and filter-group forms; `useChartData`
6. **DSL Reference** — table of all DSL components with their props, required/optional status,
   and one-line description per prop
7. **Chart Types** — screenshot placeholder + one-sentence description per type
   (bar, line, area, pie, scatter, heatmap)
8. **Themes** — table of preset names + `createChartTheme` factory example
9. **Linked-Brush Filtering** — `filterGroup` prop + `useChartFilter` hook example
10. **Interactivity** — `interactive={true}` + `onHover` / `onSelect` callbacks + `ChartTooltipOverlay`
11. **TypeScript** — exported types summary
12. **License**

**Minimal quick-start example to show:**
```tsx
import { useMemo } from 'react';
import { ScenePlayer, Scene, corePlugin } from '@brewsite/core';
import {
  chartPlugin, ChartProvider,
  Chart, ChartData, ChartAxis, ChartSeries, ChartLegend,
} from '@brewsite/charts';

const salesRows = [
  { month: 'Jan', revenue: 120, units: 45 },
  { month: 'Feb', revenue: 140, units: 52 },
  { month: 'Mar', revenue: 110, units: 38 },
];

function SalesPage() {
  const chartsPlugin = useMemo(() => chartPlugin(), []);
  return (
    <ScenePlayer
      manifestUrl="/assets/manifest.json"
      plugins={[corePlugin(), chartsPlugin]}
    >
      <ChartProvider data={{ sales: salesRows }}>
        <Scene id="chart-scene">
          <Chart id="revenue" type="bar" position={[0, 0, 0]} theme="darkGlass">
            <ChartData source="sales" />
            <ChartAxis axis="x" field="month" label="Month" />
            <ChartAxis axis="y" field="revenue" label="Revenue ($)" format="$,.0f" />
            <ChartSeries field="revenue" label="Revenue" />
            <ChartLegend visible position="right" />
          </Chart>
        </Scene>
      </ChartProvider>
    </ScenePlayer>
  );
}
```

> **§10 — Interactivity:** `getWidget(id)` is only available after the engine has compiled
> the scene for the first time. Call it in a `useEffect`, not at render time:
>
> ```tsx
> const plugin = useMemo(() => chartPlugin(), []);
>
> // ✅ Correct — wire callbacks after mount, inside useEffect
> useEffect(() => {
>   const chart = plugin.getWidget('revenue');
>   if (chart) {
>     chart.onHover = (info) => setTooltipInfo(info);
>     chart.onSelect = (info) => console.log('selected', info?.row);
>   }
> }, [plugin]);
>
> // ❌ Wrong — getWidget returns undefined at render time (scene not yet compiled)
> const chart = plugin.getWidget('revenue'); // undefined here
> ```

---

### F2. Create example chart scene in `apps/examples/`

**New directory:** `apps/examples/src/chart/`

**New files:**

`apps/examples/src/chart/scenes/chartDemo.tsx` — Scene showing multiple chart types:
- Bar chart (sales by month, multi-series)
- Line chart (revenue trend, 2 series)
- Scatter chart (units vs. revenue)
- `<ChartLegend>` on each

`apps/examples/src/chart/widgetSetup.ts` — Standard widgetSetup file per the examples
app convention.

`apps/examples/src/chart/ChartDemoPage.tsx` — Page component using `chartPlugin()` +
`ChartProvider` with the example data registered. Use the `ScenePlayer` children pattern
with `manifestUrl` (required) and `plugins` prop — not `getFrame` or `scenes`:

```tsx
// Pattern: ScenePlayer children (not getFrame, not scenes prop)
<ScenePlayer manifestUrl="/scene-manifest.json" plugins={[corePlugin(), chartsPlugin]}>
  <ChartProvider data={{ sales: sampleSalesData }}>
    <Scene id="chart-demo-bar"> ... </Scene>
    <Scene id="chart-demo-line"> ... </Scene>
    <Scene id="chart-demo-scatter"> ... </Scene>
  </ChartProvider>
</ScenePlayer>
```

The `widgetSetup.ts` file should follow the examples app's existing convention —
check `apps/examples/src/diagram/widgetSetup.ts` as the reference pattern.

The example data should be a realistic-looking but static dataset defined inline:
```typescript
export const sampleSalesData = [
  { month: 'Jan', revenue: 120, costs: 85, units: 45 },
  { month: 'Feb', revenue: 140, costs: 92, units: 52 },
  { month: 'Mar', revenue: 110, costs: 78, units: 38 },
  { month: 'Apr', revenue: 165, costs: 105, units: 61 },
  { month: 'May', revenue: 190, costs: 118, units: 72 },
  { month: 'Jun', revenue: 175, costs: 110, units: 65 },
];
```

Register the route in the examples app's router (check the existing pattern in
`apps/examples/src/App.tsx` or the top-level routing file).

---

## Execution Order

Implement work streams in this order. Each stream is self-contained and can be
PR'd independently.

| Order | Stream | Risk | Effort |
|-------|--------|------|--------|
| 1 | A (Core Correctness) | Low | Low |
| 2 | B (Data Layer) | Medium | Medium |
| 3 | C (Theme System) | Low | Medium |
| 4 | D (API Cleanup) | Low | Low |
| 5 | E (Tests) | Low | Medium |
| 6 | F (Docs + Examples) | Low | Medium |

---

## Invariants to Maintain

These must hold after every change:

1. **`compile.ts` imports nothing from Three.js or React** — only types and pure
   functions from `@brewsite/core`.

2. **Three.js is confined to `render.ts` files** — no direct Three.js in
   ChartWidget, compile.ts, data layer, or themes.

3. **Consumer API is backward compatible after this plan** — the following must
   continue to work with no changes:
   - `<ChartProvider data={{ sales: salesRows }}>`  (flat array form)
   - `<Chart id="x" type="bar" theme="darkGlass">`
   - `useChartData('sales')`
   - `useChartFilter('group')`
   - `chartPlugin()` factory

4. **`IFilterEngine` is the only entry point for filter operations** — `ChartDataStore`
   must not contain any filtering logic directly; all filtering goes through the engine.

5. **All tests pass before submitting any PR** — run `pnpm --filter @brewsite/charts test`
   after each stream.

6. **No `any` types introduced** — TypeScript strict mode is on. All cast-as-unknown
   patterns in ChartMaterialFactory must be replaced with properly typed alternatives
   as specified in E7.

---

## Files Created

| File | Work Stream |
|------|-------------|
| `packages/core/src/elements/camera/cameraKeys.ts` | D6 |
| `packages/charts/src/data/IFilterEngine.ts` | B1a |
| `packages/charts/src/data/SimpleFilterEngine.ts` | B1b |
| `packages/charts/src/themes/createChartTheme.ts` | C3 |
| `packages/charts/src/data/__tests__/SimpleFilterEngine.test.ts` | E1 |
| `packages/charts/src/data/__tests__/ChartDataStoreIntegration.test.ts` | E2 |
| `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts` | E3 |
| `packages/charts/src/renderers/line/__tests__/LineRenderer.test.ts` | E4 |
| `packages/charts/src/renderers/area/__tests__/AreaRenderer.test.ts` | E5 |
| `packages/charts/src/compiler/__tests__/chartPlugin.test.ts` | E6 |
| `packages/charts/src/renderers/shared/__tests__/ChartMaterialFactory.test.ts` | E7 |
| `packages/charts/src/themes/__tests__/createChartTheme.test.ts` | E8 |
| `packages/charts/README.md` | F1 |
| `apps/examples/src/chart/scenes/chartDemo.tsx` | F2 |
| `apps/examples/src/chart/widgetSetup.ts` | F2 |
| `apps/examples/src/chart/ChartDemoPage.tsx` | F2 |

## Files Modified

| File | Work Stream | Change |
|------|-------------|--------|
| `packages/charts/src/elements/chart/render.ts` | A1, C4 | Cache lastData; handle theme union type |
| `packages/charts/src/renderers/line/LineRenderer.ts` | A2, A6 | seriesPoints cache; nearest-datum hover |
| `packages/charts/src/renderers/area/AreaRenderer.ts` | A3, A4, A6 | Bounds cache; X-position hover; opacity fix |
| `packages/charts/src/renderers/bar/BarRenderer.ts` | A6 | Remove fake-group dispose |
| `packages/charts/src/renderers/pie/PieRenderer.ts` | A6, D7 | Remove fake-group dispose; donut innerRadius |
| `packages/charts/src/renderers/scatter/ScatterRenderer.ts` | A6 | Remove fake-group dispose |
| `packages/charts/src/player/chartPlugin.ts` | A5, D5, D8 | Required ChartData validation; fix comment; add getWidget |
| `packages/charts/src/data/ChartDataStore.ts` | B1c | IFilterEngine injection; caching; new API; getActiveFilters |
| `packages/charts/src/data/useChartData.ts` | B1e | subscribeToSource instead of subscribeToFilterGroup |
| `packages/charts/src/data/useChartFilter.ts` | B1i | Add activeFilters reactive read |
| `packages/core/src/elements/camera/index.ts` | D6 | Re-export SCENE_CAMERA_KEY from cameraKeys |
| `packages/core/src/index.ts` | D6 | Export SCENE_CAMERA_KEY from public surface |
| `packages/charts/src/player/ChartProvider.tsx` | B1f | DataSourceConfig type; filterGroup support |
| `packages/charts/src/data/transforms.ts` | B1g | Fix string/numeric comparison |
| `packages/charts/src/themes/types.ts` | C1 | Add ChartLegendTokens, ChartInteractionTokens |
| `packages/charts/src/themes/darkGlass.ts` | C2 | Add legend + interaction tokens |
| `packages/charts/src/themes/neonCyber.ts` | C2 | Add legend + interaction tokens |
| `packages/charts/src/themes/enterprise.ts` | C2 | Add legend + interaction tokens |
| `packages/charts/src/themes/lightMinimal.ts` | C2 | Add legend + interaction tokens |
| `packages/charts/src/themes/index.ts` | C5 | Re-export createChartTheme, CHART_THEMES |
| `packages/charts/src/elements/chart/types.ts` | C4, D7 | theme union; innerRadius field |
| `packages/charts/src/elements/chart/compile.ts` | D7 | innerRadius in compileChart |
| `packages/charts/src/index.ts` | B1h, C5, D1–D4 | Remove side effect import; fix exports |
| `packages/charts/src/register.ts` | D4 | Clarify JSDoc |
| `packages/charts/src/renderers/shared/ChartMaterialFactory.ts` | E7 | Fix cache type safety |
| `packages/charts/src/renderers/shared/IChartRenderer.ts` | D7 | innerRadius in ChartRenderContext |
| `packages/charts/package.json` | B1d | Remove crossfilter2 dependency |

## Files Deleted

| File | Reason |
|------|--------|
| `packages/charts/src/crossfilter2.d.ts` | crossfilter2 removed |
| `packages/charts/src/elements/chart/cameraKey.ts` | SCENE_CAMERA_KEY now exported from @brewsite/core |
