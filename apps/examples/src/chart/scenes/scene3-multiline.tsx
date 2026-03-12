// Scene 3: Multi-line chart morph — same chart ID across two scenes with keyField="month".
// Scene 3a shows baseline metrics; Scene 3b morphs to an adjusted trajectory.
import type { JSX } from 'react';
import { ProgressManager, Scene } from '@brewsite/core';
import { ChartAxis, ChartData, ChartLegend, ChartSeries, ChartTooltip, LineChart, ReferenceLine } from '@brewsite/charts';
import { saasMetrics24Months } from '../data/saasMetrics';
import { CHART_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';
import { useDemoChartTheme } from './sceneShared';

const saasMetrics24MonthsAdjusted = saasMetrics24Months.map((row, idx) => {
  const swing = idx % 3 === 0 ? 1.14 : idx % 3 === 1 ? 0.92 : 1.06;
  const costSwing = idx % 2 === 0 ? 0.96 : 1.08;
  return {
    month: row.month,
    arr: Math.round(row.arr * swing),
    revenue: Math.round(row.revenue * swing),
    costs: Math.round(row.costs * costSwing),
  };
});

export const Scene3a = (): JSX.Element => {
  const chartTheme = useDemoChartTheme();
  return (
  <Scene id="chart-s3a" >
    <ProgressManager scrollUnits={1400} />
    <SceneLighting />

    <LineChart
      id="arr-trend"
      data={saasMetrics24Months}
      theme={chartTheme}
      lineShape="circle"
      lineSmoothness={0.5}
      showPoints={true}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.3}
      interactive
    >
      <ChartData keyField="month" />
      <ChartAxis axis="x" field="month"   label="Month" />
      <ChartAxis axis="y" field="arr"     label="Metric ($k)" gridlines />
      <ChartSeries field="arr"     label="ARR" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ReferenceLine axis="y" value={300} label="$300k Target" color="#ffcf40" />
      <ChartLegend visible position="right" />
      <ChartTooltip />
    </LineChart>

    <SceneTitleBox id="s3a-title" title="ARR & Revenue — Baseline Trend" />
  </Scene>
  );
};

export const Scene3b = (): JSX.Element => {
  const chartTheme = useDemoChartTheme();
  return (
  <Scene id="chart-s3b" transition={{ exit: [0.65, 1.0], enter: [0.0, 0.35] }}>
    <ProgressManager scrollUnits={1400} />
    <SceneLighting />

    <LineChart
      id="arr-trend"
      data={saasMetrics24MonthsAdjusted}
      theme={chartTheme}
      lineShape="circle"
      lineSmoothness={0.5}
      showPoints={true}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.3}
    >
      <ChartData keyField="month" />
      <ChartAxis axis="x" field="month"   label="Month" />
      <ChartAxis axis="y" field="arr"     label="Metric ($k)" gridlines />
      <ChartSeries field="arr"     label="ARR" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ReferenceLine axis="y" value={300} label="$300k Target" color="#ffcf40" />
      <ChartLegend visible position="right" />
    </LineChart>

    <SceneTitleBox id="s3b-title" title="ARR & Revenue — Adjusted Trend" />
  </Scene>
  );
};
