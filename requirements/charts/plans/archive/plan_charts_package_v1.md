---
title: "@brewsite/charts — V1 Implementation Plan"
doc_type: plan
owner: Toolkit Architect
status: active
updated: 2026-03-01
---

# @brewsite/charts — V1 Implementation Plan

## Summary

This plan specifies the complete implementation of `@brewsite/charts`, a new published
package that adds native 3D chart rendering to the BrewSite toolkit. Charts are real
Three.js geometry objects powered by D3 math modules — not canvas textures on a plane.

The plan covers:
1. A prerequisite refactor: promoting `TextRenderer` (troika-three-text) to `@brewsite/core`
2. Full scaffolding and implementation of `packages/charts/`
3. All architectural decisions resolved from the PM's open questions

---

## Resolved Architectural Decisions

### A. TextRenderer → `@brewsite/core` (Open Question 1, Option A)

The diagram package's `TextRenderer.ts` (`ensureText`) and its troika-three-text
dependency are promoted to `@brewsite/core`. Both `@brewsite/diagram` and the new
`@brewsite/charts` then import text utilities from core, maintaining the clean
dependency direction (`charts → core`, `diagram → core`).

**Files created in @brewsite/core:**
- `packages/core/src/text/TextRenderer.ts` — re-exports `ensureText` from diagram with
  full ownership; troika-three-text becomes a peer dependency of core.
- `packages/core/src/text/index.ts` — barrel for text utilities.

**Files modified in @brewsite/diagram:**
- `packages/diagram/src/elements/diagram/rendering/TextRenderer.ts` — replaced with a
  re-export from `@brewsite/core/text` (or deleted if core's version is identical).
- `packages/diagram/package.json` — remove `troika-three-text` from `dependencies`
  (it becomes a peer dependency, installed transitively from core).

**Rationale:** `troika-three-text` is a peer dependency of the scene (it needs to be a
singleton in the renderer). Putting it in `@brewsite/core` makes this explicit and
removes duplication.

---

### B. Geometry Update Strategy (Open Question 2)

**InstancedMesh renderers (scatter, heatmap):** Always use partial in-place updates —
`setMatrixAt()`, `setColorAt()`, and `instanceMatrix.needsUpdate = true`. Never rebuild
the `InstancedMesh` unless the data point *count* changes.

**Non-instanced renderers (bar, line, area, pie):** Full geometry rebuild on each
`apply()` call. Old geometry is disposed before new geometry is created. For V1
presentation data scales (≤500 data points), the rebuild cost is < 1ms and well within
60 fps budget.

**Threshold documentation:** A comment in `IChartRenderer.ts` documents:
> "For non-instanced renderers, full rebuild is correct through ~500 data points.
> If a consumer dataset exceeds this threshold, extend the renderer with a
> LazyChartRenderer wrapper that tracks which series changed and rebuilds only those."

No `lazy` prop is added in V1. The implementation is designed so that the `IChartRenderer`
interface supports it in a future version without breaking changes.

---

### C. Tooltip System (Open Question 3, Option C hybrid)

`ChartWidget` exposes a public `onHover` callback (same pattern as
`DiagramWidget.onInteraction`). The callback receives a `ChartHoverInfo | null` — the
chart type, series index, datum index, datum value, and the Three.js world-space point
of the intersection.

A companion React component `ChartTooltipOverlay` (exported from the `player/` layer)
subscribes to this callback and positions an HTML overlay over the canvas using
`LabelPositioner`-style camera projection. This is identical to how
`DiagramWidget.onInteraction` provides hover point data.

```tsx
// App usage
const widget = new ChartWidget('revenue-chart', defaultState);
<ChartProvider data={...}>
  <EngineProvider plugins={[corePlugin(), chartPlugin()]}>
    <ChartTooltipOverlay widget={widget} render={(info) => <div>{info.value}</div>} />
    <ScenePlayer ... />
  </EngineProvider>
</ChartProvider>
```

**In non-interactive mode** (`interactive={false}`, the default), `onHover` is never
called and raycasting is disabled. No overhead.

---

### D. Interaction Model (Open Question 4, Option B)

Charts have an `interactive?: boolean` prop in the DSL (defaults to `false`). When
`false`, `ChartWidget.apply()` skips raycasting setup in `initialize()`. When `true`,
the widget registers `mousemove` / `mouseleave` / `click` listeners on the canvas DOM
element (same as `DiagramWidget`).

Cross-filtering through `crossfilter2` is only active when at least one chart in the
scene has `filterGroup` set. Brush/click events from interactive charts emit
`ChartFilterContext` updates via `useChartFilter()`.

---

### E. Time-Series Heatmap Animation (Open Question 5, Option B)

The heatmap widget implements `IAnimationController`. In `onTick()`, it reads
`tick.blockProgress` (0→1) and derives a time-slice index from it:

```ts
const sliceIndex = Math.floor(context.tick.blockProgress * (timeSlices.length - 1));
const slice = store.getTimeSlice(sourceName, timeField, sliceIndex);
```

The full time-series data is loaded from `ChartDataStore` at runtime. Nothing is baked
into the `SceneTrack` — the widget pulls the correct slice each frame. This keeps compiled
scene tracks lightweight and lets the time-series data be API-sourced.

---

## Package Dependency Graph

```
@brewsite/charts → @brewsite/core   (Widget SDK, text, compiler registry)
@brewsite/charts ↛ @brewsite/diagram  (no dependency — ever)
@brewsite/diagram ↛ @brewsite/charts  (no dependency — ever)
```

Peer dependencies: `react ^19`, `react-dom ^19`, `three ^0.183.1`

Direct dependencies:
- `@brewsite/core: workspace:*`
- `d3-scale: ^4`
- `d3-shape: ^3`
- `d3-array: ^3`
- `d3-format: ^3`
- `d3-time-format: ^4`
- `crossfilter2: ^1.5`

Dev dependencies (mirrors diagram package):
- `@types/react`, `@types/react-dom`, `@types/three`
- `@types/d3-scale`, `@types/d3-shape`, `@types/d3-array`, `@types/d3-format`,
  `@types/d3-time-format`, `@types/crossfilter2`
- `typescript ^5.9`, `vite ^5`, `vitest ^2`, `@vitest/coverage-v8`

---

## Implementation Phases

---

## Phase 0: Promote TextRenderer to `@brewsite/core`

**Goal:** Extract troika-three-text text rendering into core so charts can use 3D text
without depending on `@brewsite/diagram`.

### 0.1 — Add troika-three-text to @brewsite/core

**File:** `packages/core/package.json`

Add to `dependencies`:
```json
"troika-three-text": "^0.52.4"
```

Add to `peerDependencies` (it must be a singleton in the WebGL renderer):
> Note: troika-three-text is already included as a direct dep (not peer) in diagram.
> In core it stays as a direct `dependency` to ensure a single install, matching the
> existing diagram pattern.

### 0.2 — Create `packages/core/src/text/` module

**File:** `packages/core/src/text/types.ts`
```ts
// Troika Text object type alias. No troika import — preserves type-only boundary.
// The actual Text class is imported only in TextRenderer.ts.
export type { Text } from 'troika-three-text';

/** Text object with pre-computed layout info. */
export type TextWithLayout = import('troika-three-text').Text & {
  userData: Record<string, unknown>;
  textRenderInfo: unknown;
};
```

**File:** `packages/core/src/text/TextRenderer.ts`
```ts
// Utility for updating troika Text objects with minimal sync() calls.
// Single responsibility: batched dirty-check updates to troika Text properties.
```

Copy the `ensureText` function verbatim from:
`packages/diagram/src/elements/diagram/rendering/TextRenderer.ts`

This is a pure stateless function — no Three.js scene, no React. Safe to copy.

**File:** `packages/core/src/text/index.ts`
```ts
export { ensureText } from './TextRenderer';
export type { TextWithLayout } from './types';
```

### 0.3 — Update `packages/core/src/index.ts`

Add to the core package's public API (if not already exported via player/index.ts):
```ts
export { ensureText } from './text/TextRenderer';
export type { TextWithLayout } from './text/types';
```

### 0.4 — Update `packages/diagram/` to import from core

**File:** `packages/diagram/src/elements/diagram/rendering/TextRenderer.ts`

Replace the entire file body with:
```ts
// TextRenderer re-exported from @brewsite/core — troika-three-text is owned by core.
export { ensureText } from '@brewsite/core';
export type { TextWithLayout } from '@brewsite/core';
```

Update all diagram imports that previously used relative `TextRenderer` paths —
they remain unchanged because they still import from the same relative path.

**File:** `packages/diagram/package.json`

`troika-three-text` stays in `dependencies` for now (it will still be needed by the
diagram package's rendering layer directly). In a future cleanup pass, it can be removed
if all direct usages are routed through the core export.

> **DEBT:** The diagram package imports `Text` from `troika-three-text` directly in
> `rendering/` files. These are not changing in Phase 0. A follow-up pass can remove
> diagram's direct troika dependency once all usages are routed through core's `text/`.

### 0.5 — Update `packages/core/src/troika-three-text.d.ts`

If this file exists in diagram (it does: `packages/diagram/src/troika-three-text.d.ts`),
a parallel declaration shim may be needed in core — only if TypeScript cannot resolve
the troika types from node_modules. Verify after adding the dependency.

**Verification:** `pnpm --filter @brewsite/core typecheck` must pass. `pnpm --filter @brewsite/diagram typecheck` must pass.

---

## Phase 1: Package Scaffold

### 1.1 — Create `packages/charts/` directory structure

```
packages/charts/
  src/
    data/
    themes/
    renderers/
      bar/
      line/
      area/
      pie/
      scatter/
      heatmap/
      shared/
    elements/
      chart/
    compiler/
    player/
  __tests__/            (top-level integration tests)
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/index.ts
```

### 1.2 — `packages/charts/package.json`

```json
{
  "name": "@brewsite/charts",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "build:lib": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@brewsite/core": "workspace:*",
    "d3-array": "^3.2.4",
    "d3-format": "^3.1.0",
    "d3-scale": "^4.0.2",
    "d3-shape": "^3.2.0",
    "d3-time-format": "^4.1.0",
    "crossfilter2": "^1.5.4"
  },
  "peerDependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "three": "^0.183.1"
  },
  "devDependencies": {
    "@types/crossfilter2": "^1.3.10",
    "@types/d3-array": "^3.2.1",
    "@types/d3-format": "^3.0.4",
    "@types/d3-scale": "^4.0.8",
    "@types/d3-shape": "^3.1.6",
    "@types/d3-time-format": "^4.0.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.183.1",
    "@vitejs/plugin-react": "^4.7.0",
    "@vitest/coverage-v8": "^2.1.9",
    "typescript": "^5.9.3",
    "vite": "^5.4.21",
    "vitest": "^2.1.9"
  }
}
```

### 1.3 — `packages/charts/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "skipLibCheck": false,
    "paths": {
      "@brewsite/core": ["../core/src/index.ts"]
    }
  },
  "include": ["src", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 — `packages/charts/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@brewsite/core": ["../core/dist/index.d.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

### 1.5 — `packages/charts/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/index.ts',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/**/*.d.ts',
      ],
    },
  },
});
```

### 1.6 — `packages/charts/src/index.ts` (empty shell to start)

```ts
// @brewsite/charts — 3D chart elements for BrewSite scenes.
// See requirements/charts/plans/plan_charts_package_v1.md for architecture.
```

Populated in Phase 8.

---

## Phase 2: Data Layer

All files in `packages/charts/src/data/`.

**Dependency constraint:** Files in `data/` may NOT import from Three.js, React DOM
renderers, or chart renderers. They are pure data types and logic only.

### 2.1 — `data/types.ts`

```ts
// Contract types for the chart data layer. No runtime, no Three.js, no React.

/** A named data source registered via ChartProvider. T is the row type. */
export type ChartDataSource<T extends Record<string, unknown> = Record<string, unknown>> = {
  readonly name: string;
  readonly rows: readonly T[];
};

/** A dimension declaration for a chart axis. */
export type ChartDimension = {
  /** Key in the data row object. */
  readonly field: string;
  /** Human-readable axis label. */
  readonly label?: string;
  /** d3-format specifier for tick labels, e.g. ",.0f" or "$,.2f". */
  readonly format?: string;
};

/** Cross-filter group ID — charts sharing this ID are linked. */
export type FilterGroupId = string;

// ─── Transform types ──────────────────────────────────────────────────────────

export type FilterTransform = {
  readonly type: 'filter';
  readonly test: (row: Record<string, unknown>) => boolean;
};

export type GroupByTransform = {
  readonly type: 'groupby';
  readonly key: string;
  readonly aggregate: Readonly<Record<string, 'sum' | 'mean' | 'count' | 'min' | 'max'>>;
};

export type SortTransform = {
  readonly type: 'sort';
  readonly by: string;
  readonly order: 'asc' | 'desc';
};

export type BinTransform = {
  readonly type: 'bin';
  readonly field: string;
  readonly thresholds?: number;
  readonly outputKey?: string;
};

export type DataTransform = FilterTransform | GroupByTransform | SortTransform | BinTransform;

/** A resolved data frame after transform pipeline has been applied. */
export type ResolvedDataFrame = {
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly fields: readonly string[];
};
```

### 2.2 — `data/transforms.ts`

```ts
// Pure data transformation pipeline. No side effects, no Three.js, no React.
// Each transform function takes rows → rows. Composed in order by ChartDataStore.
```

Implement each transform as a pure function:

```ts
export function applyFilter(
  rows: ReadonlyArray<Record<string, unknown>>,
  transform: FilterTransform,
): ReadonlyArray<Record<string, unknown>>;

export function applyGroupBy(
  rows: ReadonlyArray<Record<string, unknown>>,
  transform: GroupByTransform,
): ReadonlyArray<Record<string, unknown>>;

export function applySort(
  rows: ReadonlyArray<Record<string, unknown>>,
  transform: SortTransform,
): ReadonlyArray<Record<string, unknown>>;

export function applyBin(
  rows: ReadonlyArray<Record<string, unknown>>,
  transform: BinTransform,
): ReadonlyArray<Record<string, unknown>>;

export function applyTransforms(
  rows: ReadonlyArray<Record<string, unknown>>,
  transforms: readonly DataTransform[],
): ReadonlyArray<Record<string, unknown>>;
```

`applyGroupBy` uses `d3-array`'s `rollup()` for aggregation.
`applyBin` uses `d3-array`'s `bin()` for histogram computation.
`applyFilter` is a plain `Array.prototype.filter` wrapper.
`applySort` is a plain `Array.prototype.sort` with ascending/descending comparator.

### 2.3 — `data/ChartDataStore.ts`

```ts
// Runtime registry for named data sources. Singleton per application session.
// Wraps crossfilter2 for indexed filtering per filter group.
```

```ts
import crossfilter from 'crossfilter2';
import type { FilterGroupId, DataTransform, ResolvedDataFrame } from './types';
import { applyTransforms } from './transforms';

export type ChartDataStoreEntry = {
  rows: ReadonlyArray<Record<string, unknown>>;
  cf?: crossfilter.Crossfilter<Record<string, unknown>>;
};

export class ChartDataStore {
  private sources = new Map<string, ChartDataStoreEntry>();

  /** Register a named data source. Idempotent — re-registering replaces existing. */
  register(name: string, rows: ReadonlyArray<Record<string, unknown>>): void;

  /** Register with crossfilter2 for a filter group. */
  registerWithFilter(
    name: string,
    rows: ReadonlyArray<Record<string, unknown>>,
    groupId: FilterGroupId,
  ): void;

  /** Get resolved data for a named source after applying transforms. */
  resolve(
    name: string,
    transforms: readonly DataTransform[],
  ): ResolvedDataFrame;

  /**
   * Get a specific time slice from a source by dividing the rows by a time field.
   * sliceIndex is 0-based; total slices = number of unique values in timeField.
   */
  getTimeSlice(
    name: string,
    timeField: string,
    sliceIndex: number,
  ): ResolvedDataFrame;

  /** Apply a crossfilter2 dimension filter for a filter group. */
  applyFilter(
    groupId: FilterGroupId,
    dimension: string,
    values: ReadonlyArray<unknown>,
  ): void;

  /** Clear all filters for a filter group. */
  clearFilters(groupId: FilterGroupId): void;

  /** Subscribe to filter-change events for a filter group. Returns unsubscribe fn. */
  subscribeToFilterGroup(
    groupId: FilterGroupId,
    callback: () => void,
  ): () => void;

  /** Remove all registered sources. Called on engine unmount. */
  clear(): void;
}

/** Global singleton — one store per browser session. */
export const chartDataStore = new ChartDataStore();
```

### 2.4 — `data/ChartFilterContext.tsx`

```tsx
// React context providing ChartDataStore + filter group subscriptions per scene.
// One ChartFilterProvider per scene (mounted by ChartProvider when filterGroup is used).

import { createContext, useContext, type ReactNode } from 'react';
import type { ChartDataStore } from './ChartDataStore';
import type { FilterGroupId } from './types';

export type ChartFilterContextValue = {
  store: ChartDataStore;
  activeFilterGroups: ReadonlySet<FilterGroupId>;
};

export const ChartFilterContext = createContext<ChartFilterContextValue | null>(null);

export function useChartFilterContext(): ChartFilterContextValue {
  const ctx = useContext(ChartFilterContext);
  if (!ctx) {
    throw new Error('[ChartFilterContext] useChartFilterContext must be used inside ChartProvider');
  }
  return ctx;
}
```

### 2.5 — `data/useChartData.ts`

```ts
// Hook: resolved + transformed data for a named source.
// Re-renders when the filter group changes.

import { useSyncExternalStore } from 'react';
import type { DataTransform, ResolvedDataFrame } from './types';
import { useChartFilterContext } from './ChartFilterContext';

export function useChartData(
  sourceName: string,
  transforms?: readonly DataTransform[],
): ResolvedDataFrame;
```

Implementation: calls `store.resolve(sourceName, transforms ?? [])` in `getSnapshot`.
The `subscribe` function wraps `store.subscribeToFilterGroup()` if a filter group is
active for this source.

### 2.6 — `data/useChartFilter.ts`

```ts
// Hook: apply and read filter state for a crossfilter2 filter group.

import type { FilterGroupId } from './types';
import { useChartFilterContext } from './ChartFilterContext';

export type ChartFilterControls = {
  applyFilter(dimension: string, values: ReadonlyArray<unknown>): void;
  clearFilters(): void;
  activeFilterGroups: ReadonlySet<FilterGroupId>;
};

export function useChartFilter(groupId: FilterGroupId): ChartFilterControls;
```

---

## Phase 3: Theme System

All files in `packages/charts/src/themes/`.

### 3.1 — `themes/types.ts`

```ts
// ChartTheme — token object parallel to DiagramTheme in @brewsite/diagram.
// No Three.js imports — purely data.

export type ChartThemeName = 'darkGlass' | 'neonCyber' | 'enterprise' | 'lightMinimal';

/** Per-chart-type material tokens. */
export type ChartSeriesMaterialTokens = {
  /** Ordered color palette — series[0] gets colors[0], wraps around. */
  readonly colors: readonly string[];
  /** PBR metalness [0–1]. */
  readonly metalness: number;
  /** PBR roughness [0–1]. */
  readonly roughness: number;
  /** Glass transmission [0–1]. 0 = opaque, 1 = fully transparent. */
  readonly transmission: number;
  /** emissiveIntensity on series mesh [0–1]. */
  readonly emissiveIntensity: number;
  /** Z extrusion depth for bars, pie slices, area ribbons. */
  readonly depth: number;
};

export type ChartAxisTokens = {
  readonly lineColor: string;
  readonly tickColor: string;
  readonly labelColor: string;
  readonly gridColor: string;
  readonly gridOpacity: number;
  /** Font size for tick labels in Three.js units. Default: 0.12 */
  readonly tickFontSize: number;
  /** Font size for axis labels in Three.js units. Default: 0.16 */
  readonly labelFontSize: number;
};

export type ChartBackgroundTokens = {
  readonly panelColor: string;
  readonly panelOpacity: number;
  /** Whether to render a floor plane behind the chart. */
  readonly showFloor: boolean;
};

export type ChartTheme = {
  /** Material tokens for data series (bars, lines, pie slices, scatter points). */
  readonly series: ChartSeriesMaterialTokens;
  readonly axis: ChartAxisTokens;
  readonly background: ChartBackgroundTokens;
  /** Optional troika font URL override. If absent, uses troika's built-in font. */
  readonly fontUrl?: string;
};
```

### 3.2 — Theme presets

**`themes/darkGlass.ts`** — dark background, glass-effect bars, cyan/blue series palette.
**`themes/neonCyber.ts`** — black background, high emissive, neon green/purple series.
**`themes/enterprise.ts`** — neutral background, muted blues, low emissive.
**`themes/lightMinimal.ts`** — white background, pastel series, minimal metalness.

Each exports a `const xTheme: ChartTheme = { ... }` conforming to the `ChartTheme` type.

**`themes/index.ts`** — re-exports all four presets and the `ChartTheme` type.

Example `darkGlass.ts`:
```ts
import type { ChartTheme } from './types';

export const darkGlassChartTheme: ChartTheme = {
  series: {
    colors: ['#00c8ff', '#ff6b9d', '#ffd460', '#7effd4', '#b39ddb', '#ff8a65'],
    metalness: 0.2,
    roughness: 0.1,
    transmission: 0.3,
    emissiveIntensity: 0.4,
    depth: 0.18,
  },
  axis: {
    lineColor: '#334155',
    tickColor: '#475569',
    labelColor: '#94a3b8',
    gridColor: '#1e293b',
    gridOpacity: 0.6,
    tickFontSize: 0.10,
    labelFontSize: 0.14,
  },
  background: {
    panelColor: '#0f172a',
    panelOpacity: 0.85,
    showFloor: true,
  },
};
```

---

## Phase 4: Shared Renderer Infrastructure

All files in `packages/charts/src/renderers/shared/`.

**Dependency constraint:** Files here may import Three.js and D3. They must NOT import
from React, the compiler, or `@brewsite/core`'s compiler internals.

### 4.1 — `renderers/shared/IChartRenderer.ts`

```ts
// Interface all chart-type renderers must implement.
// Single responsibility: update a ChartGroup subtree from resolved data + theme.

import type * as THREE from 'three';
import type { ChartTheme } from '../../themes/types';
import type { ResolvedDataFrame } from '../../data/types';
import type { ChartAxisState } from '../../elements/chart/types';

/**
 * Context passed to every renderer on each apply() call.
 * Contains all information needed to build or update Three.js geometry.
 */
export type ChartRenderContext = {
  /** The THREE.Group container for this chart's subtree (SeriesGroup child). */
  seriesGroup: THREE.Group;
  /** The THREE.Group for axes and floor plane. */
  axesGroup: THREE.Group;
  /** The THREE.Group for legend items. */
  legendGroup: THREE.Group;
  /** Resolved data frame after transform pipeline. */
  data: ResolvedDataFrame;
  /** X-axis declaration from compiled ChartState. */
  xAxis: ChartAxisState | null;
  /** Y-axis declaration from compiled ChartState. */
  yAxis: ChartAxisState | null;
  /** Chart bounding box in Three.js world units. */
  bounds: { width: number; height: number; depth: number };
  /** Resolved theme tokens for this apply() call. */
  theme: ChartTheme;
};

/**
 * Chart-type renderer interface.
 *
 * Design rules:
 * - `update()` must handle both initial creation and incremental updates.
 * - For non-instanced geometry: dispose old, create new.
 * - For InstancedMesh: update in-place via setMatrixAt / setColorAt.
 * - `dispose()` must release all Three.js geometry, materials, and textures.
 * - No React. No compiler imports. Pure Three.js + D3.
 *
 * // THRESHOLD NOTE: Full rebuild is correct for ≤500 data points per series.
 * // For larger datasets, extend this interface with a LazyChartRenderer wrapper
 * // that tracks changed series and rebuilds only those. Do not add in V1.
 */
export interface IChartRenderer {
  /** Build or update Three.js geometry from the render context. */
  update(ctx: ChartRenderContext): void;

  /**
   * Release all Three.js resources owned by this renderer.
   * Called before the ChartGroup is removed from the scene.
   */
  dispose(): void;

  /**
   * Return the list of Three.js Objects that should be raycasted for hover detection.
   * Empty array = no interaction on this renderer.
   */
  getInteractiveObjects(): THREE.Object3D[];

  /**
   * Given a raycast intersection, return hover info for the hit object.
   * Returns null if the hit does not belong to this renderer.
   */
  resolveHoverInfo(
    intersection: THREE.Intersection,
    data: ResolvedDataFrame,
  ): ChartHitInfo | null;
}

/** Information about a hovered data element. */
export type ChartHitInfo = {
  /** 0-based series index. */
  seriesIndex: number;
  /** 0-based datum index within the series. */
  datumIndex: number;
  /** The raw data row. */
  row: Record<string, unknown>;
  /** World-space intersection point. */
  point: readonly [number, number, number];
};
```

### 4.2 — `renderers/shared/ChartMaterialFactory.ts`

```ts
// PBR material construction from ChartTheme tokens.
// Caches materials by color+metalness+roughness key to avoid redundant GPU allocations.

import * as THREE from 'three';
import type { ChartTheme } from '../../themes/types';

export class ChartMaterialFactory {
  private cache = new Map<string, THREE.MeshPhysicalMaterial>();

  /** Create or retrieve a cached series material for the given series index. */
  getSeriesMaterial(theme: ChartTheme, seriesIndex: number): THREE.MeshPhysicalMaterial;

  /** Create a non-cached axis line material. */
  createAxisMaterial(theme: ChartTheme): THREE.LineBasicMaterial;

  /** Create a floor plane material from background tokens. */
  createFloorMaterial(theme: ChartTheme): THREE.MeshStandardMaterial;

  /** Dispose all cached materials. Call from IChartRenderer.dispose(). */
  dispose(): void;
}
```

Material key format: `${color}|${metalness}|${roughness}|${transmission}|${emissiveIntensity}`.

### 4.3 — `renderers/shared/AxesRenderer.ts`

```ts
// Renders floor plane, axis lines, and tick marks for a chart.
// Text labels are rendered via ensureText from @brewsite/core.

import * as THREE from 'three';
import { ensureText } from '@brewsite/core';
import type { ChartTheme } from '../../themes/types';
import type { ChartAxisState } from '../../elements/chart/types';

export class AxesRenderer {
  private axesGroup: THREE.Group | null = null;
  private floorMesh: THREE.Mesh | null = null;
  private axisLines: THREE.LineSegments | null = null;
  private xTickLabels: THREE.Object3D[] = [];
  private yTickLabels: THREE.Object3D[] = [];

  /** Build or update axes geometry. Disposes existing geometry before rebuild. */
  update(
    axesGroup: THREE.Group,
    xAxis: ChartAxisState | null,
    yAxis: ChartAxisState | null,
    bounds: { width: number; height: number },
    xTicks: Array<{ value: unknown; position: number }>,
    yTicks: Array<{ value: number; position: number }>,
    theme: ChartTheme,
  ): void;

  dispose(): void;
}
```

X and Y ticks are computed by the calling renderer (BarRenderer, LineRenderer, etc.)
from their D3 scales. `AxesRenderer.update()` receives pre-computed tick position arrays.

Troika `Text` objects are created via `new Text()` imported from `troika-three-text`
(installed transitively through `@brewsite/core`) and updated via `ensureText()`.

### 4.4 — `renderers/shared/LegendRenderer.ts`

```ts
// Renders color-keyed legend items as small geometry swatches + text labels.
// Positioned in LegendGroup at the top-right of the chart bounds.

import * as THREE from 'three';
import type { ChartTheme } from '../../themes/types';

export type LegendItem = {
  label: string;
  seriesIndex: number;
};

export class LegendRenderer {
  update(
    legendGroup: THREE.Group,
    items: readonly LegendItem[],
    bounds: { width: number },
    theme: ChartTheme,
  ): void;

  dispose(): void;
}
```

Legend items are positioned from top-right, stepping downward by `0.3` units per item.
Each item consists of a `BoxGeometry` swatch (0.1 × 0.1 × 0.02) + a `troika Text` label.

---

## Phase 5: Chart-Type Renderers

All renderers live in `packages/charts/src/renderers/{type}/`.

**Shared contract:** Every renderer class implements `IChartRenderer`.

### 5.1 — `renderers/bar/BarRenderer.ts`

D3 scales used:
- X: `scaleBand()` — ordinal category to X position
- Y: `scaleLinear()` — value to Y height

Three.js construction:
- One `BoxGeometry` per bar per series. Geometry width = `scaleBand.bandwidth()`.
  Height = `scaleLinear(value)`. Depth = `theme.series.depth`.
- Bars are `THREE.Mesh` with `MeshPhysicalMaterial` from `ChartMaterialFactory`.
- Grouped bars: multiple series side-by-side within each band using inner `scaleBand`.
- Stacked bars: each bar placed atop the cumulative sum of previous series using `d3-shape`'s `stack()`.

`getInteractiveObjects()` returns all bar `Mesh` objects.
`resolveHoverInfo()` looks up the hit mesh in a `Map<THREE.Mesh, { seriesIndex, datumIndex, row }>`.

`update()` algorithm:
1. Dispose all previous bar meshes.
2. Compute `scaleBand` domain from `data.rows[*][xAxis.field]`.
3. Compute `scaleLinear` domain `[0, max(data.rows[*][yAxis.field])]`.
4. For each series and each datum: create `BoxGeometry`, create `Mesh`, position, add to `seriesGroup`.
5. Compute tick arrays, call `AxesRenderer.update()`.

### 5.2 — `renderers/line/LineRenderer.ts`

D3 scales used:
- X: `scaleLinear()` or `scaleTime()` (auto-detected from field type)
- Y: `scaleLinear()`

Three.js construction:
- Per-series: Extract XY positions from D3 scale. Construct `CatmullRomCurve3` from `Vector3` array.
  `TubeGeometry(curve, tubeSegments: Math.max(12, points.length * 3), tubeRadius, radialSegments: 8, closed: false)`.
- Tube radius = `0.03` by default; can encode a second data dimension via a `sizeField` prop.
- For multi-series: Z offset = `seriesIndex * 0.15` to separate tubes in depth.

`getInteractiveObjects()` returns all tube `Mesh` objects.
`resolveHoverInfo()` finds the nearest data point on the curve to the intersection point.

### 5.3 — `renderers/area/AreaRenderer.ts`

D3 scales: same as line.

Three.js construction:
- Per-series: `d3-shape`'s `area()` generator computes upper/lower boundary arrays.
  Upper = Y values. Lower = 0 (baseline).
- Boundary points are lifted into `Vector3` arrays.
- A `THREE.Shape` is constructed by tracing upper boundary forward, lower boundary
  backward. `ExtrudeGeometry(shape, { depth: theme.series.depth, bevelEnabled: false })`.
- `MeshPhysicalMaterial` with `transparent: true`, `opacity: 0.65`, `transmission: theme.series.transmission`.

For stacked area: compute cumulative sums with `d3-shape`'s `stack()`, use stacked
baseline as lower boundary.

### 5.4 — `renderers/pie/PieRenderer.ts`

D3 scale/layout:
- `pie().value(d => d[valueField])` — computes `{ startAngle, endAngle }` per datum.
- Inner radius = `0` for pie; `outerRadius * 0.5` for donut variant.
- Outer radius = `min(bounds.width, bounds.height) / 2 * 0.8`.

Three.js construction per slice:
- `THREE.Shape` drawn with `shape.arc(cx, cy, outerR, startAngle, endAngle, false)` +
  inner arc if donut.
- `ExtrudeGeometry(shape, { depth: theme.series.depth, bevelEnabled: false })`.
- Each slice is a separate `THREE.Mesh` with distinct series color material.
- Slices are laid flat on XZ plane, rotated to face camera (Y-up, X-right).

Exploded slice: `onHover` callback sets a `THREE.Vector3` offset for the hovered slice.
The offset is applied in `update()` if a `selectedDatumIndex` is passed in. The offset
direction is the radial midpoint of the slice's angular span.

### 5.5 — `renderers/scatter/ScatterRenderer.ts`

D3 scales:
- X: `scaleLinear()` from `xAxis.field`
- Y: `scaleLinear()` from `yAxis.field`
- Size (bubble variant): `scaleSqrt()` from optional `sizeField`, range `[0.05, 0.3]`

Three.js construction:
- One `InstancedMesh` with `SphereGeometry(0.08, 12, 12)` and capacity =
  `data.rows.length`.
- `setMatrixAt(i, matrix)` — positions each sphere. Scale encodes bubble size.
- `setColorAt(i, color)` — per-instance color from optional `colorField` using
  `scaleSequential` or the series palette.
- `instanceMatrix.needsUpdate = true` after all instances are set.
- `instanceColor!.needsUpdate = true` after all colors are set.

`update()` never rebuilds the `InstancedMesh` unless `data.rows.length` changed.
Instead it calls `setMatrixAt`/`setColorAt` for each instance.

`getInteractiveObjects()` returns `[instancedMesh]`.
`resolveHoverInfo()` uses `intersection.instanceId` to find the datum.

### 5.6 — `renderers/heatmap/HeatmapRenderer.ts`

D3 scales:
- X: `scaleBand()` from X categorical field
- Y: `scaleBand()` from Y categorical field
- Color: `scaleSequential(interpolateBlues)` or theme-specific interpolator from value field
- Height (optional): `scaleLinear()` from optional `heightField`

Three.js construction:
- One `InstancedMesh` with `PlaneGeometry(1, 1)` tiles, capacity = `xCategories.length * yCategories.length`.
- Tiles are positioned on the XZ plane (Y = 0 baseline). Each tile is scaled to
  `(scaleBand.bandwidth()) × (scaleBand.bandwidth())`.
- Color: `setColorAt(i, new THREE.Color(colorScale(value)))`.
- Height: `setMatrixAt(i, matrix)` with Y scale set to `heightScale(heightValue)`.
- `instanceMatrix.needsUpdate` + `instanceColor!.needsUpdate` after all updates.

Time-series support:
- When `timeField` is set, `HeatmapRenderer` implements `IAnimationController`.
- `onTick()` derives `sliceIndex` from `tick.blockProgress`, calls
  `store.getTimeSlice(sourceName, timeField, sliceIndex)`, and calls
  `update()` with the slice data.

---

## Phase 6: Element Module

**File:** `packages/charts/src/elements/chart/`

This is the mandatory element module stack. Hard dependency direction applies.

### 6.1 — `elements/chart/types.ts`

```ts
// Contract layer for the chart element. No runtime imports, no Three.js, no React.

import type { ChartThemeName } from '../../themes/types';
import type { DataTransform, FilterGroupId, ChartDimension } from '../../data/types';

/** Supported chart types in V1. */
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'heatmap';

/** Compiled axis configuration. */
export type ChartAxisState = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
};

/** Compiled legend configuration. */
export type ChartLegendState = {
  readonly visible: boolean;
  readonly position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
};

/** Per-series compiled configuration. */
export type ChartSeriesState = {
  readonly label: string;
  readonly field: string;
  readonly sizeField?: string;
  readonly colorField?: string;
};

/** Compiled state of a single chart widget. Stored in SceneTrackTick. */
export type ChartState = {
  /** Chart type selects the renderer. */
  readonly type: ChartType;
  /** Chart position in world space [x, y, z]. */
  readonly position: readonly [number, number, number];
  /** Chart rotation in radians [x, y, z]. */
  readonly rotation: readonly [number, number, number];
  /** Chart bounding box in Three.js world units. */
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  /** Named data source (not the data itself — resolved at runtime). */
  readonly dataSource: string;
  /** Transform pipeline applied before rendering. */
  readonly transforms: readonly DataTransform[];
  /** Filter group linkage (optional). */
  readonly filterGroup?: FilterGroupId;
  /** X axis configuration. */
  readonly xAxis: ChartAxisState | null;
  /** Y axis configuration. */
  readonly yAxis: ChartAxisState | null;
  /** Legend configuration. */
  readonly legend: ChartLegendState | null;
  /** Resolved theme name. */
  readonly theme: ChartThemeName;
  /** Opacity [0–1]. Used for enter/exit transitions. */
  readonly opacity: number;
  /** Whether raycasting + hover + cross-filter interaction are active. */
  readonly interactive: boolean;
  /** Time field name for animated heatmaps. Only valid when type === 'heatmap'. */
  readonly timeField?: string;
};

/** DSL representation — direct from JSX props before compilation. */
export type ChartDSL = {
  readonly id: string;
  readonly type: ChartType;
  readonly theme?: ChartThemeName;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
  readonly opacity?: number;
  readonly interactive?: boolean;
  readonly filterGroup?: FilterGroupId;
  readonly children?: unknown;
};

export type ChartDataDSL = {
  readonly source: string;
  readonly xField?: string;
  readonly yField?: string;
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly dimensions?: readonly string[];
  readonly transform?: readonly DataTransform[];
};

export type ChartAxisDSL = {
  readonly axis: 'x' | 'y';
  readonly label?: string;
  readonly format?: string;
  readonly field?: string;
};

export type ChartLegendDSL = {
  readonly visible?: boolean;
  readonly position?: ChartLegendState['position'];
};

/** Default state used as a fallback when chart is absent from a scene. */
export const DEFAULT_CHART_STATE: ChartState = {
  type: 'bar',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  bounds: { width: 4, height: 3, depth: 0.5 },
  dataSource: '',
  transforms: [],
  filterGroup: undefined,
  xAxis: null,
  yAxis: null,
  legend: null,
  theme: 'darkGlass',
  opacity: 0,
  interactive: false,
};
```

### 6.2 — `elements/chart/dsl.tsx`

```tsx
// DSL React components for chart authoring. No Three.js. No runtime imports.
// These components are never rendered — they are compiled by the NodeHandler.

import type { ReactNode } from 'react';
import type { ChartType, ChartAxisDSL, ChartLegendDSL, ChartDataDSL } from './types';
import type { FilterGroupId } from '../../data/types';
import type { ChartThemeName } from '../../themes/types';
import type { DataTransform } from '../../data/types';

export type ChartProps = {
  readonly id: string;
  readonly type: ChartType;
  readonly theme?: ChartThemeName;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
  readonly opacity?: number;
  readonly interactive?: boolean;
  readonly filterGroup?: FilterGroupId;
  readonly children?: ReactNode;
};

export type ChartDataProps = Omit<ChartDataDSL, 'transform'> & {
  readonly transform?: readonly DataTransform[];
};

export type ChartAxisProps = ChartAxisDSL;

export type ChartLegendProps = ChartLegendDSL;

/** Root chart DSL component. */
export function Chart(_props: ChartProps): null { return null; }
Chart.displayName = 'Chart';

/** Data source binding. Child of Chart. */
export function ChartData(_props: ChartDataProps): null { return null; }
ChartData.displayName = 'ChartData';

/** Axis declaration. Child of Chart. */
export function ChartAxis(_props: ChartAxisProps): null { return null; }
ChartAxis.displayName = 'ChartAxis';

/** Legend declaration. Child of Chart. */
export function ChartLegend(_props: ChartLegendProps): null { return null; }
ChartLegend.displayName = 'ChartLegend';
```

### 6.3 — `elements/chart/compile.ts`

```ts
// Pure transformation: ChartDSL props + child DSL → ChartState.
// No Three.js. No React rendering. No side effects.

import type { ChartState, ChartDSL, ChartDataDSL, ChartAxisDSL, ChartAxisState } from './types';
import { DEFAULT_CHART_STATE } from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendVec3, blendOpacity } from '@brewsite/core';

/**
 * Compile a ChartDSL node (with its children already extracted by the NodeHandler)
 * into a ChartState. This function is called by the NodeHandler, not directly.
 */
export function compileChart(
  dsl: ChartDSL,
  dataDsl: ChartDataDSL | null,
  axisDsls: readonly ChartAxisDSL[],
  legendDsl: { visible?: boolean; position?: string } | null,
): ChartState;

/**
 * Functional transition spec for chart opacity.
 * Position and rotation use FunctionalTransitionSpec blendVec3.
 * Chart type switches discretely at t = 0.5.
 */
export const functionalChartTransitionSpec: FunctionalTransitionSpec<ChartState>;
```

`functionalChartTransitionSpec` implementation:
```ts
export const functionalChartTransitionSpec: FunctionalTransitionSpec<ChartState> = {
  exitFn: (from) => (t) => ({ ...from, opacity: blendOpacity(from.opacity, 0, t) ?? 0 }),
  enterFn: (to) => (t) => ({ ...to, opacity: blendOpacity(0, to.opacity, t) ?? 1 }),
  interpolateFn: (from, to) => (t) => ({
    ...to,
    position: blendVec3(from.position as [number,number,number], to.position as [number,number,number], t) ?? to.position,
    rotation: blendVec3(from.rotation as [number,number,number], to.rotation as [number,number,number], t) ?? to.rotation,
    opacity: blendOpacity(from.opacity, to.opacity, t) ?? 1,
    // Chart type switches discretely:
    type: t < 0.5 ? from.type : to.type,
  }),
};
```

### 6.4 — `elements/chart/render.ts`

```ts
// Three.js scene graph management for a ChartWidget instance.
// Owns the ChartGroup subtree. Delegates to chart-type renderers.
// No React. No compiler imports.

import * as THREE from 'three';
import type { ChartState } from './types';
import type { IChartRenderer, ChartHitInfo } from '../../renderers/shared/IChartRenderer';
import type { ChartTheme } from '../../themes/types';
import { chartDataStore } from '../../data/ChartDataStore';
import { ChartMaterialFactory } from '../../renderers/shared/ChartMaterialFactory';
import { AxesRenderer } from '../../renderers/shared/AxesRenderer';
import { LegendRenderer } from '../../renderers/shared/LegendRenderer';
import { BarRenderer } from '../../renderers/bar/BarRenderer';
import { LineRenderer } from '../../renderers/line/LineRenderer';
import { AreaRenderer } from '../../renderers/area/AreaRenderer';
import { PieRenderer } from '../../renderers/pie/PieRenderer';
import { ScatterRenderer } from '../../renderers/scatter/ScatterRenderer';
import { HeatmapRenderer } from '../../renderers/heatmap/HeatmapRenderer';
import { darkGlassChartTheme } from '../../themes/darkGlass';
import { neonCyberChartTheme } from '../../themes/neonCyber';
import { enterpriseChartTheme } from '../../themes/enterprise';
import { lightMinimalChartTheme } from '../../themes/lightMinimal';

export class ChartRenderer {
  private chartGroup: THREE.Group;
  private axesGroup: THREE.Group;
  private seriesGroup: THREE.Group;
  private legendGroup: THREE.Group;
  private activeRenderer: IChartRenderer | null = null;
  private lastType: string | null = null;
  private materialFactory: ChartMaterialFactory;
  private axesRenderer: AxesRenderer;
  private legendRenderer: LegendRenderer;

  constructor() { /* initialize groups, factories */ }

  /** Called once from ChartWidget.initialize(). Adds ChartGroup to scene. */
  mount(scene: THREE.Scene): void;

  /**
   * Called from ChartWidget.apply(). Updates chart geometry.
   * If type changed from last call, disposes old renderer and creates new one.
   */
  update(state: ChartState): void;

  /** Returns interactive objects for raycasting. */
  getInteractiveObjects(): THREE.Object3D[];

  /** Resolve a raycast intersection to ChartHitInfo. */
  resolveHoverInfo(intersection: THREE.Intersection): ChartHitInfo | null;

  /** Dispose all Three.js resources. */
  dispose(scene: THREE.Scene): void;

  private resolveTheme(themeName: string): ChartTheme;

  private getOrCreateRenderer(type: string): IChartRenderer;
}
```

`resolveTheme()` maps `ChartThemeName` → imported theme constant:
```ts
const THEMES: Record<string, ChartTheme> = {
  darkGlass: darkGlassChartTheme,
  neonCyber: neonCyberChartTheme,
  enterprise: enterpriseChartTheme,
  lightMinimal: lightMinimalChartTheme,
};
```

### 6.5 — `elements/chart/ChartWidget.ts`

```ts
// ChartWidget — implements ISceneElement + IRenderable + IAnimationController.
// Bridge between compiled ChartState and the Three.js ChartRenderer.

import * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  IAnimationController,
  IDslComposite,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
} from '@brewsite/core';
import { Chart, ChartData, ChartAxis, ChartLegend } from './dsl';
import { functionalChartTransitionSpec, DEFAULT_CHART_STATE } from './compile';
import { ChartRenderer } from './render';
import type { ChartState } from './types';
import type { ChartHitInfo } from '../../renderers/shared/IChartRenderer';

export type ChartHoverInfo = ChartHitInfo & {
  chartId: string;
};

export class ChartWidget
  implements
    ISceneElement<ChartState>,
    IRenderable<ChartState>,
    IAnimationController,
    IDslComposite
{
  readonly widgetId: string;
  readonly defaultState: ChartState = DEFAULT_CHART_STATE;
  readonly transitionSpec = functionalChartTransitionSpec;
  readonly DslComponent = Chart;
  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    { component: ChartData as React.ComponentType<unknown>, displayName: 'ChartData' },
    { component: ChartAxis as React.ComponentType<unknown>, displayName: 'ChartAxis' },
    { component: ChartLegend as React.ComponentType<unknown>, displayName: 'ChartLegend' },
  ];

  /** tickPriority = 2: runs after CameraWidget (0) and DiagramWidget (1). */
  readonly tickPriority = 2;

  /**
   * Optional callback for hover interactions.
   * Called with ChartHoverInfo when a data element is hovered.
   * Called with null when hover exits.
   * Only active when chart is compiled with interactive={true}.
   */
  public onHover: ((info: ChartHoverInfo | null) => void) | undefined = undefined;

  /**
   * Optional callback for click/selection interactions.
   * Only active when chart is compiled with interactive={true}.
   */
  public onSelect: ((info: ChartHoverInfo) => void) | undefined = undefined;

  private renderer: ChartRenderer;
  private scene: THREE.Scene | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private lastState: ChartState | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseLeaveHandler: (() => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  constructor(widgetId: string) {
    this.widgetId = widgetId;
    this.renderer = new ChartRenderer();
  }

  initialize({ scene, renderer }: WidgetInitContext): void;
  onTick(context: AnimationTickContext): void;  // heatmap time-slice selection
  apply(state: ChartState, ctx: WidgetRenderContext): void;
  dispose(): void;

  private handleMouseMove(event: MouseEvent): void;
  private handleMouseLeave(): void;
  private handleClick(event: MouseEvent): void;
  private performRaycast(event: MouseEvent): ChartHoverInfo | null;
}
```

**`onTick()` implementation:**
Only active when `lastState?.type === 'heatmap'` and `lastState.timeField` is set.
Reads `context.tick?.blockProgress`, derives `sliceIndex`, calls
`chartDataStore.getTimeSlice(...)`, and triggers a re-render via the HeatmapRenderer.

**`apply()` implementation:**
Calls `this.renderer.update(state)`. Sets up or tears down DOM event listeners based
on `state.interactive` vs the previous state.

### 6.6 — `elements/chart/index.ts`

```ts
// Public re-exports for the chart element.
export { Chart, ChartData, ChartAxis, ChartLegend } from './dsl';
export type { ChartProps, ChartDataProps, ChartAxisProps, ChartLegendProps } from './dsl';
export type { ChartState, ChartType, ChartAxisState, ChartLegendState, DEFAULT_CHART_STATE } from './types';
export { compileChart, functionalChartTransitionSpec } from './compile';
export { ChartRenderer } from './render';
export { ChartWidget } from './ChartWidget';
export type { ChartHoverInfo } from './ChartWidget';
```

---

## Phase 7: Compiler Handler Registration

### 7.1 — `packages/charts/src/compiler/handlers.ts`

```ts
// Registers Chart, ChartData, ChartAxis, ChartLegend DSL node handlers.

import type { ReactElement } from 'react';
import { registerNode } from '@brewsite/core';
import type { CompileApi, CompileHelpers } from '@brewsite/core';
import { Chart, ChartData, ChartAxis, ChartLegend } from '../elements/chart/dsl';
import { compileChart } from '../elements/chart/compile';
import type { ChartDSL, ChartDataDSL, ChartAxisDSL } from '../elements/chart/types';

let registered = false;

export function registerChartHandlers(): void {
  if (registered) return;
  registered = true;

  registerNode(Chart, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
    const props = node.props as Record<string, unknown>;
    const chartId = props.id as string;

    // Extract child DSL nodes
    const children = helpers.collectChildren(node);
    let dataDsl: ChartDataDSL | null = null;
    const axisDsls: ChartAxisDSL[] = [];
    let legendDsl: { visible?: boolean; position?: string } | null = null;

    for (const child of children) {
      if (!child || typeof child !== 'object') continue;
      const el = child as ReactElement;
      if (el.type === ChartData) {
        dataDsl = el.props as ChartDataDSL;
      } else if (el.type === ChartAxis) {
        axisDsls.push(el.props as ChartAxisDSL);
      } else if (el.type === ChartLegend) {
        legendDsl = el.props as { visible?: boolean; position?: string };
      }
    }

    const chartState = compileChart(
      props as ChartDSL,
      dataDsl,
      axisDsls,
      legendDsl,
    );

    api.setWidgetState(chartId, chartState);
  });

  // ChartData, ChartAxis, ChartLegend are handled by the Chart handler above.
  // Register them as no-ops so the compiler doesn't warn about unknown components.
  registerNode(ChartData, () => {});
  registerNode(ChartAxis, () => {});
  registerNode(ChartLegend, () => {});
}
```

### 7.2 — `packages/charts/src/register.ts`

```ts
// Auto-registers @brewsite/charts DSL node handlers at module-load time.
// Imported as a side-effect from packages/charts/src/index.ts.
import { registerChartHandlers } from './compiler/handlers';
registerChartHandlers();
```

---

## Phase 8: Player Layer

All files in `packages/charts/src/player/`.

### 8.1 — `player/ChartProvider.tsx`

```tsx
// Provides ChartDataStore context and registers named data sources.
// Wraps EngineProvider or ScenePlayer children.

import { type ReactNode, useEffect, useRef } from 'react';
import { ChartFilterContext, type ChartFilterContextValue } from '../data/ChartFilterContext';
import { chartDataStore } from '../data/ChartDataStore';

export type ChartProviderProps = {
  /**
   * Named data sources. Keys are source names used in ChartData[source] DSL prop.
   * Values are arrays of plain data rows.
   */
  data: Readonly<Record<string, ReadonlyArray<Record<string, unknown>>>>;
  children: ReactNode;
};

/**
 * Registers named data sources with the ChartDataStore and provides
 * ChartFilterContext to child components.
 *
 * Place ChartProvider outside EngineProvider/ScenePlayer:
 *
 * @example
 * <ChartProvider data={{ 'quarterly-revenue': rows }}>
 *   <EngineProvider plugins={[corePlugin(), chartPlugin()]}>
 *     <ScenePlayer ... />
 *   </EngineProvider>
 * </ChartProvider>
 */
export function ChartProvider({ data, children }: ChartProviderProps): ReactNode;
```

Implementation:
- On mount and when `data` changes: call `chartDataStore.register(name, rows)` for each entry.
- On unmount: call `chartDataStore.clear()`.
- Provide `ChartFilterContext.Provider` with `{ store: chartDataStore, activeFilterGroups: new Set(Object.keys(data)) }`.

### 8.2 — `player/ChartTooltipOverlay.tsx`

```tsx
// HTML tooltip overlay positioned over a hovered chart element.
// Uses camera projection (LabelPositioner-style) to convert world coords to screen.

import type { ReactNode } from 'react';
import type { ChartWidget, ChartHoverInfo } from '../elements/chart/ChartWidget';

export type ChartTooltipOverlayProps = {
  /** The ChartWidget instance to subscribe to for hover events. */
  widget: ChartWidget;
  /**
   * Render function for the tooltip content.
   * Called with ChartHoverInfo when hovering, null when not hovering.
   */
  render: (info: ChartHoverInfo | null) => ReactNode;
  /** Canvas element ref for projection. If absent, tooltip is disabled. */
  canvasRef?: React.RefObject<HTMLCanvasElement>;
};

/**
 * Subscribes to ChartWidget.onHover and renders an HTML overlay
 * at the projected screen position of the hovered data element.
 *
 * Projection: uses the same perspective divide as LabelPositioner
 * (world position → NDC → CSS top/left percentages).
 *
 * @example
 * <div style={{ position: 'relative' }}>
 *   <ScenePlayer ... />
 *   <ChartTooltipOverlay widget={chartWidget} render={(info) =>
 *     info ? <div className="tooltip">{String(info.row.value)}</div> : null
 *   } />
 * </div>
 */
export function ChartTooltipOverlay(props: ChartTooltipOverlayProps): ReactNode;
```

The overlay div is `position: absolute; pointer-events: none` with `top` and `left`
computed from the world-space `ChartHoverInfo.point`. World-to-screen projection uses
the Three.js `PerspectiveCamera` stored in `scene.userData.__brewsite_camera` (same
key as DiagramWidget).

### 8.3 — `player/chartPlugin.ts`

```ts
// WidgetPlugin factory for @brewsite/charts.
// Mirrors the structure of corePlugin() and modelPlugin() from @brewsite/core.

import type { WidgetPlugin } from '@brewsite/core';
import { registerChartHandlers } from '../compiler/handlers';
import { ChartWidget } from '../elements/chart/ChartWidget';

export type ChartPluginOptions = {
  /**
   * Chart widget definitions to register.
   * Each entry defines one chart instance: { id, defaultState? }.
   * The chart id must match the `id` prop used in Chart DSL.
   */
  charts: ReadonlyArray<{ id: string }>;
};

/**
 * WidgetPlugin for @brewsite/charts.
 *
 * @example
 * <EngineProvider
 *   plugins={[
 *     corePlugin(),
 *     chartPlugin({ charts: [{ id: 'revenue-chart' }] }),
 *   ]}
 * />
 */
export function chartPlugin(options: ChartPluginOptions): WidgetPlugin {
  return {
    createWidgets: () =>
      options.charts.map(({ id }) => new ChartWidget(id)),
    registerHandlers: () => {
      registerChartHandlers();
    },
  };
}
```

---

## Phase 9: Public Index

**File:** `packages/charts/src/index.ts`

```ts
// @brewsite/charts — native 3D chart elements for BrewSite scenes.
import './register';

// ─── DSL authoring surface ───────────────────────────────────────────────────
export { Chart, ChartData, ChartAxis, ChartLegend } from './elements/chart/dsl';
export type {
  ChartProps,
  ChartDataProps,
  ChartAxisProps,
  ChartLegendProps,
} from './elements/chart/dsl';

// ─── Compiled types ──────────────────────────────────────────────────────────
export type {
  ChartState,
  ChartType,
  ChartAxisState,
  ChartLegendState,
  ChartDSL,
  ChartDataDSL,
  ChartAxisDSL,
} from './elements/chart/types';
export { DEFAULT_CHART_STATE } from './elements/chart/types';

// ─── Widget + renderer ───────────────────────────────────────────────────────
export { ChartWidget } from './elements/chart/ChartWidget';
export type { ChartHoverInfo } from './elements/chart/ChartWidget';
export { ChartRenderer } from './elements/chart/render';

// ─── Plugin factory ──────────────────────────────────────────────────────────
export { chartPlugin } from './player/chartPlugin';
export type { ChartPluginOptions } from './player/chartPlugin';

// ─── Player components ───────────────────────────────────────────────────────
export { ChartProvider } from './player/ChartProvider';
export type { ChartProviderProps } from './player/ChartProvider';
export { ChartTooltipOverlay } from './player/ChartTooltipOverlay';
export type { ChartTooltipOverlayProps } from './player/ChartTooltipOverlay';

// ─── Data layer ──────────────────────────────────────────────────────────────
export { chartDataStore } from './data/ChartDataStore';
export { useChartData } from './data/useChartData';
export { useChartFilter } from './data/useChartFilter';
export type {
  ChartDataSource,
  ChartDimension,
  DataTransform,
  FilterTransform,
  GroupByTransform,
  SortTransform,
  BinTransform,
  ResolvedDataFrame,
  FilterGroupId,
} from './data/types';

// ─── Themes ──────────────────────────────────────────────────────────────────
export { darkGlassChartTheme } from './themes/darkGlass';
export { neonCyberChartTheme } from './themes/neonCyber';
export { enterpriseChartTheme } from './themes/enterprise';
export { lightMinimalChartTheme } from './themes/lightMinimal';
export type { ChartTheme, ChartThemeName } from './themes/types';

// ─── Compiler handler registration ───────────────────────────────────────────
// registerChartHandlers() is called automatically via ./register.ts at module-load time.
```

---

## Phase 10: Monorepo Integration

### 10.1 — `turbo.json` — no changes needed

Turborepo picks up new packages in `packages/*` automatically. The existing `build`,
`build:lib`, `typecheck`, `test`, `coverage` task definitions apply.

### 10.2 — Root `package.json` — add to `publish:core-diagram`

If a `publish:charts` script is desired, add it alongside `publish:core-diagram` in
the root package.json scripts. Follow the existing pattern in `scripts/publish-core-diagram.mjs`.

### 10.3 — `apps/examples/` — add chart demo scene

Create `apps/examples/src/charts/` with:
- `scenes/ChartDemoScene.tsx` — demonstrates all six V1 chart types
- `widgetSetup.ts` — instantiates `ChartWidget` instances and registers with `chartPlugin`

The demo must call `registerChartHandlers()` before any `WidgetRegistry` use:
```ts
// In the demo entry point or widgetSetup.ts:
import '@brewsite/charts'; // side-effect: registers handlers via register.ts
```

---

## Testing Strategy

Tests live in `packages/charts/src/` co-located in `__tests__/` directories.
`vitest run` environment: `node`. No WebGL context. No DOM (for pure logic tests).

### Test Matrix

| Module | Strategy | Location |
|---|---|---|
| `data/transforms.ts` | Pure function: real inputs → assert real output arrays | `data/__tests__/transforms.test.ts` |
| `data/ChartDataStore.ts` | Construct real store, register sources, call resolve/getTimeSlice, assert output | `data/__tests__/ChartDataStore.test.ts` |
| `elements/chart/compile.ts` | Real DSL prop objects → assert real `ChartState` fields | `elements/chart/__tests__/compile.test.ts` |
| `functionalChartTransitionSpec` | Call interpolateFn at t=0, 0.5, 1 with real states, assert opacity/position | `elements/chart/__tests__/compile.test.ts` |
| `renderers/bar/BarRenderer.ts` | Construct with mock Three.js objects (real Group), call update(), assert group.children.length and geometry dimensions | `renderers/__tests__/BarRenderer.test.ts` |
| `renderers/scatter/ScatterRenderer.ts` | Construct InstancedMesh, call update() twice with different data lengths, assert instanceCount changes | `renderers/__tests__/ScatterRenderer.test.ts` |
| `compiler/handlers.ts` | Construct minimal real CompileApi, call handler, assert api.state mutation | `compiler/__tests__/handlers.test.ts` |
| `ChartMaterialFactory.ts` | Call getSeriesMaterial for same index twice, assert same object returned (cache hit) | `renderers/__tests__/ChartMaterialFactory.test.ts` |

### What is NOT tested

- `render.ts` — excluded from coverage. Three.js render layer is not testable without WebGL.
- `ChartWidget.ts` raycasting — excluded from coverage. DOM event simulation requires browser.
- `ChartProvider.tsx`, `ChartTooltipOverlay.tsx` — excluded. React component tests require jsdom.

### Test pattern for compile.ts

```ts
// elements/chart/__tests__/compile.test.ts
import { describe, it, expect } from 'vitest';
import { compileChart } from '../compile';
import type { ChartDSL } from '../types';

describe('compileChart', () => {
  it('resolves default theme when no theme prop given', () => {
    const dsl: ChartDSL = { id: 'test', type: 'bar' };
    const state = compileChart(dsl, null, [], null);
    expect(state.theme).toBe('darkGlass');
  });

  it('compiles xAxis from ChartAxis DSL', () => {
    const dsl: ChartDSL = { id: 'test', type: 'bar' };
    const axis = { axis: 'x' as const, field: 'quarter', label: 'Quarter' };
    const state = compileChart(dsl, null, [axis], null);
    expect(state.xAxis).toEqual({ axis: 'x', field: 'quarter', label: 'Quarter', format: undefined });
  });
});
```

### Test pattern for transforms.ts

```ts
// data/__tests__/transforms.test.ts
import { describe, it, expect } from 'vitest';
import { applyFilter, applyGroupBy, applySort, applyTransforms } from '../transforms';

describe('applyFilter', () => {
  it('filters rows by predicate', () => {
    const rows = [{ year: 2024 }, { year: 2025 }];
    const result = applyFilter(rows, { type: 'filter', test: (d) => d['year'] === 2025 });
    expect(result).toHaveLength(1);
    expect(result[0]!['year']).toBe(2025);
  });
});
```

---

## Error Handling

- `ChartWidget.apply()` with an unknown `dataSource`: calls `console.warn('[ChartWidget] Data source not found: ${state.dataSource}')` and returns without updating geometry.
- `ChartDataStore.resolve()` with an unregistered source: returns `{ rows: [], fields: [] }` and logs `console.warn`.
- `ChartRenderer.getOrCreateRenderer()` with an unknown type: logs `console.warn('[ChartRenderer] Unknown chart type: ${type}')` and creates a `BarRenderer` as fallback.
- `AxesRenderer` / any renderer `update()`: wraps geometry construction in `try/catch`; on error logs `console.error` with chart ID and skips the update. Prevents a malformed data row from crashing the render loop.
- `ChartTooltipOverlay` projection: if camera is not available in `scene.userData`, silently hides the tooltip (does not throw).

---

## Open Technical Details (not blocking V1)

These items require additional design work in a follow-up plan:

1. **`troika-three-text` singleton management**: troika Text objects created in
   `AxesRenderer` and `LegendRenderer` must call `text.dispose()` in their own
   `dispose()`. Verify that troika's internal font atlas is not double-freed when
   both `@brewsite/core` and `@brewsite/charts` call dispose on different Text objects.

2. **`crossfilter2` and TypeScript strict mode**: The `@types/crossfilter2` types are
   community-maintained. Validate that strict mode + `NodeNext` module resolution
   does not produce type errors with this package before committing to the dependency.

3. **Chart resize handling**: `ChartRenderer.update()` currently uses static `bounds`
   from `ChartState`. If the window is resized, chart geometry does not recompute.
   A `ResizeObserver` on the canvas DOM element could trigger re-application of the
   last `ChartState` — add in a follow-up.

4. **`pnpm-workspace.yaml` apps entry**: The current `pnpm-workspace.yaml` lists `apps`
   (the directory) not `apps/*`. Verify that `apps/examples/` resolves `@brewsite/charts`
   via workspace protocol correctly — add a workspace dep in `apps/examples/package.json`.

---

## File Creation Checklist

### Phase 0 (@brewsite/core changes)
- [ ] `packages/core/src/text/types.ts`
- [ ] `packages/core/src/text/TextRenderer.ts`
- [ ] `packages/core/src/text/index.ts`
- [ ] `packages/core/src/index.ts` — add text exports
- [ ] `packages/diagram/src/elements/diagram/rendering/TextRenderer.ts` — update to re-export from core

### Phase 1 (Scaffold)
- [ ] `packages/charts/package.json`
- [ ] `packages/charts/tsconfig.json`
- [ ] `packages/charts/tsconfig.build.json`
- [ ] `packages/charts/vitest.config.ts`
- [ ] `packages/charts/src/index.ts` (empty shell)

### Phase 2 (Data Layer)
- [ ] `packages/charts/src/data/types.ts`
- [ ] `packages/charts/src/data/transforms.ts`
- [ ] `packages/charts/src/data/ChartDataStore.ts`
- [ ] `packages/charts/src/data/ChartFilterContext.tsx`
- [ ] `packages/charts/src/data/useChartData.ts`
- [ ] `packages/charts/src/data/useChartFilter.ts`
- [ ] `packages/charts/src/data/__tests__/transforms.test.ts`
- [ ] `packages/charts/src/data/__tests__/ChartDataStore.test.ts`

### Phase 3 (Themes)
- [ ] `packages/charts/src/themes/types.ts`
- [ ] `packages/charts/src/themes/darkGlass.ts`
- [ ] `packages/charts/src/themes/neonCyber.ts`
- [ ] `packages/charts/src/themes/enterprise.ts`
- [ ] `packages/charts/src/themes/lightMinimal.ts`
- [ ] `packages/charts/src/themes/index.ts`

### Phase 4 (Shared Renderers)
- [ ] `packages/charts/src/renderers/shared/IChartRenderer.ts`
- [ ] `packages/charts/src/renderers/shared/ChartMaterialFactory.ts`
- [ ] `packages/charts/src/renderers/shared/AxesRenderer.ts`
- [ ] `packages/charts/src/renderers/shared/LegendRenderer.ts`
- [ ] `packages/charts/src/renderers/__tests__/ChartMaterialFactory.test.ts`

### Phase 5 (Chart-Type Renderers)
- [ ] `packages/charts/src/renderers/bar/BarRenderer.ts`
- [ ] `packages/charts/src/renderers/line/LineRenderer.ts`
- [ ] `packages/charts/src/renderers/area/AreaRenderer.ts`
- [ ] `packages/charts/src/renderers/pie/PieRenderer.ts`
- [ ] `packages/charts/src/renderers/scatter/ScatterRenderer.ts`
- [ ] `packages/charts/src/renderers/heatmap/HeatmapRenderer.ts`
- [ ] `packages/charts/src/renderers/__tests__/BarRenderer.test.ts`
- [ ] `packages/charts/src/renderers/__tests__/ScatterRenderer.test.ts`

### Phase 6 (Element Module)
- [ ] `packages/charts/src/elements/chart/types.ts`
- [ ] `packages/charts/src/elements/chart/dsl.tsx`
- [ ] `packages/charts/src/elements/chart/compile.ts`
- [ ] `packages/charts/src/elements/chart/render.ts`
- [ ] `packages/charts/src/elements/chart/ChartWidget.ts`
- [ ] `packages/charts/src/elements/chart/index.ts`
- [ ] `packages/charts/src/elements/chart/__tests__/compile.test.ts`

### Phase 7 (Compiler)
- [ ] `packages/charts/src/compiler/handlers.ts`
- [ ] `packages/charts/src/compiler/__tests__/handlers.test.ts`
- [ ] `packages/charts/src/register.ts`

### Phase 8 (Player)
- [ ] `packages/charts/src/player/ChartProvider.tsx`
- [ ] `packages/charts/src/player/ChartTooltipOverlay.tsx`
- [ ] `packages/charts/src/player/chartPlugin.ts`

### Phase 9 (Public Index)
- [ ] `packages/charts/src/index.ts` (final)

### Phase 10 (Integration)
- [ ] `apps/examples/src/charts/scenes/ChartDemoScene.tsx`
- [ ] `apps/examples/src/charts/widgetSetup.ts`
- [ ] `apps/examples/package.json` — add `"@brewsite/charts": "workspace:*"`

---

## Implementation Order

Phases must be implemented in order due to dependencies:

```
Phase 0  (core TextRenderer promotion)
  ↓
Phase 1  (package scaffold — nothing imports from charts yet)
  ↓
Phase 2  (data layer — no Three.js dependency)
  ↓
Phase 3  (themes — no Three.js dependency)
  ↓
Phase 4  (shared renderers — imports Three.js + themes + data types)
  ↓
Phase 5  (chart-type renderers — imports shared renderers)
  ↓
Phase 6  (element module — imports all of the above)
  ↓
Phase 7  (compiler handlers — imports DSL + compile)
  ↓
Phase 8  (player layer — imports React + widget + data)
  ↓
Phase 9  (public index — imports everything)
  ↓
Phase 10 (integration — imports @brewsite/charts)
```

Each phase should pass `pnpm --filter @brewsite/charts typecheck` before proceeding
to the next. Run `pnpm --filter @brewsite/charts test` after Phase 7 when the first
tests become runnable.
