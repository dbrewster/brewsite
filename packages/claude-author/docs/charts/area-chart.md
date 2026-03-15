---
title: "@brewsite/charts — Area Chart"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## When to Use AreaChart

Use an area chart when you want to emphasize the volume or cumulative magnitude of a quantity over time, not just its direction. Stacked areas are effective for showing how multiple series combine into a total — for example, traffic by channel adding up to total visits. The filled region makes it easy to perceive the size of the quantity, not just its trend line.

Do not use an area chart when the values between individual series overlap significantly without stacking — the fill will obscure the series below. Use `LineChart` when you need to compare trajectory without implying accumulation. The band variant (`bandField` on `<ChartSeries>`) is best reserved for confidence intervals or ranges, not general multi-series comparison.

---

## AreaChart Props

These props are specific to `<AreaChart>`. For shared base props (`id`, `x`, `y`, `w`, `h`, `z`, `depth`, `data`, `dataUrl`, `opacity`, `interactive`, `gridlines`), see [base-props.md](./base-props.md).

| Prop | Type | Default | Description |
|---|---|---|---|
| `stackMode` | `'none' \| 'stacked'` | `'none'` | `'none'` renders each series independently from the baseline. `'stacked'` accumulates series on top of each other to show a combined total. |
| `fillOpacity` | `number` | from theme | Area fill opacity [0..1]. Lower values let overlapping series remain visible. |

For the band/range variant (confidence interval, min/max envelope), set `bandField` on `<ChartSeries>`:

```ts
// bandField on ChartSeriesProps:
bandField?: string; // Name of the lower-bound field for a band area variant
```

---

## Stacked Area Chart

When `stackMode="stacked"`, each series is rendered on top of the cumulative sum of all previous series. This makes the top edge of the uppermost series represent the total across all series:

```tsx
const trafficData = [
  { month: 'Jan', organic: 8200, paid: 3100, email: 1100 },
  { month: 'Feb', organic: 9100, paid: 3400, email: 1300 },
  { month: 'Mar', organic: 10500, paid: 3800, email: 1600 },
  { month: 'Apr', organic: 9800, paid: 3600, email: 1500 },
  { month: 'May', organic: 12200, paid: 4100, email: 1900 },
];

<AreaChart
  id="channel-traffic"
  data={trafficData}
  x={0.10} y={0.25} w={0.80} h={0.45}
  stackMode="stacked"
  fillOpacity={0.85}
>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="organic" gridlines />
  <ChartSeries field="organic" label="Organic" />
  <ChartSeries field="paid" label="Paid" />
  <ChartSeries field="email" label="Email" />
  <ChartLegend visible position="bottom" />
</AreaChart>
```

For the band/range variant showing a confidence envelope:

```tsx
const forecastData = [
  { month: 'Jan', forecast: 12000, low: 10500, high: 13800 },
  { month: 'Feb', forecast: 13500, low: 11800, high: 15400 },
  { month: 'Mar', forecast: 15000, low: 13200, high: 17100 },
];

<AreaChart id="forecast-range" data={forecastData} x={0.10} y={0.25} w={0.80} h={0.45}>
  <ChartAxis axis="x" field="month" />
  <ChartAxis axis="y" field="high" />
  {/* bandField sets the lower bound of the filled region */}
  <ChartSeries field="high" bandField="low" label="Forecast Range" />
</AreaChart>
```

---

## Complete AreaChart Example

```tsx
// widgetSetup.ts
import { chartPlugin } from '@brewsite/charts';
export const myChartPlugin = chartPlugin();

// scenes.tsx
import { Scene, ProgressManager, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { AreaChart, ChartAxis, ChartSeries, ChartLegend, ChartTooltip } from '@brewsite/charts';

const trafficData = [
  { month: 'Jan', organic: 8200, paid: 3100, email: 1100 },
  { month: 'Feb', organic: 9100, paid: 3400, email: 1300 },
  { month: 'Mar', organic: 10500, paid: 3800, email: 1600 },
  { month: 'Apr', organic: 9800, paid: 3600, email: 1500 },
  { month: 'May', organic: 12200, paid: 4100, email: 1900 },
  { month: 'Jun', organic: 14400, paid: 4600, email: 2200 },
];

export function SceneTrafficChannels() {
  return (
    <Scene id="area-channels">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 6.6]} target={[0, 0.08, 0]} fov={42} />
      <Lighting intensityScale={1.35}>
        <Ambient intensity={0.95} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      <AreaChart
        id="channel-traffic"
        data={trafficData}
        x={0.10} y={0.25} w={0.80} h={0.45}
        depth={0.3}
        stackMode="stacked"
        fillOpacity={0.85}
        interactive
      >
        <ChartAxis axis="x" field="month" label="Month" />
        <ChartAxis axis="y" field="organic" label="Sessions" gridlines />
        <ChartSeries field="organic" label="Organic" />
        <ChartSeries field="paid" label="Paid" />
        <ChartSeries field="email" label="Email" />
        <ChartLegend visible position="right" />
        <ChartTooltip format=".0f" />
      </AreaChart>
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
import { SceneTrafficChannels } from './scenes';

export default function MyPage() {
  const plugins = useMemo(() => [corePlugin(), myChartPlugin], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins}>
        <SceneTrafficChannels />

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

With `stackMode="stacked"`, the top edge of the uppermost series (email) represents total traffic across all three channels. Each filled layer shows that channel's contribution to the combined total.
