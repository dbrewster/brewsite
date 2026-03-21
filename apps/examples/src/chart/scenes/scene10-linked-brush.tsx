// Scene 10: Multi-chart linked-brush dashboard — two charts sharing filterGroup="ops".
// Interactive hover/click on one chart highlights matching data in the other.
//
// SPATIAL vs AMBIENT — Scene child constraint:
// BarChart, ScatterPlotChart, and HeatMapChart are *spatial* elements — they occupy
// an NVS region in the 3D canvas. When multiple spatial elements appear as direct
// <Scene> children, each must be wrapped in an explicit <View>. (A single spatial
// element is fine without a <View>: the compiler auto-wraps it to fullscreen.)
//
// <Camera>, <Lighting>, <Background>, <ProgressManager>, and <SceneTitleBox>
// (which renders <TextBox>) are *ambient* — they configure the scene globally and
// are always allowed as direct <Scene> children alongside Views or other elements.
import type { JSX } from 'react';
import {Camera, ProgressManager, Scene, View} from '@brewsite/core';
import {BarChart, ChartAxis, ChartData, ChartLegend, ChartSeries, HeatMapChart, ScatterPlotChart} from '@brewsite/charts';
import { teamPerformance } from '../data/teamData';
import {CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, DASH_LAYOUT_LEFT, DASH_LAYOUT_RIGHT, SceneLighting, SceneTitleBox} from './sceneShared';
import {activityHeatmap} from "../data/heatmapData";

export const Scene10 = (): JSX.Element => {
  return (
  <Scene id="chart-s10">
    <ProgressManager scrollUnits={1600} />
    <SceneLighting />

    {/* Each chart is a spatial element and must be inside a <View>. Full-screen
        Views (x=0 y=0 w=1 h=1) preserve the charts' own NVS coordinates unchanged. */}

    {/* Left: Bar chart — revenue by team, interactive */}
    <View id="s10-bar" x={0} y={0} w={"100%"} h={"100%"}>
      <BarChart
        id="ops-bar"
        data={teamPerformance}
        interactive={true}
        x={DASH_LAYOUT_LEFT.x}
        y={"40%"}
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
    </View>

    {/* Right: Scatter chart — team size vs revenue, same filter group */}
    <View id="s10-scatter" x={0} y={0} w={"100%"} h={"100%"}>
      <ScatterPlotChart
        id="ops-scatter"
        data={teamPerformance}
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
    </View>

    <View id="s10-heat" x={0} y={0} w={"100%"} h={"100%"}>
      <HeatMapChart
        id="ops-heat"
        data={teamPerformance}
        timeField="teamSize"
        heightField="revenue"
        colorInterpolator="viridis"
        x={"15%"}
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
    </View>

    <SceneTitleBox id="s10-title" subtitle="Chart Demo · Linked Brush" title="Multi-Chart Dashboard — Interactive" />
  </Scene>
  );
};
