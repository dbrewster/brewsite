// Plugin factory for the MediaScreen demo — core + screens only.
import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { screensPlugin } from '@brewsite/screens';

export function createMediaScreenDemoPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [corePlugin(), screensPlugin()],
  };
}
