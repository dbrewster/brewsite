---
title: "@brewsite/charts — Heatmap Chart"
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-15
---

## When to Use HeatMapChart

Use a heatmap to show intensity or density across a two-dimensional grid of categories. It works well for displaying patterns in a matrix — activity by day-of-week and hour, test coverage by feature and version, churn risk by region and product tier. When `timeField` is set, the heatmap animates through time-sliced frames driven by scene scroll progress, turning the grid into a living visualization that changes as the user scrolls.

Do not use a heatmap when exact values matter — color differences are hard to judge precisely. Use a `BarChart` or table when the viewer needs to read specific numbers rather than identify patterns. Avoid it when one axis has more than roughly 30 categories; cells become too small to distinguish. For a two-variable continuous relationship, `ScatterPlotChart` gives more precise positional encoding.

---

## HeatMapChart Props

These props are specific to `<HeatMapChart>`. For shared base props (`id`, `x`, `y`, `w`, `h`, `z`, `depth`, `data`, `dataUrl`, `opacity`, `interactive`, `gridlines`), see [base-props.md](./base-props.md).

| Prop | Type | Default | Description |
|---|---|---|---|
| `timeField` | `string` | — | Field name for the time/animation dimension. When set, the heatmap is divided into frames — one per unique value of `timeField` — and the displayed frame advances as `blockProgress` increases. |
| `heightField` | `string` | — | Field name whose value controls the 3D extrusion height of each cell. When absent, all cells have uniform height and only color encodes intensity. |
| `colorInterpolator` | `'blues' \| 'reds' \| 'viridis' \| 'plasma'` | — | Color scale for cell intensity values. `'viridis'` and `'plasma'` are perceptually uniform across the full range. `'blues'` and `'reds'` are sequential one-hue scales. |

---

## Animated Heatmap with timeField

When `timeField` is set, the dataset must contain rows for multiple time slices. Each unique value of the `timeField` column becomes one frame. The heatmap transitions through frames as `blockProgress` advances from 0 to 1 during scene scroll.

Data shape for an animated heatmap:

```tsx
const activityData = [
  // week=1 frame
  { week: 1, day: 'Mon', hour: 9,  intensity: 42 },
  { week: 1, day: 'Mon', hour: 10, intensity: 67 },
  { week: 1, day: 'Tue', hour: 9,  intensity: 38 },
  // ... all day/hour combinations for week=1

  // week=2 frame
  { week: 2, day: 'Mon', hour: 9,  intensity: 55 },
  { week: 2, day: 'Mon', hour: 10, intensity: 71 },
  { week: 2, day: 'Tue', hour: 9,  intensity: 44 },
  // ... all day/hour combinations for week=2
];
```

The renderer displays week=1 at scene entry and advances to week=2, week=3, etc. as the user scrolls through the scene's scroll distance. Each frame transition is animated smoothly.

```tsx
<HeatMapChart
  id="weekly-activity"
  data={activityData}
  x={0.10} y={0.20} w={0.80} h={0.55}
  timeField="week"
  colorInterpolator="viridis"
>
  <ChartAxis axis="x" field="hour" label="Hour of Day" />
  <ChartAxis axis="y" field="day" label="Day" />
</HeatMapChart>
```

---

## Complete HeatMapChart Example

```tsx
// widgetSetup.ts
import { chartPlugin } from '@brewsite/charts';
export const myChartPlugin = chartPlugin();

// scenes.tsx
import { Scene, ProgressManager, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import { HeatMapChart, ChartAxis, ChartLegend, ChartTooltip } from '@brewsite/charts';

// Static heatmap — no timeField, single grid snapshot
const coverageData = [
  { feature: 'Auth',     version: 'v1', coverage: 92, riskScore: 12 },
  { feature: 'Auth',     version: 'v2', coverage: 87, riskScore: 18 },
  { feature: 'Auth',     version: 'v3', coverage: 78, riskScore: 31 },
  { feature: 'Billing',  version: 'v1', coverage: 64, riskScore: 52 },
  { feature: 'Billing',  version: 'v2', coverage: 71, riskScore: 44 },
  { feature: 'Billing',  version: 'v3', coverage: 55, riskScore: 68 },
  { feature: 'Search',   version: 'v1', coverage: 88, riskScore: 20 },
  { feature: 'Search',   version: 'v2', coverage: 91, riskScore: 14 },
  { feature: 'Search',   version: 'v3', coverage: 83, riskScore: 25 },
  { feature: 'Reports',  version: 'v1', coverage: 45, riskScore: 78 },
  { feature: 'Reports',  version: 'v2', coverage: 52, riskScore: 71 },
  { feature: 'Reports',  version: 'v3', coverage: 38, riskScore: 88 },
];

export function SceneCoverageMap() {
  return (
    <Scene id="heatmap-coverage">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 6.6]} target={[0, 0.08, 0]} fov={42} />
      <Lighting intensityScale={1.35}>
        <Ambient intensity={0.95} color="#d7e5ff" />
        <Directional intensity={1.1} color="#edf4ff" position={[0, 2, 10]} />
      </Lighting>

      <HeatMapChart
        id="test-coverage"
        data={coverageData}
        x={0.15} y={0.20} w={0.70} h={0.55}
        depth={0.5}
        heightField="riskScore"
        colorInterpolator="reds"
        interactive
      >
        <ChartAxis axis="x" field="version" label="Version" />
        <ChartAxis axis="y" field="feature" label="Feature" />
        <ChartLegend visible position="right" title="Risk Score" />
        <ChartTooltip format=".0f" />
      </HeatMapChart>
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
import { SceneCoverageMap } from './scenes';

export default function MyPage() {
  const plugins = useMemo(() => [corePlugin(), myChartPlugin], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins}>
        <SceneCoverageMap />

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

`heightField="riskScore"` extrudes each cell in 3D proportionally to its risk score — cells with higher risk scores rise taller out of the plane. `colorInterpolator="reds"` maps low risk to pale red and high risk to deep red. Together, the height and color encode the same dimension with two redundant visual channels, making high-risk cells unmissable from any camera angle.
