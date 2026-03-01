// Factory for the built-in core WidgetPlugin.
// Provides all non-model core widgets and DSL handlers.

import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { registerCoreHandlers } from '../compiler/coreHandlers';
import { LightingWidget } from '../elements/lighting/LightingWidget';
import { BackgroundWidget } from '../elements/background/BackgroundWidget';
import { EnvironmentWidget } from '../elements/environment/EnvironmentWidget';
import { FloorWidget } from '../elements/floor/FloorWidget';
import { CameraWidget } from '../elements/camera/CameraWidget';
import { SceneMetaWidget } from './SceneMetaWidget';

export interface CorePluginOptions {
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
}

/**
 * Built-in WidgetPlugin for @brewsite/core.
 *
 * Provides: LightingWidget, BackgroundWidget, EnvironmentWidget, FloorWidget,
 * CameraWidget, SceneMetaWidget, and all core DSL NodeHandlers (Scene,
 * InputController, Action, ProgressManager, and related child components).
 *
 * Does NOT include model or label widgets — use modelPlugin() from
 * @brewsite/model for those.
 *
 * @example
 * <EngineProvider
 *   plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
 * />
 */
export function corePlugin(options?: CorePluginOptions): WidgetPlugin {
  return {
    createWidgets: () => [
      new LightingWidget(),
      new BackgroundWidget(),
      new EnvironmentWidget(),
      new FloorWidget(),
      new CameraWidget(),
      new SceneMetaWidget({ onSceneChange: options?.onSceneChange }),
    ],
    registerHandlers: () => {
      registerCoreHandlers();
    },
  };
}
