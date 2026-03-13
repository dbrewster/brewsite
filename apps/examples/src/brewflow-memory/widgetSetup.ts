import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin, themes } from '@brewsite/themes';

/**
 * Creates the WidgetPlugin array and active theme for the BrewFlow Memory Subsystem note scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createMemoryPlugins(): { plugins: WidgetPlugin[]; theme: ActiveTheme } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        diagrams: [
          'cls-diagram',
          'episodic-diagram',
          'somno-diagram',
          'neo-types',
          'neo-lifecycle',
          'inject-diagram',
          'loop-diagram',
          'guard-diagram',
        ],
      }),
      themesPlugin(),
    ],
    theme: themes.darkGlass.dark,
  };
}
