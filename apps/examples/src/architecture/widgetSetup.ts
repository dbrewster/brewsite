import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import type { WidgetPlugin } from '@brewsite/core';

/**
 * Creates the WidgetPlugin array for the architecture diagram scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createArchitecturePlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        canvases: [
          'arch-core-canvas',
          'arch-diagram-canvas',
          'arch-model-canvas',
          'arch-charts-canvas',
        ],
      }),
    ],
  };
}
