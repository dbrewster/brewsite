import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
import type { ChartPluginInstance } from '@brewsite/charts';

/**
 * Creates the WidgetPlugin array for the Core Showcase.
 * Registers corePlugin, diagramPlugin (for all diagram IDs used in scenes),
 * and chartPlugin (for bar chart morphing demo).
 */
export function createCoreShowcasePlugins(): {
  plugins: WidgetPlugin[];
  chartsPlugin: ChartPluginInstance;
} {
  const chartsPlugin = chartPlugin();
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        diagrams: [
          'cs-overview-diagram',
          'cs-scene-dsl-diagram',
          'cs-compiler-diagram',
        ],
      }),
      chartsPlugin,
    ],
    chartsPlugin,
  };
}
