---
title: "@brewsite/charts — Line Chart"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-21
---

## When to Use LineChart

Use a line chart to show how one or more continuous values change over a sequence — time series, steps, ordered categories. The connected line makes trends, acceleration, and inflection points immediately visible. Multi-series lines make it easy to compare trajectories across groups over the same x-axis sequence.

Do not use a line chart when the x-axis values are unordered categories with no meaningful sequence — use `BarChart` instead. Avoid it when you have more than 6–8 overlapping series; the lines become unreadable. When the area under the line communicates volume or accumulation, use `AreaChart`.

---

## LineChart Props

These props are specific to `<LineChart>`. For shared base props (`id`, `x`, `y`, `w`, `h`, `z`, `depth`, `data`, `dataUrl`, `opacity`, `interactive`, `gridlines`), see [base-props.md](./base-props.md).

| Prop | Type | Default | Description |
|---|---|---|---|
| `lineShape` | `'circle' \| 'triangle' \| 'hexagon' \| 'heptagon' \| 'octagon' \| 'line'` | `'line'` | 3D geometry profile for the line segment cross-section. `'line'` renders a flat ribbon; others give the line a 3D tubular shape. |
| `lineSmoothness` | `number` | `0.0` | Curve smoothness [0..1]. `0` = straight segments between points; `1` = fully smooth spline. |
| `lineSubdivisions` | `number` | `3` | Number of geometry subdivisions per line segment. Higher values smooth the curve at the cost of more geometry. |
| `showPoints` | `boolean` | — | Whether to render 3D point markers at each data vertex. Useful when you want to show individual data positions alongside the line trend. |

---

## LineChart Data Format

Line charts work best with a row-array where each row represents one x-axis position, typically a time step or ordered category. Each additional numeric field becomes a separate series:

```tsx
const monthlyData = [
  { month: 'Jan', visits: 12400, conversions: 620 },
  { month: 'Feb', visits: 13800, conversions: 710 },
  { month: 'Mar', visits: 15200, conversions: 840 },
  { month: 'Apr', visits: 14600, conversions: 780 },
  { month: 'May', visits: 17300, conversions: 960 },
  { month: 'Jun', visits: 19100, conversions: 1120 },
];
```

Map the ordered field to the x-axis and numeric fields to `<ChartSeries>`. For time-typed axes, set `scaleType="time"` on the x-axis and use ISO date strings as field values.

---

## Complete LineChart Example

```tsx
// widgetSetup.ts
import { chartPlugin } from '@brewsite/charts';
export const myChartPlugin = chartPlugin();

// scenes.tsx
import { Scene, ProgressManager, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { LineChart, ChartAxis, ChartSeries, ChartLegend, ChartTooltip } from '@brewsite/charts';

const monthlyData = [
  { month: 'Jan', visits: 12400, conversions: 620 },
  { month: 'Feb', visits: 13800, conversions: 710 },
  { month: 'Mar', visits: 15200, conversions: 840 },
  { month: 'Apr', visits: 14600, conversions: 780 },
  { month: 'May', visits: 17300, conversions: 960 },
  { month: 'Jun', visits: 19100, conversions: 1120 },
];

export function SceneTrends() {
  return (
    <Scene id="line-trends">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 6.6]} target={[0, 0.08, 0]} fov={42} />
      <Lighting intensityScale={1.35}>
        <Ambient intensity={0.95} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      <LineChart
        id="traffic-trends"
        data={monthlyData}
        x={"10%"} y={"25%"} w={"80%"} h={"45%"}
        depth={0.3}
        lineShape="circle"
        lineSmoothness={0.4}
        showPoints
        interactive
      >
        <ChartAxis axis="x" field="month" label="Month" />
        <ChartAxis axis="y" field="visits" label="Visits" gridlines />
        <ChartSeries field="visits" label="Site Visits" />
        <ChartSeries field="conversions" label="Conversions" />
        <ChartLegend visible position="right" />
        <ChartTooltip format=".0f" />
      </LineChart>
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
import { SceneTrends } from './scenes';

export default function MyPage() {
  const plugins = useMemo(() => [corePlugin(), myChartPlugin], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins}>
        <SceneTrends />

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

`lineShape="circle"` gives the line a circular tube cross-section in 3D. `lineSmoothness={0.4}` applies moderate curve interpolation between data points. `showPoints` renders a sphere at each data vertex so individual values are easy to identify on hover.
