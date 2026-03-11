// DSL NodeHandler registration for @brewsite/charts child components.

import { registerNode } from '@brewsite/core';
import {
  ChartData, ChartAxis, ChartSeries, ChartLegend,
  ChartDataLabels, ReferenceLine,
  BarChart, LineChart, ScatterPlotChart, PieChart, AreaChart, HeatMapChart,
} from '../elements/chart/stubs';

let chartHandlersRegistered = false;

/**
 * Registers guard NodeHandlers for all chart DSL components.
 *
 * Child component guards throw if a component appears outside a chart type component.
 * Per-type chart component guards are overwritten by configureRegistry() in chartPlugin.ts
 * when real handlers are registered — these serve as safety nets before plugin init.
 *
 * Idempotent — safe to call multiple times.
 */
export function registerChartHandlers(): void {
  if (chartHandlersRegistered) return;
  chartHandlersRegistered = true;

  // Child component guards — throw if used outside a chart type component
  const guardHandler = (name: string) => () => {
    throw new Error(`<${name}> must be nested inside a chart component (BarChart, LineChart, etc.).`);
  };

  registerNode(ChartData, guardHandler('ChartData'));
  registerNode(ChartAxis, guardHandler('ChartAxis'));
  registerNode(ChartSeries, guardHandler('ChartSeries'));
  registerNode(ChartLegend, guardHandler('ChartLegend'));
  registerNode(ChartDataLabels, guardHandler('ChartDataLabels'));
  registerNode(ReferenceLine, guardHandler('ReferenceLine'));

  // Per-type component guards (before chartPlugin.configureRegistry registers real handlers).
  // These are overwritten by configureRegistry — but guard against use before plugin init.
  registerNode(BarChart, guardHandler('BarChart'));
  registerNode(LineChart, guardHandler('LineChart'));
  registerNode(ScatterPlotChart, guardHandler('ScatterPlotChart'));
  registerNode(PieChart, guardHandler('PieChart'));
  registerNode(AreaChart, guardHandler('AreaChart'));
  registerNode(HeatMapChart, guardHandler('HeatMapChart'));
}

/**
 * Resets handler registration state for testing.
 * Do NOT call in production code.
 */
export function resetChartHandlerRegistrationForTesting(): void {
  chartHandlersRegistered = false;
}
