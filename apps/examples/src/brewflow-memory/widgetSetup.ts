import type {WidgetPlugin} from '@brewsite/core';
import {corePlugin} from '@brewsite/core';
import {diagramPlugin} from '@brewsite/diagram';

/**
 * Creates the WidgetPlugin array for the BrewFlow Memory Subsystem note scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createMemoryPlugins(): { plugins: WidgetPlugin[] } {
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
    ],
  };
}
