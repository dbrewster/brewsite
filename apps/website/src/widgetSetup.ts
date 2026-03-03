import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import type { WidgetPlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { NeonSignWidget } from './widgets/neon-sign';

/**
 * Returns the WidgetPlugin array for the website engine.
 * Pass to EngineProvider's `plugins` prop.
 *
 * Canvas IDs must match the id prop on every <DiagramCanvas> or standalone
 * <Diagram> element used in the website scene DSL.
 */
export function createWebsitePlugins(manifestUrl: string): WidgetPlugin[] {
  return [
    corePlugin(),
    modelPlugin({ manifestUrl }),
    diagramPlugin({
      canvases: [
        'presentation-flow',
        'simple-tech-stack',
        'system-canvas',
        'full-diagram',
      ],
    }),
    {
      createWidgets: () => [
        new NeonSignWidget(),
      ],
      registerHandlers: () => {},
    },
  ];
}
