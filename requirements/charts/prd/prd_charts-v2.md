---
title: "@brewsite/charts V2 — Charts Package"
doc_type: prd
status: current
owner: brewsite-product-manager
last_updated: 2026-03-11
change_history:
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "Initial V2 PRD created post-implementation. Documents the full V2.0.0 API: per-type DSL components, three data source paths, ChartStateDataSource discriminated union, ChartTypeOptions discriminated union, multi-dimensional data encoding, data labels, reference lines, enhanced axis/legend controls, datum-level morphing, and NVS coordinate system. Breaking changes documented with migration path. Supersedes V1 implicit documentation; links to MIGRATION.md for upgraders."
  - date: 2026-03-11
    author: "Toolkit Product"
    summary: "V2.1.0 additions: reactive data binding (useLiveChartData hook + ChartDataStore additions), axis mapping functions (compute transform tier 1, useChartAccessors tier 2), bar chart entry animation via blockProgress/mesh.scale.y, extended MorphContext to LineRenderer and AreaRenderer, full theme coverage (5 new optional token groups + textOpacity and titleFontSize extensions), and chart bounding fixes (fittedMargins in ChartLayout, ScatterRenderer scale alignment, removal of absolute minPlotWidth floor). Semver: minor (2.0.0 → 2.1.0). No breaking changes. donut-to-pie morphing deferred to future version (not V2.1). prd_theming.md updated separately for theme token additions."
---

# @brewsite/charts V2 — Charts Package

## 1. Overview

`@brewsite/charts` is the native 3D chart element library for BrewSite scenes. V2.0.0 replaced the single generic `<Chart type="...">` component with six strongly-typed per-type DSL components, added three flexible data source paths (inline, async, named), introduced type-safe per-chart-type option groups via `ChartTypeOptions`, and expanded multi-dimensional data encoding for scatter (4D), stacked bar/area, band area fills, reference lines, and datum-level bar and scatter morphing across scenes. The NVS coordinate system unified chart sizing with the broader viewport layout model.

V2.1.0 adds five feature areas: reactive data binding via `useLiveChartData` and `useChartAccessors` hooks, a serializable `compute` transform for inline column derivation, bar chart entry animation driven by scroll `blockProgress`, extended cross-scene datum morphing to `LineRenderer` and `AreaRenderer`, complete theme coverage via five new optional token groups on `ChartTheme`, and correctness fixes to chart bounding/axis positioning.

This package affects `@brewsite/charts` exclusively.

---

## 2. Problem Statement

V2.0.0 left five gaps identified through usage:

1. **No reactive data path for inline charts**: `data={rows}` on a per-type component is baked into the `SceneTrack` at compile time. Consumers building live dashboards that update data on an interval have no way to propagate `setData(newRows)` into a rendered chart without a full page reload.

2. **No column-level data transforms**: all data-to-visual-channel mappings are field-name strings. Consumers who want log-scale axes, normalized values, or derived bubble sizes must pre-process data outside the DSL.

3. **No chart entry animation**: when a scene containing a chart appears, bar heights instantly snap to final values. The `enterFn` in `functionalChartTransitionSpec` only fades opacity.

4. **Incomplete theme coverage**: ten visual parameters — including bar padding, area fill opacity, gridline dash patterns, data label styling, reference line width, and legend text opacity — have no theme-level defaults. Consumers must set them scene-by-scene in DSL props or accept hardcoded renderer values.

5. **Chart bounding correctness**: charts in multi-chart scenes overflow their declared bounds due to three root causes: `AxesRenderer` using raw theme margin values rather than the fitted values produced by `fitMargins()`; `ScatterRenderer` internal range padding misaligning tick and point positions; and a hardcoded absolute `0.8` world-unit floor in `minPlotWidth` that doesn't scale with NVS-fractional bounds.

---

## 3. Goals & Success Metrics

**Primary goals (V2.0.0 — shipped):**
- Per-type DSL components provide TypeScript-narrowed props so consumers get only relevant options for each chart type.
- Three data source paths — inline, async, named — cover all common usage scenarios without forcing a `ChartProvider` when not needed.
- Multi-dimensional encoding (4D scatter, stacked bar/area, band area, pie explode) ships with V2.
- Chart bounds use NVS fractions so charts participate in the viewport layout model.
- Datum-level morphing between scenes with shared chart IDs and `keyField` works with no extra runtime code.

**Primary goals (V2.1.0 — current):**
- A consumer holding chart data in React state can call one hook to propagate updates into a live chart without recompiling the scene.
- A consumer can add log-scale or normalized axes by adding a `compute` transform to `<ChartData>` — no pre-processing outside the DSL.
- Bar charts can animate growing upward from zero on scene entry by setting one DSL prop.
- `LineChart` and `AreaChart` scenes with `keyField` morph data smoothly between scenes (consistent with `BarChart` and `ScatterPlotChart`).
- All 10 visual parameters identified as missing from `ChartTheme` have explicit theme-level tokens.
- Charts in all example scenes stay within their declared bounds with no axis label overflow.

**Success metrics (V2.0.0):**
- 347 tests passing, zero typecheck errors.
- TypeScript produces an error when `<BarChart>` receives `innerRadius` or `<PieChart>` receives `orientation`.
- A scene with `<BarChart data={rows}>` renders without `ChartProvider`.

**Success metrics (V2.1.0):**
- `pnpm --filter @brewsite/charts test` passes all tests including new ones from all five V2.1 feature areas.
- `pnpm --filter @brewsite/charts typecheck` passes with zero errors.
- `useLiveChartData` hook exported from `@brewsite/charts`; calling it with updated rows updates a live chart without scene recompile.
- A `<BarChart animateEntry>` shows bars growing from baseline to full height on first scene entry.
- `<LineChart>` and `<AreaChart>` with `keyField` morph Y positions between consecutive scenes.
- All example scenes pass visual inspection with no axis label overflow.

**Guardrail metrics (V2.0.0 and V2.1.0):**
- All V1 `ChartProvider` + named source patterns continue to work unchanged.
- `<Chart type="...">` (deprecated V1 syntax) continues to compile and render.
- All V2.0.0 `createChartTheme()` callers continue to work unchanged (new theme fields are optional).
- No existing `ChartState` public fields removed or signature-changed.

---

## 4. Non-Goals

- Smooth animated `innerRadius` transitions for donut-to-pie morphing. Deferred to a future version.
- `PieRenderer` datum morphing (arc angle interpolation). Deferred to V2.2 — requires `ExtrudeGeometry` rebuild per morph frame, violating the O(1) frame cost model.
- Function-based data sources (data computed at runtime from an arbitrary callback). Inline, async, and named sources — plus the `useChartAccessors` runtime accessor registry — cover all identified use cases.
- Left-to-right path-reveal entry animation for `LineChart` and `AreaChart`. V2.1 scopes entry animation to `BarChart` only. Line/area path reveal requires a clip-mask or progressive geometry approach; deferred to V2.2.
- `useChartData` read-side hook for inline data sources. Deferred to V2.2 — requires a new inline listener registry (`subscribeToInline` + `resolveInline`) on `ChartDataStore` that is orthogonal to V2.1 feature areas.
- CSS-based chart theming. Chart text and geometry are WebGL-rendered; CSS font-family strings do not apply.
- Automatic dark/light mode detection from `prefers-color-scheme`.
- Server-side rendering of chart geometry.
- Custom renderer plugin API (third-party `IChartRenderer` registrations).

---

## 5. Consumer Stories

**V2.0.0 (shipped):**
- As a toolkit consumer, I want to write `<BarChart id="rev" data={myRows}>` so that I can add a bar chart to a scene without wrapping the page in `ChartProvider`.
- As a toolkit consumer, I want to write `<LineChart id="metrics" dataUrl="/api/data.json">` so that the chart fetches and renders remote data at runtime without me managing fetch state.
- As a toolkit consumer, I want per-type components (`<BarChart>`, `<PieChart>`, etc.) so that TypeScript only shows me props that are relevant to the chart type I'm using.
- As a toolkit consumer, I want `<ScatterPlotChart sizeField="revenue" colorField="region">` so that I can encode a fourth dimension without custom code.
- As a toolkit consumer, I want `<ChartDataLabels position="top" format=".0f">` so that bar tops and pie slices show data values without overlay components.
- As a toolkit consumer, I want `<ReferenceLine axis="y" value={target} label="Goal">` so that I can annotate threshold lines directly in the DSL.
- As a toolkit consumer, I want scene-to-scene bar morphing triggered by a `keyField` match so that my data-comparison scenes animate smoothly with no extra code.
- As a toolkit consumer, I want `bounds={{ width: 0.5, height: 0.5 }}` to mean "50% of viewport" so that chart sizing is consistent with NVS positioning.

**V2.1.0 (current):**
- As a toolkit consumer, I want to call `useLiveChartData(chartsPlugin, 'my-chart', rows)` so that React state changes in `rows` propagate to the rendered chart without recompiling the scene.
- As a toolkit consumer, I want to add a `{ type: 'compute', outputField: 'log_revenue', operation: { fn: 'log', inputField: 'revenue', base: 10 } }` transform to `<ChartData>` so that I can use a log-scale axis without pre-processing data outside the DSL.
- As a toolkit consumer, I want to call `useChartAccessors(chartsPlugin, 'scatter', { sizeAccessor: r => Math.sqrt(r.area) })` so that I can attach arbitrary JavaScript accessor functions to a chart without embedding function references in the DSL.
- As a toolkit consumer, I want to set `<BarChart animateEntry animationDuration={0.4}>` so that bars grow upward from the floor on scene entry, synchronized to scroll progress.
- As a toolkit consumer, I want `<LineChart>` and `<AreaChart>` scenes with `keyField` to morph Y values between consecutive scenes just as `<BarChart>` does, without any additional configuration.
- As a toolkit consumer, I want `createChartTheme(myBase, { bar: { padding: 0.3 }, gridlines: { color: '#ff0', opacity: 0.2, visible: true } })` so that I can set chart-type-specific and gridline defaults at the theme level instead of scene-by-scene.

---

## 6. Functional Requirements

**V2.0.0 (shipped):**
1. Six per-type DSL components — `<BarChart>`, `<LineChart>`, `<ScatterPlotChart>`, `<PieChart>`, `<AreaChart>`, `<HeatMapChart>` — are exported from `@brewsite/charts`.
2. The deprecated `<Chart type="...">` continues to compile and render for backward compatibility. No removal timeline.
3. The `data` prop on per-type components accepts inline rows or columnar data and compiles to an `InlineDataSource` in `ChartState`. `ChartProvider` is not required.
4. The `dataUrl` prop on per-type components accepts a URL string and compiles to an `AsyncDataSource` in `ChartState`. `ChartProvider` is not required. Formats supported: `json` (default), `csv`.
5. The `<ChartData source="name">` child component compiles to a `NamedDataSource`, requiring `ChartProvider` to register the named source. This is the V1 path.
6. `ChartState.dataSource` is a `ChartStateDataSource` discriminated union with variants `InlineDataSource`, `NamedDataSource`, and `AsyncDataSource`.
7. Type-specific options are compiled into `ChartState.typeConfig: ChartTypeOptions`, a discriminated union where `kind` matches `ChartState.type`.
8. `<ChartAxis>` accepts `scaleType`, `domain`, `tickCount`, `nice`, `clamp`, `reverse`, `gridlines`, `gridlineOpacity` in addition to V1 `field`, `label`, `format`.
9. `<ChartSeries>` accepts `bandField` for the area band variant.
10. `<ChartLegend>` accepts `title`, `columns`, `maxItems` in addition to V1 `visible`, `position`.
11. `<ChartDataLabels>` is a child DSL component that enables data-point value labels with `position` and `format` props.
12. `<ReferenceLine>` is a child DSL component that draws a labeled threshold line with `axis`, `value`, `label`, `color` props.
13. `ChartState.bounds.width` and `bounds.height` are NVS fractions in the range `[0..1]`, not world-space units. `bounds.depth` remains world-space.
14. Datum-level bar and scatter morphing is triggered when two consecutive scenes contain a chart with the same `id` and a resolved `keyField`.
15. `ChartTooltipOverlay` accepts `nvsBounds: NVSRect` (required) in place of the removed `camera` and `domElement` props.

**V2.1.0 (current additions):**
16. `useLiveChartData(chartsPlugin, chartId, data)` is exported from `@brewsite/charts`. Calling it registers `data` as a live override for the chart identified by `chartId`. On every render where the `data` reference changes, the hook updates `ChartDataStore` directly, bypassing the SceneTrack. On unmount, the hook deregisters and the chart reverts to SceneTrack-baked data. This hook only affects charts whose `dataSource.type === 'inline'`. Named and async sources are unaffected.
17. `DataTransform` gains a new `ComputeTransform` union member. The `'compute'` transform derives a new column from an existing numeric field using a named operation (`log`, `sqrt`, `normalize`, `scale`, `add`). All operations are serializable; no function references in the SceneTrack.
18. `useChartAccessors(chartsPlugin, chartId, accessors)` is exported from `@brewsite/charts`. It registers function-based data accessors (`xAccessor`, `yAccessor`, `sizeAccessor`, `colorAccessor`) for a specific chart at runtime. Renderers check for accessor functions before falling back to `Number(row[field])`. The accessor registry persists for the hook's lifetime (across all scenes using the same chart ID).
19. `BaseChartDSL` gains `animateEntry?: boolean` and `animationDuration?: number`. When `animateEntry` is true, `BarRenderer` animates bar heights from zero using `mesh.scale.y = easeOutCubic(entryT)` where `entryT` is derived from `blockProgress / animationDuration`. Entry animation replays on every scene re-entry (consistent with scroll-driven animation model). Scoped to `BarRenderer` in V2.1.
20. `LineRenderer` and `AreaRenderer` implement `MorphContext`-driven datum morphing using a Map-based O(n) lookup by `keyField`. Morph behavior is consistent with existing `BarRenderer` and `ScatterRenderer` morphing.
21. `ChartTheme` gains five new optional token groups: `bar?: ChartBarTokens`, `area?: ChartAreaTokens`, `gridlines?: ChartGridlinesTokens`, `dataLabels?: ChartDataLabelsTokens`, `referenceLines?: ChartReferenceLineTokens`. `ChartAxisTokens` gains `titleFontSize?: number`. `ChartLegendTokens` gains `textOpacity?: number`. All new fields are optional — no breaking change to existing `createChartTheme()` callers.
22. `computeChartLayout()` returns `fittedMargins: FittedMargins` alongside `plotFrame`. `AxesRenderer` uses `fittedMargins` for all axis title and tick label positioning. `ScatterRenderer` uses domain-padded scales so tick positions and point positions are co-aligned. `minPlotWidth` and `minPlotHeight` use a purely relative percentage floor (48% / 42% of chart bounds), removing the absolute world-unit floor.

---

## 7. API Design

### 7.1 Per-Type DSL Components

```tsx
import {
  BarChart, LineChart, ScatterPlotChart,
  PieChart, AreaChart, HeatMapChart,
  ChartData, ChartAxis, ChartSeries, ChartLegend,
  ChartDataLabels, ReferenceLine,
} from '@brewsite/charts';

// Inline data — no ChartProvider required
<BarChart id="rev" data={myRows} theme="darkGlass" x={0.1} y={0.1} w={0.8} h={0.8}
  animateEntry animationDuration={0.4}>
  <ChartAxis axis="x" field="month" label="Month" />
  <ChartAxis axis="y" field="revenue" label="Revenue ($k)" gridlines />
  <ChartSeries field="revenue" label="Revenue" />
  <ChartSeries field="costs"   label="Costs" />
  <ChartLegend visible position="right" />
  <ChartDataLabels position="top" format=".0f" />
  <ReferenceLine axis="y" value={500} label="Target" color="#ff4400" />
</BarChart>

// Async fetch — no ChartProvider required
<LineChart id="metrics" dataUrl="/api/data.json" lineShape="circle" showPoints>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="arr" label="ARR ($k)" />
  <ChartSeries field="arr"     label="ARR" />
  <ChartSeries field="revenue" label="Revenue" />
</LineChart>

// Named source — requires ChartProvider
<ChartProvider data={{ monthly: rows }}>
  <BarChart id="named-rev">
    <ChartData source="monthly" filterGroup="dash" />
    <ChartAxis axis="x" field="month" />
    <ChartAxis axis="y" field="revenue" />
  </BarChart>
</ChartProvider>
```

### 7.2 Per-Type DSL Prop Types

```typescript
type BaseChartDSL = {
  readonly id: string;
  /** Inline rows or columnar data. Mutually exclusive with dataUrl. */
  readonly data?: DataInput;
  /** URL for async JSON/CSV fetch. Mutually exclusive with data. */
  readonly dataUrl?: string;
  readonly theme?: ChartThemeName | ChartTheme;
  readonly opacity?: number;
  readonly interactive?: boolean;
  readonly sceneTheme?: SceneTheme;
  readonly x?: number;   // NVS left edge [0, 1]
  readonly y?: number;   // NVS top edge [0, 1]
  readonly w?: number;   // NVS width [0, 1]
  readonly h?: number;   // NVS height [0, 1]
  readonly z?: number;
  readonly rotation?: readonly [number, number, number];
  readonly bounds?: { readonly width?: number; readonly height?: number; readonly depth?: number };
  readonly gridlines?: boolean;
  readonly children?: React.ReactNode;
  // V2.1 additions:
  /** Enable bar-grow entry animation on scene entry. Scoped to BarChart in V2.1. Default: false. */
  readonly animateEntry?: boolean;
  /**
   * Duration of entry animation as a fraction of blockProgress [0..1].
   * Animation completes when blockProgress reaches this value. Default: 0.4.
   */
  readonly animationDuration?: number;
};

type BarChartDSL = BaseChartDSL & {
  readonly orientation?: 'vertical' | 'horizontal';
  readonly stackMode?: 'grouped' | 'stacked';
  readonly barPadding?: number;
};

type LineChartDSL = BaseChartDSL & {
  readonly lineShape?: ChartLineShape;
  readonly lineSmoothness?: number;
  readonly lineSubdivisions?: number;
  readonly showPoints?: boolean;
};

type ScatterPlotChartDSL = BaseChartDSL & {
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly pointShape?: 'sphere' | 'cube' | 'cylinder';
  readonly sizeScale?: { readonly min: number; readonly max: number };
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

type PieChartDSL = BaseChartDSL & {
  readonly innerRadius?: number;   // [0..1] — 0 = pie, >0 = donut
  readonly pieTilt?: number;
  readonly explodeSlice?: string;
};

type AreaChartDSL = BaseChartDSL & {
  readonly stackMode?: 'none' | 'stacked';
  readonly fillOpacity?: number;
};

type HeatMapChartDSL = BaseChartDSL & {
  readonly timeField?: string;
  readonly heightField?: string;
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};
```

### 7.3 ChartStateDataSource — Discriminated Union

```typescript
type InlineDataSource = {
  readonly type: 'inline';
  readonly rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly keyField?: string;
};

type NamedDataSource = {
  readonly type: 'named';
  readonly name: string;
  readonly keyField?: string;
};

type AsyncDataSource = {
  readonly type: 'async';
  readonly url: string;
  readonly format?: 'json' | 'csv';
  readonly keyField?: string;
};

type ChartStateDataSource = InlineDataSource | NamedDataSource | AsyncDataSource;
```

### 7.4 ChartTypeOptions — Discriminated Union

```typescript
type ChartTypeOptions =
  | { readonly kind: 'bar';     readonly options: BarChartOptions }
  | { readonly kind: 'line';    readonly options: LineChartOptions }
  | { readonly kind: 'scatter'; readonly options: ScatterChartOptions }
  | { readonly kind: 'pie';     readonly options: PieChartOptions }
  | { readonly kind: 'area';    readonly options: AreaChartOptions }
  | { readonly kind: 'heatmap'; readonly options: HeatMapChartOptions };
```

### 7.5 ChartState (abridged — includes V2.1 additions)

```typescript
type ChartState = {
  readonly type: ChartType;
  readonly nvsX: number;
  readonly nvsY: number;
  readonly z: number;
  readonly rotation: readonly [number, number, number];
  readonly bounds: {
    readonly width: number;   // NVS fraction [0..1]
    readonly height: number;  // NVS fraction [0..1]
    readonly depth: number;   // World-space thickness
  };
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
  readonly typeConfig: ChartTypeOptions;
  readonly dataLabels?: ChartDataLabelsState;
  readonly gridlines?: boolean;
  readonly _morphT?: number;               // internal — injected during transitions
  // V2.1 additions:
  readonly animateEntry: boolean;          // default: false
  readonly animationDuration: number;      // default: 0.4
};
```

### 7.6 DataTransform — V2.1 Addition: ComputeTransform

```typescript
/**
 * V2.1: Derives a new computed column from an existing numeric field.
 * All operations are serializable — no function references.
 * Stored in ChartState.transforms[] and evaluated at runtime by ChartDataStore.resolve().
 */
type ComputeTransform = {
  readonly type: 'compute';
  readonly outputField: string;
  readonly operation:
    | { readonly fn: 'log'; readonly inputField: string; readonly base?: number }
    | { readonly fn: 'sqrt'; readonly inputField: string }
    | { readonly fn: 'normalize'; readonly inputField: string }  // output: [0, 1] over dataset range
    | { readonly fn: 'scale'; readonly inputField: string; readonly factor: number }
    | { readonly fn: 'add'; readonly inputField: string; readonly value: number };
};

type DataTransform =
  | FilterTransform
  | GroupByTransform
  | SortTransform
  | BinTransform
  | ComputeTransform;  // V2.1 addition
```

Usage:
```tsx
<ScatterPlotChart id="team-perf" sizeField="sqrt_headcount">
  <ChartData
    source="teams"
    transforms={[
      { type: 'compute', outputField: 'sqrt_headcount', operation: { fn: 'sqrt', inputField: 'headcount' } },
      { type: 'compute', outputField: 'log_revenue', operation: { fn: 'log', inputField: 'revenue', base: 10 } },
    ]}
  />
  <ChartAxis axis="x" field="teamSize" />
  <ChartAxis axis="y" field="log_revenue" label="Revenue (log₁₀)" />
</ScatterPlotChart>
```

### 7.7 Reactive Data Binding — V2.1 Hooks

```typescript
import { useLiveChartData, useChartAccessors } from '@brewsite/charts';
import type { ChartAccessorFunctions } from '@brewsite/charts';

// useLiveChartData — propagates React state changes into an inline chart
// Only effective when the chart's SceneTrack dataSource.type === 'inline'.
// Named/async sources are unaffected.
useLiveChartData(chartsPlugin, 'revenue-chart', revenueRows);
// chartsPlugin: value returned by chartPlugin(), passed to ScenePlayer's plugins prop.
// chartId: matches the `id` prop on <BarChart id="revenue-chart" data={initialRows}>.
// rows: any DataInput (row array or columnar). Hook normalizes before registering.

// useChartAccessors — attaches function-based data accessors by chart ID
// Accessors are stored in the plugin's accessorRegistry (not in the SceneTrack).
// Registry entry persists across all scenes using the same chart ID, for the hook's lifetime.
// On unmount, renderers fall back to Number(row[field]) / String(row[field]).
const accessors: ChartAccessorFunctions = useMemo(() => ({
  sizeAccessor: (row) => Math.sqrt(Number(row.headcount)),
  colorAccessor: (row) => String(row.region),
}), []);
useChartAccessors(chartsPlugin, 'team-perf', accessors);
```

**`useLiveChartData` full contract:**
- On mount and on every render where `rows` reference changes: calls `store.registerInline(widgetId, normalizedRows)` and marks a live override flag.
- On unmount: calls `store.deregisterInline(widgetId)`, clearing both the data and the override flag. The next `ChartWidget.apply()` re-registers SceneTrack-baked rows.
- Single-frame latency: the hook fires via `useEffect` (after first paint). The very first rendered frame shows SceneTrack-baked `initialRows`; subsequent frames show live data. For most use cases this is invisible.

**`useChartAccessors` stability note:** The `accessors` object must be stable across renders (e.g., stabilized with `useMemo`). If the consumer creates a new object literal on every render, the hook re-registers on every render — functionally correct but unnecessary. This is the consumer's responsibility and should be documented at the call site.

### 7.8 Child DSL Components

```typescript
// ChartAxis — V2 additions: scaleType, domain, tickCount, nice, clamp, reverse, gridlines, gridlineOpacity
<ChartAxis
  axis="y"
  field="revenue"
  label="Revenue ($k)"
  scaleType="linear"
  domain={[0, 1000]}
  tickCount={5}
  nice
  gridlines
  gridlineOpacity={0.3}
/>

// ChartSeries — V2 addition: bandField for area band
<ChartSeries field="revenue" label="Revenue" bandField="revenueMin" />

// ChartLegend — V2 additions: title, columns, maxItems
<ChartLegend visible position="right" title="Metrics" columns={1} maxItems={8} />

// ChartDataLabels — new in V2
<ChartDataLabels position="top" format=".0f" />

// ReferenceLine — new in V2
<ReferenceLine axis="y" value={500} label="Target" color="#ff4400" />

// ChartData with V2.1 compute transforms:
<ChartData
  source="sales"
  transforms={[
    { type: 'compute', outputField: 'log_arr', operation: { fn: 'log', inputField: 'arr', base: 10 } },
  ]}
/>
```

### 7.9 ChartTooltipOverlay — API (V2, no change in V2.1)

```typescript
// Before (V1, removed):
<ChartTooltipOverlay camera={engine.camera} domElement={canvas} />

// After (V2, current):
<ChartTooltipOverlay nvsBounds={chartWidget.nvsBounds} />

// For a fullscreen chart:
<ChartTooltipOverlay nvsBounds={{ x: 0, y: 0, w: 1, h: 1 }} />
```

---

## 8. Technical Considerations

### Compiler Pipeline

Each per-type DSL component is a null-returning stub function registered in the WidgetRegistry via `CUSTOM_NODE_HANDLER`. The compiler's node handler maps to the core `compileChart()` function with an inferred `kind`. Type-specific compile helpers extract per-type DSL props into the `ChartTypeOptions` union. `ChartState` is SceneTrack-safe: all fields are serializable plain values with no function references. V2.1 `animateEntry` and `animationDuration` are compiled from DSL props into `ChartState` as required fields with defaults (`false`/`0.4`).

### Datum-Level Morphing

When two consecutive scenes contain a chart with the same `id` and both have a resolved `keyField`, `functionalChartTransitionSpec` activates datum-level interpolation. `_morphT` is injected into `ChartState` by the `interpolateFn` during the scene transition. `ChartWidget.apply()` constructs a `MorphContext` and passes it to the active `IChartRenderer.update()`. In V2.0, `BarRenderer` and `ScatterRenderer` implement morphing. In V2.1, `LineRenderer` and `AreaRenderer` also implement morphing using a Map-keyed O(n) lookup by `keyField` value.

### Reactive Data Binding Architecture

`useLiveChartData` bypasses the SceneTrack lifecycle by writing directly to `ChartDataStore`. The SceneTrack still contains the initial data snapshot — the hook replaces it at runtime. `ChartDataStore` tracks active live overrides via `liveOverrides: Set<string>`. `ChartWidget.apply()` checks `store.hasLiveOverride(widgetId)` before writing SceneTrack-baked rows. On hook unmount, `store.deregisterInline(widgetId)` fires a registered callback in `ChartWidget` that resets `lastInlineRowsRef`, forcing re-registration of baked rows on the next tick. The hook-to-widget communication is callback-based — `_resetInlineRef` is not exposed on the public `getWidget()` API.

### Entry Animation

`ChartWidget` implements `IAnimationController`. `onTick(ctx)` runs before `apply()` each frame. `blockProgress` is accessed as `ctx.tick?.blockProgress ?? 0` (verified path — `AnimationTickContext` does not have a direct `blockProgress` field; it lives on `SceneTrackTick`). When `state.animateEntry === true`, `currentEntryT = Math.min(blockProgress / animationDuration, 1.0)` is stored as private state. `apply()` passes `entryT` to `ChartRenderer.update()` via `ChartRenderInput`, which threads it to `BarRenderer.update(ctx)` via `ChartRenderContext`. `BarRenderer` sets `mesh.scale.y = easeOutCubic(entryT)` — no `BoxGeometry` rebuild per frame (O(1)). Bar `BoxGeometry` origin is anchored at y=0 via `geometry.translate(0, barHeight/2, 0)` at construction time.

### Compute Transform Runtime Evaluation

`applyTransforms` runs at runtime inside `ChartDataStore.resolve()`, called from `ChartRenderer.resolveData()` during every `ChartWidget.apply()` (memoized by `(sourceName, filteredRowCount, transformsHash)`). `ComputeTransform` descriptors are baked into `ChartState.transforms[]` in the SceneTrack and evaluated against live store data at render time. For inline sources, row data is immutable post-bake so the compute result is effectively cached. For named sources, the transform re-runs on data changes (cache miss).

### Async Data Source

`AsyncDataSource` charts implement `ILoadable`. `ChartWidget.load()` fetches via the browser Fetch API and stores results in `ChartDataStore` under `__async__{widgetId}`. Charts render empty until `load()` resolves. Errors are logged but do not throw.

### NVS Coordinate System

`ChartWidget` implements `INVSBounded`. `bounds.width` and `bounds.height` are NVS fractions converted to world-space via `context.coords.toWorldSize()` at render time. V2.1 removes the absolute `0.8` world-unit floor from `minPlotWidth`, replacing it with a purely relative `bounds.width * 0.48` floor. `computeChartLayout()` now returns `fittedMargins: FittedMargins` alongside `plotFrame`; `AxesRenderer` uses these fitted values for all axis title and tick label positioning.

### Bundle Impact

- V2.0: `d3-scale-chromatic` added as a runtime dependency (color interpolators).
- V2.1: No new dependencies. `useLiveChartData` and `useChartAccessors` are thin React hooks with zero external deps.
- Tree-shaking: per-type stub functions are named exports; importing only `BarChart` does not pull in `ScatterPlotChart` renderers.

---

## 9. Breaking Change Assessment

### V2.0.0 — Major (1.x → 2.0.0)

| Symbol | Change |
|---|---|
| `ChartState.dataSource` | `string` → `ChartStateDataSource` (discriminated union) |
| `ChartState.typeConfig` | Added, required. |
| `ChartState.lineShape` | **Removed.** Moved to `typeConfig.options.lineShape` (when `kind === 'line'`). |
| `ChartState.lineSmoothness` | **Removed.** Moved to `typeConfig.options`. |
| `ChartState.lineSubdivisions` | **Removed.** Moved to `typeConfig.options`. |
| `ChartState.innerRadius` | **Removed.** Moved to `typeConfig.options` (when `kind === 'pie'`). |
| `ChartState.pieTilt` | **Removed.** Moved to `typeConfig.options`. |
| `ChartState.timeField` | **Removed.** Moved to `typeConfig.options` (when `kind === 'heatmap'`). |
| `ChartState.bounds.width` | World-space units → NVS fraction [0..1] |
| `ChartState.bounds.height` | World-space units → NVS fraction [0..1] |
| `ChartTooltipOverlayProps.camera` | **Removed.** |
| `ChartTooltipOverlayProps.domElement` | **Removed.** |
| `ChartTooltipOverlayProps.nvsBounds` | **Added, required.** |
| `IChartRenderer.update(ctx)` | `ctx.typeOptions` replaces flat ctx fields. |

**V1 compatibility:** `<Chart type="...">` is deprecated but functional. V1 named source patterns with `ChartProvider` continue to work. See `packages/charts/MIGRATION.md`.

### V2.1.0 — Minor (2.0.0 → 2.1.0)

No breaking changes. All additions are additive:

- `ChartState.animateEntry` and `animationDuration` are new required fields with defaults (`false`/`0.4`). Any code that constructs a `ChartState` object directly (not via `DEFAULT_CHART_STATE` spread) must add these fields. SceneTrack-baked states via the DSL compiler are handled automatically.
- `ChartTheme` gains five new optional token groups. Existing `createChartTheme()` callers with no new fields are unaffected — renderers have documented fallback defaults.
- `DataTransform` gains `ComputeTransform` as a new union member. Code that exhaustively switches on `DataTransform.type` must add a `'compute'` case to avoid TypeScript errors.
- `AxisRenderState` gains a required `fittedMargins: FittedMargins` field. Tests that construct `AxisRenderState` directly must add `fittedMargins: { left: 0, right: 0, top: 0, bottom: 0 }` as a stub.
- `BarRenderer` geometry origin anchoring changes: `BoxGeometry` is now anchored at y=0 (bottom of bar) rather than center. Tests that assert on bar `mesh.position.y` must update their expected values.

---

## 10. Dependencies

- `@brewsite/core` — `SceneTheme`, `NVSRect`, `INVSBounded`, `NVSCoordService`, `IAnimationController` type and value imports.
- `d3-scale-chromatic` — runtime dependency for color interpolators (added in V2.0).
- `d3-array`, `d3-scale`, `d3-shape`, `d3-format`, `d3-time-format` — existing runtime dependencies (unchanged).
- `troika-three-text` — WebGL text rendering (unchanged peer dependency chain).
- No new dependencies in V2.1.

---

## 11. Risks & Mitigations

**API regret on `typeConfig` shape (V2.0):** The `{ kind, options }` wrapper was chosen over a flat discriminated union to allow clean pattern-matching without property name collisions. Stable and extensible.

**Reactive data hook misuse (V2.1):** `useLiveChartData` bypasses SceneTrack baking. Consumers who call it on a chart with a named/async source will see no effect — this silent no-op could cause confusion. Mitigation: clear JSDoc on the hook stating the inline-only constraint, with a diagnostic `console.warn` in development mode if `dataSource.type !== 'inline'` and a live hook is registered.

**`useChartAccessors` reference instability (V2.1):** If the consumer creates a new accessor object on every render, the hook re-registers every render. Functionally correct but wasteful. Mitigation: document `useMemo` requirement in JSDoc. Consider a development-mode warning if the accessor reference changes on every render (debounced).

**`ComputeTransform.normalize` range semantics (V2.1):** `normalize` computes `[0, 1]` over the current filtered rows, not a fixed domain. When filters change, the normalized values change absolute scale. This is intentional and matches standard data-visualization conventions, but consumers expecting a fixed scale must use `scale` or pre-compute the normalization.

**Async fetch errors in production (V2.0):** `AsyncDataSource` charts that point to unavailable URLs render empty and log a console warning. A future iteration could expose an `onError` callback.

**NVS bounds migration burden (V2.0):** Consumers with explicit world-unit `bounds.width`/`bounds.height` in V1 DSL must re-author as NVS fractions. See MIGRATION.md.

---

## 12. Open Questions

None. All design questions for V2.0 and V2.1 resolved during PM debate and architect review. See:
- `requirements/charts/notes/note_charts-overhaul-v2.md` — V2.1 feature note with design decisions
- `requirements/charts/plans/plan_charts-overhaul-v2.md` — V2.1 implementation plan

---

## 13. Launch Criteria

**V2.0.0 (shipped):**
- [x] 347 tests passing, zero typecheck errors.
- [x] All six per-type DSL components exported from `@brewsite/charts`.
- [x] `ChartState.dataSource` is `ChartStateDataSource` discriminated union.
- [x] `ChartState.typeConfig` is `ChartTypeOptions` discriminated union.
- [x] `ChartTooltipOverlay` accepts `nvsBounds: NVSRect`, `camera`/`domElement` removed.
- [x] 10-scene demo page in `apps/examples` exercises all chart types and data source paths.
- [x] `packages/charts/MIGRATION.md` written covering all breaking changes.
- [x] `packages/charts/README.md` reflects V2 API.
- [x] `packages/charts/package.json` version is `2.0.0`.

**V2.1.0 (pending implementation):**
- [ ] `useLiveChartData` exported from `@brewsite/charts`. Hook updates a live inline chart when React state changes.
- [ ] `useChartAccessors` exported from `@brewsite/charts`. Registry persists across scenes; cleared on unmount.
- [ ] `ComputeTransform` exported from `@brewsite/charts`. All five operations (`log`, `sqrt`, `normalize`, `scale`, `add`) tested with real data.
- [ ] `<BarChart animateEntry>` grows bars from floor to full height on scene entry, synchronized to `blockProgress`.
- [ ] `<LineChart>` and `<AreaChart>` with `keyField` morph Y positions between consecutive scenes.
- [ ] All 10 theme token gaps resolved. Four built-in themes updated with explicit values for all new groups.
- [ ] `computeChartLayout()` returns `fittedMargins`. `AxesRenderer` uses fitted values — no axis label overflow in example scenes.
- [ ] `ScatterRenderer` tick positions and point positions co-aligned (domain-padding approach).
- [ ] Absolute `0.8` world-unit floor removed from `minPlotWidth`.
- [ ] `pnpm --filter @brewsite/charts test` passes all tests including V2.1 additions.
- [ ] `pnpm --filter @brewsite/charts typecheck` passes with zero errors.
- [ ] `packages/charts/package.json` version bumped to `2.1.0`.
- [ ] `packages/charts/MIGRATION.md` updated with V2.1 notes (additive changes, `animateEntry` geometry origin note for test authors).
- [ ] `packages/charts/README.md` updated with `useLiveChartData`, `useChartAccessors`, `animateEntry`, `compute` transform, and new theme tokens.

---

## 14. See Also

- **Migration guide:** `packages/charts/MIGRATION.md`
- **Theming PRD:** `requirements/charts/prd/prd_theming.md`
- **V2.1 feature note:** `requirements/charts/notes/note_charts-overhaul-v2.md`
- **V2.1 implementation plan:** `requirements/charts/plans/plan_charts-overhaul-v2.md`
- **Example scenes:** `apps/examples/src/chart/scenes/`
