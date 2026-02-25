import type { Scene as ThreeScene, WebGLRenderer } from 'three';
import type { VariableStoreReader, JsonPrimitive } from './VariableStore';
import type { ElementTransitionSpec, FunctionalTransitionSpec } from '../compiler/transitions/transitionTypes';
import type { ClipMeta, SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';

type AssetManifest = { version: number; models: unknown[]; animations: unknown[] };

export interface IWidget {
  readonly widgetId: string;
}

export interface ISceneElement<TState, TExtra = void> extends IWidget {
  readonly defaultState: TState;
  readonly transitionSpec: ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>;
  readonly DslComponent: React.ComponentType<any>;
  compileExtra?(state: TState, context: CompileExtraContext): TExtra;
  /**
   * When true, the DSL component requires a string "type" prop to route.
   */
  readonly requiresTypeProp?: boolean;
  /**
   * Optional snapshot merge hook for compiler-level state persistence.
   * Called per-scene before transitions are baked.
   */
  mergeSnapshot?(prev: TState | undefined, next: TState | undefined): TState | undefined;
}

export interface IDslComposite extends IWidget {
  readonly childDslComponents: ReadonlyArray<{
    component: React.ComponentType<unknown>;
    displayName: string;
    topLevelError?: boolean;
  }>;
}

export interface ILoadable extends IWidget {
  load(manifest: AssetManifest | null): Promise<void>;
  readonly isLoaded: boolean;
}

export interface IRenderable<TState> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext): void;
  dispose(): void;
}

export interface IContainedModel<TState> extends IRenderable<TState> {
  readonly anchorModelId: string;
  readonly anchorKey: string;
}

export interface IAnimationController extends IWidget {
  readonly tickPriority?: number;
  onTick(context: AnimationTickContext): void;
}

export interface IVariableProvider extends IWidget {
  readonly variableNamespace: string;
  readonly variableKeys: readonly string[];
}

export type CompileExtraContext = {
  sceneProgress: number;
  globalProgress: number;
  clipMeta: ClipMeta[];
  prefersReducedMotion: boolean;
};

export type WidgetInitContext = {
  scene: ThreeScene;
  widgetId: string;
  renderer?: WebGLRenderer;
};

export type WidgetRenderContext = {
  deltaSeconds: number;
  globalProgress: number;
  wallTimeSeconds: number;
  variables: VariableStoreReader;
  extra: unknown;
};

export type AnimationTickContext = {
  deltaSeconds: number;
  wallTimeSeconds: number;
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track?: SceneTrack | null;
};

// Re-export VariableStoreReader type
export type { VariableStoreReader, JsonPrimitive };

// Import VariableStore for AnimationTickContext
import type { VariableStore } from './VariableStore';
