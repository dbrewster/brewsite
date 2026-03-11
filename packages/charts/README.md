# @brewsite/charts

## 1. Overview

`@brewsite/charts` adds native 3D chart elements to BrewSite scenes. Declare bar,
line, area, pie, scatter, and heatmap charts with a JSX DSL and the engine renders
them as animated Three.js geometry inside the BrewSite scene graph.

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

## 3. Quick Start

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

## 4. Plugin Setup

`chartPlugin()` returns a `WidgetPlugin` that registers chart DSL handlers and
provides a per-engine `ChartDataStore`. Create one instance per `EngineProvider`:

```tsx
import { useMemo } from 'react';
import { EngineProvider, corePlugin } from '@brewsite/core';
import { chartPlugin } from '@brewsite/charts';

function App() {
  const chartsPlugin = useMemo(() => chartPlugin(), []);
  return (
    <EngineProvider
      manifestUrl="/assets/manifest.json"
      plugins={[corePlugin(), chartsPlugin]}
    >
      {/* scenes and layout here */}
    </EngineProvider>
  );
}
```

The plugin:
- Registers chart DSL node handlers (`<Chart>`, `<ChartData>`, etc.)
- Auto-creates `ChartWidget` instances on first DSL encounter
- Wraps children in a `ChartStoreContext.Provider` so hooks can access the store

## 5. Data Registration

### Flat-array form

```tsx
import { ChartProvider } from '@brewsite/charts';

const salesRows = [
  { month: 'Jan', revenue: 120 },
  { month: 'Feb', revenue: 140 },
];

<ChartProvider data={{ sales: salesRows }}>
  {/* scenes */}
</ChartProvider>
```

### Filter group form

Use `filterGroup` on `<ChartData>` to enable linked-brush filtering across charts:

```tsx
<Chart id="bar1" type="bar">
  <ChartData source="sales" filterGroup="dashboard" />
  {/* ... */}
</Chart>

<Chart id="scatter1" type="scatter">
  <ChartData source="sales" filterGroup="dashboard" />
  {/* ... */}
</Chart>
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

## 6. DSL Reference

### `<Chart>`

| Prop | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique chart element ID |
| `type` | `ChartType` | Yes | Chart type: `'bar'` \| `'line'` \| `'area'` \| `'pie'` \| `'scatter'` \| `'heatmap'` |
| `position` | `[x, y, z]` | No | World-space position. Default `[0, 0, 0]` |
| `rotation` | `[x, y, z]` | No | Euler rotation in radians. Default `[0, 0, 0]` |
| `bounds` | `{ width, height, depth }` | No | Chart bounding box. Default `{ 4, 3, 0.4 }` |
| `theme` | `ChartThemeName` | No | Theme preset name. Default `'darkGlass'` |
| `opacity` | `number` | No | Overall opacity 0-1. Default `1` |
| `interactive` | `boolean` | No | Enable hover/click events. Default `false` |
| `axisGap` | `number` | No | Gap between the plot axes and axis labels/title. Overrides `theme.axis.gap` |
| `legendGap` | `number` | No | Gap between the plot area and the legend. Overrides `theme.legend.gap` |
| `innerRadius` | `number` | No | Pie/donut inner radius ratio. Default `0` |
| `pieTilt` | `number` | No | Pie chart tilt in radians. Overrides `theme.pie.tilt` when set |

### `<ChartData>`

| Prop | Type | Required | Description |
|---|---|---|---|
| `source` | `string` | Yes | Data source name registered via `ChartProvider` |
| `transforms` | `DataTransform[]` | No | Transforms applied at resolve time |
| `filterGroup` | `string` | No | Linked-brush filter group ID |
| `timeField` | `string` | No | Time dimension field for heatmap animation |

### `<ChartAxis>`

| Prop | Type | Required | Description |
|---|---|---|---|
| `axis` | `'x'` \| `'y'` | Yes | Which axis to configure |
| `field` | `string` | Yes | Data field name to map to this axis |
| `label` | `string` | No | Axis label text |
| `format` | `string` | No | d3-format string for tick labels |

### `<ChartSeries>`

| Prop | Type | Required | Description |
|---|---|---|---|
| `field` | `string` | Yes | Data field for this series |
| `label` | `string` | No | Legend label text |
| `color` | `string` | No | Override series color (hex) |

### `<ChartLegend>`

| Prop | Type | Required | Description |
|---|---|---|---|
| `visible` | `boolean` | No | Show/hide the legend. Default `true` when present |
| `position` | `'right'` \| `'bottom'` \| `'top'` \| `'left'` | No | Legend placement. Default `'right'` |

## 7. Chart Types

| Type | Description |
|---|---|
| `bar` | Vertical bar chart with grouped multi-series support |
| `line` | Line chart rendered as 3D tubes with per-series coloring |
| `area` | Filled area chart with extruded geometry |
| `pie` | Pie/donut chart with configurable `innerRadius` |
| `scatter` | 3D scatter plot with sphere markers |
| `heatmap` | 2D heatmap grid with color-mapped cells and optional time animation |

## 8. Themes

### Preset themes

| Name | Description |
|---|---|
| `darkGlass` | Dark background with glass-like transmission materials |
| `neonCyber` | Vibrant neon palette with high emissive intensity |
| `enterprise` | Muted professional palette on a light background |
| `lightMinimal` | Clean light theme with flat opaque materials |

### Custom themes with `createChartTheme`

```tsx
import { createChartTheme } from '@brewsite/charts';

const brandTheme = createChartTheme('darkGlass', {
  name: 'brand',
  axis: { lineColor: '#ff4400', labelColor: '#ffffff', gap: 0.22 },
  legend: { gap: 0.32 },
  pie: { tilt: 0.5 },
  series: [
    { color: '#ff4400', metalness: 0.3, roughness: 0.4, transmission: 0, emissiveIntensity: 0.1, depth: 0.3 },
  ],
});
```

Pass the resulting `ChartTheme` object to the `theme` prop on `<Chart>`.

Built-in themes now include `theme.pie.tilt`, so pie and donut charts render with a slight upward tilt by default to expose slice depth.
Built-in themes also include `theme.axis.gap` and `theme.legend.gap`, and individual charts can override them with `axisGap` and `legendGap`.

## 9. Linked-Brush Filtering

Charts that share a `filterGroup` are automatically linked. Selecting data in one
chart filters all other charts in the same group.

```tsx
import { useChartFilter } from '@brewsite/charts';

function FilterControls() {
  const { applyFilter, clearFilters } = useChartFilter('dashboard');

  return (
    <div>
      <button onClick={() => applyFilter('month', ['Jan', 'Feb'])}>
        Filter Jan+Feb
      </button>
      <button onClick={() => clearFilters()}>Clear</button>
    </div>
  );
}
```

In the scene DSL, set the same `filterGroup` on each chart's `<ChartData>`:

```tsx
<Chart id="chart-a" type="bar">
  <ChartData source="sales" filterGroup="dashboard" />
  {/* ... */}
</Chart>

<Chart id="chart-b" type="line">
  <ChartData source="sales" filterGroup="dashboard" />
  {/* ... */}
</Chart>
```

## 10. Interactivity

Enable hover and click events with `interactive={true}`:

```tsx
<Chart id="revenue" type="bar" interactive>
  <ChartData source="sales" />
  {/* ... */}
</Chart>
```

Wire callbacks via `getWidget`:

> **Important:** `getWidget(id)` is only available after the engine has compiled
> the scene for the first time. Call it in a `useEffect`, not at render time:

```tsx
const plugin = useMemo(() => chartPlugin(), []);

// Correct -- wire callbacks after mount, inside useEffect
useEffect(() => {
  const chart = plugin.getWidget('revenue');
  if (chart) {
    chart.onHover = (info) => setTooltipInfo(info);
    chart.onSelect = (info) => console.log('selected', info?.row);
  }
}, [plugin]);

// Wrong -- getWidget returns undefined at render time (scene not yet compiled)
const chart = plugin.getWidget('revenue'); // undefined here
```

Use `ChartTooltipOverlay` for a ready-made tooltip that projects hover info
to screen coordinates:

```tsx
import { ChartTooltipOverlay } from '@brewsite/charts';

<ChartTooltipOverlay widget={chartWidget} />
```

## 11. TypeScript

Key exported types:

| Type | Description |
|---|---|
| `ChartType` | `'bar'` \| `'line'` \| `'area'` \| `'pie'` \| `'scatter'` \| `'heatmap'` |
| `ChartState` | Compiled runtime state for one chart element |
| `ChartTheme` | Complete theme token set |
| `ChartThemeName` | Preset theme name union |
| `ChartPluginInstance` | Return type of `chartPlugin()` |
| `ChartHoverInfo` | Hover/select event payload |
| `ChartProviderProps` | Props for `<ChartProvider>` |
| `DataTransform` | Union of transform descriptors (filter, sort, groupBy, bin) |
| `FilterGroupId` | String alias for filter group identifiers |
| `ResolvedDataFrame` | `{ rows, fields }` resolved from the data store |

## 12. License

MIT
