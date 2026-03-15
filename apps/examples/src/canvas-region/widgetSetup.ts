// widgetSetup.ts — Plugin setup for Canvas Region example.

import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin } from '@brewsite/themes';

/**
 * Creates the plugin array for the Canvas Region example.
 * Uses diagram elements for the 3D content (no model manifest needed).
 */
export function createCanvasRegionPlugins(): WidgetPlugin[] {
  return [corePlugin(), diagramPlugin(), themesPlugin()];
}
