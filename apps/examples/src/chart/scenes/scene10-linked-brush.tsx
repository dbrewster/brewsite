// Scene 10: Multi-chart linked-brush dashboard — two charts sharing filterGroup="ops".
// Interactive hover/click on one chart highlights matching data in the other.
import type { JSX } from 'react';
import {Camera, ProgressManager, Scene} from '@brewsite/core';
import {BarChart, ChartAxis, ChartData, ChartLegend, ChartSeries, HeatMapChart, ScatterPlotChart} from '@brewsite/charts';
import { teamPerformance } from '../data/teamData';
import {CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, DASH_LAYOUT_LEFT, DASH_LAYOUT_RIGHT, SceneLighting, SceneTitleBox} from './sceneShared';
import { useDemoChartTheme } from './sceneShared';
import {activityHeatmap} from "../data/heatmapData";

export const Scene10 = (): JSX.Element => {
  const chartTheme = useDemoChartTheme();
  return (
  <Scene id="chart-s10" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1600} />
    <SceneLighting />

    {/* Left: Bar chart — revenue by team, interactive */}
    <BarChart
      id="ops-bar"
      data={teamPerformance}
      theme={chartTheme}
      interactive={true}
      x={DASH_LAYOUT_LEFT.x}
      y={.4}
      w={DASH_LAYOUT_LEFT.w}
      h={DASH_LAYOUT_LEFT.h}
      depth={0.4}
      z={1}
    >
      <ChartData filterGroup="ops" />
      <ChartAxis axis="x" field="team"    label="Team" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
    </BarChart>

    {/* Right: Scatter chart — team size vs revenue, same filter group */}
    <ScatterPlotChart
      id="ops-scatter"
      data={teamPerformance}
      theme={chartTheme}
      interactive={true}
      sizeField="headcount"
      colorField='region'
      x={DASH_LAYOUT_RIGHT.x}
      y={DASH_LAYOUT_RIGHT.y}
      w={DASH_LAYOUT_RIGHT.w}
      h={DASH_LAYOUT_RIGHT.h}
      z={-5}
      depth={0.28}
    >
      <ChartData filterGroup="ops" />
      <ChartAxis axis="x" field="teamSize" label="Team Size" />
      <ChartAxis axis="y" field="revenue"  label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
    </ScatterPlotChart>

    <HeatMapChart
      id="ops-heat"
      data={teamPerformance}
      theme={chartTheme}
      timeField="teamSize"
      heightField="revenue"
      colorInterpolator="viridis"
      x={.15}
      y={DASH_LAYOUT_RIGHT.y}
      w={DASH_LAYOUT_RIGHT.w}
      h={DASH_LAYOUT_RIGHT.h}
      z={-5}
      depth={0.28}
    >
      <ChartData />
      <ChartAxis axis="x" field="Region"    label="Region" />
      <ChartAxis axis="y" field="revenue"  label="Revenue ($k)" />
      <ChartLegend visible position="right" />
    </HeatMapChart>

    <SceneTitleBox id="s10-title" subtitle="Chart Demo · Linked Brush" title="Multi-Chart Dashboard — Interactive" />
  </Scene>
  );
};
