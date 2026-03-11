// Scene 10: Multi-chart linked-brush dashboard — two charts sharing filterGroup="ops".
// Interactive hover/click on one chart highlights matching data in the other.
import type { JSX } from 'react';
import { Camera, ProgressManager, Scene } from '@brewsite/core';
import { BarChart, ChartAxis, ChartData, ChartLegend, ChartSeries, ScatterPlotChart } from '@brewsite/charts';
import { CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, DASH_LAYOUT_LEFT, DASH_LAYOUT_RIGHT, SceneLighting, SceneTitleBox } from './sceneShared';
import {theme} from "../ChartDemoPage";

export const Scene10 = (): JSX.Element => (
  <Scene id="chart-s10" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1600} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    {/* Left: Bar chart — revenue by team, interactive */}
    <BarChart
      id="ops-bar"
      theme={theme}
      interactive={true}
      x={DASH_LAYOUT_LEFT.x}
      y={DASH_LAYOUT_LEFT.y}
      w={DASH_LAYOUT_LEFT.w}
      h={DASH_LAYOUT_LEFT.h}
      depth={0.4}
    >
      <ChartData filterGroup="ops" />
      <ChartAxis axis="x" field="team"    label="Team" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="bottom" />
    </BarChart>

    {/* Right: Scatter chart — team size vs revenue, same filter group */}
    <ScatterPlotChart
      id="ops-scatter"
      theme={theme}
      interactive={true}
      sizeField="headcount"
      x={DASH_LAYOUT_RIGHT.x}
      y={DASH_LAYOUT_RIGHT.y}
      w={DASH_LAYOUT_RIGHT.w}
      h={DASH_LAYOUT_RIGHT.h}
      depth={0.28}
    >
      <ChartData filterGroup="ops" />
      <ChartAxis axis="x" field="teamSize" label="Team Size" />
      <ChartAxis axis="y" field="revenue"  label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="bottom" />
    </ScatterPlotChart>

    <SceneTitleBox id="s10-title" subtitle="Chart Demo · Linked Brush" title="Multi-Chart Dashboard — Interactive" />
  </Scene>
);
