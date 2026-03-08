// DSL NodeHandler registration for @brewsite/charts child components.

import { registerNode } from '@brewsite/core';
import { ChartData, ChartAxis, ChartSeries, ChartLegend } from '../elements/chart/ChartWidget';

let chartHandlersRegistered = false;

/**
 * Registers guard NodeHandlers for chart child DSL components.
 *
 * These handlers throw if a child component appears outside <Chart>.
 * The Chart handler itself is registered in chartPlugin().configureRegistry()
 * where the WidgetRegistry is available for auto-widget-creation.
 *
 * Idempotent — safe to call multiple times.
 */
export function registerChartHandlers(): void {
  if (chartHandlersRegistered) return;
  chartHandlersRegistered = true;

  registerNode(ChartData, () => {
    throw new Error('<ChartData> must be nested inside <Chart>.');
  });
  registerNode(ChartAxis, () => {
    throw new Error('<ChartAxis> must be nested inside <Chart>.');
  });
  registerNode(ChartSeries, () => {
    throw new Error('<ChartSeries> must be nested inside <Chart>.');
  });
  registerNode(ChartLegend, () => {
    throw new Error('<ChartLegend> must be nested inside <Chart>.');
  });
}

/**
 * Resets handler registration state for testing.
 * Do NOT call in production code.
 */
export function resetChartHandlerRegistrationForTesting(): void {
  chartHandlersRegistered = false;
}
