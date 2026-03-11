// Scene 3: Multi-line chart with reference line — 3 product lines + $300k ARR target.
import type { JSX } from 'react';
import { Camera, ProgressManager, Scene } from '@brewsite/core';
import { ChartAxis, ChartData, ChartLegend, ChartSeries, LineChart, ReferenceLine } from '@brewsite/charts';
import { CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, CHART_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';

export const Scene3 = (): JSX.Element => (
  <Scene id="chart-s3" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1400} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <LineChart
      id="arr-trend"
      theme="darkGlass"
      lineShape="circle"
      lineSmoothness={0.5}
      showPoints={true}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.3}
    >
      <ChartData source="saas-24m" />
      <ChartAxis axis="x" field="month"   label="Month" />
      <ChartAxis axis="y" field="arr"     label="Metric ($k)" gridlines />
      <ChartSeries field="arr"     label="ARR" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ReferenceLine axis="y" value={300} label="$300k Target" color="#ffcf40" />
      <ChartLegend visible position="right" />
    </LineChart>

    <SceneTitleBox id="s3-title" title="ARR & Revenue — 24 Month Trend" />
  </Scene>
);
