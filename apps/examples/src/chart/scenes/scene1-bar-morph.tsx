// Scene 1: Animated bar morphing — same chart ID, two datasets (Year A vs Year B).
// Datum-level morphing is triggered by the shared `quarter` keyField.
import type { JSX } from 'react';
import { Camera, ProgressManager, Scene } from '@brewsite/core';
import { BarChart, ChartAxis, ChartData, ChartDataLabels, ChartLegend, ChartSeries } from '@brewsite/charts';
import { saasMetricsYearA, saasMetricsYearB } from '../data/saasMetrics';
import { CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, CHART_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';

// Scene 1a — Year A data (inline)
export const Scene1a = (): JSX.Element => (
  <Scene id="chart-s1a" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <BarChart
      id="revenue-comparison"
      data={saasMetricsYearA}
      theme="darkGlass"
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.45}
    >
      <ChartData keyField="quarter" />
      <ChartAxis axis="x" field="quarter" label="Quarter" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ChartSeries field="profit"  label="Profit" />
      <ChartLegend visible position="right" />
      <ChartDataLabels position="top" format=".0f" />
    </BarChart>

    <SceneTitleBox id="s1a-title" title="Year A — Revenue Breakdown" />
  </Scene>
);

// Scene 1b — Same chart ID, Year B data — triggers datum-level bar morphing
export const Scene1b = (): JSX.Element => (
  <Scene id="chart-s1b" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <BarChart
      id="revenue-comparison"
      data={saasMetricsYearB}
      theme="darkGlass"
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.45}
    >
      <ChartData keyField="quarter" />
      <ChartAxis axis="x" field="quarter" label="Quarter" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ChartSeries field="profit"  label="Profit" />
      <ChartLegend visible position="right" />
    </BarChart>

    <SceneTitleBox id="s1b-title" title="Year B — Revenue Breakdown" />
  </Scene>
);
