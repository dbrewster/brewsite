import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { ScenePlayerProps } from '@brewsite/core';

export type DemoWidgetSetup = NonNullable<ScenePlayerProps['widgetSetup']>;

export function createDemoWidgetSetup(): DemoWidgetSetup {
  return () => createDefaultWidgetRegistry(null);
}

export function createModelDemoWidgetSetup(): DemoWidgetSetup {
  return (manifest) => createDefaultWidgetRegistry(manifest);
}
