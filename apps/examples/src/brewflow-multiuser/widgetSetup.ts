import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin, themes } from '@brewsite/themes';

/**
 * Creates the WidgetPlugin array and active theme for the BrewFlow multi-user cloud architecture scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createMultiUserPlugins(): { plugins: WidgetPlugin[]; theme: ActiveTheme } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        diagrams: [
          'prob-diagram',
          'sess-diagram',
          'ep-diagram',
          'neo-diagram',
          'dream-diagram',
          'exp-diagram',
          'deb-diagram',
          'conv-diagram',
          'frac-diagram',
          'cross-diagram',
          'conf-diagram',
        ],
      }),
      themesPlugin(),
    ],
    theme: themes.darkGlass.dark,
  };
}
