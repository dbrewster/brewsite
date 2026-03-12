// Scene 4: Stacked area chart — APAC, EMEA, Americas regional revenue. neonCyber theme.
import type { JSX } from 'react';
import { ProgressManager, Scene } from '@brewsite/core';
import { AreaChart, ChartAxis, ChartData, ChartLegend, ChartSeries } from '@brewsite/charts';
import { regionalRevenue } from '../data/saasMetrics';
import { CHART_LAYOUT, NeonLighting, SceneTitleBox } from './sceneShared';
import { useDemoChartTheme } from './sceneShared';

export const Scene4 = (): JSX.Element => {
  const chartTheme = useDemoChartTheme();
  return (
  <Scene id="chart-s4" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1400} />
    <NeonLighting />

    <AreaChart
      id="regional-area"
      data={regionalRevenue}
      theme={chartTheme}
      stackMode="stacked"
      fillOpacity={0.72}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.35}
    >
      <ChartData />
      <ChartAxis axis="x" field="month"    label="Month" />
      <ChartAxis axis="y" field="emea"     label="Revenue ($k)" gridlines />
      <ChartSeries field="americas" label="Americas" />
      <ChartSeries field="emea"     label="EMEA" />
      <ChartSeries field="apac"     label="APAC" />
      <ChartLegend visible position="right" />
    </AreaChart>

    <SceneTitleBox id="s4-title" subtitle="Chart Demo · neonCyber" title="Regional Revenue — Stacked Area" />
  </Scene>
  );
};
