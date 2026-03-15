---
title: "@brewsite/charts — Package Overview"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## What @brewsite/charts Provides

`@brewsite/charts` adds native 3D chart elements to BrewSite scenes. Charts are rendered directly in Three.js — not as DOM overlays — so they exist in the same 3D space as models, diagrams, and environment lighting.

Available chart types:
- `bar` — vertical or horizontal bar chart, grouped or stacked
- `line` — multi-series line chart with optional 3D point shapes
- `area` — area/ribbon chart, stacked or independent
- `pie` — pie or donut chart with tilt control
- `scatter` — scatter/bubble chart with size and color encoding
- `heatmap` — grid heatmap with color interpolation

Key capabilities:
- Datum-level morphing between scenes when charts share an ID and `keyField`
- Entry animation (bar grow) driven by scene progress
- Interactive hover/select with tooltips via `<ChartTooltip>`
- Multiple data source modes: inline rows, columnar data, named (ChartProvider), async URL fetch
- Serializable data transforms: filter, groupBy, sort, bin, compute
- Linked-brush crossfilter across multiple charts via `filterGroup`
- Theme system with dark and light presets; custom themes via `createChartTheme()`
- Live data updates via `useLiveChartData()`

---

## Installation and Plugin Registration

```bash
pnpm add @brewsite/charts
```

`@brewsite/charts` requires `@brewsite/core` as a peer dependency.

```tsx
import { useMemo } from 'react';
import {
  corePlugin, SceneEngine, ScrollStage, SceneCanvas,
  BackgroundLayer, EngineARContainer, EngineOverlayHost,
} from '@brewsite/core';
import { chartPlugin, ChartTooltipHost } from '@brewsite/charts';

export default function MyChartPage() {
  // Create plugin instance once per engine — each call creates an isolated ChartDataStore.
  const plugins = useMemo(() => [corePlugin(), chartPlugin()], []);

  return (
    <SceneEngine plugins={plugins}>
      {/* Scene declarations go here */}

      <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={400}>
        <EngineARContainer aspectRatio={9 / 9} scaleMode="fit-height" referenceWidth={1920}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost passthroughPointerEvents>
            {/* Required for tooltip support — place once inside EngineOverlayHost */}
            <ChartTooltipHost />
          </EngineOverlayHost>
        </EngineARContainer>
      </ScrollStage>
    </SceneEngine>
  );
}
```

`chartPlugin()` takes no required arguments. Each call creates a completely isolated plugin instance with its own `ChartDataStore`. Use one instance per `<SceneEngine>`.

When using named data sources (via `<ChartData source="myData" />`), wrap the engine with `<ChartProvider>` to register data:

```tsx
import { ChartProvider } from '@brewsite/charts';

<ChartProvider data={{ sales: salesRows, costs: costRows }}>
  <SceneEngine plugins={plugins}>
    ...
  </SceneEngine>
</ChartProvider>
```

---

## Package Exports

### DSL Components (scene authoring)

**Per-type chart components (V2 — use these):**

| Component | Description |
|---|---|
| `BarChart` | Bar chart element. Accepts `orientation`, `stackMode`, `barPadding`. |
| `LineChart` | Line chart element. Accepts `lineShape`, `lineSmoothness`, `lineSubdivisions`, `showPoints`. |
| `AreaChart` | Area/ribbon chart. Accepts `stackMode`, `fillOpacity`. |
| `PieChart` | Pie/donut chart. Accepts `innerRadius`, `pieTilt`, `explodeSlice`. |
| `ScatterPlotChart` | Scatter/bubble chart. Accepts `sizeField`, `colorField`, `pointShape`, `sizeScale`. |
| `HeatMapChart` | Heatmap chart. Accepts `timeField`, `heightField`, `colorInterpolator`. |

**Shared child components (nest inside any chart element):**

| Component | Description |
|---|---|
| `ChartData` | Data source config. Accepts `source`, `transforms`, `filterGroup`, `keyField`. |
| `ChartAxis` | Axis config. Accepts `axis`, `field`, `label`, `format`, `scaleType`, `domain`, `gridlines`, etc. |
| `ChartSeries` | One data series. Accepts `field`, `label`, `color`, `bandField`. |
| `ChartLegend` | Legend config. Accepts `visible`, `position`, `title`, `columns`, `maxItems`. |
| `ChartDataLabels` | Data-point value labels. Accepts `position`, `format`. |
| `ReferenceLine` | Reference line across the chart. Accepts `axis`, `value`, `label`, `color`. |
| `ChartTooltip` | Tooltip config (child of chart element). Accepts `projection`, `format`. |

### Player Components and Hooks

| Export | Description |
|---|---|
| `ChartTooltipHost` | Tooltip overlay. Place once inside `<EngineOverlayHost>`. Required when any chart uses `<ChartTooltip>`. |
| `ChartProvider` | Provides named data sources to charts. Wraps `<SceneEngine>` or any ancestor. |
| `useLiveChartData(id, data)` | Hook to push live data to a chart by ID at runtime. |
| `useChartAccessors(id)` | Hook to get accessor functions for a chart (e.g. for custom rendering). |
| `useChartTooltip()` | Hook to read the current tooltip entry from the store. |
| `useChartTooltipConfig(id, config)` | Hook to register a custom `renderContent` function for a chart's tooltip. |
| `useChartData(id)` | Hook to read resolved chart data from the `ChartDataStore`. |
| `useChartFilter(id)` | Hook to apply filter operations to a chart's data. |
| `useChartStore()` | Hook to access the `ChartDataStore` directly. |
| `useChartTheme()` | Hook to read the resolved `ChartTheme` for the current scene theme. |

### Plugin Factory

| Export | Description |
|---|---|
| `chartPlugin()` | Creates the `ChartPluginInstance`. Call once per `<SceneEngine>`. |

### Themes

| Export | Description |
|---|---|
| `enterpriseChartTheme` | Dark enterprise aesthetic (default). |
| `defaultChartTheme` | Alias for `enterpriseChartTheme`. |
| `enterpriseLightChartTheme` | Light enterprise aesthetic. |
| `defaultLightChartTheme` | Alias for `enterpriseLightChartTheme`. |
| `createChartTheme(base, overrides)` | Factory for custom themes from a base preset. |
| `registerChartThemePair(name, pair)` | Registers a dark/light theme pair in the registry. |
| `resolveChartTheme(family, polarity)` | Resolves a named theme from the registry. |

### State Types

| Type | Description |
|---|---|
| `ChartState` | Compiled runtime state for one chart. |
| `ChartType` | `'bar' \| 'line' \| 'area' \| 'pie' \| 'scatter' \| 'heatmap'` |
| `ChartAxisState` | Compiled axis config. |
| `ChartSeriesState` | Compiled series config. |
| `ChartLegendState` | Compiled legend config. |
| `ChartDataLabelsState` | Compiled data-labels config. |
| `ReferenceLineState` | Compiled reference line config. |
| `ChartTooltipState` | Compiled tooltip config. |
| `ChartTypeOptions` | Discriminated union of per-type options. |
| `BarChartOptions`, `LineChartOptions`, etc. | Per-type option types. |
| `InlineDataSource`, `NamedDataSource`, `AsyncDataSource` | Data source variants. |
| `DataRow`, `ColumnarData`, `DataInput` | Data row/column types. |

### Data Layer

| Export | Description |
|---|---|
| `ChartDataStore` | The per-engine data store. Owned by `chartPlugin`. |
| `normalizeDataInput(data)` | Converts `DataInput` (row array or columnar object) to `DataRow[]`. |
| `SimpleFilterEngine` | Default filter implementation. |
| `CHART_TYPES` | `['bar', 'line', 'area', 'pie', 'scatter', 'heatmap']` constant array. |

---

## When to Use 3D Charts

BrewSite charts are rendered in Three.js and exist in the same 3D space as everything else in the scene. This gives them properties that 2D chart libraries cannot match:

**Scroll-driven storytelling.** Charts animate in as the user scrolls. Bar heights grow up from zero (`animateEntry`). Data morphs between two datasets when the chart ID stays constant across scenes — bars smoothly change height, colors blend, axes rescale.

**Scene transitions.** Charts can move across the viewport, change type, and fade between datasets as the user moves through a scroll-driven presentation. A single `<BarChart id="revenue">` across two scenes will automatically interpolate position, scale, opacity, and (when keyField is set) individual data values.

**3D depth and material.** Bars have a `depth` dimension and respond to scene lighting. The enterprise and neon themes use PBR materials (metalness, roughness) for a polished look.

**Co-location with 3D models.** A diagram of an architecture can sit beside a 3D robot model and a bar chart of performance metrics in the same camera view, all lit by the same environment.

**Linked-brush interactivity.** Multiple charts can share a `filterGroup` — hovering/selecting on one chart filters data across all charts in the same group. This works in 3D without DOM.

Use a standard 2D chart library (e.g. Recharts, Victory) when you need accessibility features, screen reader support, or are displaying charts outside of an immersive BrewSite scene.
