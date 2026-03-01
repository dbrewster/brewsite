import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import type { WidgetPlugin } from '@brewsite/core';
import { NeonSignWidget } from './widgets/neon-sign';

/**
 * Returns the WidgetPlugin array for the website engine.
 * Pass to EngineProvider's `plugins` prop.
 */
export function createWebsitePlugins(manifestUrl: string): WidgetPlugin[] {
  return [
    corePlugin(),
    modelPlugin({ manifestUrl }),
    {
      createWidgets: () => [new NeonSignWidget()],
      registerHandlers: () => {},
    },
  ];
}
