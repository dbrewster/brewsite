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
        diagrams: [
          'cf-overview',
          'bf-overview',
          'audit-cf',
          'learn-diagram',
          'ctx-diagram',
          'coord-diagram',
          'restart-diagram',
          'gate-diagram',
          'safety-diagram',
          'mature-diagram',
        ],
      }),
    ],
  };
}
