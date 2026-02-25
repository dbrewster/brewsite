import { WidgetRegistry } from '../widget/WidgetRegistry';
import { ModelWidget } from '../elements/model/ModelWidget';
import { ModelRouter } from '../elements/model/dsl';
import { LightingWidget } from '../elements/lighting/LightingWidget';
import { BackgroundWidget } from '../elements/background/BackgroundWidget';
import { EnvironmentWidget } from '../elements/environment/EnvironmentWidget';
import { FloorWidget } from '../elements/floor/FloorWidget';
import { CameraWidget } from '../elements/camera/CameraWidget';
import type { AssetManifest } from '../elements/model/metadata';
import { clipMetaFromManifest } from '../elements/model/metadata';
import { SceneMetaWidget } from './SceneMetaWidget';

export const createDefaultWidgetRegistry = (
  manifest: AssetManifest | null,
  options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void },
): WidgetRegistry => {
  const registry = new WidgetRegistry();
  const clipMeta = manifest ? clipMetaFromManifest(manifest) : [];

  if (manifest) {
    registry.registerTypeFactory(ModelRouter, (props) => {
      const type = typeof props.type === 'string' ? props.type : null;
      const id = typeof props.id === 'string' ? props.id : null;
      if (!type || !id) {
        throw new Error('[WidgetRegistry] Model factory requires string type and id.');
      }
      const modelMeta = manifest.models.find((m) => m.type === type);
      if (!modelMeta) {
        const available = manifest.models.map((m) => m.type).join(', ') || '(none)';
        throw new Error(`[WidgetRegistry] Unknown model type "${type}". Available: ${available}`);
      }
      return new ModelWidget({ modelMeta, clipMeta, widgetId: id });
    });
  }

  registry
    .register(new LightingWidget())
    .register(new BackgroundWidget())
    .register(new EnvironmentWidget())
    .register(new FloorWidget())
    .register(new CameraWidget())
    .register(new SceneMetaWidget({ onSceneChange: options?.onSceneChange }));

  return registry;
};
