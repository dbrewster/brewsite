// Scene 5: Scatter bubble chart — 4D encoding: X=teamSize, Y=revenue, size=headcount (sqrt-scaled), color=region.
// headcount_sqrt pre-computed via ComputeTransform so the renderer's min/max normalization
// operates on sqrt values — bubble area becomes proportional to headcount (perceptually correct).
import type { JSX } from 'react';
import {ProgressManager, Scene} from '@brewsite/core';
import {ChartAxis, ChartData, ChartLegend, ChartSeries, ScatterPlotChart} from '@brewsite/charts';
import { teamPerformance } from '../data/teamData';
import {CHART_LAYOUT, SceneLighting, SceneTitleBox} from './sceneShared';

export const Scene5 = (): JSX.Element => {
  return (
  <Scene id="chart-s5">
    <ProgressManager scrollUnits={1400} />
    <SceneLighting />

    <ScatterPlotChart
      id="team-bubble"
      data={teamPerformance}
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
};
