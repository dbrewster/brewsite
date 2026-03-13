import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import type { ChartPluginInstance } from '@brewsite/charts';
import { chartPlugin } from '@brewsite/charts';
import { themesPlugin, themes } from '@brewsite/themes';

/**
 * Creates the WidgetPlugin array and active theme for the chart demo.
 * Returns both the plugin array and the chart plugin instance
 * so ChartDemoPage can pass the store to ChartProvider.
 */
export function createChartDemoPlugins(): {
  plugins: WidgetPlugin[];
  chartsPlugin: ChartPluginInstance;
  theme: ActiveTheme;
} {
  const chartsPlugin = chartPlugin();
  return {
    plugins: [corePlugin(), chartsPlugin, themesPlugin()],
    chartsPlugin,
    theme: themes.lightCanvas.light,
  };
}
