import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
import type { ChartPluginInstance } from '@brewsite/charts';
import { themesPlugin, themes } from '@brewsite/themes';

/**
 * Creates the WidgetPlugin array and active theme for the Core Showcase.
 * Registers corePlugin, diagramPlugin (lazy widget creation per DSL encounter),
 * chartPlugin (for bar chart morphing demo), and themesPlugin.
 */
export function createCoreShowcasePlugins(): {
  plugins: WidgetPlugin[];
  chartsPlugin: ChartPluginInstance;
  theme: ActiveTheme;
} {
  const chartsPlugin = chartPlugin();
  return {
    plugins: [
      corePlugin(),
      diagramPlugin(),
      chartsPlugin,
      themesPlugin(),
    ],
    chartsPlugin,
    theme: themes.darkGlass.dark,
  };
}
