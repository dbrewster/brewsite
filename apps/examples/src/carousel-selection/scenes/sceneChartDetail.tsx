import type { JSX } from 'react';
import {
  Camera, Floor, Lighting, Ambient, Directional, ProgressManager, Scene,
} from '@brewsite/core';
import {
  BarChart, ChartAxis, ChartData, ChartDataLabels, ChartLegend,
  ChartSeries, ChartTooltip,
} from '@brewsite/charts';
import { revenueData } from '../data/sampleData';

const CAM_POS: [number, number, number] = [0, 1.5, 6];
const CAM_TGT: [number, number, number] = [0, 0.3, 0];

export const ChartDetailScene = (): JSX.Element => (
  <Scene id="detail-chart-view">
    <ProgressManager scrollUnits={800} />
    <Camera mode="world" position={CAM_POS} target={CAM_TGT} fov={38} />
    <Lighting intensityScale={1.3}>
      <Ambient intensity={2.8} color="#d7e5ff" />
      <Directional intensity={1.5} color="#ffffff" position={[3, 5, 4]} />
    </Lighting>
    <Floor variant="grid" negativeZExtent={20} />

    <BarChart
      id="picker-chart"
      data={revenueData}
      x={0.08} y={0.05} w={0.84} h={0.85}
      depth={0.45}
      interactive
    >
      <ChartData keyField="quarter" />
      <ChartAxis axis="x" field="quarter" label="Quarter" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs" label="Costs" />
      <ChartSeries field="profit" label="Profit" />
      <ChartLegend visible position="right" />
      <ChartDataLabels position="top" format=".0f" />
      <ChartTooltip projection />
    </BarChart>
  </Scene>
);
