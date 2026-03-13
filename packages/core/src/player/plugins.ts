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
import { isLightingOverride } from '../widget/WidgetRegistry';
import { SpotlightRigWidget } from '../elements/spotlight-rig/SpotlightRigWidget';

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
  const lightingWidget = new LightingWidget();
  const backgroundWidget = new BackgroundWidget();
  const environmentWidget = new EnvironmentWidget();
  const floorWidget = new FloorWidget();
  const cameraWidget = new CameraWidget();
  const sceneMetaWidget = new SceneMetaWidget({ onSceneChange: options?.onSceneChange });
  const spotlightRigWidget = new SpotlightRigWidget();

  return {
    createWidgets() {
      return [lightingWidget, backgroundWidget, environmentWidget,
              floorWidget, cameraWidget, sceneMetaWidget,
              spotlightRigWidget];
    },
    registerHandlers() {
      registerCoreHandlers();
    },
    configureRegistry(reg) {
      // Resolve ILightingOverride widgets registered by other plugins (e.g. diagram).
      // Called after all plugins' createWidgets() have run.
      const overrideWidgets = [...reg.getAllWidgets()].filter(isLightingOverride);
      lightingWidget.setLightingOverrides(overrideWidgets);
    },
  };
}
