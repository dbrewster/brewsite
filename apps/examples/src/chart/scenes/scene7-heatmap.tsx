// Scene 7: Heatmap — 7-day × 24-hour activity grid with time animation.
import type { JSX } from 'react';
import { Camera, ProgressManager, Scene } from '@brewsite/core';
import { ChartAxis, ChartData, ChartLegend, HeatMapChart } from '@brewsite/charts';
import { activityHeatmap } from '../data/heatmapData';
import { CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, CHART_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';

export const Scene7 = (): JSX.Element => {
  return (
  <Scene id="chart-s7">
    <ProgressManager scrollUnits={1800} fn={(t) => Math.min(1, t * 2.5)} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <HeatMapChart
      id="activity-heat"
      data={activityHeatmap}
      timeField="day"
      heightField="calls"
      colorInterpolator="viridis"
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.25}
    >
      <ChartData />
      <ChartAxis axis="x" field="hour" label="Hour of Day" />
      <ChartAxis axis="y" field="day"  label="Day" />
      <ChartLegend visible position="right" />
    </HeatMapChart>

    <SceneTitleBox id="s7-title" title="Support Call Activity — 7-Day Heatmap" />
  </Scene>
  );
};
