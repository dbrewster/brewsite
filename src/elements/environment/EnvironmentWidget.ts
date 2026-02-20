// EnvironmentWidget — ISceneElement + IRenderable + ILoadable (HDRI async load).
// Wraps compile.ts transition spec and render.ts Three.js logic into the widget SDK.

import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  ILoadable,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { SceneEnvironment } from './types';
import { DEFAULT_ENVIRONMENT, environmentTransitionSpec } from './compile';
import { Environment } from './dsl';
import { applyEnvironment } from './render';
import type { AssetManifest } from '../model/metadata';

export class EnvironmentWidget
  implements ISceneElement<SceneEnvironment>, IRenderable<SceneEnvironment>, ILoadable
{
  readonly widgetId = 'environment';
  readonly defaultState: SceneEnvironment = DEFAULT_ENVIRONMENT;
  readonly transitionSpec = environmentTransitionSpec;
  readonly DslComponent = Environment;

  isLoaded = false;
  private threeScene: THREE.Scene | null = null;

  initialize({ scene }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
  }

  async load(_manifest: AssetManifest | null): Promise<void> {
    // HDRI loading stub — full implementation in a later phase.
    // When the environment has a url/preset, load the texture here.
    this.isLoaded = true;
  }

  apply(state: SceneEnvironment, _ctx: WidgetRenderContext): void {
    if (!this.threeScene) return;
    applyEnvironment(state, { scene: this.threeScene });
  }

  dispose(): void {
    this.threeScene = null;
    this.isLoaded = false;
  }
}
