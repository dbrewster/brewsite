import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import type { WidgetPlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { NeonSignWidget } from './widgets/neon-sign';
import { SignalFieldWidget } from './widgets/signal-field';
import { ShaderSurfaceWidget } from './widgets/shader-surface';
import { PostFxWidget } from './widgets/postfx';

/**
 * Returns the WidgetPlugin array for the website engine.
 * Pass to EngineProvider's `plugins` prop.
 *
 * Diagram IDs must match the id prop on every <Diagram> element used in the website scene DSL.
 */
export function createWebsitePlugins(manifestUrl: string): WidgetPlugin[] {
  return [
    corePlugin(),
    modelPlugin({ manifestUrl }),
    diagramPlugin(),
    {
      createWidgets: () => [
        new NeonSignWidget(),
        new SignalFieldWidget(),
        new ShaderSurfaceWidget(),
        new PostFxWidget(),
      ],
      registerHandlers: () => {},
    },
  ];
}
