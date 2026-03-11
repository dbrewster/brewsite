// Scene 5: Scatter bubble chart — 4D encoding: X=teamSize, Y=revenue, size=headcount (sqrt-scaled), color=region.
// headcount_sqrt pre-computed via ComputeTransform so the renderer's min/max normalization
// operates on sqrt values — bubble area becomes proportional to headcount (perceptually correct).
import type { JSX } from 'react';
import {Camera, ProgressManager, Scene} from '@brewsite/core';
import {ChartAxis, ChartData, ChartLegend, ChartSeries, ScatterPlotChart} from '@brewsite/charts';
import {CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, CHART_LAYOUT, SceneLighting, SceneTitleBox} from './sceneShared';
import {theme} from "../ChartDemoPage";

export const Scene5 = (): JSX.Element => (
  <Scene id="chart-s5" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1400} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <ScatterPlotChart
      id="team-bubble"
      theme={theme}
      sizeField="headcount_sqrt"
      colorField="region"
      sizeScale={{ min: 0.28, max: 0.85 }}
      interactive={true}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.3}
    >
      <ChartData
        source="teams"
        transforms={[{
          type: 'compute',
          outputField: 'headcount_sqrt',
          operation: { fn: 'sqrt', inputField: 'headcount' },
        }]}
      />
      <ChartAxis axis="x" field="teamSize" label="Team Size" gridlines />
      <ChartAxis axis="y" field="revenue"  label="Revenue ($k)" gridlines />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="right" />
    </ScatterPlotChart>

    <SceneTitleBox id="s5-title" title="Team Size vs. Revenue (4D Bubble)" />
  </Scene>
);
