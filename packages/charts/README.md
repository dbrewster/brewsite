# @brewsite/charts

## 1. Overview

`@brewsite/charts` adds native 3D chart elements to BrewSite scenes. Declare bar,
line, area, pie, scatter, and heatmap charts with a JSX DSL and the engine renders
them as animated Three.js geometry inside the BrewSite scene graph.

**Current version: 2.1.0** — V1 upgraders see [MIGRATION.md](./MIGRATION.md).

## 2. Installation

```bash
pnpm add @brewsite/charts
```

**Peer dependencies:**

| Package | Version |
|---|---|
| `@brewsite/core` | `workspace:*` or `>=0.1.0` |
| `react` | `>=18` |
| `three` | `>=0.160` |

## 3. Quick Start — Inline Data

No `ChartProvider` required when data is passed inline:

```tsx
import { useMemo } from 'react';
import { ScenePlayer, Scene, corePlugin } from '@brewsite/core';
import { chartPlugin, BarChart, ChartAxis, ChartSeries, ChartLegend } from '@brewsite/charts';

const salesRows = [
  { month: 'Jan', revenue: 120, costs: 85 },
  { month: 'Feb', revenue: 140, costs: 92 },
  { month: 'Mar', revenue: 110, costs: 78 },
];

function SalesPage() {
  const charts = useMemo(() => chartPlugin(), []);
  return (
    <ScenePlayer
      manifestUrl="/assets/manifest.json"
      plugins={[corePlugin(), charts]}
    >
      <Scene id="chart-scene">
        <BarChart id="revenue" data={salesRows} theme="darkGlass">
          <ChartAxis axis="x" field="month" label="Month" />
          <ChartAxis axis="y" field="revenue" label="Revenue ($)" />
          <ChartSeries field="revenue" label="Revenue" />
          <ChartSeries field="costs"   label="Costs" />
          <ChartLegend visible position="right" />
        </BarChart>
      </Scene>
    </ScenePlayer>
  );
}
```

## 4. Plugin Setup

`chartPlugin()` returns a `WidgetPlugin` that registers chart DSL handlers and
provides a per-engine `ChartDataStore`. Create one instance per `EngineProvider`:

```tsx
import { useMemo } from 'react';
import { EngineProvider, corePlugin } from '@brewsite/core';
import { chartPlugin } from '@brewsite/charts';

function App() {
  const charts = useMemo(() => chartPlugin(), []);
  return (
    <EngineProvider
      manifestUrl="/assets/manifest.json"
      plugins={[corePlugin(), charts]}
    >
      {/* scenes and layout here */}
    </EngineProvider>
  );
}
```

## 5. Data Sources

V2 supports three data source paths. Mix them freely across charts in the same scene.

### Inline data

Pass rows or columnar data directly via the `data` prop. `ChartProvider` not required.

```tsx
const rows = [
  { month: 'Jan', revenue: 120 },
  { month: 'Feb', revenue: 140 },
];

<BarChart id="revenue" data={rows}>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>
```

### Async fetch

Pass a URL via `dataUrl`. The widget fetches the data at runtime (JSON default, or CSV).
The chart renders empty until the fetch resolves. `ChartProvider` not required.

```tsx
<LineChart id="remote-chart" dataUrl="/api/metrics.json">
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="arr" />
</LineChart>

// CSV source:
<BarChart id="csv-chart" dataUrl="/data/sales.csv">
  {/* ... */}
</BarChart>
```

### Named source with `ChartProvider`

Register named datasets once and reference them from multiple charts. Supports
linked-brush filtering via `filterGroup`.

```tsx
import { ChartProvider, BarChart, LineChart, ChartData } from '@brewsite/charts';

<ChartProvider data={{ sales: salesRows, kpis: kpiRows }}>
  <BarChart id="bar1">
    <ChartData source="sales" filterGroup="dashboard" />
    {/* ... */}
  </BarChart>

  <LineChart id="line1">
    <ChartData source="kpis" filterGroup="dashboard" />
    {/* ... */}
  </LineChart>
</ChartProvider>
```

### `useChartData` hook

Read resolved data reactively in overlay components:

```tsx
import { useChartData } from '@brewsite/charts';

function Overlay() {
  const data = useChartData('sales');
  return <div>{data.rows.length} rows</div>;
}
```

### Reactive inline data — `useLiveChartData` (V2.1)

Propagate React state changes into an inline chart without recompiling the scene.
Only effective for charts whose `dataSource.type === 'inline'` (i.e., charts using
the `data={rows}` prop directly).

```tsx
import { useMemo, useState } from 'react';
import { chartPlugin, BarChart, ChartAxis, useLiveChartData } from '@brewsite/charts';

function LiveDashboard() {
  const charts = useMemo(() => chartPlugin(), []);
  const [rows, setRows] = useState(initialRows);

  // Propagates rows into the chart on every reference change.
  // The scene DSL still needs data={initialRows} to seed the SceneTrack.
  useLiveChartData(charts, 'live-chart', rows);

  // Update rows externally (e.g., on interval, WebSocket, etc.):
  useEffect(() => {
    const id = setInterval(() => setRows(fetchLatest()), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <ScenePlayer plugins={[charts]}>
      <Scene id="s1">
        <BarChart id="live-chart" data={initialRows} theme="darkGlass">
          <ChartAxis axis="x" field="month" />
          <ChartAxis axis="y" field="revenue" />
        </BarChart>
      </Scene>
    </ScenePlayer>
  );
}
```

**Notes:**
- The hook fires after first paint (`useEffect`). The very first frame shows `initialRows`; subsequent frames show live data. For most use cases this single-frame delta is invisible.
- Has **no effect** on named (`<ChartData source="...">`) or async (`dataUrl="..."`) data sources. Use `ChartProvider` + `ChartDataStore.register()` for reactive named sources.

## 6. Per-Type Components

V2 provides one component per chart type with narrowed TypeScript props.
The deprecated `<Chart type="...">` from V1 continues to work.

### `<BarChart>`

```tsx
<BarChart
  id="revenue"
  data={rows}
  orientation="vertical"
  stackMode="stacked"
  barPadding={0.2}
  theme="darkGlass"
  animateEntry          // V2.1: bars grow upward on scene entry
  animationDuration={0.4}  // V2.1: completes at 40% of blockProgress
>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  <ChartSeries field="revenue" label="Revenue" />
  <ChartSeries field="costs"   label="Costs" />
  <ChartLegend visible />
  <ChartDataLabels position="top" format=".0f" />
  <ReferenceLine axis="y" value={500} label="Target" />
</BarChart>
```

### `<LineChart>`

```tsx
<LineChart
  id="metrics"
  dataUrl="/api/data.json"
  lineShape="circle"
  lineSmoothness={0.5}
  showPoints={true}
>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="value" gridlines />
  <ChartSeries field="arr"     label="ARR" />
  <ChartSeries field="revenue" label="Revenue" />
</LineChart>
```

### `<ScatterPlotChart>` (4D encoding)

```tsx
<ScatterPlotChart
  id="scatter"
  data={rows}
  sizeField="revenue"
  colorField="region"
  pointShape="sphere"
  sizeScale={{ min: 0.05, max: 0.3 }}
  colorInterpolator="viridis"
>
  <ChartAxis axis="x" field="acquisitionCost" label="CAC ($)" />
  <ChartAxis axis="y" field="ltv"             label="LTV ($)" />
</ScatterPlotChart>
```

### `<PieChart>` / donut

```tsx
<PieChart
  id="market-share"
  data={rows}
  innerRadius={0.4}
  pieTilt={0.4}
  explodeSlice="North America"
>
  <ChartAxis axis="x" field="region" />
  <ChartAxis axis="y" field="share" />
  <ChartLegend visible position="bottom" />
  <ChartDataLabels position="outside" format=".1%" />
</PieChart>
```

### `<AreaChart>` (with band variant)

```tsx
<AreaChart id="range" data={rows} stackMode="stacked">
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="revenue" />
  {/* Band area: fills between revenue and revenueMin */}
  <ChartSeries field="revenue" bandField="revenueMin" label="Revenue Range" />
</AreaChart>
```

### `<HeatMapChart>`

```tsx
<HeatMapChart
  id="heatmap"
  data={rows}
  timeField="week"
  colorInterpolator="blues"
>
  <ChartAxis axis="x" field="day" />
  <ChartAxis axis="y" field="hour" />
</HeatMapChart>
```

## 7. Multi-Series Example

```tsx
<BarChart id="comparison" data={rows} theme="enterprise">
  <ChartAxis axis="x" field="quarter" label="Quarter" />
  <ChartAxis axis="y" field="revenue" label="Revenue ($k)" format=",.0f" gridlines />
  <ChartSeries field="revenue" label="Revenue" />
  <ChartSeries field="costs"   label="Costs" />
  <ChartSeries field="profit"  label="Profit" />
  <ChartLegend visible position="right" title="Metrics" />
  <ChartDataLabels position="top" format=".0f" />
</BarChart>
```

## 8. Scene-to-Scene Datum Morphing

Charts with the same `id` across consecutive scenes animate data values between
matched data points when `keyField` is set. In V2.1, morphing is supported in
`BarChart`, `ScatterPlotChart`, `LineChart`, and `AreaChart`.

```tsx
// Scene A
<BarChart id="revenue-comparison" data={yearARows}>
  <ChartData keyField="quarter" />
  <ChartAxis axis="x" field="quarter" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>

// Scene B — same id + keyField triggers datum-level morphing
<BarChart id="revenue-comparison" data={yearBRows}>
  <ChartData keyField="quarter" />
  <ChartAxis axis="x" field="quarter" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>
```

The same pattern works for `<LineChart>` (Y positions morph) and `<AreaChart>`
(upper and lower boundary points morph).

## 9. Axis Mapping Functions (V2.1)

### Tier 1 — Serializable `compute` transforms

Derive new columns from existing fields inside the DSL. All operations are
serializable and stored in the `SceneTrack`.

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

Supported operations: `log` (with optional `base`), `sqrt`, `normalize` (maps to [0, 1] over dataset range), `scale` (multiply by constant), `add` (add constant).

### Tier 2 — Runtime accessor functions

Attach arbitrary JavaScript accessor functions to a chart by ID. Accessors are
not serialized into the `SceneTrack` — they live in plugin memory and persist
across all scenes using the same chart ID.

```tsx
import { useChartAccessors } from '@brewsite/charts';
import type { ChartAccessorFunctions } from '@brewsite/charts';

function MyComponent() {
  const charts = useMemo(() => chartPlugin(), []);

  // Stabilize the object with useMemo to avoid re-registering on every render:
  const accessors = useMemo<ChartAccessorFunctions>(() => ({
    sizeAccessor: (row) => Math.sqrt(Number(row.headcount)),
    colorAccessor: (row) => String(row.region),
  }), []);

  useChartAccessors(charts, 'team-perf', accessors);

  // ...
}
```

`ChartAccessorFunctions` has four optional fields: `xAccessor`, `yAccessor`,
`sizeAccessor`, `colorAccessor`. Supported on `BarChart`, `LineChart`, and
`ScatterPlotChart`. On unmount, renderers fall back to `Number(row[field])`.

## 10. DSL Reference

### Shared Base Props (all per-type components)

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Required. Unique chart element ID |
| `data` | `DataInput` | Inline rows or columnar data. Mutually exclusive with `dataUrl` |
| `dataUrl` | `string` | URL for async JSON/CSV fetch. Mutually exclusive with `data` |
| `theme` | `ChartThemeName \| ChartTheme` | Theme preset name or custom theme object |
| `opacity` | `number` | Overall opacity 0–1. Default `1` |
| `interactive` | `boolean` | Enable hover/click events. Default `false` |
| `x` | `number` | NVS left edge [0, 1]. Default `0` |
| `y` | `number` | NVS top edge [0, 1]. Default `0` |
| `w` | `number` | NVS width [0, 1]. Default `1` |
| `h` | `number` | NVS height [0, 1]. Default `1` |
| `z` | `number` | World-space z offset. Default `0` |
| `rotation` | `[x, y, z]` | Euler rotation in radians |
| `bounds` | `{ width?, height?, depth? }` | Geometry fill ratio within NVS region. `width`/`height` are NVS fractions [0..1]; `depth` is world-space thickness |
| `gridlines` | `boolean` | Per-chart gridlines shorthand |
| `sceneTheme` | `SceneTheme` | Cross-package font/color-mode context |
| `animateEntry` | `boolean` | **V2.1** — Enable bar-grow entry animation. Scoped to `BarChart`. Default `false` |
| `animationDuration` | `number` | **V2.1** — Entry animation duration as fraction of `blockProgress` [0..1]. Default `0.4` |

### `<ChartData>`

| Prop | Type | Description |
|---|---|---|
| `source` | `string` | Named source registered via `ChartProvider`. Required for named path. |
| `keyField` | `string` | Key field for datum-level morphing |
| `transforms` | `DataTransform[]` | Transforms applied at resolve time. Includes `'compute'` in V2.1 |
| `filterGroup` | `string` | Linked-brush filter group ID |

### `<ChartAxis>`

| Prop | Type | Description |
|---|---|---|
| `axis` | `'x' \| 'y'` | Which axis to configure |
| `field` | `string` | Data field name |
| `label` | `string` | Axis label text |
| `format` | `string` | d3-format string for tick labels |
| `scaleType` | `'linear' \| 'log' \| 'time' \| 'band' \| 'sqrt'` | Scale type |
| `domain` | `[min, max]` | Fixed domain override |
| `tickCount` | `number` | Approximate tick count |
| `nice` | `boolean` | Round domain to nice values |
| `clamp` | `boolean` | Clamp out-of-domain values |
| `reverse` | `boolean` | Reverse axis direction |
| `gridlines` | `boolean` | Show gridlines for this axis |
| `gridlineOpacity` | `number` | Gridline opacity 0–1 |

### `<ChartSeries>`

| Prop | Type | Description |
|---|---|---|
| `field` | `string` | Data field for this series |
| `label` | `string` | Legend label text |
| `color` | `string` | Override series color (hex) |
| `bandField` | `string` | Lower-bound field for area band variant |

### `<ChartLegend>`

| Prop | Type | Description |
|---|---|---|
| `visible` | `boolean` | Show/hide legend. Default `true` when present |
| `position` | `'right' \| 'bottom' \| 'top' \| 'left'` | Legend placement. Default `'right'` |
| `title` | `string` | Legend title text |
| `columns` | `number` | Number of legend columns |
| `maxItems` | `number` | Maximum legend entries to show |

### `<ChartDataLabels>` (new in V2)

| Prop | Type | Description |
|---|---|---|
| `position` | `'top' \| 'center' \| 'outside'` | Label placement. Default `'top'` |
| `format` | `string` | d3-format string. Default `'.0f'` |

### `<ReferenceLine>` (new in V2)

| Prop | Type | Description |
|---|---|---|
| `axis` | `'x' \| 'y'` | Which axis the value is on |
| `value` | `number` | Axis value where the line appears |
| `label` | `string` | Label text |
| `color` | `string` | Line color (hex). Falls back to `theme.referenceLines.defaultColor` |

## 11. Chart Types

| Component | Type | Description |
|---|---|---|
| `<BarChart>` | `bar` | Vertical/horizontal bars, grouped or stacked multi-series |
| `<LineChart>` | `line` | 3D tube lines with configurable cross-section shape and point markers |
| `<AreaChart>` | `area` | Filled extruded area with stacked and band variants |
| `<PieChart>` | `pie` | Pie/donut with configurable `innerRadius`, tilt, and slice explode |
| `<ScatterPlotChart>` | `scatter` | 3D scatter plot with optional size and color encoding (4D) |
| `<HeatMapChart>` | `heatmap` | 2D color-mapped grid with optional time animation |

## 12. Themes

### Preset themes

| Name | Description |
|---|---|
| `darkGlass` | Dark background with glass-like transmission materials |
| `neonCyber` | Vibrant neon palette with high emissive intensity |
| `enterprise` | Muted professional palette on a light background |
| `lightMinimal` | Clean light theme with flat opaque materials |

Pass a preset name string or import the theme constant directly:

```tsx
import { darkGlassChartTheme } from '@brewsite/charts';
<BarChart id="rev" theme={darkGlassChartTheme}>...</BarChart>
```

### Custom themes with `createChartTheme`

V2.1 adds five new optional token groups to `ChartTheme`. Existing theme objects
work unchanged — new groups are optional with renderer fallback defaults.

```tsx
import { createChartTheme } from '@brewsite/charts';

const brandTheme = createChartTheme('darkGlass', {
  name: 'brand',
  axis: {
    lineColor: '#ff4400',
    labelColor: '#ffffff',
    titleFontSize: 0.07,  // V2.1: independent axis title font size
  },
  legend: {
    textOpacity: 0.85,    // V2.1: legend label opacity
  },
  bar: { padding: 0.25 },    // V2.1: default barPadding when DSL prop absent
  area: { fillOpacity: 0.6 }, // V2.1: default fillOpacity
  gridlines: {               // V2.1: replaces deprecated background.gridColor
    color: '#4a8080',
    opacity: 0.2,
    visible: true,           // on by default for this theme
    dashSize: 0.03,          // dashed gridlines (requires LineDashedMaterial)
    gapSize: 0.02,
  },
  dataLabels: { fontSize: 0.05, color: '#e0e8ff' },
  referenceLines: { defaultColor: '#ff8844', lineWidth: 0.005, lineOpacity: 0.85 },
});
```

### Cross-package font via `sceneTheme`

```tsx
import { darkSceneTheme } from '@brewsite/core';

<BarChart
  id="rev"
  theme="darkGlass"
  sceneTheme={{
    ...darkSceneTheme,
    font: { ...darkSceneTheme.font, webglFontUrl: '/fonts/inter-msdf.ttf' },
  }}
>
  {/* ... */}
</BarChart>
```

## 13. Linked-Brush Filtering

Charts that share a `filterGroup` are automatically linked. Selecting data in one
chart filters all others in the same group.

```tsx
import { useChartFilter } from '@brewsite/charts';

function FilterControls() {
  const { applyFilter, clearFilters } = useChartFilter('dashboard');
  return (
    <div>
      <button onClick={() => applyFilter('month', ['Jan', 'Feb'])}>Jan+Feb</button>
      <button onClick={() => clearFilters()}>Clear</button>
    </div>
  );
}
```

```tsx
<ChartProvider data={{ sales: rows }}>
  <BarChart id="chart-a">
    <ChartData source="sales" filterGroup="dashboard" />
  </BarChart>

  <LineChart id="chart-b">
    <ChartData source="sales" filterGroup="dashboard" />
  </LineChart>
</ChartProvider>
```

## 14. Interactivity

```tsx
<BarChart id="revenue" interactive>
  {/* ... */}
</BarChart>
```

```tsx
import { useMemo, useEffect } from 'react';
import { chartPlugin } from '@brewsite/charts';

const plugin = useMemo(() => chartPlugin(), []);

useEffect(() => {
  const chart = plugin.getWidget('revenue');
  if (chart) {
    chart.onHover  = (info) => setTooltipInfo(info);
    chart.onSelect = (info) => console.log('selected', info?.row);
  }
}, [plugin]);
```

Use `ChartTooltipOverlay` for built-in tooltip projection:

```tsx
import { ChartTooltipOverlay } from '@brewsite/charts';

// nvsBounds required in V2; pass widget.nvsBounds or a fullscreen rect
<ChartTooltipOverlay nvsBounds={chartWidget.nvsBounds} />
```

## 15. TypeScript

Key exported types:

| Type | Description |
|---|---|
| `ChartType` | `'bar' \| 'line' \| 'area' \| 'pie' \| 'scatter' \| 'heatmap'` |
| `ChartState` | Compiled runtime state for one chart element |
| `ChartStateDataSource` | Discriminated union: `InlineDataSource \| NamedDataSource \| AsyncDataSource` |
| `ChartTypeOptions` | Discriminated union of per-type option bags |
| `BarChartOptions` | Bar-specific options |
| `LineChartOptions` | Line-specific options |
| `ScatterChartOptions` | Scatter-specific options |
| `PieChartOptions` | Pie-specific options |
| `AreaChartOptions` | Area-specific options |
| `HeatMapChartOptions` | Heatmap-specific options |
| `ChartTheme` | Complete theme token set |
| `ChartThemeName` | Preset theme name union |
| `ChartPluginInstance` | Return type of `chartPlugin()` |
| `ChartAccessorFunctions` | **V2.1** — Function accessor object for `useChartAccessors` |
| `ChartHoverInfo` | Hover/select event payload |
| `ChartProviderProps` | Props for `<ChartProvider>` |
| `DataTransform` | Union of transform descriptors (`filter`, `sort`, `groupBy`, `bin`, `compute`) |
| `ComputeTransform` | **V2.1** — Serializable column-derive transform |
| `ResolvedDataFrame` | `{ rows, fields }` resolved from the data store |
| `DataInput` | `DataRow[] \| ColumnarData` — accepted by the `data` prop |
| `ChartBarTokens` | **V2.1** — Bar chart theme defaults token group |
| `ChartAreaTokens` | **V2.1** — Area chart theme defaults token group |
| `ChartGridlinesTokens` | **V2.1** — Gridline visual token group |
| `ChartDataLabelsTokens` | **V2.1** — Data label theme token group |
| `ChartReferenceLineTokens` | **V2.1** — Reference line theme token group |

## 16. V1 Migration

See [MIGRATION.md](./MIGRATION.md) for the complete V1 → V2 migration guide, including:
- Replacing `<Chart type="...">` with per-type components
- Migrating `state.dataSource` (string → discriminated union)
- Migrating `state.lineShape`, `state.innerRadius`, etc. (flat → `typeConfig.options`)
- Updating `ChartTooltipOverlay` props (`camera`/`domElement` → `nvsBounds`)
- Converting `bounds.width`/`height` from world-units to NVS fractions
- V2.1 notes for custom renderer authors

## 17. License

MIT
