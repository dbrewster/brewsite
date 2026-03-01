import type { Object3D, Scene as ThreeScene, WebGLRenderer } from 'three';
import type { VariableStoreReader, JsonPrimitive } from './VariableStore';
import type { ElementTransitionSpec, FunctionalTransitionSpec } from '../compiler/transitions/transitionTypes';
import type { ClipMeta, SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import type { RealtimeClock } from '../runtime/types';

type AssetManifest = { version: number; models: unknown[]; animations: unknown[] };

export interface IWidget {
  readonly widgetId: string;
}

export interface ISceneElement<TState, TExtra = void> extends IWidget {
  readonly defaultState: TState;
  /**
   * Specifies how this widget's state transitions between adjacent scenes.
   *
   * Three transition scenarios (determined by widget presence in each scene):
   * - exit: widget present in scene N, absent from scene N+1
   * - enter: widget absent in scene N, present in scene N+1
   * - interpolate: widget present in both scenes
   *
   * ElementTransitionSpec pre-bakes values into SceneTrack ticks at compile time.
   * FunctionalTransitionSpec stores closures evaluated lazily each frame.
   */
  readonly transitionSpec: ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>;
  /**
   * The DSL React component for this widget.
   *
   * Typed as ComponentType<any> because the registry is intentionally heterogeneous -
   * each registered widget has a different prop type for its DSL component.
   * DSL prop safety is enforced at each component's own props type.
   */
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

// ─── New interfaces added in Phase 1 ────────────────────────────────────────

/**
 * Widget that participates in WebGLRenderer lifecycle events.
 * Implement to manage GPU resources (loaders, render targets) tied to
 * a specific renderer instance.
 *
 * Preferred over ad-hoc cleanup calls in useSceneEngine.ts. When a renderer
 * is disposed, WidgetRegistry.notifyRendererDisposing() broadcasts to all
 * IRendererLifecycle implementors automatically.
 */
export interface IRendererLifecycle extends IWidget {
  onRendererCreated(renderer: WebGLRenderer): void;
  onRendererDisposing(renderer: WebGLRenderer): void;
}

/**
 * Named 3D world positions and per-target color overrides contributed by a widget
 * after each rendered frame. Consumed by LabelPositioner and any overlay system
 * that needs world positions.
 *
 * Key format is widget-defined. Convention for model bones:
 *   `'${widgetId}:${boneName}'`
 * Convention for model subparts/meshes:
 *   `'${widgetId}:${meshId}'`
 */
export type RenderContribution = {
  /**
   * Named 3D world positions contributed this frame.
   * ReadonlyMap for safety — callers must not mutate.
   */
  namedPositions?: ReadonlyMap<string, [number, number, number]>;
  /**
   * Per-target color overrides. Keys match namedPositions keys.
   */
  targetColors?: ReadonlyMap<string, string>;
};

/**
 * Widget that contributes data to the render loop after each Three.js frame.
 * Called once per frame by RuntimeDriverImpl.collectRenderContributions() after
 * renderer.render() completes. Hot path — keep implementors cheap.
 *
 * ModelWidget implements this to expose bone world positions for LabelPositioner.
 */
export interface IRenderContributor extends IWidget {
  contributeRenderData(): RenderContribution;
}

/**
 * Widget whose rootObject should be parented to a named attachment point
 * on another registered widget's scene graph.
 *
 * RuntimeDriverImpl calls attachContainedRenderables() after all ILoadable
 * widgets have resolved. The host widget must implement IAttachmentHost.
 * After attachment, Three.js manages the resulting transform hierarchy
 * automatically each frame.
 *
 * This is the generic replacement for IContainedModel. IContainedModel
 * (model-specific, with anchorModelId) moves to @brewsite/model and extends
 * both IRenderable and IContainedRenderable.
 */
export interface IContainedRenderable extends IWidget {
  /** widgetId of the IAttachmentHost widget that will serve as parent. */
  readonly anchorWidgetId: string;
  /** Named attachment point key on the host widget. */
  readonly anchorKey: string;
  /** The Object3D to parent under the resolved attachment point. */
  readonly rootObject: Object3D;
}

/**
 * Widget that exposes named Three.js Object3D attachment points.
 *
 * Other widgets implementing IContainedRenderable attach their rootObjects
 * to these points after initialize(). Three.js manages the resulting
 * world-transform hierarchy automatically each frame.
 *
 * ModelWidget implements this to expose bone nodes as attachment points
 * for contained models and body-part accessories.
 */
export interface IAttachmentHost extends IWidget {
  /**
   * Returns the Three.js Object3D for the named attachment point, or null
   * if the key is not found or the host is not yet initialized.
   *
   * Called once per IContainedRenderable after all ILoadable.load() promises
   * resolve, from RuntimeDriverImpl.attachContainedRenderables().
   */
  getAttachmentPoint(key: string): Object3D | null;
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
  /**
   * Synchronized real-time clock. Same values every widget sees every frame.
   * Use clock.wallTimeSeconds for ambient oscillations.
   * Use clock.deltaSeconds for physics / real-time increment-based effects.
   */
  clock: RealtimeClock;
  /**
   * Scroll-velocity-boosted delta. Use for effects that should accelerate with scroll.
   * Rule: pass this to AnimationMixer.update(). Use clock.deltaSeconds for physics.
   */
  effectiveDeltaSeconds: number;
  globalProgress: number;
  variables: VariableStoreReader;
  extra: unknown;
  /** Current tick snapshot (if available). */
  tick?: SceneTrackTick | null;
  // REMOVED: deltaSeconds — use clock.deltaSeconds or effectiveDeltaSeconds
  // REMOVED: wallTimeSeconds — use clock.wallTimeSeconds
};

export type AnimationTickContext = {
  /**
   * Synchronized real-time clock. Same values every widget sees every frame.
   * Use clock.wallTimeSeconds for ambient oscillations.
   * Use clock.deltaSeconds for physics / real-time increment-based effects.
   */
  clock: RealtimeClock;
  /**
   * Scroll-velocity-boosted delta for AnimationMixer.update().
   * Equals clock.deltaSeconds when idle. Increases proportionally to scroll speed
   * when animationTimeScale is declared on the scene.
   *
   * Rule: pass this to AnimationMixer.update(). Use clock.deltaSeconds for physics.
   */
  effectiveDeltaSeconds: number;
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track: SceneTrack | null;
  // REMOVED: deltaSeconds — use clock.deltaSeconds or effectiveDeltaSeconds
  // REMOVED: wallTimeSeconds — use clock.wallTimeSeconds
};

// Re-export VariableStoreReader type
export type { VariableStoreReader, JsonPrimitive };

// Import VariableStore for AnimationTickContext
import type { VariableStore } from './VariableStore';
