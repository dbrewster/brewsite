// Scene 8: Remote metrics chart.
// Data is loaded by chart async source (`dataUrl`) and managed by ChartWidget.load().
import type { JSX } from 'react';
import { ProgressManager, Scene } from '@brewsite/core';
import {ChartAxis, ChartData, ChartLegend, ChartSeries, LineChart} from '@brewsite/charts';
import { CHART_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';
import { useDemoChartTheme } from './sceneShared';

export const Scene8 = (): JSX.Element => {
  const chartTheme = useDemoChartTheme();
  return (
  <Scene id="chart-s8" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1400} />
    <SceneLighting />

    <LineChart
      id="remote-chart"
      dataUrl="/data/metrics.json"
      theme={chartTheme}
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
      <ChartData />
    </LineChart>

    <SceneTitleBox id="s8-title" subtitle="Chart Demo · Async" title="Async Data Loading — /data/metrics.json" />
  </Scene>
  );
};
