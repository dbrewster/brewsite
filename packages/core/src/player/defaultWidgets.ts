import { WidgetRegistry } from '../widget/WidgetRegistry';
import { LightingWidget } from '../elements/lighting/LightingWidget';
import { BackgroundWidget } from '../elements/background/BackgroundWidget';
import { EnvironmentWidget } from '../elements/environment/EnvironmentWidget';
import { FloorWidget } from '../elements/floor/FloorWidget';
import { CameraWidget } from '../elements/camera/CameraWidget';
import { SceneMetaWidget } from './SceneMetaWidget';

export type DefaultWidgetRegistryOptions = {
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  /**
   * @deprecated Model states are now managed by modelPlugin() from @brewsite/model.
   * This option has no effect. Use modelPlugin({ defaultModelStates }) instead.
   */
  defaultModelStates?: Partial<Record<string, Partial<Record<string, unknown>>>>;
};

/**
 * @deprecated Use EngineProvider's `plugins` prop with corePlugin() and modelPlugin()
 * from @brewsite/model instead. This function will be removed in a future major version.
 *
 * Kept for backward compatibility with existing widgetSetup-based integrations.
 * Note: Model widget registration (ModelWidget, ModelRouter) is no longer included
 * here. Use modelPlugin() from @brewsite/model for model and label support.
 */
export const createDefaultWidgetRegistry = (
  _manifest: unknown,
  options?: DefaultWidgetRegistryOptions,
): WidgetRegistry => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[BrewSite] createDefaultWidgetRegistry() is deprecated. ' +
      'Migrate to EngineProvider plugins={[corePlugin(), modelPlugin(...)]} instead.',
    );
  }
  const registry = new WidgetRegistry({ strict: true });

  registry
    .register(new LightingWidget())
    .register(new BackgroundWidget())
    .register(new EnvironmentWidget())
    .register(new FloorWidget())
    .register(new CameraWidget())
    .register(new SceneMetaWidget({ onSceneChange: options?.onSceneChange }));

  return registry;
};
