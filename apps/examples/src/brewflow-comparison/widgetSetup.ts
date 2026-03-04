import type {WidgetPlugin} from '@brewsite/core';
import {corePlugin} from '@brewsite/core';
import {diagramPlugin} from '@brewsite/diagram';

/**
 * Creates the WidgetPlugin array for the BrewFlow comparison scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createComparisonPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        canvases: [
          'bfc-cf-canvas',
          'bfc-bf-canvas',
          'bfc-audit-canvas',
          'bfc-learn-canvas',
          'bfc-ctx-canvas',
          'bfc-coord-canvas',
          'bfc-restart-canvas',
          'bfc-gate-canvas',
          'bfc-safety-canvas',
          'bfc-mature-canvas',
        ],
      }),
    ],
  };
}
