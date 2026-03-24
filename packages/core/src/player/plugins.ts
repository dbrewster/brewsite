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
import type { Object3D } from 'three';
import { SpotlightRigWidget } from '../elements/spotlight-rig/SpotlightRigWidget';
import { ViewWidget } from '../elements/view/ViewWidget';
import type { ViewState } from '../compiler/viewTypes';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneTrack } from '../compiler/sceneTrackTypes';
import {
  CarouselScrubberWidget,
  isCarouselScrubberStateLike,
} from '../elements/carousel-scrubber/CarouselScrubberWidget';

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
 * <SceneEngine
 *   plugins={[corePlugin(), modelPlugin({ manifest: '/assets/manifest.json' })]}
 *   getFrame={() => <IntroScene />}
 * />
 */
export function corePlugin(options?: CorePluginOptions): WidgetPlugin {
  return {
    createWidgets() {
      return [
        new LightingWidget(),
        new BackgroundWidget(),
        new EnvironmentWidget(),
        new FloorWidget(),
        new CameraWidget(),
        new SceneMetaWidget({ onSceneChange: options?.onSceneChange }),
        new SpotlightRigWidget(),
      ];
    },
    registerHandlers() {
      registerCoreHandlers();
    },
    configureRegistry(reg) {
      // Resolve ILightingOverride widgets registered by other plugins (e.g. diagram).
      // Called after all plugins' createWidgets() have run.
      const lighting = reg.get('lighting');
      if (lighting && 'setLightingOverrides' in lighting) {
        const overrideWidgets = [...reg.getAllWidgets()].filter(isLightingOverride);
        (lighting as LightingWidget).setLightingOverrides(overrideWidgets);
      }
      // Wire material loader/manifest access for floor preset materials.
      const floor = reg.get('floor');
      if (floor && 'setRegistry' in floor) {
        (floor as FloorWidget).setRegistry(reg);
      }
    },

    reconcileCompiledTrack(registry: WidgetRegistry, track: SceneTrack): void {
      for (const tick of track.ticks) {
        for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
          if (isViewStateLike(state) && !registry.get(widgetId)) {
            const resolveChildWidget = (childId: string) => registry.get(childId);

            const resolveChildObject = (childId: string): Object3D | null => {
              return registry.getWidgetObject(childId) ?? null;
            };

            const viewWidget = new ViewWidget(widgetId, resolveChildWidget, resolveChildObject);
            registry.register(viewWidget);
          }
          if (isCarouselScrubberStateLike(state) && !registry.get(widgetId)) {
            const scrubberWidget = new CarouselScrubberWidget(widgetId, registry);
            registry.register(scrubberWidget);
          }
        }
      }
    },
  };
}
