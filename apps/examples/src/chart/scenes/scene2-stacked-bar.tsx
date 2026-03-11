// Scene 2: Stacked bar chart — multi-series regional revenue, stacked then horizontal.
// Same chart ID "stacked-revenue" across both sub-scenes for orientation transition.
import type { JSX } from 'react';
import { Camera, ProgressManager, Scene } from '@brewsite/core';
import { BarChart, ChartAxis, ChartDataLabels, ChartLegend, ChartSeries } from '@brewsite/charts';
import { regionalRevenue } from '../data/saasMetrics';
import { CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, CHART_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';
import {theme} from "../ChartDemoPage";

// Scene 2a — Stacked vertical bars
export const Scene2a = (): JSX.Element => (
  <Scene id="chart-s2a" >
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <BarChart
      id="stacked-revenue"
      data={regionalRevenue}
      theme={theme}
      stackMode="stacked"
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.45}
    >
      <ChartAxis axis="x" field="month" label="Month" />
      <ChartAxis axis="y" field="emea"  label="Revenue ($k)" />
      <ChartSeries field="americas" label="Americas" />
      <ChartSeries field="emea"     label="EMEA" />
      <ChartSeries field="apac"     label="APAC" />
      <ChartLegend visible position="right" />
      <ChartDataLabels position="center" format=".0f" />
    </BarChart>

    <SceneTitleBox id="s2a-title" title="Regional Revenue — Stacked" />
  </Scene>
);

// Scene 2b — Same chart, horizontal orientation
export const Scene2b = (): JSX.Element => (
  <Scene id="chart-s2b" >
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <BarChart
      id="stacked-revenue"
      data={regionalRevenue}
      theme={theme}
      stackMode="stacked"
      orientation="horizontal"
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.45}
    >
      <ChartAxis axis="x" field="month"    label="Month" />
      <ChartAxis axis="y" field="emea"     label="Revenue ($k)" />
      <ChartSeries field="americas" label="Americas" />
      <ChartSeries field="emea"     label="EMEA" />
      <ChartSeries field="apac"     label="APAC" />
      <ChartLegend visible position="right" />
    </BarChart>

    <SceneTitleBox id="s2b-title" title="Regional Revenue — Horizontal" />
  </Scene>
);
