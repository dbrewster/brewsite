import type { Object3D, Scene as ThreeScene, WebGLRenderer } from 'three';
import type { VariableStoreReader, JsonPrimitive } from './VariableStore';
import type { ElementTransitionSpec, FunctionalTransitionSpec } from '../compiler/transitions/transitionTypes';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import type { RealtimeClock } from '../runtime/types';

/**
 * Minimal asset manifest type. Extended by @brewsite/model with model-specific fields.
 * Passed to ILoadable.load() when the manifest has been fetched.
 */
export type AssetManifest = {
  readonly version: number;
  readonly models: unknown[];
  readonly animations: unknown[];
};

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
   * The React DSL component for this widget.
   *
   * Typed as `ComponentType<any>` because the registry is intentionally heterogeneous —
   * each registered widget provides a different component with different prop types.
   * Prop safety is enforced at each component's own type definition (CameraProps,
   * LightingProps, etc.), not here. Narrowing this type with a generic would propagate
   * a TProps type parameter through the entire registry without adding safety.
   */
  readonly DslComponent: React.ComponentType<any>; // intentional: see JSDoc
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

export interface IRenderable<TState, TExtra = unknown> extends IWidget {
  initialize(context: WidgetInitContext): void;
  apply(state: TState, context: WidgetRenderContext<TExtra>): void;
  dispose(): void;
}

/**
 * Opts a widget into the per-frame tick loop. Called once per rendered frame
 * during the animation phase, before IRenderable.apply().
 *
 * Use cases include (but are not limited to):
 * - Advancing AnimationMixer for GLTF animations
 * - Physics simulation steps
 * - Procedural motion (oscillation, spring physics)
 * - Publishing derived state to the VariableStore
 * - Per-frame input processing
 *
 * Despite the name, this interface is not limited to animation. It is the
 * general-purpose per-frame side-effect hook.
 */
export interface IAnimationController extends IWidget {
  readonly tickPriority?: number;
  onTick(context: AnimationTickContext): void;
}

/**
 * Optional lifecycle interface for widgets that need to respond to scene transitions
 * at runtime. Implement this to reset per-scene state, restart animations, or clean
 * up Three.js objects that should not carry between scenes.
 *
 * Both methods are called synchronously during the tick loop when the scene index changes.
 * Do not perform heavy work here — defer to the next apply() call if needed.
 *
 * @example
 * class ParticleWidget implements IRenderable<ParticleState>, ISceneLifecycle {
 *   onSceneExit(sceneId: string, sceneIndex: number): void {
 *     this.particleSystem.reset();
 *   }
 *   onSceneEnter(sceneId: string, sceneIndex: number): void {
 *     this.accumulator = 0;
 *   }
 * }
 */
export interface ISceneLifecycle extends IWidget {
  /**
   * Called when the engine transitions away from the scene with the given id.
   * Fires before onSceneEnter for the next scene.
   */
  onSceneExit(sceneId: string, sceneIndex: number): void;

  /**
   * Called when the engine transitions into the scene with the given id.
   * Fires after onSceneExit for the previous scene.
   */
  onSceneEnter(sceneId: string, sceneIndex: number): void;
}

export interface ICameraActionTarget extends IWidget {
  applyOrbit(dx: number, dy: number, speed: number): void;
  applyDolly(delta: number, speed: number): void;
  applyReset(): void;
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
  prefersReducedMotion: boolean;
  // clipMeta removed — @brewsite/model manages its own clip metadata.
};

export type WidgetInitContext = {
  scene: ThreeScene;
  widgetId: string;
  renderer?: WebGLRenderer;
};

export type WidgetRenderContext<TExtra = unknown> = {
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
  /**
   * Compiled extra data from ISceneElement.compileExtra().
   * Typed as TExtra when the widget implements ISceneElement<TState, TExtra>.
   * Unknown when consumed from a generic context.
   */
  extra: TExtra;
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
