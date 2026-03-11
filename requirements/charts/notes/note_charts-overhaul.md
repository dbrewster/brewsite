---
title: Charts Package Overhaul
doc_type: note
owner: brewsite-product-manager
status: draft
updated: 2026-03-10
change_summary: "PM debate pass — inline rows moved into ChartState directly (fixes per-scene collision); FunctionDataSource cut from V2 scope; DSL/State layer types explicitly separated; Scene 6 smooth innerRadius animation descoped to V2.1; 7 open questions closed as decisions; ChartState.type documented as derived field with interpolateFn change; d3-scale-chromatic added as explicit dependency decision."
---

# @brewsite/charts — Overhaul Feature Note

## Problem Statement

The current `@brewsite/charts` package, shipped as V1, achieves native 3D chart rendering with D3 math and Three.js geometry. It works. But as usage has grown, five structural limitations have become clear:

**1. Data registration is always mandatory and always synchronous.**
Every chart requires data to be pre-registered in a `ChartProvider` by string key before the scene renders. There is no path to embed data inline in the DSL, no async fetch mechanism, and no support for function-returned datasets. Consumers building data-driven demo pages must always thread data through the React component hierarchy with a `ChartProvider` wrapper — even for a single chart with static data.

**2. The generic `<Chart type="...">` DSL conflates all chart types into one component.**
All six chart types share one `ChartDSL` type and one `ChartState` type. Props like `innerRadius`, `pieTilt`, `lineShape`, `lineSmoothness`, `lineSubdivisions`, and `timeField` are all on the shared type. There is no TypeScript narrowing — a consumer can set `innerRadius` on a bar chart and get no error. IDE autocomplete offers irrelevant props for every type. The DSL is not self-documenting.

**3. Multi-dimensional data encoding is underdeveloped.**
Scatter plots can only encode X and Y. There is no `sizeField` (bubble variant), no `colorField` (color encoding), and no concept of a third visual channel. Bar charts have no stacked variant — only grouped. Area charts have no stacked or banded variant. Heatmaps have a `timeField` in the types but the `onTick` animation is not driven by `blockProgress`.

**4. Axis configuration is minimal.**
`ChartAxisDSL` supports only `field`, `label`, and `format`. There is no way to set explicit domain bounds (min/max), choose a scale type (log, time, ordinal), control tick count, or toggle gridlines visibility. The BarRenderer hardcodes `maxY * 1.1` as the domain ceiling — consumers cannot override this.

**5. The demo page is thin.**
The existing `apps/examples/src/chart/` shows four scenes: bar, line, pie, scatter. All use static data, no transitions between datasets, no cross-chart filtering demo, no async loading, no multi-series showcase beyond bar+costs. It does not demonstrate what the package is capable of.

---

## Current System Analysis

### Architecture Summary

The package follows the core element module pattern:
```
elements/chart/
  types.ts       — ChartState, ChartDSL, ChartDataDSL, ChartAxisDSL, ChartSeriesDSL, ChartLegendDSL
  dsl.tsx        — prop type exports (no stubs — stubs are in ChartWidget.ts)
  compile.ts     — pure: DSL → ChartState (compileChart, functionalChartTransitionSpec)
  render.ts      — ChartRenderer: dispatches to per-type IChartRenderer instances
  ChartWidget.ts — implements ISceneElement + IRenderable + IAnimationController + IDslComposite
  layout.ts      — computeChartLayout: margin/plotFrame computation
  index.ts       — re-exports
```

DSL stubs (null-returning components) live in `ChartWidget.ts` alongside the class — a deviation from the pattern where stubs are in the Widget file.

### Data Layer

`ChartDataStore` is a per-engine instance (one per `chartPlugin()` call). It wraps a `SimpleFilterEngine` (or custom `IFilterEngine`) and provides:
- `register(name, rows, filterGroupId?)` — registers named data source
- `unregister(name)` — removes source on unmount
- `resolve(name, transforms)` — applies serializable transforms; memoized by (name, row-count, transforms-hash)
- `getTimeSlice(name, timeField, sliceIndex)` — used by HeatmapRenderer for time animation
- `applyFilter / clearFilters` — linked-brush cross-chart filtering
- `subscribeToSource` — reactive updates for `useChartData` hook

`ChartProvider` React component registers/unregisters data into the store via `useEffect`. It must be inside `EngineProvider` (to reach `ChartStoreContext`).

**Critical constraint:** `ChartState.dataSource` is a string key referencing the store. It is **required** — an empty string produces an empty chart with a console warning. There is no mechanism to put actual data rows into `ChartState`.

### Transforms

Four serializable transforms: `filter` (op/field/value), `groupBy` (field/aggregate), `sort` (field/direction), `bin` (field/thresholds). Applied in order by `applyTransforms()`. No function references — safe for SceneTrack baking.

### Renderers

Each chart type has a dedicated `IChartRenderer` in `renderers/{type}/`:
- **BarRenderer** — grouped bars only (no stacked), BoxGeometry per bar, smart rebuild: full geometry rebuild on count/series change, opacity-only update otherwise
- **LineRenderer** — CatmullRomCurve3 → ExtrudeGeometry (profile shapes) or THREE.Line; 6 profile shapes; multi-series at Z offsets; smart rebuild on count/series/shape changes
- **AreaRenderer** — extruded THREE.Shape from D3 area boundary
- **PieRenderer** — ExtrudeGeometry arc slices; innerRadius for donut; pieTilt rotation
- **ScatterRenderer** — InstancedMesh of SphereGeometry; smart partial update (setMatrixAt/setColorAt without geometry rebuild when count unchanged); 2D only — no sizeField, no colorField
- **HeatmapRenderer** — InstancedMesh of PlaneGeometry tiles; timeField/getTimeSlice for animation

### ChartState — key fields

```typescript
type ChartState = {
  type: ChartType;                    // single discriminant for all types
  dataSource: string;                 // required store key — no inline data
  transforms: readonly DataTransform[];
  xAxis: ChartAxisState | null;       // field + label + format only
  yAxis: ChartAxisState | null;       // field + label + format only
  series: readonly ChartSeriesState[]; // field + label + optional color only
  legend: ChartLegendState | null;
  theme: ChartThemeName | ChartTheme;
  opacity: number;
  interactive: boolean;
  lineShape?: ChartLineShape;         // line-only — pollutes shared type
  lineSmoothness?: number;            // line-only
  lineSubdivisions?: number;          // line-only
  innerRadius?: number;               // pie-only
  pieTilt?: number;                   // pie-only
  timeField?: string;                 // heatmap-only
  axisGap?: number;
  legendGap?: number;
  sceneTheme?: SceneTheme;
  nvsBounds: NVSRect;
  bounds: { width: number; height: number; depth: number }; // NVS fractions for w/h, world-space for depth
  nvsX: number; nvsY: number; z: number; rotation: [number, number, number];
};
```

### Transition Behavior

`functionalChartTransitionSpec`:
- `exitFn` / `enterFn` — opacity fade only
- `interpolateFn` — opacity + position (nvsX, nvsY, z); chart type switches at t=0.5 midpoint

No datum-level interpolation — when data changes between scenes with the same chart ID, the geometry rebuilds at the midpoint cutover. There is no mechanism to animate individual bars/points between datasets.

### What Works Well (Keep It)

- Per-type `IChartRenderer` dispatch — good abstraction boundary
- SmartRebuild pattern (geometry rebuild only on structural change, opacity-only update otherwise) — performant
- `ChartDataStore` memoization and filter engine abstraction (`IFilterEngine`) — extensible
- Serializable transforms — correct design, SceneTrack-safe
- `chartPlugin()` factory pattern — no singleton, per-engine isolation
- `computeChartLayout()` — handles axis/legend margin reservation cleanly
- `ChartTheme` token system with 4 presets + `createChartTheme` helper + sceneTheme integration
- NVS coordinate system for positioning and sizing

### What Needs Work (Overhaul Scope)

- Data access model (mandatory provider, no inline/async options)
- DSL surface (generic Chart vs. per-type components)
- Scatter: missing sizeField / colorField
- Bar: missing stacked variant and horizontal orientation
- Axis: missing domain control, scale type, tick count, gridlines toggle
- Heatmap: timeField animation not connected to `blockProgress`
- Demo page: thin, no compelling cross-type or data-transition scenes
- `ChartSeriesState` has no `sizeField` or `colorField` (noted in amendment docs but not fully implemented)

---

## Proposed Solution

### Theme 1 & 2: Flexible Data Providers + Provider Optionality

#### Why the provider exists at all

The `ChartProvider` serves three functions:
1. **Lifecycle management** — registers data on mount, unregisters on unmount (React-idiomatic)
2. **Cross-chart sharing** — multiple charts referencing the same source name share one dataset without duplication
3. **Filter group scoping** — linked-brush filtering requires a shared `ChartDataStore` scope

These are valid reasons. But they should not be _mandatory_ for the simple case: a single chart with static data that no other chart shares and that requires no filtering.

#### Two distinct layers: DSL input vs. compiled state

The data source concept spans two layers with different shapes. These must not be conflated:

**`ChartDataSourceDSL`** — what the consumer writes in JSX. Three authoring conveniences:
- `data={rows}` prop on `<BarChart>` etc. — inline array shorthand
- `<ChartData source="name">` child component — named reference to a ChartProvider-registered source
- `dataUrl="/api/metrics.json"` prop — async fetch shorthand

**`ChartStateDataSource`** — what appears in compiled `ChartState` / SceneTrack. All three variants are fully serializable:

```typescript
/** Inline static data — rows stored directly in ChartState. No ChartProvider needed. */
type InlineDataSource = {
  readonly type: 'inline';
  readonly rows: ReadonlyArray<Record<string, unknown>>;
};

/** Named reference to a ChartProvider-registered source (current behavior). */
type NamedDataSource = {
  readonly type: 'named';
  readonly name: string;
};

/** Async fetch — URL is serializable; fetched data is cached in widget memory. */
type AsyncDataSource = {
  readonly type: 'async';
  readonly url: string;
  readonly format?: 'json' | 'csv';  // default: 'json'
};

/** Compiled state type — all three variants are SceneTrack-safe. */
export type ChartStateDataSource =
  | InlineDataSource
  | NamedDataSource
  | AsyncDataSource;
```

**Function data sources** (`data={() => fn()}`) are explicitly **out of scope for V2**. The pure compile pipeline has no mechanism to extract a function from a JSX prop and deliver it to a widget instance — the compiler produces serializable ChartState and there is no side-channel to the widget. Named + inline + async covers all SDK consumer scenarios. Function sources are documented as a future consideration dependent on a Widget SDK reactive data provider interface.

**SceneTrack serialization:**
- `inline`: rows are plain JSON — fully serializable. A dev-mode warning is emitted if `rows.length > 500`, recommending a named source for large datasets.
- `named`: string key — fully serializable. Unchanged from V1.
- `async`: URL string + format string — fully serializable. Fetched data is cached in widget memory, not in SceneTrack.

#### DSL authoring surface

```tsx
// Option A — inline data (no ChartProvider needed):
<BarChart id="q1-revenue" data={q1Rows}>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>

// Option B — named source (current behavior, backward compatible):
<BarChart id="q1-revenue">
  <ChartData source="quarterly" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>

// Option C — async fetch:
<BarChart id="remote-chart" dataUrl="/api/metrics.json">
  <ChartAxis axis="x" field="date" />
  <ChartAxis axis="y" field="value" />
</BarChart>
```

**Async loading lifecycle:** `ChartWidget` implements `ILoadable` for async sources. `load()` (called by the RuntimeDriver before the tick loop starts) initiates the fetch and stores the promise. `apply()` checks promise resolution before invoking the renderer — if not yet resolved, the renderer receives an empty data frame and shows a loading state (e.g., via HUD overlay). This minimizes the empty-render window compared to "resolve on first apply" initialization. The architect should handle the edge case where `load()` has not yet been called (widget used outside a full RuntimeDriver lifecycle) with a graceful no-op render.

#### `ChartProvider` remains — but is optional

`ChartProvider` continues to exist for the named source pattern and cross-chart sharing. It is not removed. The change is: **if no `<ChartData source="...">` child is present AND a `data` prop is provided directly, the chart uses inline data**. Both models coexist.

Multiple `ChartProvider` instances on the same page are already supported (each uses the same `ChartDataStore` per engine, but data registered by one provider is visible to all charts in that engine). This does not change.

---

### Theme 3: Flexible Data Shape — `ChartDataSource` Type System

Beyond the source model, the shape of individual rows needs more flexibility:

**Currently supported:** `ReadonlyArray<Record<string, unknown>>` — flat object arrays.

**Proposed additions:**

```typescript
/** Columnar object needing transposition — e.g. { date: [...], value: [...] } */
type ColumnarData = Readonly<Record<string, ReadonlyArray<unknown>>>;

/** Auto-detect: if value is an array, treat as columnar column; if Record[], treat as rows */
type DataInput = ReadonlyArray<Record<string, unknown>> | ColumnarData;
```

Transposition: `{ month: ['Jan','Feb'], revenue: [128, 145] }` → `[{ month: 'Jan', revenue: 128 }, { month: 'Feb', revenue: 145 }]`.

Transposition happens in `ChartDataStore.register()` (for named sources) or in the compile/widget layer (for inline sources) — not in the renderer. Renderers always receive `ResolvedDataFrame` with flat rows.

**For async sources:** Fetch, parse (JSON array or CSV via a lightweight CSV parser), normalize to flat rows, store in widget cache. No streaming — data is aggregated fully in memory before first render. This is appropriate for presentation data scales (< 10,000 rows).

---

### Theme 4: Per-Chart-Type DSL Components

Replace `<Chart type="bar">` with specific typed components. The motivation is TypeScript DX: each chart type has a distinct prop set that TypeScript can validate at authoring time.

#### Proposed DSL surface

```tsx
// Bar chart — type-specific props: orientation, stackMode, barPadding
<BarChart id="revenue" orientation="vertical" stackMode="grouped">
  <ChartData source="quarterly" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  <ChartSeries field="revenue" label="Revenue" />
  <ChartSeries field="costs"   label="Costs" />
  <ChartLegend position="right" />
</BarChart>

// Line chart — type-specific props: lineShape, lineSmoothness, showPoints
<LineChart id="arr-trend" lineShape="circle" lineSmoothness={0.5}>
  <ChartData source="monthly" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="arr" />
  <ChartSeries field="arr" label="ARR" />
</LineChart>

// Scatter plot — type-specific props: sizeField, colorField, pointShape
<ScatterPlotChart id="team-perf" sizeField="teamSize" colorField="region">
  <ChartData source="teams" />
  <ChartAxis axis="x" field="teamSize" />
  <ChartAxis axis="y" field="quarterlyRev" />
</ScatterPlotChart>

// Pie / donut — type-specific props: innerRadius, pieTilt, explodeSlice
<PieChart id="products" innerRadius={0.4}>
  <ChartData source="revenue" />
  <ChartAxis axis="x" field="product" />
  <ChartAxis axis="y" field="revenue" />
  <ChartLegend position="right" />
</PieChart>

// Area chart — type-specific props: stackMode, fillOpacity
<AreaChart id="trends" stackMode="stacked">
  <ChartData source="monthly" />
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  <ChartSeries field="revenue" label="Revenue" />
  <ChartSeries field="costs"   label="Costs" />
</AreaChart>

// Heat map — type-specific props: timeField, colorField, heightField
<HeatMapChart id="activity" timeField="week">
  <ChartData source="heatData" />
  <ChartAxis axis="x" field="day" />
  <ChartAxis axis="y" field="hour" />
  <ChartSeries field="activity" label="Activity" />
</HeatMapChart>
```

#### Architecture — how per-type components map to the runtime

Two implementation approaches:

**Approach A (Preferred): Per-type DSL stubs + single ChartWidget with discriminated ChartState.**
- `<BarChart>`, `<LineChart>`, etc. are DSL stubs (null-returning functions) — same as the current `<Chart>` stub
- Each has its own NodeHandler that validates type-specific props and calls `compileChart()` with a forced `type` field
- `ChartState` gains a discriminated union shape OR keeps the flat shape but adds type-specific sub-configs
- `ChartWidget` and `ChartRenderer` dispatch to per-type `IChartRenderer` as today
- No new widget classes — just new DSL components and NodeHandlers

**Approach B: Per-type Widget classes (BarChartWidget, LineChartWidget, etc.).**
- Each has its own state type (`BarChartState`, `LineChartState`)
- Cleaner type narrowing but 6× the widget boilerplate
- Complicates transitions between chart types with the same ID
- Not recommended

**Recommendation: Approach A.** Add per-type DSL stubs (null-returning functions) in `ChartWidget.ts`, register per-type NodeHandlers in `chartPlugin.configureRegistry`, compile to a discriminated `ChartState` or a flat `ChartState` with a type-specific options bag. The generic `<Chart>` component stays exported for backward compatibility (mapped to same handlers, deprecated).

#### ChartState — type-specific options

Rather than polluting the flat `ChartState`, introduce a `typeOptions` discriminated union:

```typescript
type BarChartOptions = {
  readonly orientation?: 'vertical' | 'horizontal';  // default: 'vertical'
  readonly stackMode?: 'grouped' | 'stacked';        // default: 'grouped'
  readonly barPadding?: number;                       // [0..1], default from theme
};

type LineChartOptions = {
  readonly lineShape?: ChartLineShape;
  readonly lineSmoothness?: number;
  readonly lineSubdivisions?: number;
  readonly showPoints?: boolean;
};

type ScatterChartOptions = {
  readonly sizeField?: string;
  readonly colorField?: string;
  readonly pointShape?: 'sphere' | 'cube' | 'cylinder';
  readonly sizeScale?: { readonly min: number; readonly max: number };
};

type PieChartOptions = {
  readonly innerRadius?: number;  // 0 = pie, > 0 = donut
  readonly pieTilt?: number;
  readonly explodeSlice?: string; // field value to explode outward
};

type AreaChartOptions = {
  readonly stackMode?: 'none' | 'stacked';
  readonly fillOpacity?: number;
};

type HeatMapChartOptions = {
  readonly timeField?: string;
  readonly heightField?: string;  // encode a second value as tile height
  readonly colorInterpolator?: 'blues' | 'reds' | 'viridis' | 'plasma';
};

type ChartTypeOptions =
  | { readonly kind: 'bar';      readonly options: BarChartOptions }
  | { readonly kind: 'line';     readonly options: LineChartOptions }
  | { readonly kind: 'scatter';  readonly options: ScatterChartOptions }
  | { readonly kind: 'pie';      readonly options: PieChartOptions }
  | { readonly kind: 'area';     readonly options: AreaChartOptions }
  | { readonly kind: 'heatmap';  readonly options: HeatMapChartOptions };

// ChartState gains this field instead of the flat optional props:
type ChartState = {
  // ... shared fields ...
  readonly typeConfig: ChartTypeOptions;
};
```

This is a **breaking change** to `ChartState`. Migration: renderers read `state.typeConfig.options` instead of `state.lineShape`, `state.pieTilt`, etc.

---

### Theme 5: Multi-Dimensional Data — Series / Dimension Model

#### Scatter plot — multi-dimensional encoding

Current scatter: `xAxis.field` (X position), `series[0].field` (Y position). Nothing else.

Proposed `ScatterChartOptions.sizeField` and `colorField`:

```typescript
// DSL
<ScatterPlotChart id="teams" sizeField="revenue" colorField="region">
  <ChartAxis axis="x" field="teamSize"     label="Team Size" />
  <ChartAxis axis="y" field="productivity" label="Productivity Score" />
</ScatterPlotChart>

// Renders: X=teamSize, Y=productivity, point size=revenue (scaleSqrt), color=region (ordinal scale)
```

`colorField` drives per-instance color via `InstancedMesh.setColorAt`. When `colorField` is an ordinal string field, use the theme's series color palette mapped to unique values. When it is a continuous numeric field, use a color interpolator (e.g., `d3-scale-chromatic` sequential scale).

`sizeField` drives per-instance scale via `InstancedMesh.setMatrixAt` with non-uniform scale. Scale range is configurable via `sizeScale.min / sizeScale.max` in `ScatterChartOptions`.

This turns scatter into a true bubble chart with 4 data dimensions: X, Y, size, color.

#### Bar chart — stacked variant

`BarChartOptions.stackMode: 'grouped' | 'stacked'`:

- **Grouped** (current): side-by-side bars per category, one per series
- **Stacked**: bars stacked vertically on same X position, each series segment on top of previous

Stacked requires tracking cumulative Y offsets per category. D3's `d3-shape` `stack()` function handles this cleanly. `BarRenderer` needs a stacked build path.

**Horizontal bar:** `BarChartOptions.orientation: 'horizontal'` — swap X/Y scales and rotate geometry. Axis labels swap. All other behavior identical.

#### Area chart — stacked and bands

`AreaChartOptions.stackMode`:
- `'none'` (current): single area or overlapping areas
- `'stacked'`: D3 `stackOffsetNone` — areas stacked cumulatively

Band areas (showing confidence intervals or ranges): a `<ChartSeries>` child with both `field` (upper bound) and `bandField` (lower bound). `AreaRenderer` fills the region between. This enables showing forecast ranges, error margins, or min/max envelopes.

#### Line chart — reference lines

A `<ReferenceLine>` child of `<LineChart>` — a horizontal or vertical constant-value line. Drawn by `LineRenderer` as a separate line at a fixed scale value. Common in business charts: "Target: $200k", "Threshold: 80%".

#### Heatmap — `blockProgress`-driven animation

Current `HeatmapRenderer` gets data for the current time slice via `store.getTimeSlice(name, timeField, sliceIndex)`. But `sliceIndex` is hardcoded in `ChartWidget.onTick` — it doesn't use `blockProgress` from `AnimationTickContext`.

Fix: in `ChartWidget.onTick(ctx)`, compute `sliceIndex = Math.floor(ctx.blockProgress * totalSliceCount)` and pass it to the renderer. This makes the heatmap animation scroll-driven — as the user scrolls through a scene, the heatmap steps through time slices.

---

### Theme 6: Full Options Per Chart Type

#### Axes

Current `ChartAxisDSL`: `axis`, `field`, `label`, `format`. No domain, no scale type, no tick count.

Proposed additions to `ChartAxisDSL`:

```typescript
type ChartAxisDSL = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;            // d3-format string

  // New:
  readonly scaleType?: 'linear' | 'log' | 'time' | 'band' | 'sqrt';  // default: auto-detect
  readonly domain?: readonly [number | string, number | string];       // explicit min/max
  readonly tickCount?: number;         // hint to D3 tick generator (approximate)
  readonly nice?: boolean;             // d3-scale .nice() rounding (default: true for linear)
  readonly clamp?: boolean;            // clamp out-of-domain values (default: false)
  readonly reverse?: boolean;          // flip the axis direction (default: false)
  readonly gridlines?: boolean;        // show gridlines for this axis (default from theme)
  readonly gridlineOpacity?: number;   // override theme gridline opacity
};
```

`scaleType: 'log'` — useful for revenue/growth data spanning orders of magnitude. `d3-scale.scaleLog()`.
`scaleType: 'time'` — when field values are Date objects or ISO strings. `d3-scale.scaleTime()`.
`domain` — explicit override prevents D3 auto-extent. Useful when showing a fixed Y axis across multiple scenes ("always 0 to 500").
`tickCount` — D3's tick generator treats this as a hint; actual count may differ.
`nice` — `scaleLinear().nice()` rounds domain to clean values (e.g., 0–435 → 0–500). Already the de facto behavior in BarRenderer via `maxY * 1.1`; making it explicit and configurable is cleaner.

#### Gridlines

Currently: gridlines are in the theme tokens only (`background.gridColor`). The `AxesRenderer` draws gridlines based on theme.

Proposed: per-axis `gridlines` prop on `<ChartAxis>` (above). Additionally, `<BarChart gridlines={false}>` as a convenience shorthand that disables gridlines for the entire chart without modifying the theme.

**Axis serialization note:** `domain` with `string` values is already serializable. `domain` with `Date` values is not — consumer should pass Unix timestamp numbers or ISO strings as the domain, formatted with the axis `format` string.

#### Legends

Current: `<ChartLegend visible position="right|left|top|bottom" />`. Sparse.

Proposed additions:

```typescript
type ChartLegendDSL = {
  readonly visible?: boolean;
  readonly position?: LegendPosition;

  // New:
  readonly title?: string;            // legend title above entries
  readonly columns?: number;          // multi-column layout for top/bottom legends
  readonly maxItems?: number;         // truncate after N items (show "X more...")
  readonly onClick?: never;           // interaction via onSelect callback on ChartWidget — not in DSL
};
```

#### Labels on data points

A common request for bar/pie charts: show the value directly on each bar or slice.

Proposed: `<ChartDataLabels>` child component:

```tsx
<BarChart id="revenue">
  <ChartDataLabels position="top" format=".0f" />  // show value above each bar
  ...
</BarChart>
```

`position: 'top' | 'center' | 'outside'` — "top" = above bar, "center" = mid-bar, "outside" = outside pie slice. Rendered by the per-type renderer via troika-three-text.

#### Transitions — datum-level morphing

Current transitions are opacity+position only. When the same chart ID appears in two scenes with different data, the chart swaps at the midpoint (type midpoint logic in `interpolateFn`).

To animate bar heights, point positions, or slice angles between datasets, we need datum-level morphing. This is the most complex addition in the overhaul.

**Proposed mechanism:** Datum keying. Each row has an optional `key` field (configurable via `<ChartData keyField="id">`). When transitioning between two scenes with the same chart ID:
- If both data frames have matching keys, animate each datum from its source geometry to its target geometry using `ctx.t`
- If no keyField is set, fall back to current midpoint-swap behavior

Datum morphing happens in the renderer's `update()` — the renderer receives both `fromData` and `toData` frames and `ctx.t`, and interpolates geometry (bar heights via `BoxGeometry` height param, point positions via `setMatrixAt`, etc.).

This requires `interpolateFn` in `functionalChartTransitionSpec` to pass `t` into `ChartRenderer.update()` as a new field in `ChartRenderInput`. Significant renderer refactor.

**Priority assessment:** Datum-level morphing is high-impact but high-complexity. Recommend implementing keyField-based matching first for bar and scatter (the most compelling visual transitions), deferring line/area/pie morphing to a follow-on.

---

### Theme 7: Architecture Refactor

#### Current module structure problems

1. **`ChartState` is a catch-all type.** Per-type props (`lineShape`, `pieTilt`, `innerRadius`, `timeField`) pollute the shared state. Growing each chart type's options means growing the shared type.

2. **`ChartWidget.ts` exports DSL stubs.** The element module pattern says stubs belong in the Widget file — this is actually correctly followed. But the stubs for 5 child components (`ChartData`, `ChartAxis`, `ChartSeries`, `ChartLegend`) and the main `Chart` stub are all in `ChartWidget.ts`. Adding 6 per-type stubs to this file makes it large. Consider moving stubs to a dedicated `stubs.ts` file within the element.

3. **No per-type compile functions.** `compileChart()` is one large function. Adding per-type options requires type-specific branches. Should be refactored into `compileBarChart()`, `compileLineChart()`, etc., composed by `compileChart()` as a dispatcher.

4. **`BarRenderer` does not support stacked.** `BarRenderer.buildBars()` only does grouped. Adding stacked requires significant rework of the D3 stacking logic — separate build paths in the same class.

5. **`ScatterRenderer` has no size/color field encoding.** Adding sizeField/colorField requires extending `update()` with field resolution logic.

6. **`ChartRenderer` (render.ts) passes `ChartRenderInput` to `IChartRenderer.update()`.** Adding `fromData + toData + t` for datum morphing means changing the `IChartRenderer` interface — a breaking change for all 6 renderer implementations.

#### Proposed module changes

```
elements/chart/
  types.ts           — ChartState with ChartTypeOptions discriminated union
  dsl.tsx            — per-type DSL prop types (BarChartDSL, LineChartDSL, etc.)
  stubs.ts           — null-returning DSL stub functions (moved from ChartWidget.ts)
  compile.ts         — compileBarChart(), compileLineChart(), etc. + dispatcher
  render.ts          — ChartRenderer: unchanged in structure, updated IChartRenderer contract
  ChartWidget.ts     — widget class, imports stubs from stubs.ts
  layout.ts          — unchanged
  index.ts           — updated exports

renderers/
  bar/
    BarRenderer.ts   — add stacked build path, horizontal orientation
  line/
    LineRenderer.ts  — add showPoints, reference line support
  scatter/
    ScatterRenderer.ts — add sizeField, colorField encoding
  heatmap/
    HeatmapRenderer.ts — connect timeField animation to blockProgress
  area/
    AreaRenderer.ts  — add stackMode: 'stacked', band area support
  pie/
    PieRenderer.ts   — add explodeSlice support
  shared/
    IChartRenderer.ts   — update update() signature for datum morphing (optional ctx.t)
    AxesRenderer.ts     — add scaleType, domain, tickCount, nice, gridlines support
    LegendRenderer.ts   — add title, columns, maxItems
    DataLabelRenderer.ts — NEW: troika-text labels on data points
    ChartMaterialFactory.ts — add colorField-based per-instance coloring
```

#### Backward compatibility strategy

1. `<Chart>` generic component remains exported and functional — it compiles to the same runtime as the per-type components. It is deprecated (JSDoc `@deprecated`) but not removed.
2. `ChartState` change (adding `typeConfig`, removing flat per-type props) is a **breaking change** — major semver bump required. Migration guide must be provided.
3. Per-type components (`BarChart`, `LineChart`, etc.) are new exports — additive, no breaking change in themselves.
4. `IChartRenderer.update()` signature change — breaking for any consumer who has implemented a custom `IChartRenderer`. Document as breaking.

#### Three.js confinement

Strictly maintained: all Three.js code stays in `render.ts` and `renderers/**`. `types.ts`, `dsl.tsx`, `compile.ts`, `stubs.ts`, `layout.ts` remain Three.js-free. New data-source types (`ChartDataSource`) live in `data/types.ts` — no Three.js.

#### Testing strategy

- `compile.ts` per-type functions: pure, test with real inputs → assert `ChartState.typeConfig` matches expected discriminated value
- `transforms.ts`: already well tested; add tests for columnar data transposition
- `ChartDataStore`: add tests for inline data path (no-provider), async fetch mock
- `BarRenderer` stacked path: test with 3-series stacked data → assert cumulative Y positions
- `ScatterRenderer` size/color: test `setMatrixAt` scale and `setColorAt` values per row
- `AxesRenderer` domain/scaleType: test log scale tick computation, explicit domain clamping

---

### Theme 8: Demo Page

The new demo page at `apps/examples/src/chart/` should be a showcase piece — the kind of scene that makes someone say "I want that on my marketing site."

#### Scene roster (proposed)

**Scene 1: Animated Bar — same chart, two datasets**
- Chart ID: `"revenue-comparison"`
- Scene 1a: Q1–Q4 data for Year A
- Scene 1b: same chart ID, Q1–Q4 data for Year B
- Transition: bars morph height between datasets (keyField: 'quarter')
- Multi-series: Revenue, Costs, Profit — grouped bars in darkGlass theme
- Demonstrates: datum-level bar morphing, multi-series grouped bars

**Scene 2: Stacked Bar with Legend**
- Same data, `stackMode="stacked"` — bars stack to show total composition
- Horizontal orientation variant in Scene 2b (same IDs, orientation changes at midpoint)
- Demonstrates: stacked bars, horizontal bars, orientation transition

**Scene 3: Multi-Line with Reference Line**
- 3-line chart: Revenue, ARR, Costs over 24 months
- Reference line at Revenue target ("$300k")
- lineShape="circle" for profile tubes
- Demonstrates: multi-series lines, reference lines, profile shape options

**Scene 4: Area Chart — Stacked Bands**
- Stacked area: APAC, EMEA, Americas revenue over time
- `stackMode="stacked"` — fills accumulate upward
- NeonCyber theme
- Demonstrates: stacked area, per-theme visual contrast

**Scene 5: Scatter Bubble — 4D encoding**
- Team size vs. productivity, size = revenue, color = region
- sizeField and colorField active — true bubble chart
- Point labels on hover (via `ChartTooltipOverlay`)
- Demonstrates: 4-dimensional data encoding, interactive hover

**Scene 6: Pie → Donut → Exploded**
- Same chart ID "product-split"
- Scene 6a: Pie (`innerRadius={0}`)
- Scene 6b: Donut (`innerRadius={0.5}`) — `typeConfig` switches at midpoint (t=0.5); `innerRadius` does NOT animate smoothly in V2 (midpoint switch only)
- Scene 6c: `explodeSlice="Core Platform"` — largest slice pushed outward
- Demonstrates: pie/donut transition storytelling, slice explosion
- **V2 limitation:** Per-kind option interpolation (smooth `innerRadius` lerp) requires a dispatch table inside `interpolateFn` and is deferred to V2.1. The `typeConfig` discriminated union design does not preclude this — a future `interpolateFn` can inspect `from.typeConfig.kind === to.typeConfig.kind` and delegate to a per-kind interpolator. The architect must not design the `interpolateFn` signature in a way that forecloses same-kind option interpolation.

**Scene 7: Heatmap Time Animation**
- 7-day × 24-hour activity heatmap
- timeField="week" — scrolling through the scene advances the time slice
- heightField="calls" — tile height encodes a second metric
- Demonstrates: scroll-driven time animation, 5D heatmap visualization

**Scene 8: Cross-Chart Linked Brush (Interactive)**
- Two charts sharing filterGroup: a bar chart and a scatter plot
- `interactive={true}` on both
- Click a bar category → scatter updates to show only that category's points
- Tooltip overlay active
- Demonstrates: cross-chart filtering, interactive mode

**Scene 9: Async Data Loading**
- `dataUrl="/api/metrics.json"` on a line chart
- Loading state shown (dimmed chart with spinner via HUD overlay)
- Data appears when fetch resolves
- Demonstrates: async data source, loading state pattern

**Scene 10: Chart-Type Switcher**
- Same data, same chart ID: "switcher-demo"
- Scenes cycle through bar → line → area → scatter — same data, different visualization
- Type changes at the midpoint crossover (existing behavior)
- Data labels on bars in bar scene
- Demonstrates: chart type transition storytelling

#### Demo data requirements

Each scene needs purpose-built data. Generic "sales" data is fine but the scenarios should feel varied:
- SaaS metrics: MRR, ARR, churn rate over 24 months
- Team org data: department, headcount, revenue, cost-per-head
- Activity heatmap: realistic 7×24 hourly call volume grid
- Product revenue breakdown: 7–8 product lines

All data should be defined in `apps/examples/src/chart/data/` as typed constants — not inline in scene files.

---

## Key Design Decisions

### 1. Per-type DSL stubs share one ChartWidget

**Decision:** `<BarChart>`, `<LineChart>`, etc. are syntactic sugar — distinct DSL components with per-type TypeScript prop validation, but they all compile to `ChartState` and use one `ChartWidget` class. No per-type Widget subclasses.

**Rationale:** Widget proliferation is complex. The `IChartRenderer` dispatch is the right extensibility point — not the widget layer. Transitions between chart types on the same ID remain straightforward with a single widget.

### 2. `ChartState.typeConfig` discriminated union (vs. flat optional fields)

**Decision:** Replace flat optional per-type fields with a `typeConfig: ChartTypeOptions` discriminated union.

**Rationale:** Flat optional fields grow unboundedly as chart types gain options. The discriminated union makes type narrowing possible in renderers: `if (state.typeConfig.kind === 'scatter') { state.typeConfig.options.sizeField ... }`.

**Cost:** Breaking change to `ChartState`. The architect must determine whether to use a true discriminated union (cleaner but bigger breaking change) or a flat `typeOptions: Record<string, unknown>` escape hatch (backward compatible but loses type safety). Recommendation: true discriminated union; the breaking change is worth the DX gain.

### 3. Inline data is stored directly in ChartState

**Decision:** `inline` data source rows are stored directly in `ChartState` as `{ type: 'inline', rows: Row[] }`. Each compiled `ChartState` carries its own snapshot of inline data. `ChartWidget.apply()` registers the rows into `ChartDataStore` under the stable key `__inline__${widgetId}` when processing the `inline` source type. Registration is skipped when the rows reference is unchanged from the previous `apply()` call (reference equality check). The store evicts and re-registers on reference change.

**Rationale:** An auto-registration approach keyed only by chart ID is broken for multi-scene use — two scenes with the same chart ID but different inline data would collide, with the last registration winning. Storing rows directly in `ChartState` gives each scene its own deterministic data snapshot without naming collisions. Row arrays are plain JSON and fully serializable — the SceneTrack constraint (no function references or non-JSON-safe values) is not violated.

**SceneTrack memory note for architect:** The SceneTrack baker should store a reference to the inline array object rather than copying it per tick. Within a single scene, inline data does not change tick-to-tick — the baker can recognize identity and avoid duplication. A dev-mode warning is emitted if `rows.length > 500`, recommending a named source for large datasets.

### 4. Async sources use `ILoadable` — not first-apply initialization

**Decision:** `ChartWidget` implements `ILoadable` for async sources. `load()` (called by the RuntimeDriver before the tick loop starts) initiates the fetch and stores the promise. `apply()` checks promise resolution before invoking the renderer — if not yet resolved, the renderer receives an empty data frame. The fetched rows are cached in widget memory and registered into `ChartDataStore` under `__async__${widgetId}`. The architect should handle the edge case where `load()` has not been called (widget used outside a full RuntimeDriver lifecycle) with a graceful no-op render.

**Rationale:** URLs are serializable (safe for SceneTrack). Fetched data is not (arbitrary size). Initiating the fetch in `load()` rather than `apply()` minimizes the empty-render window — the data may be available or in-flight before the first tick. One loading frame remains possible on fast networks due to race conditions; this is acceptable for marketing demo use cases.

### 5. Datum morphing via keyField — optional, progressive enhancement

**Decision:** Datum-level morphing is opt-in via `<ChartData keyField="id">`. Without a keyField, existing midpoint-swap behavior is preserved. With a keyField, renderers receive both frames and interpolate.

**Rationale:** Mandatory datum morphing would require all 6 renderers to be rewritten simultaneously. Opt-in allows shipping the feature incrementally — start with bar and scatter (highest visual payoff), add others later.

### 6. `<Chart>` generic component stays, deprecated

**Decision:** Existing `<Chart type="bar">` usage continues to work. It is marked `@deprecated` in JSDoc. No removal timeline specified — removal is a future major version decision.

**Rationale:** Consumers have existing scenes using `<Chart>`. Breaking them unnecessarily damages adoption. The deprecated path compiles to identical runtime behavior.

### 7. `ChartState.type` becomes a derived field; `interpolateFn` updated accordingly

**Decision:** With `typeConfig: ChartTypeOptions` added to `ChartState`, the top-level `type: ChartType` field is retained as a derived, read-only convenience field: `type: state.typeConfig.kind as ChartType`. It is not independently interpolated.

The `functionalChartTransitionSpec.interpolateFn` is updated as follows:
- `type` is no longer interpolated as an independent field — it is derived from `typeConfig.kind`
- `typeConfig` switches at midpoint: `typeConfig: ctx.t < 0.5 ? from.typeConfig : to.typeConfig`
- The existing `type: ctx.t < 0.5 ? from.type : to.type` logic is removed from the interpolation body

Per-kind option interpolation (e.g., smooth `innerRadius` lerp within a same-kind transition) is deferred to V2.1. The `interpolateFn` signature must not foreclose it: a future implementation can dispatch on `from.typeConfig.kind === to.typeConfig.kind` to invoke a per-kind interpolator.

**Rationale:** Keeping `ChartState.type` as a derived field preserves backward compatibility for consumers who read `state.type` directly, while the `typeConfig` discriminated union becomes the canonical representation. The derivation is cheap and the interface remains clean.

---

## Resolved Design Decisions (formerly open questions)

The following questions were resolved during PM review and are presented as decisions for the architect.

1. **Function data sources — cut from V2 scope.** The pure compile pipeline has no mechanism to extract a function from a JSX prop and deliver it to a widget instance at runtime. Named + inline + async covers all SDK consumer use cases. Function sources are documented as a future consideration dependent on a Widget SDK reactive data provider interface.

2. **`ILoadable` for async chart data — use `ILoadable`.** `ChartWidget` implements `ILoadable` for async sources. `load()` initiates the fetch before the tick loop starts; `apply()` checks promise resolution before invoking the renderer. Graceful no-op render required when `load()` has not been called.

4. **Stacked bar D3 integration — use `d3-shape.stack()`.** `d3-shape` is already a dependency. The `stack()` function maps cleanly to the `ChartSeriesState` model (field name per series). Manual cumulative offset computation is not needed.

5. **`colorField` continuous scale — add `d3-scale-chromatic`.** For ordinal string fields, use the theme's series color palette. For continuous numeric fields, use `d3-scale-chromatic` sequential scales. At ~15KB gzip, this is justified for a professional 3D visualization toolkit. Add `d3-scale-chromatic` as a dependency.

6. **`ChartAxis.scaleType: 'time'` and date serialization — ISO strings or Unix ms.** `Date` objects cannot be serialized in SceneTrack. When `scaleType: 'time'`, field values and `domain` values must be numeric Unix timestamps (ms) or ISO 8601 strings. The AxesRenderer handles ISO string → Date conversion internally.

9. **Multiple `ChartProvider` instances — one store per engine, shared is correct.** `ChartDataStore` is one per engine (per `chartPlugin()` call). Multiple `ChartProvider` instances writing to the same store is the intended behavior — data registered by any provider is visible to all charts in that engine. No scoped sub-stores.

10. **Async demo data in examples — use Vite `public/` directory.** The examples app (Vite) serves `public/` directory files in dev and build modes. Place `apps/examples/public/data/metrics.json` (and any other demo JSON files) there. The `dataUrl` prop references these as `/data/metrics.json`.

## Open Questions for Architect

3. **Datum morphing renderer contract**: The updated `IChartRenderer.update()` signature for datum morphing breaks all 6 renderer implementations. The architect should define the exact new signature and whether `fromData + toData + t` are optional (backward-compatible, allows incremental rollout per renderer) or required (clean interface, forces simultaneous update of all 6). Recommendation: optional with explicit `isMorphTransition` flag to make intent clear.

7. **Stacked area + SmartRebuild condition**: The current SmartRebuild pattern checks row count and series count to determine whether a full geometry rebuild is needed. Stacked area mode changes geometry significantly for the same row/series counts. The rebuild condition must also track `stackMode` in `AreaChartOptions`. The architect should confirm this is included in the SmartRebuild spec for `AreaRenderer`.

8. **`ChartDataLabels` renderer placement**: Should `DataLabelRenderer` be a new shared renderer class in `renderers/shared/`, or should each per-type renderer handle its own label positioning? A shared class is DRY; per-type handling allows more precise positioning (e.g., above bar tops vs. outside pie slices vs. next to scatter points). Recommendation: shared class with a typed `LabelPlacement` hint passed from each per-type renderer to the shared class. Architect should confirm the interface design.

---

## Constraints

- **SceneTrack serialization is inviolable.** No function references, `Date` objects, or non-JSON-safe values may enter `ChartState`. All new fields must be serializable. Inline data rows are stored directly in `ChartState` as a plain JSON array — this is serializable and correct. Function data sources are excluded from V2 scope.

- **Three.js stays in `render.ts` and `renderers/**`.** New per-type compile functions in `compile.ts` remain Three.js-free. The `ChartStateDataSource` type and all data layer types are Three.js-free.

- **`@brewsite/core` dependency direction unchanged.** `@brewsite/charts` may import from core; core must not import from charts. Any shared utilities (e.g., a future columnar-transpose helper) belong in `data/types.ts` within the charts package.

- **D3 dependency scope**: The overhaul adds one new D3 module: `d3-scale-chromatic` (~15KB gzip) for `colorField` continuous scale support in scatter/heatmap. All other D3 modules in use (`d3-scale`, `d3-shape`, `d3-array`, `d3-format`, `d3-time-format`) remain unchanged.

- **`crossfilter2` dependency**: Already present for linked-brush filtering. No change to its role.

- **Semver impact**: The `typeConfig` discriminated union change to `ChartState` is a **major semver bump** for `@brewsite/charts`. The overhaul ships as a new major version (e.g., 2.0.0). The deprecated `<Chart>` generic component provides a migration bridge. A `MIGRATION.md` is required.

- **`IChartRenderer` is not a public API surface.** It is internal to the package — custom renderer implementations by consumers are not a documented use case. Breaking changes to `IChartRenderer.update()` are acceptable without a deprecation window.

- **Backward compatibility for `<Chart>` generic component**: The `<Chart type="bar">` DSL compiles to the same runtime state as `<BarChart>`. Both must work in the same scene. This means the NodeHandlers for per-type components and for the generic `Chart` must compile to the same `ChartState` format. The `typeConfig` discriminated union is populated from the `type` prop in the generic path.

- **Demo page is a private app, not a published package.** No API stability requirements. The demo can be rewritten fully without semver concerns.
