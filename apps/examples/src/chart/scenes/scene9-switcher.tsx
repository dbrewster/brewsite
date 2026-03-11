// Scene 9: Chart-type switcher — same chart ID "switcher-demo", same inline data,
// cycling through BarChart → LineChart → AreaChart → ScatterPlotChart.
// Demonstrates chart-type transitions at the widget level (same ID = same widget).
import type { JSX } from 'react';
import { Camera, ProgressManager, Scene } from '@brewsite/core';
import { AreaChart, BarChart, ChartAxis, ChartLegend, ChartSeries, LineChart, ScatterPlotChart } from '@brewsite/charts';
import { saasMetrics24Months } from '../data/saasMetrics';
import { CHART_CAM_FOV, CHART_CAM_POS, CHART_CAM_TGT, CHART_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';
import {theme} from "../ChartDemoPage";

const SWITCHER_DATA = saasMetrics24Months.slice(0, 12); // 12 months for compact view

// Scene 9a — Bar view
export const Scene9a = (): JSX.Element => (
  <Scene id="chart-s9a" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1000} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <BarChart
      id="switcher-demo"
      data={SWITCHER_DATA}
      theme={theme}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.45}
    >
      <ChartAxis axis="x" field="month"   label="Month" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ChartLegend visible position="right" />
    </BarChart>

    <SceneTitleBox id="s9a-title" subtitle="Type Switcher" title="Same Data — Bar View" />
  </Scene>
);

// Scene 9b — Line view (same chart ID)
export const Scene9b = (): JSX.Element => (
  <Scene id="chart-s9b" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1000} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <LineChart
      id="switcher-demo"
      data={SWITCHER_DATA}
      theme={theme}
      showPoints={true}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.3}
    >
      <ChartAxis axis="x" field="month"   label="Month" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ChartLegend visible position="right" />
    </LineChart>

    <SceneTitleBox id="s9b-title" subtitle="Type Switcher" title="Same Data — Line View" />
  </Scene>
);

// Scene 9c — Area view (same chart ID)
export const Scene9c = (): JSX.Element => (
  <Scene id="chart-s9c" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1000} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <AreaChart
      id="switcher-demo"
      data={SWITCHER_DATA}
      theme={theme}
      fillOpacity={0.6}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.35}
    >
      <ChartAxis axis="x" field="month"   label="Month" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs"   label="Costs" />
      <ChartLegend visible position="right" />
    </AreaChart>

    <SceneTitleBox id="s9c-title" subtitle="Type Switcher" title="Same Data — Area View" />
  </Scene>
);

// Scene 9d — Scatter view (same chart ID)
export const Scene9d = (): JSX.Element => (
  <Scene id="chart-s9d" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.0] }}>
    <ProgressManager scrollUnits={1000} />
    <Camera mode="world" position={CHART_CAM_POS} target={CHART_CAM_TGT} fov={CHART_CAM_FOV} />
    <SceneLighting />

    <ScatterPlotChart
      id="switcher-demo"
      data={SWITCHER_DATA}
      theme={theme}
      x={CHART_LAYOUT.x}
      y={CHART_LAYOUT.y}
      w={CHART_LAYOUT.w}
      h={CHART_LAYOUT.h}
      depth={0.3}
    >
      <ChartAxis axis="x" field="month"   label="Month" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="right" />
    </ScatterPlotChart>

    <SceneTitleBox id="s9d-title" subtitle="Type Switcher" title="Same Data — Scatter View" />
  </Scene>
);
