import { corePlugin } from '@brewsite/core';
import { chartPlugin } from '@brewsite/charts';
import type { WidgetPlugin } from '@brewsite/core';
import type { ChartPluginInstance } from '@brewsite/charts';

/**
 * Creates the WidgetPlugin array for the chart demo.
 * Returns both the plugin array and the chart plugin instance
 * so ChartDemoPage can pass the store to ChartProvider.
 */
export function createChartDemoPlugins(): {
  plugins: WidgetPlugin[];
  chartsPlugin: ChartPluginInstance;
} {
  const chartsPlugin = chartPlugin();
  return {
    plugins: [corePlugin(), chartsPlugin],
    chartsPlugin,
  };
}
