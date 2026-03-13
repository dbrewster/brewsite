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
import { isLightingOverride, isGroupOwner } from '../widget/WidgetRegistry';
import { SpotlightRigWidget } from '../elements/spotlight-rig/SpotlightRigWidget';
import { ViewWidget } from '../elements/view/ViewWidget';
import type { ViewState } from '../compiler/viewTypes';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneTrack } from '../compiler/sceneTrackTypes';

/** Duck-type guard for ViewState — checks structural fields without instanceof. */
function isViewStateLike(state: unknown): state is ViewState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s['id'] === 'string' &&
    s['bounds'] !== undefined &&
    s['contentBounds'] !== undefined &&
    Array.isArray(s['childWidgetIds'])
  );
}

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

    reconcileCompiledTrack(registry: WidgetRegistry, track: SceneTrack): void {
      for (const tick of track.ticks) {
        for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
          if (isViewStateLike(state) && !registry.get(widgetId)) {
            const resolveChildRoot = (childId: string) => {
              const child = registry.get(childId);
              if (child && isGroupOwner(child)) return child.rootGroup;
              return null;
            };
            const viewWidget = new ViewWidget(widgetId, resolveChildRoot);
            registry.register(viewWidget);
          }
        }
      }
    },
  };
}
