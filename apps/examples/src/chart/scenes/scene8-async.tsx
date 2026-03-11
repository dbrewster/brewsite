// Scene 8: Async data loading — LineChart fetches /data/metrics.json at runtime.
// The widget renders empty until ILoadable.load() resolves.
import type { JSX } from 'react';
import { Camera, ProgressManager, Scene } from '@brewsite/core';
import { ChartAxis, ChartLegend, ChartSeries, LineChart } from '@brewsite/charts';
import { CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, CHART_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';

export const Scene8 = (): JSX.Element => (
  <Scene id="chart-s8" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1400} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <LineChart
      id="remote-chart"
      dataUrl="/data/metrics.json"
      theme="darkGlass"
      lineShape="circle"
      showPoints={true}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.3}
    >
      <ChartAxis axis="x" field="month"   label="Month" />
      <ChartAxis axis="y" field="arr"     label="Metric ($k)" gridlines />
      <ChartSeries field="arr"     label="ARR" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ChartLegend visible position="right" />
    </LineChart>

    <SceneTitleBox id="s8-title" subtitle="Chart Demo · Async" title="Async Data Loading — /data/metrics.json" />
  </Scene>
);
