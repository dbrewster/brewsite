import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin, themes } from '@brewsite/themes';

/**
 * Creates the WidgetPlugin array and active theme for the BrewFlow sidecar note scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createSidecarPlugins(): { plugins: WidgetPlugin[]; theme: ActiveTheme } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        diagrams: [
          'surfaces-diagram',
          'bf-arch-cf',
          'bf-arch-sidecar',
          'mcp-tools',
          'seq-normal',
          'seq-fail',
          'dreamer-flow',
          'levels-diagram',
        ],
      }),
      themesPlugin(),
    ],
    theme: themes.darkGlass.dark,
  };
}
