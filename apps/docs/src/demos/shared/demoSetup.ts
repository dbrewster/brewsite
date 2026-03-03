import { corePlugin } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';

/** Returns the default WidgetPlugin array for standalone demos. */
export function createDemoWidgetSetup(): WidgetPlugin[] {
  return [corePlugin()];
}

/** Returns a WidgetPlugin array with model support for model demos. */
export function createModelDemoWidgetSetup(): WidgetPlugin[] {
  return [corePlugin()];
}
