import type {WidgetPlugin} from '@brewsite/core';
import {corePlugin} from '@brewsite/core';
import {diagramPlugin} from '@brewsite/diagram';

/**
 * Creates the WidgetPlugin array for the BrewFlow multi-user cloud architecture scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createMultiUserPlugins(): { plugins: WidgetPlugin[] } {
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
    ],
  };
}
