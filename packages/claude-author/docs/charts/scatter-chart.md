---
title: "@brewsite/charts — Scatter Plot Chart"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## When to Use ScatterPlotChart

Use a scatter plot to show the relationship between two continuous variables and identify clusters, outliers, or correlations. When `sizeField` is set, point size encodes a third quantitative dimension — this is the bubble chart variant. Adding `colorField` encodes a fourth dimension using a color scale. This is the right chart when individual data point identity and relative positioning in 2D space are both meaningful.

Do not use a scatter plot for categorical x-axis data — use `BarChart`. Avoid it when you have fewer than 10 data points; a bar chart communicates the same comparison more clearly with less visual ambiguity. With more than a few hundred points, overplotting becomes a problem — consider binning or aggregating the data first.

---

## ScatterPlotChart Props

These props are specific to `<ScatterPlotChart>`. For shared base props (`id`, `x`, `y`, `w`, `h`, `z`, `depth`, `data`, `dataUrl`, `opacity`, `interactive`, `gridlines`), see [base-props.md](./base-props.md).

| Prop | Type | Default | Description |
|---|---|---|---|
| `sizeField` | `string` | — | Row field name that encodes point size. When set, each point's 3D radius scales proportionally to the field value within the `sizeScale` range. |
| `colorField` | `string` | — | Row field name that encodes point color. Continuous numeric values are mapped through the `colorInterpolator` scale; categorical string values cycle through the series color palette. |
| `pointShape` | `'sphere' \| 'cube' \| 'cylinder'` | `'sphere'` | 3D geometry shape of each data point. `'sphere'` is the standard choice; `'cube'` can emphasize precision in technical contexts. |
| `sizeScale` | `{ min: number; max: number }` | — | World-space radius range for `sizeField` encoding. The minimum field value maps to `sizeScale.min`; the maximum maps to `sizeScale.max`. |
| `colorInterpolator` | `'blues' \| 'reds' \| 'viridis' \| 'plasma'` | — | Color scale for continuous `colorField` values. `'viridis'` and `'plasma'` are perceptually uniform; `'blues'` and `'reds'` are sequential. |

---

## Encoding a Third Variable

The standard scatter plot encodes two variables (x and y). `sizeField` and `colorField` each add one more dimension without requiring another axis.

Use `sizeField` when the third variable represents magnitude, market cap, or volume — size is naturally proportional to quantity. Pair it with `sizeScale` to control the min/max world-space radius:

```tsx
<ScatterPlotChart
  id="companies"
  data={companyData}
  sizeField="marketCap"
  sizeScale={{ min: 0.03, max: 0.25 }}
  ...
>
```

Use `colorField` when the variable is a continuous intensity like growth rate, temperature, or risk score. Choose a perceptually uniform interpolator (`'viridis'` or `'plasma'`) when the full range of the scale needs equal visual resolution:

```tsx
<ScatterPlotChart
  id="companies"
  data={companyData}
  colorField="growthRate"
  colorInterpolator="viridis"
  ...
>
```

Both can be combined in the same chart to encode four variables simultaneously. Keep the data-to-ink ratio reasonable — beyond four encoded variables, the chart becomes hard to interpret.

---

## Complete ScatterPlotChart Example

```tsx
// widgetSetup.ts
import { chartPlugin } from '@brewsite/charts';
export const myChartPlugin = chartPlugin();

// scenes.tsx
import { Scene, ProgressManager, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { ScatterPlotChart, ChartAxis, ChartLegend, ChartTooltip } from '@brewsite/charts';

const companyData = [
  { company: 'Alpha', revenue: 420, margin: 28, employees: 1200, growthRate: 0.14 },
  { company: 'Beta',  revenue: 185, margin: 41, employees: 340,  growthRate: 0.31 },
  { company: 'Gamma', revenue: 610, margin: 18, employees: 2800, growthRate: 0.05 },
  { company: 'Delta', revenue: 92,  margin: 55, employees: 180,  growthRate: 0.48 },
  { company: 'Eps',   revenue: 330, margin: 33, employees: 890,  growthRate: 0.21 },
  { company: 'Zeta',  revenue: 770, margin: 12, employees: 4100, growthRate: 0.02 },
];

export function SceneCompanyMatrix() {
  return (
    <Scene id="scatter-companies">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 6.6]} target={[0, 0.08, 0]} fov={42} />
      <Lighting intensityScale={1.35}>
        <Ambient intensity={0.95} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      <ScatterPlotChart
        id="company-matrix"
        data={companyData}
        x={0.10} y={0.20} w={0.80} h={0.55}
        depth={0.2}
        pointShape="sphere"
        sizeField="employees"
        sizeScale={{ min: 0.04, max: 0.22 }}
        colorField="growthRate"
        colorInterpolator="viridis"
        interactive
      >
        <ChartAxis axis="x" field="revenue" label="Revenue ($M)" gridlines />
        <ChartAxis axis="y" field="margin" label="Gross Margin %" gridlines />
        <ChartLegend visible position="right" title="Growth Rate" />
        <ChartTooltip format=".1f" />
      </ScatterPlotChart>
    </Scene>
  );
}

// MyPage.tsx
import { useMemo } from 'react';
import {
  corePlugin, SceneEngine, ScrollStage, SceneCanvas, BackgroundLayer,
  EngineARContainer, EngineOverlayHost,
} from '@brewsite/core';
import { ChartTooltipHost } from '@brewsite/charts';
import { myChartPlugin } from './widgetSetup';
import { SceneCompanyMatrix } from './scenes';

export default function MyPage() {
  const plugins = useMemo(() => [corePlugin(), myChartPlugin], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins}>
        <SceneCompanyMatrix />

        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={400}>
          <EngineARContainer aspectRatio={1} scaleMode="fit-height" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost passthroughPointerEvents>
              <ChartTooltipHost />
            </EngineOverlayHost>
          </EngineARContainer>
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
```

This example encodes four variables: x-axis (revenue), y-axis (margin), point size (employee count via `sizeField`), and point color (growth rate via `colorField` with the viridis scale). The `viridis` interpolator maps low growth rates to purple and high growth rates to yellow, making outliers immediately visible in 3D.
