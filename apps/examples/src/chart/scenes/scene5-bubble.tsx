// Scene 5: Scatter bubble chart — 4D encoding: X=teamSize, Y=revenue, size=headcount, color=region.
import {Camera, ProgressManager, Scene} from '@brewsite/core';
import {ChartAxis, ChartData, ChartLegend, ChartSeries, ScatterPlotChart} from '@brewsite/charts';
import {CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, CHART_LAYOUT, SceneLighting, SceneTitleBox} from './sceneShared';

export const Scene5 = () => (
  <Scene id="chart-s5" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1400} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <ScatterPlotChart
      id="team-bubble"
      theme="darkGlass"
      sizeField="headcount"
      colorField="region"
      sizeScale={{ min: 0.25, max: 0.6 }}
      interactive={true}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.3}
    >
      <ChartData source="teams" />
      <ChartAxis axis="x" field="teamSize" label="Team Size" gridlines />
      <ChartAxis axis="y" field="revenue"  label="Revenue ($k)" gridlines />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="right" />
    </ScatterPlotChart>

    <SceneTitleBox id="s5-title" title="Team Size vs. Revenue (4D Bubble)" />
  </Scene>
);
