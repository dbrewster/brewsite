---
title: "@brewsite/charts — Pie Chart"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## When to Use PieChart

Use a pie chart to show part-of-whole relationships for a small number of named segments. It works best with 3–6 slices where the proportional difference between them is the key message — for example, market share by brand, budget allocation by department, or traffic sources by channel.

Do not use a pie chart to compare more than 7–8 segments, or when the difference between slices is small (less than 5%); angular differences are harder to judge than length. Do not use it for time series or any data where absolute values matter more than proportions — use `BarChart` instead.

---

## PieChart vs Donut Chart

The `innerRadius` prop controls whether the chart renders as a solid pie or a donut. `innerRadius={0}` (the default) renders a traditional pie. Any value greater than `0` cuts out the center to create a donut.

The donut variant is generally preferred for 3D scenes: it reduces the visual mass of the chart center and leaves space for a center annotation. The hole also makes slice boundaries easier to read from an angle when `pieTilt` is applied.

```tsx
{/* Traditional pie */}
<PieChart id="share" data={shareData} innerRadius={0} ... >

{/* Donut — hole is 45% of the outer radius */}
<PieChart id="share" data={shareData} innerRadius={0.45} ... >
```

---

## PieChart Props

These props are specific to `<PieChart>`. For shared base props (`id`, `x`, `y`, `w`, `h`, `z`, `depth`, `data`, `dataUrl`, `opacity`, `interactive`, `gridlines`), see [base-props.md](./base-props.md).

| Prop | Type | Default | Description |
|---|---|---|---|
| `innerRadius` | `number` | `0` | [0..1] — `0` = pie, `>0` = donut. Controls the size of the center hole as a fraction of the outer radius. `0.45` is a common donut proportion. |
| `pieTilt` | `number` | `0` | Tilt angle in radians applied to the pie plane. A small positive value (e.g. `0.3`) gives a 3D perspective tilt. |
| `explodeSlice` | `string` | — | The x-axis field value of the slice to push outward (explode) for emphasis. Pass the string value of the category field, not an index. |

---

## PieChart Data Format

Pie charts typically use one series and one label field. Each row represents one slice. The x-axis field provides slice labels; the series field provides the values that determine slice angles:

```tsx
const marketShareData = [
  { brand: 'Product A', share: 42 },
  { brand: 'Product B', share: 28 },
  { brand: 'Product C', share: 18 },
  { brand: 'Other', share: 12 },
];
```

Map the label field to the x-axis and the value field as a `<ChartSeries>`:

```tsx
<PieChart id="market-share" data={marketShareData} ...>
  <ChartAxis axis="x" field="brand" />
  <ChartSeries field="share" label="Market Share" />
</PieChart>
```

Values do not need to sum to 100 — the renderer normalizes them automatically.

---

## Complete PieChart Example

Both pie and donut variants in adjacent scenes, with `explodeSlice` to highlight the leading segment:

```tsx
// widgetSetup.ts
import { chartPlugin } from '@brewsite/charts';
export const myChartPlugin = chartPlugin();

// scenes.tsx
import { Scene, ProgressManager, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { PieChart, ChartAxis, ChartSeries, ChartLegend, ChartDataLabels, ChartTooltip } from '@brewsite/charts';

const marketShareData = [
  { brand: 'Product A', share: 42 },
  { brand: 'Product B', share: 28 },
  { brand: 'Product C', share: 18 },
  { brand: 'Other', share: 12 },
];

export function ScenePie() {
  return (
    <Scene id="pie-share">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 6.6]} target={[0, 0.08, 0]} fov={42} />
      <Lighting intensityScale={1.35}>
        <Ambient intensity={0.95} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      {/* Traditional pie with a tilt and slice explode */}
      <PieChart
        id="market-share"
        data={marketShareData}
        x={0.30} y={0.25} w={0.40} h={0.40}
        depth={0.3}
        innerRadius={0}
        pieTilt={0.3}
        explodeSlice="Product A"
        interactive
      >
        <ChartAxis axis="x" field="brand" />
        <ChartSeries field="share" label="Market Share" />
        <ChartLegend visible position="right" />
        <ChartDataLabels position="outside" format=".0f" />
        <ChartTooltip format=".1f" />
      </PieChart>
    </Scene>
  );
}

export function SceneDonut() {
  return (
    <Scene id="donut-share">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 6.6]} target={[0, 0.08, 0]} fov={42} />
      <Lighting intensityScale={1.35}>
        <Ambient intensity={0.95} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      {/* Donut variant — same id triggers morphing from pie to donut */}
      <PieChart
        id="market-share"
        data={marketShareData}
        x={0.30} y={0.25} w={0.40} h={0.40}
        depth={0.3}
        innerRadius={0.45}
        pieTilt={0.3}
        interactive
      >
        <ChartAxis axis="x" field="brand" />
        <ChartSeries field="share" label="Market Share" />
        <ChartLegend visible position="right" />
        <ChartTooltip format=".1f" />
      </PieChart>
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
import { ScenePie, SceneDonut } from './scenes';

export default function MyPage() {
  const plugins = useMemo(() => [corePlugin(), myChartPlugin], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins}>
        <ScenePie />
        <SceneDonut />

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

`explodeSlice="Product A"` pushes the Product A slice outward to draw attention to the leading segment. In `SceneDonut`, the same `id="market-share"` causes the chart to transition from the pie to the donut form as the user scrolls between scenes.
