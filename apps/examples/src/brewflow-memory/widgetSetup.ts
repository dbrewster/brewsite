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
        canvases: [
          'bfm-cls-canvas',
          'bfm-episodic-canvas',
          'bfm-somno-canvas',
          'bfm-neo-canvas',
          'bfm-inject-canvas',
          'bfm-loop-canvas',
          'bfm-guard-canvas',
        ],
      }),
    ],
  };
}
