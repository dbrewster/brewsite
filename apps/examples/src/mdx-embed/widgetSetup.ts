// widgetSetup.ts — Plugin setup for MDX Embed example.

import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin } from '@brewsite/themes';

/**
 * Creates the plugin array for the MDX embed example.
 * Each SceneEmbed in the markdown needs its own plugin instances.
 */
export function createMdxEmbedPlugins(): WidgetPlugin[] {
  return [corePlugin(), diagramPlugin(), themesPlugin()];
}
