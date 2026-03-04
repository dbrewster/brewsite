import type {WidgetPlugin} from '@brewsite/core';
import {corePlugin} from '@brewsite/core';
import {diagramPlugin} from '@brewsite/diagram';

/**
 * Creates the WidgetPlugin array for the BrewFlow sidecar note scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createSidecarPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        canvases: [
          'bf-surfaces',
          'bf-arch',
          'bf-mcp-tools',
          'bf-seq-normal',
          'bf-seq-fail',
          'bf-dreamer',
          'bf-levels',
        ],
      }),
    ],
  };
}
