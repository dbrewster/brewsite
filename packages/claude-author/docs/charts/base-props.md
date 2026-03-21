---
title: "@brewsite/charts — Shared Props and Child Components"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-21
---

## BaseChartDSL Shared Props

All per-type chart components (`BarChart`, `LineChart`, `AreaChart`, `PieChart`, `ScatterPlotChart`, `HeatMapChart`) accept these props:

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Unique widget ID. Must be stable across scenes for morphing and transitions. |
| `x` | `SceneLength` | `"0%"` | NVS left edge. `x={"0%"}` is left viewport edge. |
| `y` | `SceneLength` | `"0%"` | NVS top edge. `y={"0%"}` is top viewport edge. |
| `w` | `SceneLength` | `"100%"` | NVS width. |
| `h` | `SceneLength` | `"100%"` | NVS height. |
| `z` | `number` | `0` | World-space Z depth. |
| `rotation` | `readonly [SceneAngle, SceneAngle, SceneAngle]` | `[0,0,0]` | Euler rotation. Accepts `"45deg"`, `"0.78rad"`, or `0`. |
| `depth` | `number` | `0.4` | 3D extrusion depth of chart geometry in world units. Width and height are derived from `w`/`h`. |
| `data` | `DataInput` | — | Inline data rows or columnar object. Mutually exclusive with `dataUrl`. |
| `dataUrl` | `string` | — | URL for async JSON or CSV fetch. Mutually exclusive with `data`. |
| `opacity` | `number` | `1` | Chart opacity [0..1]. |
| `interactive` | `boolean` | `false` | Enable hover/select interaction. Required for `<ChartTooltip>` to work. |
| `gridlines` | `boolean` | — | Per-chart gridlines shorthand. Overrides axis-level `gridlines`. |
| `animateEntry` | `boolean` | `false` | Bar-grow entry animation driven by scene block progress. Currently scoped to `BarRenderer`. |
| `animationDuration` | `number` | `0.4` | Entry animation duration as fraction of blockProgress [0..1]. Clamped to [0.01..1.0]. |
| `children` | `ReactNode` | — | `<ChartData>`, `<ChartAxis>`, `<ChartSeries>`, `<ChartLegend>`, `<ChartDataLabels>`, `<ReferenceLine>`, `<ChartTooltip>`. |

NVS coordinates: `x={"0%"}` is left, `x={"100%"}` is right, `y={"0%"}` is top, `y={"100%"}` is bottom. The chart center is `(x + w/2, y + h/2)`.

---

## Data Format

The `data` prop accepts `DataInput`:

```ts
type DataInput = ReadonlyArray<DataRow> | ColumnarData;

// Row format — array of flat objects:
type DataRow = Readonly<Record<string, unknown>>;

// Columnar format — object of arrays (transposed to rows at compile time):
type ColumnarData = Readonly<Record<string, ReadonlyArray<unknown>>>;
```

### Row array (most common)

```tsx
const salesData = [
  { quarter: 'Q1', revenue: 128, costs: 84, profit: 44 },
  { quarter: 'Q2', revenue: 145, costs: 91, profit: 54 },
  { quarter: 'Q3', revenue: 162, costs: 97, profit: 65 },
  { quarter: 'Q4', revenue: 190, costs: 105, profit: 85 },
];

<BarChart id="sales" data={salesData}>
  <ChartAxis axis="x" field="quarter" />
  <ChartAxis axis="y" field="revenue" />
  <ChartSeries field="revenue" label="Revenue" />
  <ChartSeries field="costs" label="Costs" />
</BarChart>
```

### Columnar object

Arrays are transposed to rows automatically at compile time. Column names become field names.

```tsx
const salesData = {
  quarter: ['Q1', 'Q2', 'Q3', 'Q4'],
  revenue: [128, 145, 162, 190],
  costs:   [84,  91,  97,  105],
};
// Equivalent to the row array above.
```

### Named source (via ChartProvider)

When data is managed externally or shared across charts, use a named source:

```tsx
// Wrap your page or engine with ChartProvider:
<ChartProvider data={{ salesData: rows }}>
  <SceneEngine plugins={plugins}>
    ...
  </SceneEngine>
</ChartProvider>

// In the scene:
<BarChart id="sales">
  <ChartData source="salesData" />
  <ChartAxis axis="x" field="quarter" />
  ...
</BarChart>
```

### Async URL fetch

```tsx
<BarChart id="sales" dataUrl="/api/sales.json">
  <ChartAxis axis="x" field="quarter" />
  <ChartAxis axis="y" field="revenue" />
</BarChart>
```

Supports `format: 'json' | 'csv'`. JSON is the default. For CSV, pass `dataUrl="/data/sales.csv"`.

---

## Child Components

### `<ChartData>`

Configures data source for named/transform paths. Optional when `data` or `dataUrl` is on the parent.

```ts
type ChartDataProps = {
  source?: string;              // Named source registered in ChartProvider
  transforms?: DataTransform[]; // filter, groupBy, sort, bin, compute
  filterGroup?: string;         // Crossfilter group ID for linked-brush
  keyField?: string;            // Field for datum-level morphing between scenes
};
```

`keyField` enables datum-level morphing: when two adjacent scenes use the same chart `id` and `keyField`, the runtime matches rows by key and morphs individual bars/points between their values during the scene transition.

### `<ChartAxis>`

```ts
type ChartAxisProps = {
  axis: 'x' | 'y';           // required
  field: string;              // required — data field name to map to this axis
  label?: string;             // Axis title text
  format?: string;            // d3-format string for tick labels
  scaleType?: 'linear' | 'log' | 'time' | 'band' | 'sqrt';
  domain?: [number | string, number | string]; // Explicit domain [min, max]
  tickCount?: number;
  nice?: boolean;             // Round domain to nice values
  clamp?: boolean;            // Clamp out-of-domain values
  reverse?: boolean;          // Reverse axis direction
  gridlines?: boolean;        // Show gridlines for this axis
  gridlineOpacity?: number;   // Gridline opacity [0..1]
};
```

### `<ChartSeries>`

```ts
type ChartSeriesProps = {
  field: string;      // required — data field name for this series
  label?: string;     // Legend label for this series
  color?: string;     // Override series color (hex or CSS)
  bandField?: string; // For area charts: lower-bound field for band/range variant
};
```

When no `<ChartSeries>` children are provided, the renderer derives a single series from `yAxis.field`.

### `<ChartLegend>`

```ts
type ChartLegendProps = {
  visible?: boolean;          // Default: true when present
  position?: 'right' | 'bottom' | 'top' | 'left'; // Default: 'right'
  title?: string;             // Legend heading text
  columns?: number;           // Force multi-column layout
  maxItems?: number;          // Truncate after N items
};
```

### `<ChartDataLabels>`

Renders value labels at each data point (bar tops, pie slice centers, etc.).

```ts
type ChartDataLabelsProps = {
  position?: 'top' | 'center' | 'outside'; // Default: 'top'
  format?: string; // d3-format string. Default: '.0f'
};
```

### `<ReferenceLine>`

Draws a horizontal or vertical reference line across the chart.

```ts
type ReferenceLineProps = {
  axis: 'x' | 'y'; // required — which axis the line is parallel to
  value: number;   // required — position on that axis
  label?: string;  // Text label on the line
  color?: string;  // Override line color
};
```

---

## Chart Tooltip

`<ChartTooltip>` is a child component nested directly inside a chart element. The chart must have `interactive={true}`.

```tsx
<BarChart id="revenue" data={salesData} interactive>
  <ChartAxis axis="x" field="quarter" />
  <ChartAxis axis="y" field="revenue" />
  <ChartSeries field="revenue" label="Revenue" />
  <ChartTooltip projection format=".0f" />
</BarChart>
```

`ChartTooltipProps`:

| Prop | Type | Default | Description |
|---|---|---|---|
| `projection` | `boolean` | `false` | Render a Y-axis projection beam from the hovered point down to the floor. |
| `format` | `string` | `'.3~s'` | d3-format string for Y values in the tooltip. |

The tooltip is rendered by `<ChartTooltipHost>`. Place it once inside `<EngineOverlayHost>`:

```tsx
<EngineOverlayHost passthroughPointerEvents>
  <ChartTooltipHost />
</EngineOverlayHost>
```

`ChartTooltipHost` is a zero-prop component that reads from the global `chartTooltipStore` singleton. It handles edge-flip positioning (flips when near viewport edges), animation, and type-aware content rendering.

To provide custom tooltip content for a specific chart, use `useChartTooltipConfig()`:

```tsx
import { useChartTooltipConfig } from '@brewsite/charts';

function MyPage() {
  useChartTooltipConfig('revenue', {
    renderContent: (info) => (
      <div>
        <strong>{info.meta?.seriesLabel}</strong>: ${info.meta?.segmentValue?.toLocaleString()}
      </div>
    ),
  });
  // ...
}
```

---

## Chart Themes

Themes control all visual token values: series colors, material properties (metalness, roughness), axis label styles, legend, gridlines, tooltips, and more.

### Built-in Themes

| Theme Object | Name | Polarity | Description |
|---|---|---|---|
| `enterpriseChartTheme` | `'enterprise'` | dark | Default. Muted blue/teal series, dark background, glass tooltip. |
| `defaultChartTheme` | — | dark | Alias for `enterpriseChartTheme`. |
| `enterpriseLightChartTheme` | `'enterprise-light'` | light | Same palette, light axis labels, white tooltip. |
| `defaultLightChartTheme` | — | light | Alias for `enterpriseLightChartTheme`. |

Additional named themes (darkGlass, midnight, neonCyber, lightCanvas) are registered by `@brewsite/themes`.

### Theme Resolution

Themes are resolved automatically from the scene's `themeFamily` and `themePolarity` context when using `<SceneEngine theme={...}>`. You do not set `theme` directly on chart elements.

### Custom Themes

```tsx
import { createChartTheme } from '@brewsite/charts';

const brandTheme = createChartTheme('enterprise', {
  name: 'brand',
  series: [
    { color: '#ff4400', metalness: 0.1, roughness: 0.5, transmission: 0, emissiveIntensity: 0.05, depth: 0.3 },
    { color: '#0088ff', metalness: 0.1, roughness: 0.5, transmission: 0, emissiveIntensity: 0.05, depth: 0.3 },
  ],
  axis: { labelColor: '#ffffff', lineColor: '#666688' },
});
```

`createChartTheme(base, overrides)` — `base` is a theme name string or full `ChartTheme` object. `overrides` is a deep-partial that merges onto the base.

---

## keyField and Datum Morphing

`keyField` on `<ChartData>` enables datum-level morphing between scenes. When two adjacent scenes use the same chart `id` and the same `keyField`, the runtime matches rows by key and morphs individual data values during the scene transition.

```tsx
// Scene A
<BarChart id="revenue" data={yearAData}>
  <ChartData keyField="quarter" />
  ...
</BarChart>

// Scene B — same id, different data, same keyField
<BarChart id="revenue" data={yearBData}>
  <ChartData keyField="quarter" />
  ...
</BarChart>
```

During scroll transition from Scene A to Scene B, each bar's height morphs from its Year A value to its Year B value, matched by `quarter`. Position, scale, and opacity also interpolate automatically when the chart `id` is stable.

When the chart type changes between scenes (e.g. bar to line), the runtime holds the current chart type until the scene boundary and then switches. This prevents rendering artifacts during mid-transition structural changes.

---

## Entry Animation

`animateEntry={true}` on `<BarChart>` causes bars to grow from zero height at scene entry, driven by `blockProgress` (scene scroll progress). This prop is currently scoped to `BarRenderer`.

```tsx
<BarChart
  id="revenue"
  data={salesData}
  x={"30%"} y={"32%"} w={"40%"} h={"30%"}
  animateEntry
  animationDuration={0.4}
>
  ...
</BarChart>
```

`animationDuration` is a fraction of `blockProgress` [0..1]. At `blockProgress = animationDuration`, bars reach full height. Defaults to `0.4`.
