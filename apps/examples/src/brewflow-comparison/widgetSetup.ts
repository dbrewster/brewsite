import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin, themes } from '@brewsite/themes';

/**
 * Creates the WidgetPlugin array and active theme for the BrewFlow comparison scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createComparisonPlugins(): { plugins: WidgetPlugin[]; theme: ActiveTheme } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin(),
      themesPlugin(),
    ],
    theme: themes.darkGlass.dark,
  };
}
