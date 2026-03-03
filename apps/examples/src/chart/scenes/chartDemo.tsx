import type { JSX } from 'react';
import { Scene } from '@brewsite/core';
import {
  Chart, ChartData, ChartAxis, ChartSeries, ChartLegend,
} from '@brewsite/charts';

export const sampleSalesData = [
  { month: 'Jan', revenue: 120, costs: 85, units: 45 },
  { month: 'Feb', revenue: 140, costs: 92, units: 52 },
  { month: 'Mar', revenue: 110, costs: 78, units: 38 },
  { month: 'Apr', revenue: 165, costs: 105, units: 61 },
  { month: 'May', revenue: 190, costs: 118, units: 72 },
  { month: 'Jun', revenue: 175, costs: 110, units: 65 },
];

/** Bar chart — multi-series sales by month. */
export const chartDemoBar: JSX.Element = (
  <Scene id="chart-demo-bar">
    <Chart id="sales-bar" type="bar" position={[0, 0, 0]} theme="darkGlass">
      <ChartData source="sales" />
      <ChartAxis axis="x" field="month" label="Month" />
      <ChartAxis axis="y" field="revenue" label="Amount ($)" format="$,.0f" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs" label="Costs" />
      <ChartLegend visible position="right" />
    </Chart>
  </Scene>
);

/** Line chart — revenue & costs trend over 6 months. */
export const chartDemoLine: JSX.Element = (
  <Scene id="chart-demo-line">
    <Chart id="sales-line" type="line" position={[0, 0, 0]} theme="darkGlass">
      <ChartData source="sales" />
      <ChartAxis axis="x" field="month" label="Month" />
      <ChartAxis axis="y" field="revenue" label="Amount ($)" format="$,.0f" />
      <ChartSeries field="revenue" label="Revenue" />
      <ChartSeries field="costs" label="Costs" />
      <ChartLegend visible position="right" />
    </Chart>
  </Scene>
);

/** Scatter chart — units vs. revenue. */
export const chartDemoScatter: JSX.Element = (
  <Scene id="chart-demo-scatter">
    <Chart id="sales-scatter" type="scatter" position={[0, 0, 0]} theme="darkGlass">
      <ChartData source="sales" />
      <ChartAxis axis="x" field="units" label="Units Sold" />
      <ChartAxis axis="y" field="revenue" label="Revenue ($)" format="$,.0f" />
      <ChartSeries field="revenue" label="Revenue vs Units" />
      <ChartLegend visible position="right" />
    </Chart>
  </Scene>
);
