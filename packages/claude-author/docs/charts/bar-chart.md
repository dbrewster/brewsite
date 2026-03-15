---
title: "@brewsite/charts — Bar Chart"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## When to Use BarChart

Use a bar chart to compare discrete, unordered categories: revenue by product line, users by country, conversions by campaign. The visual emphasis is on individual values and their magnitude relative to each other. Grouped and stacked modes let you show multiple series side by side or accumulated within each category.

Do not use a bar chart for time-series data where the trend matters more than individual values — use `LineChart` instead. Do not use it for more than roughly 20 categories; readability breaks down and bars become too thin to read. For a single part-of-whole comparison with 5 or fewer segments, `PieChart` is more scannable.

---

## BarChart Props

These props are specific to `<BarChart>`. For shared base props (`id`, `x`, `y`, `w`, `h`, `z`, `depth`, `data`, `dataUrl`, `opacity`, `interactive`, `gridlines`), see [base-props.md](./base-props.md).

| Prop | Type | Default | Description |
|---|---|---|---|
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Bar direction. Horizontal bars work better when category labels are long text strings. |
| `stackMode` | `'grouped' \| 'stacked'` | `'grouped'` | How multiple series are rendered side by side or accumulated. |
| `barPadding` | `number` | from theme | Padding ratio between bar groups [0..1]. |

---

## BarChart Data Format

Bar charts work best with a row-array where each row represents one category. Define the category field on the x-axis and each metric as a separate series:

```tsx
const salesData = [
  { quarter: 'Q1', revenue: 128, costs: 84 },
  { quarter: 'Q2', revenue: 145, costs: 91 },
  { quarter: 'Q3', revenue: 162, costs: 97 },
  { quarter: 'Q4', revenue: 190, costs: 105 },
];
```

For `stackMode="stacked"`, the same data shape applies — the renderer accumulates each series field on top of the previous one.

For horizontal bars with long labels, prefer `orientation="horizontal"`:

```tsx
const channelData = [
  { channel: 'Organic Search', sessions: 42000 },
  { channel: 'Paid Social', sessions: 18500 },
  { channel: 'Email Campaign', sessions: 12300 },
  { channel: 'Direct Traffic', sessions: 9800 },
];
```

---

## BarChart Entry Animation

`animateEntry` causes bars to grow from zero height when the scene enters, driven by scene scroll progress (`blockProgress`). This is the primary way to introduce chart data dramatically in a scroll-driven presentation.

```tsx
<BarChart
  id="revenue"
  data={salesData}
  x={0.30} y={0.32} w={0.40} h={0.30}
  animateEntry
  animationDuration={0.4}
>
  ...
</BarChart>
```

`animationDuration` is a fraction of `blockProgress` [0..1]. At `blockProgress = animationDuration`, bars reach full height. Defaults to `0.4`. This means bars are fully grown by the time the user has scrolled 40% through the scene's scroll distance.

Note: `animateEntry` is currently scoped to `BarRenderer` and has no effect on other chart types.

---

## Complete BarChart Example

A two-scene sequence: bars animate in on the first scene, morph to new data on the second scene. Includes tooltip, legend, data labels, and a reference line.

```tsx
// widgetSetup.ts
import { chartPlugin } from '@brewsite/charts';
export const myChartPlugin = chartPlugin();

// data.ts
export const yearAData = [
  { quarter: 'Q1', revenue: 128, costs: 84 },
  { quarter: 'Q2', revenue: 145, costs: 91 },
  { quarter: 'Q3', revenue: 162, costs: 97 },
  { quarter: 'Q4', revenue: 190, costs: 105 },
];

export const yearBData = [
  { quarter: 'Q1', revenue: 148, costs: 88 },
  { quarter: 'Q2', revenue: 171, costs: 95 },
  { quarter: 'Q3', revenue: 195, costs: 103 },
  { quarter: 'Q4', revenue: 224, costs: 112 },
];

// scenes.tsx
import { Scene, ProgressManager, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import {
  BarChart, ChartAxis, ChartSeries, ChartLegend,
  ChartDataLabels, ChartData, ChartTooltip, ReferenceLine,
} from '@brewsite/charts';
import { yearAData, yearBData } from './data';

const CAM_POS: [number, number, number] = [0, 1.5, 6.6];
const CAM_TGT: [number, number, number] = [0, 0.08, 0];
const CHART = { x: 0.30, y: 0.32, w: 0.40, h: 0.30 };

export function SceneYearA() {
  return (
    <Scene id="bar-year-a">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.35}>
        <Ambient intensity={0.95} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      <BarChart
        id="revenue-chart"
        data={yearAData}
        x={CHART.x} y={CHART.y} w={CHART.w} h={CHART.h}
        depth={0.45}
        orientation="vertical"
        stackMode="grouped"
        interactive
        animateEntry
        animationDuration={0.4}
      >
        <ChartData keyField="quarter" />
        <ChartAxis axis="x" field="quarter" label="Quarter" />
        <ChartAxis axis="y" field="revenue" label="Revenue ($k)" gridlines />
        <ChartSeries field="revenue" label="Revenue" />
        <ChartSeries field="costs" label="Costs" />
        <ChartLegend visible position="right" />
        <ChartDataLabels position="top" format=".0f" />
        <ReferenceLine axis="y" value={150} label="Target" color="#aaffaa" />
        <ChartTooltip projection format=".0f" />
      </BarChart>
    </Scene>
  );
}

export function SceneYearB() {
  return (
    <Scene id="bar-year-b">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={42} />
      <Lighting intensityScale={1.35}>
        <Ambient intensity={0.95} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      {/* Same id as SceneYearA — datum-level morphing triggered by keyField="quarter" */}
      <BarChart
        id="revenue-chart"
        data={yearBData}
        x={CHART.x} y={CHART.y} w={CHART.w} h={CHART.h}
        depth={0.45}
        interactive
      >
        <ChartData keyField="quarter" />
        <ChartAxis axis="x" field="quarter" label="Quarter" />
        <ChartAxis axis="y" field="revenue" label="Revenue ($k)" gridlines />
        <ChartSeries field="revenue" label="Revenue" />
        <ChartSeries field="costs" label="Costs" />
        <ChartLegend visible position="right" />
        <ChartTooltip projection format=".0f" />
      </BarChart>
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
import { SceneYearA, SceneYearB } from './scenes';

export default function MyPage() {
  const plugins = useMemo(() => [corePlugin(), myChartPlugin], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins}>
        <SceneYearA />
        <SceneYearB />

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

When scrolling from `SceneYearA` to `SceneYearB`, each bar morphs from Year A values to Year B values — matched by `quarter` via `keyField`. The tooltip shows on hover because `interactive={true}`. The projection beam draws from the hovered bar down to the floor plane because `projection` is set on `<ChartTooltip>`.
