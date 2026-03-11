// DSL stub functions for @brewsite/charts — null-returning components registered with NodeHandlers.
// These are never rendered to DOM. The compiler intercepts them via registerNode().

import type {
  BarChartProps,
  LineChartProps,
  ScatterPlotChartProps,
  PieChartProps,
  AreaChartProps,
  HeatMapChartProps,
  ChartDataProps,
  ChartAxisProps,
  ChartSeriesProps,
  ChartLegendProps,
  ChartDataLabelsProps,
  ReferenceLineProps,
  ChartProps,
} from './dsl';

/** @deprecated Use <BarChart>, <LineChart>, etc. instead. */
export function Chart(_props: ChartProps): null { return null; }
Chart.displayName = 'Chart';

/** DSL stub for a bar chart element. */
export function BarChart(_props: BarChartProps): null { return null; }
BarChart.displayName = 'BarChart';

/** DSL stub for a line chart element. */
export function LineChart(_props: LineChartProps): null { return null; }
LineChart.displayName = 'LineChart';

/** DSL stub for a scatter plot chart element. */
export function ScatterPlotChart(_props: ScatterPlotChartProps): null { return null; }
ScatterPlotChart.displayName = 'ScatterPlotChart';

/** DSL stub for a pie/donut chart element. */
export function PieChart(_props: PieChartProps): null { return null; }
PieChart.displayName = 'PieChart';

/** DSL stub for an area chart element. */
export function AreaChart(_props: AreaChartProps): null { return null; }
AreaChart.displayName = 'AreaChart';

/** DSL stub for a heatmap chart element. */
export function HeatMapChart(_props: HeatMapChartProps): null { return null; }
HeatMapChart.displayName = 'HeatMapChart';

/** DSL stub for inline or named data source configuration. */
export function ChartData(_props: ChartDataProps): null { return null; }
ChartData.displayName = 'ChartData';

/** DSL stub for a chart axis configuration. */
export function ChartAxis(_props: ChartAxisProps): null { return null; }
ChartAxis.displayName = 'ChartAxis';

/** DSL stub for a data series within a chart. */
export function ChartSeries(_props: ChartSeriesProps): null { return null; }
ChartSeries.displayName = 'ChartSeries';

/** DSL stub for chart legend configuration. */
export function ChartLegend(_props: ChartLegendProps): null { return null; }
ChartLegend.displayName = 'ChartLegend';

/** DSL stub for data point value labels. */
export function ChartDataLabels(_props: ChartDataLabelsProps): null { return null; }
ChartDataLabels.displayName = 'ChartDataLabels';

/** DSL stub for a reference line drawn across the chart. */
export function ReferenceLine(_props: ReferenceLineProps): null { return null; }
ReferenceLine.displayName = 'ReferenceLine';
