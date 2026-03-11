---
title: Charts Package Overhaul — Implementation Plan
doc_type: plan
owner: brewsite-architect
status: draft
updated: 2026-03-10
---

# Charts Package Overhaul — Implementation Plan

## 1. Overview

This plan covers the complete V2 overhaul of `@brewsite/charts`. It is derived from `requirements/charts/notes/note_charts-overhaul.md` (PM debate-finalized). The plan resolves all three open architect questions (Q3, Q7, Q8), specifies every file to create or modify with full TypeScript signatures, organizes work into 5 parallel developer streams with no file conflicts, and covers the 10-scene demo page.

**Semver:** This is a **major version bump** (`@brewsite/charts` 1.x → 2.0.0). `ChartState` is a breaking change (see §13).

---

## 2. Architecture Decisions

### Q3 — Datum Morphing Renderer Contract

**Decision:** Add an optional `morphCtx?: MorphContext` field to `ChartRenderContext`. Its presence signals a morphing transition; absence preserves V1 behavior exactly.

```typescript
export type MorphContext = {
  readonly fromData: ResolvedDataFrame;  // data from the "from" scene
  readonly toData: ResolvedDataFrame;    // data from the "to" scene (same as ctx.data)
  readonly t: number;                    // interpolation progress [0, 1]
  readonly keyField: string;             // field name used to match datums
};
```

- `morphCtx` is injected by `ChartRenderer.update()` when both the from-state and to-state have the same `keyField` set in their `dataSource`.
- `IChartRenderer.update(ctx)` signature is **unchanged** — the new field is additive on `ChartRenderContext`.
- Renderers that don't implement morphing safely ignore `morphCtx` — they render `ctx.data` as before.
- **V2 scope:** Only `BarRenderer` and `ScatterRenderer` implement morphing. All others ignore `morphCtx`.
- `interpolateFn` in `compile.ts` populates a new `_morphT?: number` field on the interpolated `ChartState`. `ChartRenderer` reads this to construct `MorphContext` during transition ticks.

### Q7 — AreaRenderer SmartRebuild with stackMode

**Decision:** `AreaRenderer` tracks a new `private lastStackMode: 'none' | 'stacked' = 'none'` field alongside `lastDataLength` and `lastSeriesCount`. The rebuild condition becomes:

```typescript
const areaOptions = ctx.typeOptions.kind === 'area' ? ctx.typeOptions.options : {};
const stackMode = areaOptions.stackMode ?? 'none';
const needsRebuild =
  data.rows.length !== this.lastDataLength ||
  effectiveSeries.length !== this.lastSeriesCount ||
  stackMode !== this.lastStackMode;
```

After rebuild, `this.lastStackMode = stackMode`.

### Q8 — DataLabelRenderer Placement

**Decision:** Shared `DataLabelRenderer` class in `renderers/shared/`. Each per-type renderer computes a `DataLabelEntry[]` array and passes it to the shared renderer. The `alignment` discriminant allows per-type positioning without per-type label rendering code.

```typescript
export type DataLabelAlignment = 'above' | 'center' | 'outside';

export type DataLabelEntry = {
  readonly position: THREE.Vector3;  // 3D anchor point in seriesGroup space
  readonly text: string;             // formatted value string
  readonly alignment: DataLabelAlignment;
};
```

`DataLabelRenderer` owns troika-three-text instances and updates them from entries each frame. Per-type renderers call `this.dataLabelRenderer.update(entries, theme, opacity, fontUrl)` only when `ctx.dataLabels` is non-null.

---

## 3. Complete Type Specifications

### 3.1 `packages/charts/src/elements/chart/types.ts` — Full V2 Definition

#### Data Source Types (new)

```typescript
/** A single data row — flat column-value pairs. Fully JSON-serializable. */
export type DataRow = Readonly<Record<string, unknown>>;

/**
 * Columnar data format: { month: ['Jan','Feb'], revenue: [128, 145] }.
 * Transposed to DataRow[] by normalizeDataInput() before storage.
 */
export type ColumnarData = Readonly<Record<string, ReadonlyArray<unknown>>>;

/** Accepted DSL data input formats. Normalized before entering ChartState. */
export type DataInput = ReadonlyArray<DataRow> | ColumnarData;

/** Inline static rows — stored directly in ChartState. SceneTrack-safe. */
export type InlineDataSource = {
  readonly type: 'inline';
  readonly rows: ReadonlyArray<DataRow>;
  /** Key field for datum-level morphing between scenes. */
  readonly keyField?: string;
};

/** Named reference to a ChartProvider-registered source. V1 behavior. */
export type NamedDataSource = {
  readonly type: 'named';
  readonly name: string;
  readonly keyField?: string;
};

/** Async fetch — URL serialized in SceneTrack; data cached in widget memory. */
export type AsyncDataSource = {
  readonly type: 'async';
  readonly url: string;
  readonly format?: 'json' | 'csv';
  readonly keyField?: string;
};

/** Discriminated union of all compiled data sources. All variants are SceneTrack-safe. */
export type ChartStateDataSource = InlineDataSource | NamedDataSource | AsyncDataSource;
```

#### Type-Specific Options (new)

```typescript
export type BarChartOptions = {
  readonly orientation?: 'vertical' | 'horizontal';
  readonly stackMode?: 'grouped' | 'stacked';
  /** Padding ratio between bar groups [0..1]. Default from theme. */
  readonly barPadding?: number;
};

export type LineChartOptions = {
  readonly lineShape?: ChartLineShape;
  readonly lineSmoothness?: number;
  readonly lineSubdivisions?: number;
  readonly showPoints?: boolean;
};

export type ScatterChartOptions = {
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly pointShape?: 'sphere' | 'cube' | 'cylinder';
  /** World-space radius scale range for sizeField encoding. */
  readonly sizeScale?: { readonly min: number; readonly max: number };
  /** Color interpolator for continuous numeric colorField values. */
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

export type PieChartOptions = {
  /** [0..1] — 0 = pie, >0 = donut. Default: 0. */
  readonly innerRadius?: number;
  readonly pieTilt?: number;
  /** x-axis field value of the slice to push outward. */
  readonly explodeSlice?: string;
};

export type AreaChartOptions = {
  readonly stackMode?: 'none' | 'stacked';
  readonly fillOpacity?: number;
};

export type HeatMapChartOptions = {
  readonly timeField?: string;
  readonly heightField?: string;
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

/**
 * Discriminated union of per-chart-type options.
 * `kind` matches `ChartState.type`. Renderers pattern-match on `kind`.
 */
export type ChartTypeOptions =
  | { readonly kind: 'bar';     readonly options: BarChartOptions }
  | { readonly kind: 'line';    readonly options: LineChartOptions }
  | { readonly kind: 'scatter'; readonly options: ScatterChartOptions }
  | { readonly kind: 'pie';     readonly options: PieChartOptions }
  | { readonly kind: 'area';    readonly options: AreaChartOptions }
  | { readonly kind: 'heatmap'; readonly options: HeatMapChartOptions };
```

#### Data Labels (new)

```typescript
export type DataLabelsPosition = 'top' | 'center' | 'outside';

export type ChartDataLabelsState = {
  readonly position: DataLabelsPosition;
  /** d3-format string. Default: '.0f'. */
  readonly format?: string;
};
```

#### Reference Lines (new)

```typescript
export type ReferenceLineState = {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly label?: string;
  readonly color?: string;
};
```

#### Updated ChartAxisState

```typescript
export type ChartAxisState = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
  // V2 additions:
  readonly scaleType?: 'linear' | 'log' | 'time' | 'band' | 'sqrt';
  readonly domain?: readonly [number | string, number | string];
  readonly tickCount?: number;
  readonly nice?: boolean;
  readonly clamp?: boolean;
  readonly reverse?: boolean;
  readonly gridlines?: boolean;
  readonly gridlineOpacity?: number;
};
```

#### Updated ChartSeriesState

```typescript
export type ChartSeriesState = {
  readonly field: string;
  readonly label?: string;
  readonly color?: string;
  /** For area band variant: name of the lower-bound field. */
  readonly bandField?: string;
};
```

#### Updated ChartLegendState

```typescript
export type ChartLegendState = {
  readonly visible: boolean;
  readonly position: LegendPosition;
  readonly title?: string;
  readonly columns?: number;
  readonly maxItems?: number;
};
```

#### ChartState V2 (breaking change)

```typescript
/**
 * Compiled runtime state for one chart element — V2.
 *
 * Breaking changes from V1:
 * - `dataSource: string` → `dataSource: ChartStateDataSource` (discriminated union)
 * - `typeConfig: ChartTypeOptions` added — replaces flat optional per-type fields
 * - Removed flat fields: lineShape, lineSmoothness, lineSubdivisions, innerRadius,
 *   pieTilt, timeField, axisGap, legendGap (all moved into typeConfig.options)
 * - `dataLabels?: ChartDataLabelsState` added
 * - `gridlines?: boolean` added (per-chart shorthand)
 * - `referenceLines?: ReadonlyArray<ReferenceLineState>` added
 * - `series[].bandField` added
 * - Legend gains title, columns, maxItems
 * - Axis gains scaleType, domain, tickCount, nice, clamp, reverse, gridlines, gridlineOpacity
 * - `_morphT?: number` internal field for transition morphing (not public API)
 */
export type ChartState = {
  /** Convenience derived field — always equals typeConfig.kind. Kept for backward compat. */
  readonly type: ChartType;
  readonly nvsX: number;
  readonly nvsY: number;
  readonly z: number;
  readonly rotation: readonly [number, number, number];
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  /** V2: Discriminated data source. Replaces V1 `dataSource: string`. */
  readonly dataSource: ChartStateDataSource;
  readonly transforms: readonly DataTransform[];
  readonly filterGroup?: FilterGroupId;
  readonly xAxis: ChartAxisState | null;
  readonly yAxis: ChartAxisState | null;
  readonly series: readonly ChartSeriesState[];
  readonly referenceLines?: ReadonlyArray<ReferenceLineState>;
  readonly legend: ChartLegendState | null;
  readonly theme: ChartThemeName | ChartTheme;
  readonly opacity: number;
  readonly interactive: boolean;
  readonly sceneTheme?: SceneTheme;
  readonly nvsBounds: NVSRect;
  /** V2: Discriminated type-specific options. */
  readonly typeConfig: ChartTypeOptions;
  /** V2: Data point value labels (bar tops, pie slices, scatter points). */
  readonly dataLabels?: ChartDataLabelsState;
  /** V2: Per-chart gridlines shorthand — overrides axis-level settings. */
  readonly gridlines?: boolean;
  /**
   * Internal: interpolation t value injected by interpolateFn during transitions.
   * Used by ChartRenderer to build MorphContext. Not part of the public API.
   * @internal
   */
  readonly _morphT?: number;
};
```

#### DEFAULT_CHART_STATE V2

```typescript
export const DEFAULT_CHART_STATE: ChartState = {
  type: 'bar',
  nvsX: 0.5,
  nvsY: 0.5,
  z: 0,
  rotation: [0, 0, 0],
  bounds: { width: 1.0, height: 1.0, depth: 0.4 },
  dataSource: { type: 'named', name: '' },
  transforms: [],
  xAxis: null,
  yAxis: null,
  series: [],
  legend: null,
  theme: 'darkGlass',
  opacity: 1,
  interactive: false,
  sceneTheme: undefined,
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  typeConfig: { kind: 'bar', options: {} },
};
```

#### DSL Prop Types (new/updated — live in `dsl.tsx`)

```typescript
/** Shared props for all per-type chart DSL components. */
export type BaseChartDSL = {
  readonly id: string;
  /** Inline data rows or columnar data object. Mutually exclusive with dataUrl. */
  readonly data?: DataInput;
  /** URL for async JSON/CSV fetch. Mutually exclusive with data. */
  readonly dataUrl?: string;
  readonly theme?: ChartThemeName | ChartTheme;
  readonly opacity?: number;
  readonly interactive?: boolean;
  readonly sceneTheme?: SceneTheme;
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number;
  readonly z?: number;
  readonly rotation?: readonly [number, number, number];
  readonly bounds?: {
    readonly width?: number;
    readonly height?: number;
    readonly depth?: number;
  };
  /** Per-chart gridlines override. */
  readonly gridlines?: boolean;
  readonly children?: React.ReactNode;
};

export type BarChartDSL = BaseChartDSL & {
  readonly orientation?: 'vertical' | 'horizontal';
  readonly stackMode?: 'grouped' | 'stacked';
  readonly barPadding?: number;
};

export type LineChartDSL = BaseChartDSL & {
  readonly lineShape?: ChartLineShape;
  readonly lineSmoothness?: number;
  readonly lineSubdivisions?: number;
  readonly showPoints?: boolean;
};

export type ScatterPlotChartDSL = BaseChartDSL & {
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly pointShape?: 'sphere' | 'cube' | 'cylinder';
  readonly sizeScale?: { readonly min: number; readonly max: number };
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

export type PieChartDSL = BaseChartDSL & {
  readonly innerRadius?: number;
  readonly pieTilt?: number;
  readonly explodeSlice?: string;
};

export type AreaChartDSL = BaseChartDSL & {
  readonly stackMode?: 'none' | 'stacked';
  readonly fillOpacity?: number;
};

export type HeatMapChartDSL = BaseChartDSL & {
  readonly timeField?: string;
  readonly heightField?: string;
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

/** Updated V2 ChartDataDSL — source is now optional (inline/async paths don't need it). */
export type ChartDataDSL = {
  readonly source?: string;
  readonly transforms?: readonly DataTransform[];
  readonly filterGroup?: FilterGroupId;
  readonly keyField?: string;
};

/** Updated V2 ChartAxisDSL — includes all new axis control fields. */
export type ChartAxisDSL = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
  readonly scaleType?: 'linear' | 'log' | 'time' | 'band' | 'sqrt';
  readonly domain?: readonly [number | string, number | string];
  readonly tickCount?: number;
  readonly nice?: boolean;
  readonly clamp?: boolean;
  readonly reverse?: boolean;
  readonly gridlines?: boolean;
  readonly gridlineOpacity?: number;
};

/** Updated V2 ChartSeriesDSL — adds bandField for area charts. */
export type ChartSeriesDSL = {
  readonly field: string;
  readonly label?: string;
  readonly color?: string;
  readonly bandField?: string;
};

/** Updated V2 ChartLegendDSL — adds title, columns, maxItems. */
export type ChartLegendDSL = {
  readonly visible?: boolean;
  readonly position?: LegendPosition;
  readonly title?: string;
  readonly columns?: number;
  readonly maxItems?: number;
};

/** Data labels DSL component props. */
export type ChartDataLabelsDSL = {
  readonly position?: DataLabelsPosition;
  readonly format?: string;
};

/** Reference line DSL component props (LineChart only in V2). */
export type ReferenceLineDSL = {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly label?: string;
  readonly color?: string;
};
```

### 3.2 `packages/charts/src/renderers/shared/IChartRenderer.ts` — V2 Definition

```typescript
import type * as THREE from 'three';
import type { ResolvedDataFrame } from '../../data/types';
import type { ChartTheme } from '../../themes/types';
import type { ChartAxisState, ChartSeriesState, ChartTypeOptions,
  ChartDataLabelsState, ReferenceLineState } from '../../elements/chart/types';

export type { ChartAxisState, ChartSeriesState };

export type ChartHitInfo = {
  readonly seriesIndex: number;
  readonly datumIndex: number;
  readonly row: Record<string, unknown>;
  readonly point: readonly [number, number, number];
};

/**
 * Q3 Resolution: Datum morphing context.
 * Present in ChartRenderContext only when keyField is set on both the from- and
 * to-state data sources and both have data. Renderers that don't implement
 * morphing safely ignore this field.
 */
export type MorphContext = {
  readonly fromData: ResolvedDataFrame;
  readonly toData: ResolvedDataFrame;
  readonly t: number;
  readonly keyField: string;
};

/**
 * Q8 Resolution: Single entry for DataLabelRenderer.
 * Per-type renderers compute these from geometry; shared DataLabelRenderer renders them.
 */
export type DataLabelAlignment = 'above' | 'center' | 'outside';

export type DataLabelEntry = {
  readonly position: THREE.Vector3;
  readonly text: string;
  readonly alignment: DataLabelAlignment;
};

/**
 * V2 render context — passed to every IChartRenderer.update() call.
 * Breaking changes from V1: typeOptions replaces flat lineShape/pieTilt/etc.,
 * morphCtx added (optional), dataLabels added, referenceLines added, gridlines added.
 */
export type ChartRenderContext = {
  readonly seriesGroup: THREE.Group;
  readonly axesGroup: THREE.Group;
  readonly legendGroup: THREE.Group;
  readonly chartPosition?: readonly [number, number, number];
  /** Current/to-state data. Used for rendering. Also in morphCtx.toData when morphing. */
  readonly data: ResolvedDataFrame;
  readonly xAxis: ChartAxisState | null;
  readonly yAxis: ChartAxisState | null;
  readonly series: readonly ChartSeriesState[];
  readonly referenceLines?: ReadonlyArray<ReferenceLineState>;
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  readonly theme: ChartTheme;
  readonly opacity: number;
  /** V2: Replaces flat lineShape, lineSmoothness, innerRadius, pieTilt, timeField, etc. */
  readonly typeOptions: ChartTypeOptions;
  /** V2: Non-null when <ChartDataLabels> is present in the DSL. */
  readonly dataLabels: ChartDataLabelsState | null;
  /** V2: Per-chart gridlines override (null = use axis-level settings). */
  readonly gridlines: boolean | null;
  readonly fontUrl?: string;
  /**
   * Q3 Resolution: Present only during keyField-based datum-morphing transitions.
   * Renderers that don't implement morphing ignore this field — they render `data` as-is.
   */
  readonly morphCtx?: MorphContext;
};

export interface IChartRenderer {
  update(ctx: ChartRenderContext): void;
  dispose(): void;
  getInteractiveObjects(): THREE.Object3D[];
  resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null;
}
```

### 3.3 `packages/charts/src/data/types.ts` — V2 Additions

Add `ColumnarData` and `DataInput` and `normalizeDataInput` function signature:

```typescript
// ADDED to existing data/types.ts:

/**
 * Columnar data format: { month: ['Jan','Feb'], revenue: [128, 145] }.
 * Transposed to DataRow[] by normalizeDataInput().
 */
export type ColumnarData = Readonly<Record<string, ReadonlyArray<unknown>>>;

/** Accepted data input formats for inline data prop and ChartProvider. */
export type DataInput = ReadonlyArray<Record<string, unknown>> | ColumnarData;

/**
 * Normalizes DataInput to a flat row array.
 * - If input is an array → returned as-is (cast)
 * - If input is a columnar object → transposed to row array
 * Throws if columnar columns have different lengths.
 */
export function normalizeDataInput(input: DataInput): ReadonlyArray<Record<string, unknown>>;
```

`normalizeDataInput` is implemented in `data/transforms.ts` and re-exported from `data/types.ts`.

---

## 4. File-by-File Specification

### Phase 0 — Foundation (no parallelism; all streams depend on these)

---

#### `packages/charts/src/elements/chart/types.ts` — MODIFY

**What changes:** Complete replacement of type definitions as specified in §3.1. Remove V1 flat per-type fields. Add all V2 types.

**Exported symbols (all):**
- Types: `DataRow`, `ColumnarData`, `DataInput`, `InlineDataSource`, `NamedDataSource`, `AsyncDataSource`, `ChartStateDataSource`, `BarChartOptions`, `LineChartOptions`, `ScatterChartOptions`, `PieChartOptions`, `AreaChartOptions`, `HeatMapChartOptions`, `ChartTypeOptions`, `DataLabelsPosition`, `ChartDataLabelsState`, `ReferenceLineState`, `ChartAxisState`, `ChartSeriesState`, `ChartLegendState`, `ChartState`, `ChartType`, `LegendPosition`, `ChartLineShape`
- DSL types: `BaseChartDSL`, `BarChartDSL`, `LineChartDSL`, `ScatterPlotChartDSL`, `PieChartDSL`, `AreaChartDSL`, `HeatMapChartDSL`, `ChartDataDSL`, `ChartAxisDSL`, `ChartSeriesDSL`, `ChartLegendDSL`, `ChartDataLabelsDSL`, `ReferenceLineDSL`
- Values: `DEFAULT_CHART_STATE`

**Imports:** `@brewsite/core` (SceneTheme, NVSRect), `../../data/types` (DataTransform, FilterGroupId), `../../themes/types` (ChartThemeName, ChartTheme)

**Dependencies in:** `dsl.tsx`, `compile.ts`, `render.ts`, `ChartWidget.ts`, `layout.ts`, `IChartRenderer.ts`, `chartPlugin.ts`, `handlers.ts`, tests

**Test file:** Not directly tested — types only, no logic. `compile.test.ts` validates that compileChart produces correct ChartState shapes.

---

#### `packages/charts/src/renderers/shared/IChartRenderer.ts` — MODIFY

**What changes:** Per §3.2 — add `MorphContext`, `DataLabelAlignment`, `DataLabelEntry`; update `ChartRenderContext` to replace flat type-specific fields with `typeOptions: ChartTypeOptions`; add `dataLabels`, `gridlines`, `morphCtx`, `referenceLines`.

**Exported symbols:** `ChartHitInfo`, `ChartAxisState` (re-export), `ChartSeriesState` (re-export), `MorphContext`, `DataLabelAlignment`, `DataLabelEntry`, `ChartRenderContext`, `IChartRenderer`

**No logic — types and interface only.**

---

#### `packages/charts/src/data/types.ts` — MODIFY

**What changes:** Add `ColumnarData`, `DataInput` types. Add `normalizeDataInput` function signature (implementation in `transforms.ts`).

**Exported symbols added:** `ColumnarData`, `DataInput`, `normalizeDataInput` (type signature; implementation imported from transforms)

---

### Phase 1 — Five Parallel Streams

After Phase 0 is merged, all five streams can proceed independently with no file conflicts.

---

### Stream 1: DSL + Compile Layer

**Developer 1 owns all of these files.**

#### `packages/charts/src/elements/chart/dsl.tsx` — MODIFY

**What changes:** Export prop types for all per-type chart components. Import new DSL types from `types.ts`.

**Full content:**
```typescript
// Chart DSL stub component prop types — never rendered, only compiled by NodeHandlers.
import React from 'react';
import type {
  BaseChartDSL, BarChartDSL, LineChartDSL, ScatterPlotChartDSL, PieChartDSL,
  AreaChartDSL, HeatMapChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL,
  ChartLegendDSL, ChartDataLabelsDSL, ReferenceLineDSL, ChartDSL,
} from './types';

// V2: Per-type prop types
export type BarChartProps = BarChartDSL;
export type LineChartProps = LineChartDSL;
export type ScatterPlotChartProps = ScatterPlotChartDSL;
export type PieChartProps = PieChartDSL;
export type AreaChartProps = AreaChartDSL;
export type HeatMapChartProps = HeatMapChartDSL;

// V2: Shared child component prop types
export type ChartDataProps = ChartDataDSL;
export type ChartAxisProps = ChartAxisDSL;
export type ChartSeriesProps = ChartSeriesDSL;
export type ChartLegendProps = ChartLegendDSL;
export type ChartDataLabelsProps = ChartDataLabelsDSL;
export type ReferenceLineProps = ReferenceLineDSL;

// V1 compat (deprecated)
export type ChartProps = ChartDSL & { children?: React.ReactNode };
```

Note: `ChartDSL` in types.ts is the V1 generic prop type, kept for deprecated `<Chart>` backward compat.

---

#### `packages/charts/src/elements/chart/stubs.ts` — NEW

**What this file does:** Exports all null-returning DSL stub functions. Moved from `ChartWidget.ts` (V1 had them there). All stubs are null-returning functions — they are never called at runtime; the compiler intercepts them by component identity.

**Full content:**
```typescript
// DSL stub functions for @brewsite/charts — null-returning components registered with NodeHandlers.
// These are never rendered to DOM. The compiler intercepts them via registerNode().

import type {
  BarChartProps, LineChartProps, ScatterPlotChartProps, PieChartProps,
  AreaChartProps, HeatMapChartProps, ChartDataProps, ChartAxisProps,
  ChartSeriesProps, ChartLegendProps, ChartDataLabelsProps, ReferenceLineProps,
  ChartProps,
} from './dsl';

/** @deprecated Use <BarChart>, <LineChart>, etc. instead. */
export function Chart(_props: ChartProps): null { return null; }
Chart.displayName = 'Chart';

export function BarChart(_props: BarChartProps): null { return null; }
BarChart.displayName = 'BarChart';

export function LineChart(_props: LineChartProps): null { return null; }
LineChart.displayName = 'LineChart';

export function ScatterPlotChart(_props: ScatterPlotChartProps): null { return null; }
ScatterPlotChart.displayName = 'ScatterPlotChart';

export function PieChart(_props: PieChartProps): null { return null; }
PieChart.displayName = 'PieChart';

export function AreaChart(_props: AreaChartProps): null { return null; }
AreaChart.displayName = 'AreaChart';

export function HeatMapChart(_props: HeatMapChartProps): null { return null; }
HeatMapChart.displayName = 'HeatMapChart';

export function ChartData(_props: ChartDataProps): null { return null; }
ChartData.displayName = 'ChartData';

export function ChartAxis(_props: ChartAxisProps): null { return null; }
ChartAxis.displayName = 'ChartAxis';

export function ChartSeries(_props: ChartSeriesProps): null { return null; }
ChartSeries.displayName = 'ChartSeries';

export function ChartLegend(_props: ChartLegendProps): null { return null; }
ChartLegend.displayName = 'ChartLegend';

export function ChartDataLabels(_props: ChartDataLabelsProps): null { return null; }
ChartDataLabels.displayName = 'ChartDataLabels';

export function ReferenceLine(_props: ReferenceLineProps): null { return null; }
ReferenceLine.displayName = 'ReferenceLine';
```

---

#### `packages/charts/src/elements/chart/compile.ts` — MODIFY

**What changes:**
1. Add `normalizeDataInput` import from `data/transforms.ts`
2. Add per-type option compile functions
3. Add `compileDataSource()` function
4. Refactor `compileChart()` to accept the new per-type DSL shapes and produce V2 `ChartState`
5. Update `functionalChartTransitionSpec` per Decision 7

**New exported functions:**

```typescript
/**
 * Normalizes DSL inline/url/named data props into ChartStateDataSource.
 * Handles columnar→row transposition for inline data.
 */
export function compileDataSource(
  dsl: BaseChartDSL,
  dataDsl: ChartDataDSL | null,
): ChartStateDataSource

/**
 * Compiles BarChart-specific options from DSL props.
 * Pure — no Three.js, no React.
 */
export function compileBarChartOptions(dsl: BarChartDSL): BarChartOptions

export function compileLineChartOptions(dsl: LineChartDSL): LineChartOptions

export function compileScatterChartOptions(dsl: ScatterPlotChartDSL): ScatterChartOptions

export function compilePieChartOptions(dsl: PieChartDSL): PieChartOptions

export function compileAreaChartOptions(dsl: AreaChartDSL): AreaChartOptions

export function compileHeatMapChartOptions(dsl: HeatMapChartDSL): HeatMapChartOptions

/**
 * Main compile dispatcher. Accepts any per-type DSL + kind discriminant.
 * Produces a fully-populated V2 ChartState.
 *
 * @param dsl         Base props (shared across all chart types)
 * @param kind        The chart type kind ('bar'|'line'|...) — from the specific DSL component
 * @param typeOptions Already-compiled ChartTypeOptions (from compileXxxChartOptions())
 * @param dataDsl     Compiled <ChartData> child props, or null
 * @param axisDsls    All <ChartAxis> children props
 * @param seriesDsls  All <ChartSeries> children props
 * @param legendDsl   <ChartLegend> child props, or null
 * @param dataLabelsDsl <ChartDataLabels> child props, or null
 * @param referenceLineDsls All <ReferenceLine> children props
 */
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
): ChartState
```

**`compileDataSource()` logic:**
```
if dsl.data is set:
  rows = normalizeDataInput(dsl.data)
  warn in dev if rows.length > 500
  return { type: 'inline', rows, keyField: dataDsl?.keyField }
else if dsl.dataUrl is set:
  return { type: 'async', url: dsl.dataUrl, format: 'json', keyField: dataDsl?.keyField }
else if dataDsl?.source:
  return { type: 'named', name: dataDsl.source, keyField: dataDsl?.keyField }
else:
  warn: "No data source specified" (dev only)
  return { type: 'named', name: '' }
```

**Updated `functionalChartTransitionSpec`:**
```typescript
export const functionalChartTransitionSpec: FunctionalTransitionSpec<ChartState> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0,
  }),

  enterFn: (to) => (ctx) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity,
  }),

  interpolateFn: (from, to) => (ctx) => ({
    ...to,
    nvsX: blendNumber(from.nvsX, to.nvsX, ctx.t) ?? to.nvsX,
    nvsY: blendNumber(from.nvsY, to.nvsY, ctx.t) ?? to.nvsY,
    z: blendNumber(from.z, to.z, ctx.t) ?? to.z,
    opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    // typeConfig switches at midpoint. type is derived from typeConfig.kind.
    typeConfig: ctx.t < 0.5 ? from.typeConfig : to.typeConfig,
    type: ctx.t < 0.5 ? from.type : to.type,
    sceneTheme: ctx.t < 0.5 ? from.sceneTheme : to.sceneTheme,
    // Internal: inject t so ChartRenderer can build MorphContext
    _morphT: ctx.t,
  }),
};
```

**`compileAxisDsl()` helper (internal):**
```typescript
function compileAxisDsl(dsl: ChartAxisDSL): ChartAxisState {
  return {
    axis: dsl.axis,
    field: dsl.field,
    label: dsl.label,
    format: dsl.format,
    scaleType: dsl.scaleType,
    domain: dsl.domain,
    tickCount: dsl.tickCount,
    nice: dsl.nice,
    clamp: dsl.clamp,
    reverse: dsl.reverse,
    gridlines: dsl.gridlines,
    gridlineOpacity: dsl.gridlineOpacity,
  };
}
```

**`compileLegendDsl()` helper (internal):**
```typescript
function compileLegendDsl(dsl: ChartLegendDSL): ChartLegendState {
  return {
    visible: dsl.visible ?? true,
    position: dsl.position ?? 'right',
    title: dsl.title,
    columns: dsl.columns,
    maxItems: dsl.maxItems,
  };
}
```

**Test file:** `packages/charts/src/elements/chart/__tests__/compile.test.ts` — MODIFY

Test cases to cover:
1. `compileDataSource` — inline data: `data` prop present, rows < 500, correct InlineDataSource shape
2. `compileDataSource` — inline data: columnar object, transposed correctly to rows
3. `compileDataSource` — async: `dataUrl` prop present, correct AsyncDataSource shape
4. `compileDataSource` — named: `<ChartData source="foo">` child, correct NamedDataSource shape
5. `compileDataSource` — named with keyField: keyField propagated to NamedDataSource
6. `compileBarChartOptions` — defaults: empty props → `{ orientation: undefined, stackMode: undefined }`
7. `compileBarChartOptions` — stacked + horizontal: explicit props propagated
8. `compilePieChartOptions` — innerRadius=0.5, explodeSlice='Core Platform' propagated
9. `compileScatterChartOptions` — sizeField + colorField + sizeScale propagated
10. `compileChart` — BarChart full compile: produces ChartState with `typeConfig.kind === 'bar'`, `type === 'bar'`, inline dataSource, correct axes and series
11. `compileChart` — axis V2 fields: scaleType, domain, tickCount, gridlines propagated to ChartAxisState
12. `compileChart` — legend V2 fields: title, columns, maxItems propagated
13. `compileChart` — dataLabels: ChartDataLabelsState propagated
14. `compileChart` — referenceLines: ReferenceLineState[] propagated
15. `functionalChartTransitionSpec.interpolateFn` — t=0: typeConfig from from-state; t=1: typeConfig from to-state; t=0.5: to-state; opacity interpolated; _morphT = t

---

#### `packages/charts/src/elements/chart/layout.ts` — MINOR MODIFY

**What changes:** `ComputeChartLayoutInput` replaces `type: ChartType` with `typeConfig: ChartTypeOptions`. The `isCartesian` check becomes:
```typescript
const isCartesian = typeConfig.kind !== 'pie';
```

No other changes to layout logic.

**Test file:** `packages/charts/src/elements/chart/__tests__/layout.test.ts` — MODIFY
Add test: cartesian true for bar/line/area/scatter/heatmap, false for pie.

---

### Stream 2: Widget + Render Layer

**Developer 2 owns all of these files.**

#### `packages/charts/src/elements/chart/ChartWidget.ts` — MODIFY

**What changes:**
1. Remove all stub function definitions (moved to `stubs.ts`). Import stubs from `stubs.ts`.
2. Implement `ILoadable` for async data sources.
3. Handle inline data registration in `apply()`.
4. Update `childDslComponents` to include all V2 components.
5. Update `apply()` to pass `typeOptions`, `dataLabels`, `referenceLines`, `gridlines`, `morphCtx` to `ChartRenderer.update()`.
6. `onTick()` — use `ctx.blockProgress` for heatmap time animation.
7. Add `_configureAsync()` method (called by `chartPlugin.reconcileCompiledTrack`).

**Full class signature:**
```typescript
export class ChartWidget
  implements
    ISceneElement<ChartState>,
    IRenderable<ChartState>,
    IAnimationController,
    IDslComposite,
    ILoadable,
    INVSBounded
{
  readonly widgetId: string;
  readonly defaultState: ChartState;
  readonly disableWhenAbsent = true;
  readonly transitionSpec: FunctionalTransitionSpec<ChartState>;
  readonly DslComponent: typeof BarChart;  // primary DSL component (BarChart = default for registry)
  readonly tickPriority = 2;

  // ILoadable
  readonly isLoaded: boolean;
  load(manifest: AssetManifest | null): Promise<void>;

  // IDslComposite — V2: includes BarChart, LineChart, ScatterPlotChart, PieChart,
  //   AreaChart, HeatMapChart, Chart (deprecated), ChartData, ChartAxis, ChartSeries,
  //   ChartLegend, ChartDataLabels, ReferenceLine
  readonly childDslComponents: IDslComposite['childDslComponents'];

  // INVSBounded
  get nvsBounds(): NVSRect;

  // Interaction callbacks
  public onHover: ((info: ChartHoverInfo | null) => void) | undefined;
  public onSelect: ((info: ChartHoverInfo) => void) | undefined;

  constructor(widgetId: string, store: ChartDataStore);

  // Internal: called by chartPlugin.reconcileCompiledTrack when async source detected
  _configureAsync(url: string, format?: 'json' | 'csv'): void;

  initialize(ctx: WidgetInitContext): void;
  apply(state: ChartState, ctx: WidgetRenderContext): void;
  onTick(ctx: AnimationTickContext): void;
  dispose(): void;
}
```

**Private fields added:**
```typescript
private asyncUrl: string | null = null;
private asyncFormat: 'json' | 'csv' = 'json';
private asyncDataLoaded = false;
private lastInlineRowsRef: ReadonlyArray<DataRow> | null = null;
private lastMorphFrom: ChartState | null = null; // the previous state for morphCtx construction
```

**`apply()` logic additions:**
```
1. Inline data registration:
   if state.dataSource.type === 'inline':
     if state.dataSource.rows !== lastInlineRowsRef:
       store.register(`__inline__${widgetId}`, state.dataSource.rows)
       lastInlineRowsRef = state.dataSource.rows

2. Resolve effective data source name for ChartRenderer:
   - 'inline' → `__inline__${widgetId}`
   - 'named' → state.dataSource.name
   - 'async' → `__async__${widgetId}` (or '' if not loaded)

3. Build morphCtx if state._morphT is set and dataSource.keyField is set:
   if state._morphT !== undefined && dataSource.keyField && lastMorphFrom:
     const fromData = store.resolve(effectiveFromName, lastMorphFrom.transforms)
     const toData = store.resolve(effectiveToName, state.transforms)
     morphCtx = { fromData, toData, t: state._morphT, keyField: dataSource.keyField }

4. Pass typeOptions, dataLabels, referenceLines, gridlines, morphCtx to ChartRenderer.update()

5. lastMorphFrom = state (store for next tick)
```

**`onTick()` for heatmap — use blockProgress:**
```typescript
onTick(ctx: AnimationTickContext): void {
  if (this.lastState?.typeConfig.kind !== 'heatmap') return;
  const opts = this.lastState.typeConfig.options;
  if (!opts.timeField) return;
  // blockProgress-driven slice index
  const totalSlices = this.store.getTimeSliceCount(
    this.resolveSourceName(this.lastState.dataSource),
    opts.timeField,
  );
  const sliceIndex = Math.min(
    Math.floor(ctx.blockProgress * totalSlices),
    totalSlices - 1,
  );
  // Pass sliceIndex to ChartRenderer via a dedicated heatmap update call
  this.chartRenderer.updateHeatmapSlice(sliceIndex, this.lastState, this.widgetId, this.lastCoords!);
}
```

Note: `ChartDataStore` needs a `getTimeSliceCount(name, timeField)` method added (see Stream 3).

**`ILoadable.load()` implementation:**
```typescript
async load(_manifest: AssetManifest | null): Promise<void> {
  if (!this.asyncUrl) return;
  try {
    const resp = await fetch(this.asyncUrl);
    const rows = this.asyncFormat === 'csv'
      ? parseCsv(await resp.text())
      : (await resp.json() as DataRow[]);
    const normalized = normalizeDataInput(rows);
    this.store.register(`__async__${this.widgetId}`, normalized as Row[]);
    this.asyncDataLoaded = true;
  } catch (e) {
    console.error(`[ChartWidget] Failed to load async data from "${this.asyncUrl}":`, e);
  }
}
```

`parseCsv()` is a new small pure function in `data/transforms.ts`.

**Test file:** `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts` — MODIFY

Test cases:
1. Constructor creates widget with correct widgetId
2. `ILoadable.isLoaded` — true when no async URL; false before load(); true after load()
3. `_configureAsync()` sets URL; subsequent `load()` registers data in store under `__async__${id}`
4. `apply()` with inline source: registers rows on first apply, skips registration on second apply with same reference
5. `apply()` with inline source: re-registers rows when reference changes
6. `apply()` with named source: calls `store.resolve(name, transforms)` (no registration)
7. `onTick()` with heatmap typeConfig and blockProgress=0.5: sliceIndex = floor(0.5 * totalSlices)
8. `dispose()`: detaches DOM listeners, disposes chartRenderer, nulls scene
9. `nvsBounds` returns DEFAULT_CHART_STATE.nvsBounds before first apply()
10. `childDslComponents` includes all 13 V2 components

---

#### `packages/charts/src/elements/chart/render.ts` — MODIFY

**What changes:**
1. `ChartRenderInput` updated: `dataSource: ChartStateDataSource` replaces `dataSource: string`; add `typeOptions`, `dataLabels`, `referenceLines`, `gridlines`, `morphCtx`
2. `ChartRenderer.update()` routes data resolution through the new source type
3. Pass `typeOptions` to `activeRenderer.update(ctx)`
4. Remove flat type-specific fields from `ChartRenderContext` construction (no more `lineShape`, `pieTilt`, etc. passed individually)
5. Add `updateHeatmapSlice()` method for blockProgress-driven heatmap animation
6. `effectiveTheme` construction: `axisGap` and `legendGap` removed (now in `BarChartOptions` etc.)

**Key method signatures:**

```typescript
export type ChartRenderInput = Omit<ChartState, 'nvsX' | 'nvsY' | 'z'> & {
  readonly position: readonly [number, number, number];
};

export class ChartRenderer {
  constructor(private readonly store: ChartDataStore);
  mount(scene: THREE.Scene): void;
  update(state: ChartRenderInput, widgetId: string): void;
  updateHeatmapSlice(
    sliceIndex: number,
    state: ChartRenderInput,
    widgetId: string,
    coords: NVSCoordService,
  ): void;
  getInteractiveObjects(): THREE.Object3D[];
  resolveHoverInfo(intersection: THREE.Intersection): ChartHitInfo | null;
  dispose(scene: THREE.Scene): void;
}
```

**`resolveData()` private method:**
```typescript
private resolveData(dataSource: ChartStateDataSource, transforms: readonly DataTransform[], widgetId: string): ResolvedDataFrame {
  switch (dataSource.type) {
    case 'inline':  return this.store.resolve(`__inline__${widgetId}`, transforms);
    case 'named':   return this.store.resolve(dataSource.name, transforms);
    case 'async':   return this.store.resolve(`__async__${widgetId}`, transforms);
  }
}
```

**MorphContext construction in `update()`:**
```typescript
// Build morphCtx if _morphT is present and keyField is set
let morphCtx: MorphContext | undefined;
if (state._morphT !== undefined && state.dataSource.keyField && this.lastFromData) {
  morphCtx = {
    fromData: this.lastFromData,
    toData: data,
    t: state._morphT,
    keyField: state.dataSource.keyField,
  };
}
this.lastFromData = data; // store for next call
```

`private lastFromData: ResolvedDataFrame | null = null;`

**`createRenderer()` — unchanged dispatch logic, same 6 types**

**`isSmartRebuild` check remains within each per-type renderer — `render.ts` itself doesn't check.**

---

### Stream 3: Data Layer

**Developer 3 owns all of these files.**

#### `packages/charts/src/data/transforms.ts` — MODIFY

**What changes:**
1. Add `normalizeDataInput(input: DataInput): ReadonlyArray<Record<string, unknown>>` — columnar→rows transposition
2. Add `parseCsv(text: string): ReadonlyArray<Record<string, unknown>>` — lightweight CSV parser (header row + data rows; handles quoted fields)
3. Export both

**`normalizeDataInput()` algorithm:**
```
if Array.isArray(input): return input as-is
else (columnar object):
  keys = Object.keys(input)
  if keys.length === 0: return []
  length = input[keys[0]].length
  assert all columns same length (throw in dev, warn + truncate in prod)
  return Array.from({ length }, (_, i) => Object.fromEntries(keys.map(k => [k, input[k][i]])))
```

**`parseCsv()` algorithm:**
```
split by newline
first row = header fields (trimmed, quoted-string handling)
remaining rows = data rows → each field parsed to number if numeric, else string
return array of { field: value } objects
skip empty rows
```

**Test file:** `packages/charts/src/data/__tests__/transforms.test.ts` — MODIFY

New test cases:
1. `normalizeDataInput` — row array passthrough: `[{a:1}]` → `[{a:1}]`
2. `normalizeDataInput` — columnar 3-column: `{month:['Jan','Feb'], rev:[128,145]}` → `[{month:'Jan',rev:128},{month:'Feb',rev:145}]`
3. `normalizeDataInput` — empty columnar: `{}` → `[]`
4. `normalizeDataInput` — single-column columnar: `{x:[1,2,3]}` → `[{x:1},{x:2},{x:3}]`
5. `parseCsv` — basic: `"a,b\n1,2\n3,4"` → `[{a:1,b:2},{a:3,b:4}]`
6. `parseCsv` — quoted field: `"name,val\n\"Foo, Inc\",42"` → `[{name:'Foo, Inc',val:42}]`
7. `parseCsv` — trailing newline: handled without empty row
8. `parseCsv` — numeric detection: `"2024-01-01"` stays string; `"123.45"` → `123.45`

---

#### `packages/charts/src/data/ChartDataStore.ts` — MODIFY

**What changes:**
1. Add `getTimeSliceCount(name, timeField): number` — needed by ChartWidget.onTick()
2. Add `registerInline(widgetId, rows)` convenience method (thin wrapper around `register()` with `__inline__${widgetId}` key)
3. `register()` now accepts `DataInput` (not just `Row[]`) — normalizes via `normalizeDataInput()` before storing
4. Warning message update: inline source warning references the new API

**New method signatures:**
```typescript
/**
 * Returns the number of distinct time-slice values for a given time field.
 * Used by ChartWidget.onTick() for scroll-driven heatmap animation.
 */
getTimeSliceCount(name: string, timeField: string): number;

/**
 * Registers inline data for a chart widget, keyed by __inline__${widgetId}.
 * Thin wrapper around register() for the inline data source pattern.
 */
registerInline(widgetId: string, rows: ReadonlyArray<DataRow>): void;
```

**Updated `register()` signature:**
```typescript
register(
  name: string,
  rows: ReadonlyArray<Record<string, unknown>> | DataInput,
  filterGroupId?: string,
): void;
```
Internally calls `normalizeDataInput()` if the input is a `ColumnarData`.

**Test file:** `packages/charts/src/data/__tests__/ChartDataStore.test.ts` — MODIFY

New test cases:
1. `getTimeSliceCount` — 3 distinct week values → returns 3
2. `getTimeSliceCount` — unregistered source → returns 0
3. `registerInline` — registers under `__inline__${id}` key; resolvable via `resolve()`
4. `register()` with columnar data — transposed and stored correctly
5. `register()` with empty columnar data — stores empty rows, fields empty

---

#### `packages/charts/src/data/__tests__/ChartDataStoreIntegration.test.ts` — MODIFY

Add integration test scenarios:
1. Inline data → register via `registerInline` → resolve → correct rows
2. Named source → register → filter → re-resolve → filtered rows
3. Register columnar data → resolve → flat rows correct

---

### Stream 4: Shared Renderers

**Developer 4 owns all of these files.**

#### `packages/charts/src/renderers/shared/DataLabelRenderer.ts` — NEW

**What this file does:** Manages troika-three-text label instances for data point value labels. Called by per-type renderers when `ctx.dataLabels` is non-null.

**Full class specification:**
```typescript
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { ensureText } from '@brewsite/core';
import type { ChartTheme } from '../../themes/types';
import type { DataLabelEntry } from './IChartRenderer';

export class DataLabelRenderer {
  private readonly labelGroup: THREE.Group;
  private texts: ReturnType<typeof ensureText>[] = [];

  constructor(group: THREE.Group) {
    this.labelGroup = group;
  }

  /**
   * Updates troika-three-text instances to match the provided label entries.
   * Reuses existing Text instances; creates/removes as count changes.
   * Applies alignment-based Z and Y offsets relative to entry.position.
   */
  update(
    entries: DataLabelEntry[],
    theme: ChartTheme,
    opacity: number,
    fontUrl?: string,
  ): void;

  /** Removes all label text objects and releases resources. */
  dispose(): void;
}
```

**`update()` implementation details:**
- Grow/shrink the `texts` array to match `entries.length` using `ensureText()` and `labelGroup.remove()`
- For each entry:
  - Set `text.text` to `entry.text`
  - Set `text.position` from `entry.position`
  - `'above'` alignment: add `0.06` Z offset (slightly above geometry) — used by BarRenderer for bar-top labels
  - `'center'` alignment: no offset — used by PieRenderer for mid-slice labels
  - `'outside'` alignment: add `0.08` radial offset from the position direction — used by PieRenderer for exploded slice labels
  - Set font size from `theme.legend.fontSize * 0.85`
  - Set color from `theme.series[0]?.color ?? '#fff'`
  - Set opacity
  - Set `fontUrl` if provided; else troika built-in
  - Call `text.sync()`

**Test file:** `packages/charts/src/renderers/shared/__tests__/DataLabelRenderer.test.ts` — NEW

Test cases:
1. Instantiation: creates group with no children
2. `update()` with 3 entries: `texts.length === 3` after call
3. `update()` with 0 entries after 3: texts cleared, group has no text children
4. `update()` — 'above' alignment: position Z offset applied
5. `dispose()` — texts removed from group

Note: Tests use a mock `THREE.Group` accepting `add/remove` and real `DataLabelEntry` values. No actual Three.js renderer needed.

---

#### `packages/charts/src/renderers/shared/AxesRenderer.ts` — MODIFY

**What changes:**
1. Accept new `ChartAxisState` fields in `AxisRenderState`: `scaleType`, `domain`, `tickCount`, `nice`, `gridlines`, `gridlineOpacity`, `reverse`, `clamp`
2. New `gridlines?: boolean` field in `AxisRenderState` (per-chart override from `ctx.gridlines`)
3. Tick generation: use `axis.tickCount` hint when provided (pass to D3 tick generator)
4. Gridline rendering: when `axis.gridlines !== false` and `gridlines !== false`, draw horizontal gridlines for Y axis at each tick position using `PlaneGeometry` or `EdgesGeometry` lines
5. Log/time scale: when `scaleType === 'log'`, use `d3-scale.scaleLog()` for Y tick values; when `scaleType === 'time'`, parse ISO strings to Date before passing to `d3-scale.scaleTime()`
6. Domain override: when `axis.domain` is provided, pass to scale `.domain([min, max])` instead of computing from data

**Updated `AxisRenderState`:**
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
  /** Per-chart gridlines override from ChartRenderContext.gridlines */
  gridlines: boolean | null;
};
```

Note: Tick computation moves from individual renderers (BarRenderer currently computes ticks) into `AxesRenderer.update()`. Renderers pass domain extents; `AxesRenderer` handles scale type and tick generation.

Actually — to avoid breaking BarRenderer's data-access pattern, keep tick computation in each renderer for now. AxesRenderer just accepts the pre-computed tick arrays plus the axis config for gridlines/scale display. The `scaleType` field on ChartAxisState affects how AxesRenderer formats tick labels and whether it draws log-scale gridlines.

---

#### `packages/charts/src/renderers/shared/LegendRenderer.ts` — MODIFY

**What changes:**
1. Accept `title?: string`, `columns?: number`, `maxItems?: number` from `ChartLegendState`
2. `title`: render a troika Text above the legend entries
3. `columns`: when > 1 and position is 'top' or 'bottom', lay entries in N columns
4. `maxItems`: truncate series list after N items; append "X more..." text entry

**Updated `update()` signature:**
```typescript
update(
  series: ReadonlyArray<{ field: string; label?: string; color?: string }>,
  legend: ChartLegendState,
  theme: ChartTheme,
  opacity: number,
  fontUrl?: string,
): void;
```
(Previous signature was `update(series, theme, opacity, fontUrl)` — now also takes `legend` state for title/columns/maxItems.)

All callers in per-type renderers update their `legendRenderer.update()` call to pass the full `legend` state from `ctx` (available in `ChartRenderContext` as `ctx.legend` — wait, currently `legend` is not in `ChartRenderContext`. It needs to be added).

**Add `legend: ChartLegendState | null` to `ChartRenderContext`** (in `IChartRenderer.ts`).

---

#### `packages/charts/src/renderers/shared/ChartMaterialFactory.ts` — MODIFY

**What changes:**
1. Add `getColorFieldMaterial(color: THREE.Color, opacity: number): THREE.MeshPhysicalMaterial` — used by ScatterRenderer for per-datum colorField colors
2. Add static utility `interpolateColor(value: number, min: number, max: number, interpolator: ScatterChartOptions['colorInterpolator']): THREE.Color` — uses `d3-scale-chromatic` to map a normalized [0,1] value to a Color

Note: `d3-scale-chromatic` must be added as a package dependency in `packages/charts/package.json`.

**New method signatures:**
```typescript
/**
 * Returns a fresh MeshPhysicalMaterial for a specific datum color (colorField encoding).
 * Not cached — caller is responsible for disposal.
 */
getColorFieldMaterial(color: THREE.Color, opacity: number): THREE.MeshPhysicalMaterial;

/**
 * Maps a normalized [0,1] value to a Three.js Color using the specified d3-scale-chromatic interpolator.
 * Used by ScatterRenderer for continuous colorField encoding.
 */
static interpolateColor(
  normalizedValue: number,
  interpolator: 'blues' | 'reds' | 'viridis' | 'plasma',
): THREE.Color;
```

**Test file:** `packages/charts/src/renderers/shared/__tests__/ChartMaterialFactory.test.ts` — MODIFY

Add test cases:
1. `interpolateColor('viridis', 0)` → dark purple (assert RGB approximately)
2. `interpolateColor('viridis', 1)` → yellow (assert RGB approximately)
3. `getColorFieldMaterial` returns material with correct opacity

---

### Stream 5: Per-Type Renderers

**Developer 5 owns all of these files.** Stream 5 depends on Phase 0 (types) and can be written concurrently with Streams 1-4 since it owns different files. However, `DataLabelRenderer` from Stream 4 must be referenced — Developer 5 should write a temporary stub or import it from the planned file path and let it resolve at merge time.

**Key invariant for all renderers:** Replace reads of `ctx.lineShape`, `ctx.pieTilt`, `ctx.innerRadius`, `ctx.lineSmoothness`, `ctx.lineSubdivisions` with pattern-matched reads from `ctx.typeOptions.options`.

---

#### `packages/charts/src/renderers/bar/BarRenderer.ts` — MODIFY

**What changes:**
1. Read type-specific options from `ctx.typeOptions` (pattern match on `kind === 'bar'`)
2. Add stacked bar path — `buildStackedBars()` using `d3-shape.stack()`
3. Add horizontal orientation path — swap X/Y in `buildBars()` / `buildStackedBars()`
4. SmartRebuild condition: add `stackMode !== this.lastStackMode` and `orientation !== this.lastOrientation`
5. `DataLabelRenderer` integration: if `ctx.dataLabels !== null`, compute `DataLabelEntry[]` (bar-top positions) and call `dataLabelRenderer.update()`
6. MorphContext implementation: if `ctx.morphCtx`, interpolate bar heights between `fromData` and `toData` using keyField matching

**New private fields:**
```typescript
private lastStackMode: 'grouped' | 'stacked' = 'grouped';
private lastOrientation: 'vertical' | 'horizontal' = 'vertical';
private dataLabelRenderer: DataLabelRenderer | null = null;
```

**`buildStackedBars()` algorithm:**
```
Use d3-shape.stack()
  .keys(series.map(s => s.field))
  .order(d3-shape.stackOrderNone)
  .offset(d3-shape.stackOffsetNone)
  applied to data.rows

For each series layer (si) in stacked output:
  For each datum (di) in layer:
    [y0, y1] = layer[di]
    barH = yScale(y1) - yScale(y0)
    yPos = yScale(y0) + barH / 2
    Create BoxGeometry(bandwidth, barH, depth)
    mesh.position.set(xPos + bandwidth/2, yPos, 0)
```

**MorphContext bar-height interpolation:**
```
if ctx.morphCtx:
  Build a key→value map from morphCtx.fromData keyed by keyField
  For each bar datum in toData:
    fromValue = fromData.get(datum[keyField])?.[series.field] ?? 0
    toValue = datum[series.field]
    interpolatedValue = lerp(fromValue, toValue, morphCtx.t)
    Use interpolatedValue for bar height
  If key not found in fromData: bar enters from height=0
  If key in fromData but not toData: bar exits to height=0
```

**Tick computation:** `BarRenderer` continues to compute X/Y ticks for `AxesRenderer`. Domain override: if `yAxis.domain` is set, use `[domain[0], domain[1]]` instead of `[0, maxY * 1.1]`.

**Test file:** `packages/charts/src/renderers/bar/__tests__/BarRenderer.test.ts` — MODIFY

Test cases:
1. Grouped bars (default): mesh count = rows × series
2. Stacked bars: mesh count = rows × series (same); Y positions are cumulative
3. Horizontal orientation: bar width and height dimensions swapped
4. SmartRebuild — stackMode change triggers rebuild (lastStackMode check)
5. SmartRebuild — orientation change triggers rebuild
6. Datum morphing: with morphCtx t=0 → from bar heights; t=1 → to bar heights; t=0.5 → midpoint
7. Datum morphing: new key in toData (not in fromData) → bar enters from height 0
8. Datum morphing: key in fromData not in toData → bar exits to height 0
9. DataLabels: if ctx.dataLabels non-null, 1 DataLabelEntry per datum per series

---

#### `packages/charts/src/renderers/scatter/ScatterRenderer.ts` — MODIFY

**What changes:**
1. Read `sizeField`, `colorField`, `pointShape`, `sizeScale`, `colorInterpolator` from `ctx.typeOptions.options` (kind === 'scatter')
2. `sizeField` → per-instance scale via `InstancedMesh.setMatrixAt` with non-uniform scale
3. `colorField` with ordinal string → palette colors from `theme.series` mapped to unique string values
4. `colorField` with numeric → `ChartMaterialFactory.interpolateColor()` from `d3-scale-chromatic`
5. MorphContext: interpolate point positions between fromData and toData by keyField
6. SmartRebuild: add `sizeField !== lastSizeField`, `colorField !== lastColorField` conditions

**Algorithm for `colorField` ordinal vs. numeric detection:**
```
Inspect first non-null value:
  if typeof === 'string' → ordinal → palette mode
  if typeof === 'number' → continuous → interpolator mode
```

**DataLabelRenderer**: scatter doesn't use data labels (no `ChartDataLabels` UI for scatter in V2).

**Test file:** `packages/charts/src/renderers/scatter/__tests__/ScatterRenderer.test.ts` — new or modify existing

Test cases:
1. Basic scatter: instanceCount matches data.rows.length
2. sizeField encoding: matrix scale for row with large value > scale for row with small value
3. colorField ordinal: InstancedMesh has distinct colors for distinct string values
4. colorField numeric: InstancedMesh colors lie on the viridis spectrum
5. MorphContext: point positions interpolated by keyField at t=0.5
6. SmartRebuild: sizeField change triggers rebuild

---

#### `packages/charts/src/renderers/area/AreaRenderer.ts` — MODIFY

**What changes:**
1. Read `stackMode`, `fillOpacity` from `ctx.typeOptions.options` (kind === 'area')
2. Stacked area: use `d3-shape.stack()` to compute stacked layers; each layer rendered as extruded shape
3. Band areas: if `series[i].bandField` is set, render area between `field` (upper) and `bandField` (lower)
4. SmartRebuild: track `lastStackMode` field per Q7 decision

**Stacked area algorithm:**
```
stacked = d3.stack().keys(series.map(s=>s.field))(data.rows)
For each layer si:
  Create a THREE.Shape from the stacked layer's [y0,y1] values across x positions
  Extrude with depth from bounds.depth
  Color from theme.series[si]
  fillOpacity from typeOptions.fillOpacity ?? theme.area?.fillOpacity ?? 0.8
```

**SmartRebuild condition (Q7):**
```typescript
const needsRebuild =
  data.rows.length !== this.lastDataLength ||
  effectiveSeries.length !== this.lastSeriesCount ||
  stackMode !== this.lastStackMode;
```

**Test file:** `packages/charts/src/renderers/area/__tests__/AreaRenderer.test.ts` — MODIFY

Test cases:
1. Stacked mode: y-positions of upper layer start where lower layer ends
2. stackMode change triggers rebuild (lastStackMode assertion)
3. Band area: series with `bandField` renders area between two fields
4. fillOpacity applied to material

---

#### `packages/charts/src/renderers/line/LineRenderer.ts` — MODIFY

**What changes:**
1. Read `lineShape`, `lineSmoothness`, `lineSubdivisions`, `showPoints` from `ctx.typeOptions.options`
2. `showPoints`: when true, add a small sphere or disc at each datum position
3. Reference lines: if `ctx.referenceLines` is non-null, draw them as horizontal/vertical THREE.Line objects in `axesGroup`
4. DataLabelRenderer: not used for LineRenderer in V2

**Reference line algorithm:**
```
For each referenceLine in ctx.referenceLines:
  axis === 'x': draw vertical line at xScale(referenceLine.value) from bottom to top of plot
  axis === 'y': draw horizontal line at yScale(referenceLine.value) from left to right of plot
  color from referenceLine.color ?? theme.axis.color
  add optional label text via DataLabelRenderer (or inline troika text)
```

**Test file:** `packages/charts/src/renderers/line/__tests__/LineRenderer.test.ts` — MODIFY

Test cases:
1. showPoints=true: sphere objects added to seriesGroup for each datum
2. Reference line: with referenceLines=[{axis:'y',value:200}], axesGroup contains a Line object at correct Y position
3. Line shape options propagated from typeOptions (existing logic, now sourced from typeOptions.options)

---

#### `packages/charts/src/renderers/pie/PieRenderer.ts` — MODIFY

**What changes:**
1. Read `innerRadius`, `pieTilt`, `explodeSlice` from `ctx.typeOptions.options`
2. `explodeSlice`: when matching slice is found, translate the slice mesh outward by `0.1 * outerRadius` in the direction of the slice centroid
3. DataLabels: if `ctx.dataLabels` non-null, compute `DataLabelEntry[]` for slice centroids and call `dataLabelRenderer.update()`
4. DataLabel position for pie: `alignment: 'outside'` for exploded slice, `'center'` otherwise

**Test file:** `packages/charts/src/renderers/pie/__tests__/PieRenderer.test.ts` — MODIFY

Test cases:
1. explodeSlice='Core Platform': that slice's mesh.position differs from non-exploded slices
2. DataLabels: entries count matches slice count; alignment 'center' for non-exploded

---

#### `packages/charts/src/renderers/heatmap/HeatmapRenderer.ts` — MODIFY

**What changes:**
1. Read `timeField`, `heightField`, `colorInterpolator` from `ctx.typeOptions.options`
2. `heightField`: encode a second numeric field as tile height (Z scale on InstancedMesh)
3. `colorInterpolator`: use `ChartMaterialFactory.interpolateColor()` for cell colors instead of the current linear interpolation
4. The `getTimeSlice()` call: the slice index is now passed in as part of the `update()` call context
5. Add `updateSlice(sliceIndex: number, ctx: ChartRenderContext): void` public method called by `ChartRenderer.updateHeatmapSlice()`

**`updateSlice()` method:** Called by `ChartRenderer.updateHeatmapSlice()` from `ChartWidget.onTick()`. Allows the heatmap to be updated without a full `update()` cycle.

**Test file:** Existing heatmap test — MODIFY

Test cases:
1. heightField encoding: tiles with higher field values have taller Z scale
2. colorInterpolator: viridis scale produces colors on the viridis spectrum
3. `updateSlice(1, ctx)`: shows data from slice index 1 only

---

### Phase 2 — Integration

After all Stream 1-5 files are merged, Phase 2 integration can proceed.

---

#### `packages/charts/src/compiler/handlers.ts` — MODIFY

**What changes:**
1. Import all per-type stubs from `stubs.ts` instead of `ChartWidget.ts`
2. Add guard handlers for new components: `ChartDataLabels`, `ReferenceLine`
3. Update existing guard handlers to import from `stubs.ts`

**Full content:**
```typescript
import { registerNode } from '@brewsite/core';
import {
  ChartData, ChartAxis, ChartSeries, ChartLegend,
  ChartDataLabels, ReferenceLine,
  BarChart, LineChart, ScatterPlotChart, PieChart, AreaChart, HeatMapChart,
} from '../elements/chart/stubs';

let chartHandlersRegistered = false;

export function registerChartHandlers(): void {
  if (chartHandlersRegistered) return;
  chartHandlersRegistered = true;

  // Child component guards — throw if used outside a chart type component
  const guardHandler = (name: string) => () => {
    throw new Error(`<${name}> must be nested inside a chart component (BarChart, LineChart, etc.).`);
  };

  registerNode(ChartData, guardHandler('ChartData'));
  registerNode(ChartAxis, guardHandler('ChartAxis'));
  registerNode(ChartSeries, guardHandler('ChartSeries'));
  registerNode(ChartLegend, guardHandler('ChartLegend'));
  registerNode(ChartDataLabels, guardHandler('ChartDataLabels'));
  registerNode(ReferenceLine, guardHandler('ReferenceLine'));

  // Per-type component guards (before chartPlugin.configureRegistry registers real handlers)
  // These are overwritten by configureRegistry — but guard against use before plugin init.
  registerNode(BarChart, guardHandler('BarChart'));
  registerNode(LineChart, guardHandler('LineChart'));
  registerNode(ScatterPlotChart, guardHandler('ScatterPlotChart'));
  registerNode(PieChart, guardHandler('PieChart'));
  registerNode(AreaChart, guardHandler('AreaChart'));
  registerNode(HeatMapChart, guardHandler('HeatMapChart'));
}

export function resetChartHandlerRegistrationForTesting(): void {
  chartHandlersRegistered = false;
}
```

**Test file:** `packages/charts/src/compiler/__tests__/handlers.test.ts` — MODIFY

Test cases:
1. `registerChartHandlers()` is idempotent (call twice — no double-registration errors)
2. `ChartDataLabels` guard throws when compiled outside chart context
3. `ReferenceLine` guard throws when compiled outside chart context

---

#### `packages/charts/src/player/chartPlugin.ts` — MODIFY

**What changes:**
1. Import stubs from `stubs.ts` instead of `ChartWidget.ts`
2. Register handlers for all 6 per-type components plus deprecated `Chart` in `configureRegistry()`
3. Each per-type handler calls the appropriate compile function and passes compiled `ChartTypeOptions`
4. Update `isChartStateLike()` guard to check `dataSource.type` instead of `dataSource: string`
5. Update `reconcileCompiledTrack()` to call `widget._configureAsync()` for async sources
6. The deprecated `Chart` handler wraps to call `compileChart()` with `kind` derived from `type` prop

**Handler pattern (example for BarChart):**
```typescript
registerNode(BarChart, (node, api, helpers) => {
  const props = node.props as BarChartDSL;
  const chartId = props.id;
  if (!chartId) throw new Error('<BarChart> requires an "id" prop.');

  if (!registry.get(chartId)) registerChartWidget(registry, chartId);

  const children = helpers.collectChildren(node);
  const { dataDsl, axisDsls, seriesDsls, legendDsl, dataLabelsDsl, referenceLineDsls }
    = extractChartChildren(children, BarChart, ChartData, ChartAxis, ChartSeries, ChartLegend, ChartDataLabels, ReferenceLine);

  const typeOptions: ChartTypeOptions = {
    kind: 'bar',
    options: compileBarChartOptions(props),
  };

  const state = compileChart(
    props, 'bar', typeOptions, dataDsl, axisDsls, seriesDsls,
    legendDsl, dataLabelsDsl, referenceLineDsls,
  );
  api.setWidgetState(chartId, state);
});
```

**`extractChartChildren()` helper (internal to chartPlugin.ts):**
```typescript
function extractChartChildren(
  children: unknown[],
  ...allowedChildTypes: Array<(...args: never[]) => null>
): {
  dataDsl: ChartDataDSL | null;
  axisDsls: ChartAxisDSL[];
  seriesDsls: ChartSeriesDSL[];
  legendDsl: ChartLegendDSL | null;
  dataLabelsDsl: ChartDataLabelsDSL | null;
  referenceLineDsls: ReferenceLineDSL[];
}
```

**Updated `isChartStateLike()`:**
```typescript
function isChartStateLike(state: unknown): state is ChartState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Partial<ChartState>;
  return (
    typeof s.type === 'string' &&
    CHART_TYPES.has(s.type) &&
    s.dataSource !== null && typeof s.dataSource === 'object' &&
    'type' in (s.dataSource as object) &&
    Array.isArray(s.series) &&
    typeof s.bounds?.width === 'number' &&
    typeof s.bounds?.height === 'number' &&
    typeof s.bounds?.depth === 'number'
  );
}
```

**Updated `reconcileCompiledTrack()`:**
```typescript
for (const tick of track.ticks) {
  for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
    if (!registry.get(widgetId) && isChartStateLike(state)) {
      const widget = registerChartWidget(registry, widgetId);
      if (state.dataSource.type === 'async') {
        widget._configureAsync(state.dataSource.url, state.dataSource.format ?? 'json');
      }
    }
  }
}
```

**`ChartPluginInstance` updated:**
```typescript
export type ChartPluginInstance = WidgetPlugin & {
  readonly store: ChartDataStore;
  getWidget(id: string): Pick<ChartWidget, 'onHover' | 'onSelect'> | undefined;
};
```
(Unchanged from V1 — same API.)

**Test file:** `packages/charts/src/compiler/__tests__/chartPlugin.test.ts` — MODIFY

Test cases:
1. `BarChart` handler: produces ChartState with `typeConfig.kind === 'bar'`, inline rows from `data` prop
2. `PieChart` handler: produces ChartState with `typeConfig.kind === 'pie'`, innerRadius in options
3. `ScatterPlotChart` handler: sizeField and colorField in `typeConfig.options`
4. Deprecated `Chart` handler: compiles to same runtime state as `BarChart` for same props
5. `isChartStateLike` correctly identifies V2 ChartState (dataSource is object)
6. `reconcileCompiledTrack` calls `_configureAsync` for async sources
7. `ChartData` without source in async chart: dataDsl.source is undefined — handled gracefully

---

#### `packages/charts/src/elements/chart/index.ts` — MODIFY

Remove stubs exported from ChartWidget, add stubs from stubs.ts and new V2 exports.

**New/updated exports:**
```typescript
export {
  BarChart, LineChart, ScatterPlotChart, PieChart, AreaChart, HeatMapChart,
  Chart, ChartData, ChartAxis, ChartSeries, ChartLegend, ChartDataLabels, ReferenceLine,
} from './stubs';
export type {
  BarChartProps, LineChartProps, ScatterPlotChartProps, PieChartProps,
  AreaChartProps, HeatMapChartProps, ChartDataProps, ChartAxisProps, ChartSeriesProps,
  ChartLegendProps, ChartDataLabelsProps, ReferenceLineProps,
} from './dsl';
export type { ChartState, ChartType, /* all V2 types */ } from './types';
export { DEFAULT_CHART_STATE } from './types';
export { compileChart, compileBarChartOptions, /* etc. */, functionalChartTransitionSpec } from './compile';
```

---

#### `packages/charts/src/index.ts` — MODIFY

**Updated public API surface:**

```typescript
// ─── DSL authoring surface ───────────────────────────────────────────────────
// V2: Per-type components
export { BarChart, LineChart, ScatterPlotChart, PieChart, AreaChart, HeatMapChart } from './elements/chart/stubs';
// V2: Shared child components
export { ChartData, ChartAxis, ChartSeries, ChartLegend, ChartDataLabels, ReferenceLine } from './elements/chart/stubs';
// Deprecated: generic Chart component
export { Chart } from './elements/chart/stubs';

// V2 prop types
export type {
  BarChartProps, LineChartProps, ScatterPlotChartProps, PieChartProps,
  AreaChartProps, HeatMapChartProps, ChartDataProps, ChartAxisProps,
  ChartSeriesProps, ChartLegendProps, ChartDataLabelsProps, ReferenceLineProps,
} from './elements/chart/dsl';

// ─── State types ─────────────────────────────────────────────────────────────
export type {
  ChartState, ChartType, ChartAxisState, ChartSeriesState, ChartLegendState,
  ChartTypeOptions, BarChartOptions, LineChartOptions, ScatterChartOptions,
  PieChartOptions, AreaChartOptions, HeatMapChartOptions,
  ChartStateDataSource, InlineDataSource, NamedDataSource, AsyncDataSource,
  ChartDataLabelsState, DataLabelsPosition, ReferenceLineState,
  DataRow, ColumnarData, DataInput,
} from './elements/chart/types';
export { DEFAULT_CHART_STATE } from './elements/chart/types';

export const CHART_TYPES = ['bar', 'line', 'area', 'pie', 'scatter', 'heatmap'] as const;

// ─── Compiler ────────────────────────────────────────────────────────────────
export {
  compileChart, compileBarChartOptions, compileLineChartOptions,
  compileScatterChartOptions, compilePieChartOptions, compileAreaChartOptions,
  compileHeatMapChartOptions, functionalChartTransitionSpec,
} from './elements/chart/compile';

// ─── Plugin ──────────────────────────────────────────────────────────────────
export { chartPlugin } from './player/chartPlugin';
export type { ChartPluginInstance } from './player/chartPlugin';

// ─── Player components ───────────────────────────────────────────────────────
export { ChartProvider } from './player/ChartProvider';
export type { ChartProviderProps } from './player/ChartProvider';
export { ChartTooltipOverlay } from './player/ChartTooltipOverlay';
export type { ChartTooltipOverlayProps } from './player/ChartTooltipOverlay';

// ─── Data layer ──────────────────────────────────────────────────────────────
export { ChartDataStore } from './data/ChartDataStore';
export { useChartData } from './data/useChartData';
export { useChartFilter } from './data/useChartFilter';
export { useChartStore, ChartStoreContext } from './data/ChartStoreContext';
export type { IFilterEngine } from './data/IFilterEngine';
export { SimpleFilterEngine } from './data/SimpleFilterEngine';
export { normalizeDataInput } from './data/transforms';
export type {
  DataTransform, FilterTransform, FilterOp, GroupByTransform, SortTransform, BinTransform,
  ResolvedDataFrame, FilterGroupId, ChartDimension, DataInput, ColumnarData, DataRow,
} from './data/types';

// ─── Themes ──────────────────────────────────────────────────────────────────
export { darkGlassChartTheme } from './themes/darkGlass';
export { neonCyberChartTheme } from './themes/neonCyber';
export { enterpriseChartTheme } from './themes/enterprise';
export { lightMinimalChartTheme } from './themes/lightMinimal';
export { createChartTheme } from './themes/createChartTheme';
export { CHART_THEMES } from './themes/index';
export type { ChartThemeOverrides } from './themes/createChartTheme';
export type { ChartTheme, ChartThemeName, ChartLegendTokens, ChartPieTokens } from './themes/types';

// V1 deprecated type exports (migration compat)
/** @deprecated V1 type. Use BarChartDSL, LineChartDSL, etc. from specific imports. */
export type { ChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL, ChartLegendDSL } from './elements/chart/types';
export type { ChartHoverInfo } from './elements/chart/ChartWidget';
```

---

#### `packages/charts/package.json` — MODIFY

Add `d3-scale-chromatic` dependency:
```json
{
  "dependencies": {
    "d3-scale-chromatic": "^3.0.0"
  },
  "devDependencies": {
    "@types/d3-scale-chromatic": "^3.0.0"
  }
}
```

---

### Phase 3 — Demo Page

**Can begin once Phase 1 streams are complete and at least the compile/widget layers are merged.**

---

#### Demo data files — all NEW

**`apps/examples/src/chart/data/saasMetrics.ts`**
```typescript
// SaaS metrics data for chart demo scenes.
// Two years of monthly data for datum-morphing demo.

export const saasMetricsYearA = [/* 12 months: { quarter, month, revenue, costs, profit } */];
export const saasMetricsYearB = [/* 12 months: same structure, different values */];
export const saasMetrics24Months = [/* 24 months: { month, arr, revenue, costs } */];
export const regionalRevenue = [/* { month, apac, emea, americas } x 12 */];
```

**`apps/examples/src/chart/data/teamData.ts`**
```typescript
export const teamPerformance = [
  { id: 't1', team: 'Growth', teamSize: 5, revenue: 420, region: 'EMEA' },
  { id: 't2', team: 'Platform', teamSize: 12, revenue: 890, region: 'APAC' },
  /* ... 15 teams total */
];
```

**`apps/examples/src/chart/data/productData.ts`**
```typescript
export const productRevenue = [
  { product: 'Core Platform', revenue: 520 },
  /* ... 7 products */
];
```

**`apps/examples/src/chart/data/heatmapData.ts`**
```typescript
// 7-day × 24-hour activity heatmap. 168 rows.
export const activityHeatmap = [
  { day: 'Mon', hour: 0, calls: 12, satisfaction: 4.1 },
  /* ... 168 rows */
];
```

**`apps/examples/public/data/metrics.json`**
JSON file for async loading demo. Contains `{ month, arr, revenue, costs }` for 12 months.

---

#### Scene files — all within `apps/examples/src/chart/scenes/`

Each scene file is a new `.tsx` file (or the existing `chartDemo.tsx` is replaced/supplemented).

**`apps/examples/src/chart/scenes/scene1-bar-morph.tsx`** — NEW
```tsx
// Scene 1a: Bar chart, Year A data (inline)
export const Scene1a = () => (
  <Scene id="chart-s1a" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />
    <BarChart
      id="revenue-comparison"
      data={saasMetricsYearA}
      theme="darkGlass"
      x={CHART_LAYOUT.x} y={CHART_LAYOUT.y} w={CHART_LAYOUT.w} h={CHART_LAYOUT.h}
      bounds={{ width: 0.4, height: 0.3, depth: 0.45 }}
    >
      <ChartData keyField="quarter" />
      <ChartAxis axis="x" field="month" label="Quarter" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs" label="Costs" />
      <ChartSeries field="profit" label="Profit" />
      <ChartLegend position="right" />
      <ChartDataLabels position="top" format=".0f" />
    </BarChart>
    <SceneTitleBox title="Year A — Revenue Breakdown" />
  </Scene>
);

// Scene 1b: Same chart ID, Year B data — triggers datum morphing
export const Scene1b = () => (
  <Scene id="chart-s1b" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />
    <BarChart
      id="revenue-comparison"
      data={saasMetricsYearB}
      theme="darkGlass"
      x={CHART_LAYOUT.x} y={CHART_LAYOUT.y} w={CHART_LAYOUT.w} h={CHART_LAYOUT.h}
      bounds={{ width: 0.4, height: 0.3, depth: 0.45 }}
    >
      <ChartData keyField="quarter" />
      <ChartAxis axis="x" field="month" label="Quarter" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs" label="Costs" />
      <ChartSeries field="profit" label="Profit" />
      <ChartLegend position="right" />
    </BarChart>
    <SceneTitleBox title="Year B — Revenue Breakdown" />
  </Scene>
);
```

**`apps/examples/src/chart/scenes/scene2-stacked-bar.tsx`** — NEW
```tsx
// Scene 2a: Stacked bars
// Scene 2b: Same data, horizontal orientation
// Same chart ID "stacked-revenue" across both scenes — orientation transition
```

**`apps/examples/src/chart/scenes/scene3-multiline.tsx`** — NEW
```tsx
// 3-series line chart with a $300k reference line
// <LineChart id="arr-trend" lineShape="circle" lineSmoothness={0.5}>
// <ReferenceLine axis="y" value={300} label="$300k Target" />
```

**`apps/examples/src/chart/scenes/scene4-stacked-area.tsx`** — NEW
```tsx
// Stacked area: APAC, EMEA, Americas. neonCyber theme.
// <AreaChart id="regional-revenue" stackMode="stacked" theme="neonCyber">
```

**`apps/examples/src/chart/scenes/scene5-bubble.tsx`** — NEW
```tsx
// 4D bubble chart: X=teamSize, Y=revenue, size=headcount, color=region
// <ScatterPlotChart id="team-bubble" sizeField="headcount" colorField="region">
// interactive={true} with ChartTooltipOverlay
```

**`apps/examples/src/chart/scenes/scene6-pie-donut.tsx`** — NEW
```tsx
// Scene 6a: Pie (innerRadius=0)
// Scene 6b: Donut (innerRadius=0.5) — same chart ID "product-split"
// Scene 6c: explodeSlice="Core Platform"
```

**`apps/examples/src/chart/scenes/scene7-heatmap.tsx`** — NEW
```tsx
// Heatmap: 7-day × 24-hour activity
// <HeatMapChart id="activity-heat" timeField="week" heightField="calls">
// Scroll-driven time animation via blockProgress
```

**`apps/examples/src/chart/scenes/scene8-linked-brush.tsx`** — NEW
```tsx
// Two charts sharing filterGroup="ops"
// <BarChart id="ops-bar" interactive={true} ...>
//   <ChartData source="opsData" filterGroup="ops" />
// </BarChart>
// <ScatterPlotChart id="ops-scatter" interactive={true} ...>
//   <ChartData source="opsData" filterGroup="ops" />
// </ScatterPlotChart>
// <ChartTooltipOverlay />
```

**`apps/examples/src/chart/scenes/scene9-async.tsx`** — NEW
```tsx
// <LineChart id="remote-chart" dataUrl="/data/metrics.json">
// Loading state: dimmed chart with HUD TextBox showing "Loading..."
// The widget shows empty until ILoadable.load() completes
```

**`apps/examples/src/chart/scenes/scene10-switcher.tsx`** — NEW
```tsx
// Same chart ID "switcher-demo", same data, cycling through types:
// Scene 10a: <BarChart>, Scene 10b: <LineChart>,
// Scene 10c: <AreaChart>, Scene 10d: <ScatterPlotChart>
// Type changes at t=0.5 midpoint (existing behavior)
```

---

#### `apps/examples/src/chart/widgetSetup.ts` — MODIFY

Add `monthlySaasData` (year A and B), `teamPerformance`, `activityHeatmap` registrations.
Remove old inline data from scene file.

```typescript
import { saasMetricsYearA, saasMetricsYearB, saasMetrics24Months, regionalRevenue } from './data/saasMetrics';
import { teamPerformance } from './data/teamData';
import { activityHeatmap } from './data/heatmapData';

export function registerChartDemoData(store: ChartDataStore): void {
  store.register('saas-year-a', saasMetricsYearA);
  store.register('saas-year-b', saasMetricsYearB);
  store.register('saas-24m', saasMetrics24Months);
  store.register('regional', regionalRevenue);
  store.register('teams', teamPerformance);
  store.register('heatmap', activityHeatmap, 'ops'); // filter group for linked brush
  // ... etc
}
```

---

#### `apps/examples/src/chart/ChartDemoPage.tsx` — MODIFY

Update imports to use V2 per-type components. Register all 10 scenes in the scene player sequence.

---

## 5. Work Stream Summary — No File Conflicts

### Phase 0 (Sequential — 2 devs; must complete before any Phase 1 stream)

| Dev | Files |
|-----|-------|
| P0-A | `packages/charts/src/elements/chart/types.ts` |
| P0-B | `packages/charts/src/renderers/shared/IChartRenderer.ts`, `packages/charts/src/data/types.ts` |

These three files have no dependencies on each other. P0-A and P0-B are truly parallel.

### Phase 1 (5 parallel streams — start after Phase 0)

| Stream | Dev | Files Owned (no overlaps) |
|--------|-----|--------------------------|
| S1: DSL+Compile | Dev 1 | `elements/chart/dsl.tsx`, `elements/chart/stubs.ts` (NEW), `elements/chart/compile.ts`, `elements/chart/layout.ts`, `elements/chart/__tests__/compile.test.ts`, `elements/chart/__tests__/layout.test.ts` |
| S2: Widget+Render | Dev 2 | `elements/chart/render.ts`, `elements/chart/ChartWidget.ts`, `elements/chart/__tests__/ChartWidget.test.ts` |
| S3: Data Layer | Dev 3 | `data/ChartDataStore.ts`, `data/transforms.ts`, `data/__tests__/ChartDataStore.test.ts`, `data/__tests__/transforms.test.ts`, `data/__tests__/ChartDataStoreIntegration.test.ts` |
| S4: Shared Renderers | Dev 4 | `renderers/shared/DataLabelRenderer.ts` (NEW), `renderers/shared/AxesRenderer.ts`, `renderers/shared/LegendRenderer.ts`, `renderers/shared/ChartMaterialFactory.ts`, `renderers/shared/__tests__/DataLabelRenderer.test.ts` (NEW), `renderers/shared/__tests__/ChartMaterialFactory.test.ts` |
| S5: Per-Type Renderers | Dev 5 | `renderers/bar/BarRenderer.ts`, `renderers/bar/__tests__/BarRenderer.test.ts`, `renderers/scatter/ScatterRenderer.ts`, `renderers/area/AreaRenderer.ts`, `renderers/area/__tests__/AreaRenderer.test.ts`, `renderers/line/LineRenderer.ts`, `renderers/line/__tests__/LineRenderer.test.ts`, `renderers/pie/PieRenderer.ts`, `renderers/pie/__tests__/PieRenderer.test.ts`, `renderers/heatmap/HeatmapRenderer.ts` |

**Note on S5 and DataLabelRenderer:** Dev 5 imports `DataLabelRenderer` from its planned path. If S4 hasn't merged yet at the time of compilation, CI will fail — but the implementation is still correct. Coordinate merge order: S4 DataLabelRenderer → S5 per-type renderers.

**Note on S2 and stubs.ts:** `ChartWidget.ts` in S2 imports stubs from `stubs.ts` (created in S1). Recommend merging S1 stubs.ts first, or having Dev 2 create a local stub placeholder that S1 replaces.

### Phase 2 (Integration — after all Phase 1 streams merged)

| Dev | Files |
|-----|-------|
| Any | `compiler/handlers.ts`, `compiler/__tests__/handlers.test.ts`, `player/chartPlugin.ts`, `compiler/__tests__/chartPlugin.test.ts`, `elements/chart/index.ts`, `index.ts`, `package.json` |

One developer can handle Phase 2; it's primarily wiring the new compile functions and stubs into the plugin.

### Phase 3 (Demo — after Phase 2 merged)

| Dev | Files |
|-----|-------|
| Any | All `apps/examples/src/chart/` files — data constants, scenes, widgetSetup, ChartDemoPage |

---

## 6. Test Strategy Summary

| Module | Test file | Strategy |
|--------|-----------|----------|
| `compile.ts` | `__tests__/compile.test.ts` | Real DSL inputs → assert exact ChartState shape. No mocks. |
| `transforms.ts` | `data/__tests__/transforms.test.ts` | Real arrays in → real rows out. Pure function. |
| `ChartDataStore.ts` | `data/__tests__/ChartDataStore.test.ts` | Real store with SimpleFilterEngine. Register → resolve → assert. |
| `DataLabelRenderer.ts` | `renderers/shared/__tests__/DataLabelRenderer.test.ts` | Fake THREE.Group with stub add/remove. Assert text count and position offsets. |
| `ChartMaterialFactory.ts` | `renderers/shared/__tests__/ChartMaterialFactory.test.ts` | Assert material properties. |
| `BarRenderer.ts` | `renderers/bar/__tests__/BarRenderer.test.ts` | Fake THREE.Group. Real data rows. Assert mesh count and position values for stacked/grouped/horizontal/morph cases. |
| `ScatterRenderer.ts` | `renderers/scatter/__tests__/ScatterRenderer.test.ts` | Real InstancedMesh inspection via getMatrixAt/getColorAt. |
| `AreaRenderer.ts` | `renderers/area/__tests__/AreaRenderer.test.ts` | Real data. Assert stackMode triggers rebuild (lastStackMode). |
| `LineRenderer.ts` | `renderers/line/__tests__/LineRenderer.test.ts` | Assert reference line objects in axesGroup. |
| `PieRenderer.ts` | `renderers/pie/__tests__/PieRenderer.test.ts` | Assert explodeSlice offset, dataLabels entry count. |
| `ChartWidget.ts` | `__tests__/ChartWidget.test.ts` | Real ChartDataStore. Assert ILoadable isLoaded transitions. |
| `handlers.ts` | `compiler/__tests__/handlers.test.ts` | Assert guard throws on child components outside chart. |
| `chartPlugin.ts` | `compiler/__tests__/chartPlugin.test.ts` | Real compile pipeline: DSL tree → assert ChartState. |

**Testing invariants:**
- All compile.ts tests: pure function calls with literal inputs; assert exact output fields
- All renderer tests: construct renderer with real THREE.Group; pass ChartRenderContext with real data; assert mesh/geometry properties
- No `vi.fn()` mocking of internal functions — test at module boundaries
- No `any` in test code

---

## 7. Demo Page — 10-Scene Roster

| Scene | File | Chart Type | Key Feature Demo |
|-------|------|-----------|-----------------|
| 1a | `scene1-bar-morph.tsx` | BarChart (grouped, inline) | Inline data, data labels |
| 1b | `scene1-bar-morph.tsx` | BarChart (grouped, inline) | Datum morphing via keyField |
| 2a | `scene2-stacked-bar.tsx` | BarChart (stacked) | stackMode="stacked" |
| 2b | `scene2-stacked-bar.tsx` | BarChart (horizontal) | orientation="horizontal" |
| 3 | `scene3-multiline.tsx` | LineChart | Reference line, multi-series |
| 4 | `scene4-stacked-area.tsx` | AreaChart (stacked) | stackMode="stacked", neonCyber |
| 5 | `scene5-bubble.tsx` | ScatterPlotChart | sizeField + colorField (4D) |
| 6a | `scene6-pie-donut.tsx` | PieChart (pie) | innerRadius=0 |
| 6b | `scene6-pie-donut.tsx` | PieChart (donut) | innerRadius=0.5 |
| 6c | `scene6-pie-donut.tsx` | PieChart (exploded) | explodeSlice |
| 7 | `scene7-heatmap.tsx` | HeatMapChart | blockProgress time animation, heightField |
| 8 | `scene8-linked-brush.tsx` | BarChart + ScatterPlotChart | Cross-chart filterGroup |
| 9 | `scene9-async.tsx` | LineChart | dataUrl async loading |
| 10a-d | `scene10-switcher.tsx` | Bar→Line→Area→Scatter | Chart type transition |

---

## 8. Backward Compatibility

### `<Chart>` Generic Component

- Remains exported from `index.ts` with `@deprecated` JSDoc
- Its NodeHandler in `chartPlugin.configureRegistry()` maps the `type` prop to the appropriate `ChartTypeOptions`:
  ```typescript
  const kind = (props.type ?? 'bar') as ChartType;
  const typeOptions = buildTypeOptionsFromGenericProps(kind, props);
  ```
- `buildTypeOptionsFromGenericProps()` extracts the V1 flat props (`lineShape`, `pieTilt`, etc.) and maps them to the appropriate `typeConfig.options`
- Produces identical runtime ChartState as the per-type components

### V1 `ChartState` Migration

`ChartState` is a **breaking type change**. Consumers who:
1. Read `state.dataSource` (was `string`) → must switch to `state.dataSource.name` (for named) or handle discriminated union
2. Read `state.lineShape` → must read `state.typeConfig.options` (after narrowing to `kind === 'line'`)
3. Read `state.innerRadius` → must read `state.typeConfig.options` (after narrowing to `kind === 'pie'`)

### V1 `IChartRenderer` Migration

Custom `IChartRenderer` implementations (undocumented but possible): `ChartRenderContext` fields `lineShape`, `lineSmoothness`, `lineSub divisions`, `innerRadius`, `pieTilt` are removed. Implementations must read from `ctx.typeOptions.options`. Since `IChartRenderer` is not a public API surface (documented in the note), no deprecation window required.

### MIGRATION.md

Create `packages/charts/MIGRATION.md` documenting:
1. `<Chart type="bar">` → `<BarChart>` (show before/after)
2. `ChartState.dataSource: string` → `ChartState.dataSource: ChartStateDataSource`
3. Flat per-type props → `typeConfig.options` (with narrowing example)
4. New imports for per-type components
5. `chartPlugin()` unchanged — no action required
6. `ChartProvider` unchanged — still works; now optional for inline/async sources

### Semver

`@brewsite/charts` bumps from `1.x` to `2.0.0`. No other BrewSite packages are affected.

---

## 9. Dependency Changes

| Package | Change |
|---------|--------|
| `d3-scale-chromatic` | ADD as dependency (^3.0.0) |
| `@types/d3-scale-chromatic` | ADD as devDependency (^3.0.0) |
| `d3-shape` | Already present — ensure `stack()` is imported |
| `d3-scale` | Already present — no change |
| `d3-array` | Already present — no change |

Run `pnpm install` from repo root after updating `packages/charts/package.json`.

---

## 10. Implementation Order Checklist

```
Phase 0 (parallel, ~0.5 day):
  [ ] types.ts V2 — Dev P0-A
  [ ] IChartRenderer.ts V2, data/types.ts V2 — Dev P0-B
  [ ] Code review + merge Phase 0

Phase 1 (parallel, ~2-3 days):
  [ ] Stream 1: dsl.tsx, stubs.ts, compile.ts, layout.ts + tests
  [ ] Stream 2: render.ts, ChartWidget.ts + tests
  [ ] Stream 3: transforms.ts, ChartDataStore.ts + tests
  [ ] Stream 4: DataLabelRenderer.ts, AxesRenderer.ts, LegendRenderer.ts, ChartMaterialFactory.ts + tests
  [ ] Stream 5: All per-type renderers + tests
  [ ] Coordinate merge order: S1 stubs.ts before S2; S4 DataLabelRenderer before S5
  [ ] Code review + merge all Phase 1 streams

Phase 2 (sequential, ~1 day):
  [ ] handlers.ts, chartPlugin.ts, index.ts, package.json + tests
  [ ] pnpm install (d3-scale-chromatic)
  [ ] Code review + merge Phase 2
  [ ] pnpm typecheck (all packages)
  [ ] pnpm test (all packages)

Phase 3 (demo, ~1-2 days):
  [ ] Data constants files
  [ ] public/data/metrics.json
  [ ] 10 scene files
  [ ] widgetSetup.ts, ChartDemoPage.tsx updates
  [ ] Manual visual review in pnpm dev

Wrap-up:
  [ ] MIGRATION.md
  [ ] Bump @brewsite/charts version to 2.0.0 in package.json
  [ ] Update requirements/charts/prd/ documents
  [ ] Move plan to archive when fully implemented
```
