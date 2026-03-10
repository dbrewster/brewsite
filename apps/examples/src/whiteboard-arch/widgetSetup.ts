// WidgetPlugin factory for the whiteboard architecture slide deck.
import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';

/**
 * Creates the WidgetPlugin array for the whiteboard architecture scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createWhiteboardArchPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        diagrams: ['whiteboard-arch-diagram'],
      }),
    ],
  };
}
