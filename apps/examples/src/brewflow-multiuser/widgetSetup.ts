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
        canvases: [
          'bfmu-prob-canvas',
          'bfmu-sess-canvas',
          'bfmu-ep-canvas',
          'bfmu-neo-canvas',
          'bfmu-dream-canvas',
          'bfmu-exp-canvas',
          'bfmu-deb-canvas',
          'bfmu-conv-canvas',
          'bfmu-frac-canvas',
          'bfmu-cross-canvas',
          'bfmu-conf-canvas',
        ],
      }),
    ],
  };
}
