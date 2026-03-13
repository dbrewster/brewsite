// Scene 6: Pie → Donut → Explode transitions — same chart ID "product-split" across 3 scenes.
import type { JSX } from 'react';
import { Camera, ProgressManager, Scene } from '@brewsite/core';
import { ChartAxis, ChartLegend, ChartSeries, PieChart } from '@brewsite/charts';
import { productRevenue } from '../data/productData';
import { PIE_CAM_FOV, PIE_CAM_POS, PIE_CAM_TGT, PIE_LAYOUT, SceneLighting, SceneTitleBox } from './sceneShared';

// Scene 6a — Pie chart (innerRadius=0)
export const Scene6a = (): JSX.Element => {
  return (
  <Scene id="chart-s6a">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={PIE_CAM_POS} target={PIE_CAM_TGT} fov={PIE_CAM_FOV} />
    <SceneLighting />

    <PieChart
      id="product-split"
      data={productRevenue}
      innerRadius={0}
      pieTilt={0}
      x={PIE_LAYOUT.x}
      y={PIE_LAYOUT.y}
      w={PIE_LAYOUT.w}
      h={PIE_LAYOUT.h}
      depth={0.5}
    >
      <ChartAxis axis="x" field="product" label="Product" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="right" />
    </PieChart>

    <SceneTitleBox id="s6a-title" title="Revenue by Product — Pie" />
  </Scene>
  );
};

// Scene 6b — Donut (innerRadius=0.5)
export const Scene6b = (): JSX.Element => {
  return (
  <Scene id="chart-s6b">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={PIE_CAM_POS} target={PIE_CAM_TGT} fov={PIE_CAM_FOV} />
    <SceneLighting />

    <PieChart
      id="product-split"
      data={productRevenue}
      innerRadius={0.5}
      pieTilt={0}
      x={PIE_LAYOUT.x}
      y={PIE_LAYOUT.y}
      w={PIE_LAYOUT.w}
      h={PIE_LAYOUT.h}
      depth={0.5}
    >
      <ChartAxis axis="x" field="product" label="Product" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="right" />
    </PieChart>

    <SceneTitleBox id="s6b-title" title="Revenue by Product — Donut" />
  </Scene>
  );
};

// Scene 6c — Exploded slice (Core Platform pushed outward)
export const Scene6c = (): JSX.Element => {
  return (
  <Scene id="chart-s6c">
    <ProgressManager scrollUnits={1000} />
    <Camera mode="world" position={PIE_CAM_POS} target={PIE_CAM_TGT} fov={PIE_CAM_FOV} />
    <SceneLighting />

    <PieChart
      id="product-split"
      data={productRevenue}
      innerRadius={0.5}
      pieTilt={0}
      explodeSlice="Core Platform"
      x={PIE_LAYOUT.x}
      y={PIE_LAYOUT.y}
      w={PIE_LAYOUT.w}
      h={PIE_LAYOUT.h}
      depth={0.5}
    >
      <ChartAxis axis="x" field="product" label="Product" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($k)" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartLegend visible position="right" />
    </PieChart>

    <SceneTitleBox id="s6c-title" title="Core Platform — Spotlight" />
  </Scene>
  );
};
