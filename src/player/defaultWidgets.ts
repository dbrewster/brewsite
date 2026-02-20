import { WidgetRegistry } from '../widget/WidgetRegistry';
import { ModelWidget } from '../elements/model/ModelWidget';
import { LightingWidget } from '../elements/lighting/LightingWidget';
import { BackgroundWidget } from '../elements/background/BackgroundWidget';
import { EnvironmentWidget } from '../elements/environment/EnvironmentWidget';
import { FloorWidget } from '../elements/floor/FloorWidget';
import type { AssetManifest } from '../elements/model/metadata';
import { clipMetaFromManifest } from '../elements/model/metadata';
import { SceneMetaWidget } from './SceneMetaWidget';

export const createDefaultWidgetRegistry = (
  manifest: AssetManifest | null,
  options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void },
): WidgetRegistry => {
  const registry = new WidgetRegistry();
  const clipMeta = manifest ? clipMetaFromManifest(manifest) : [];

  for (const modelMeta of manifest?.models ?? []) {
    registry.register(new ModelWidget({ modelMeta, clipMeta }));
  }

  registry
    .register(new LightingWidget())
    .register(new BackgroundWidget())
    .register(new EnvironmentWidget())
    .register(new FloorWidget())
    .register(new SceneMetaWidget({ onSceneChange: options?.onSceneChange }));

  return registry;
};
