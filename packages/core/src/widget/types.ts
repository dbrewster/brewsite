import type { Object3D, PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three';
import type { VariableStoreReader, JsonPrimitive } from './VariableStore';
import type { ElementTransitionSpec, FunctionalTransitionSpec } from '../compiler/transitions/transitionTypes';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import type { RealtimeClock } from '../runtime/types';
import type { InputActionSpec } from '../input/types';

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

  /**
   * When true, the compiler substitutes makeDisabledDefault(defaultState) —
   * a clone of defaultState with `enabled` forced to false — for scenes where
   * this widget is absent. When false or omitted, absent scenes use the raw
   * defaultState unchanged.
   *
   * Replaces the duck-typed `readonly useDefaultStateWhenAbsent = false` pattern.
   * The old field name was a double-negative that misrepresented the behaviour;
   * the new name states the intent directly.
   *
   * Default: false (raw defaultState used when widget is absent).
   *
   * Widgets that should be disabled when not present in a scene
   * (CameraWidget, LightingWidget, BackgroundWidget) declare:
   *   readonly disableWhenAbsent = true;
   */
  readonly disableWhenAbsent?: boolean;

  /**
   * Optional structural equality hook used by the compiler's delta-detection pass.
   *
   * When provided, replaces the JSON.stringify comparison in buildDelta().
   * This prevents false positives from non-deterministic key ordering and
   * eliminates O(n×k) serialization for widgets with large or complex state.
   *
   * @param a - Previous state.
   * @param b - Next state.
   * @returns true when the two states are functionally equivalent.
   */
  stateEquals?(a: TState, b: TState): boolean;
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

/**
 * @deprecated No built-in widget implements this interface. If your custom widget
 * uses ICameraActionTarget, migrate to ActionInputController's onUnknownAction callback
 * pattern. This interface will be removed in v3.
 */
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

/**
 * Widget that exposes default input actions to the player layer.
 *
 * Implemented by widgets (e.g. DiagramCanvasWidget) that carry input configuration
 * in their compiled state. The player calls getDefaultInputActions() each frame
 * after widget.apply() has been called to read the current scene's actions.
 *
 * CRITICAL: getDefaultInputActions() MUST return this.currentInputActions (a field
 * updated inside apply()), NOT a value derived from defaultState. defaultState is
 * constant after construction; currentInputActions reflects the live compiled state.
 */
export interface IInputDefaultProvider extends IWidget {
  getDefaultInputActions(): InputActionSpec[];
}

export type CompileExtraContext = {
  /**
   * Block-level progress within the current transition block: 0 at block start,
   * 1 at block end. Renamed from `sceneProgress` (which was misleading — the
   * value was always block-level, not scene-level).
   *
   * BREAKING: any widget implementing compileExtra() must rename its usage.
   */
  blockProgress: number;
  globalProgress: number;
  prefersReducedMotion: boolean;
  // clipMeta removed — @brewsite/model manages its own clip metadata.
};

export type WidgetInitContext = {
  scene: ThreeScene;
  widgetId: string;
  renderer?: WebGLRenderer;
  /**
   * THREE.PerspectiveCamera managed by the engine.
   * Injected once at widget initialization — replaces the __brewsite_camera
   * scene.userData key. Widgets that need the camera object (e.g. CameraWidget)
   * must save this reference in their initialize() implementation.
   */
  camera?: PerspectiveCamera;
};

/**
 * Per-frame coordinate conversion service injected by the engine into
 * WidgetRenderContext. Converts NVS [0..1] positions to Three.js world-space
 * using the live camera and live canvas dimensions.
 *
 * Widgets that place geometry in the main scene MUST use this service instead
 * of holding camera references or using hardcoded aspect-ratio constants.
 *
 * Available from the first apply() call onward. Guaranteed non-null.
 */
export interface NVSCoordService {
  /**
   * Convert NVS [0..1] viewport position to Three.js world-space XYZ.
   * Projects onto the world Z-plane at the given depth.
   *
   * @param nvsX  Horizontal position [0=left, 1=right].
   * @param nvsY  Vertical position [0=top, 1=bottom].
   * @param z     World-space Z depth of the target plane. Default: 0 (look-at plane).
   *
   * @remarks
   * Gives exact results only when the camera is positioned on the Z-axis looking
   * straight toward [0, 0, 0] — i.e., camera.position = [cx, cy, cameraZ] with no
   * X/Y tilt and camera.lookAt([cx, cy, 0]). This is guaranteed for mode="nvsViewport".
   *
   * For orbit-mode cameras pointed at an angle, toWorld(0.5, 0.5) still maps correctly
   * to the camera's look-at point, but corner values are approximate — the NVS grid is
   * projected onto z=0 as if the camera were axis-aligned. Error grows with camera tilt
   * angle. For extreme angles, use world-space positioning instead.
   */
  toWorld(nvsX: number, nvsY: number, z?: number): readonly [number, number, number];

  /**
   * Convert NVS width/height fractions to Three.js world-space units.
   * Based on the visible world size at z=0 (the camera look-at plane).
   *
   * @param nvsW  Width as fraction of viewport [0..1].
   * @param nvsH  Height as fraction of viewport [0..1].
   */
  toWorldSize(nvsW: number, nvsH: number): readonly [number, number];

  /** Live canvas aspect ratio: width / height in CSS pixels. */
  readonly canvasAspect: number;

  /**
   * Visible world height at z=0 (the camera look-at plane).
   * Equals 2 * cameraDistance * tan(fov/2).
   */
  readonly visibleWorldHeight: number;

  /** Visible world width at z=0. Equals visibleWorldHeight * canvasAspect. */
  readonly visibleWorldWidth: number;

  /** Canvas width in CSS pixels. Updated each frame. */
  readonly viewportWidth: number;

  /** Canvas height in CSS pixels. Updated each frame. */
  readonly viewportHeight: number;
}

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
  /** Live NVS → world coordinate conversion service. Never null after first apply(). */
  coords: NVSCoordService;
  // REMOVED: deltaSeconds — use clock.deltaSeconds or effectiveDeltaSeconds
  // REMOVED: wallTimeSeconds — use clock.wallTimeSeconds
};

/**
 * Typed replacement for the __brewsite_camera_override scene.userData key.
 * Set by useSceneEngine via RuntimeDriver.setCameraOverride().
 * Read by CameraWidget in onTick() from context.cameraOverride.
 */
export type RuntimeCameraOverride = {
  readonly enabled: boolean;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up?: readonly [number, number, number];
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly exposure?: number;
};

/**
 * Widget that accepts camera focus requests from peer widgets.
 *
 * Implemented by CameraWidget. DiagramCanvasWidget dispatches focus requests
 * via context.cameraFocusTarget?.requestFocus() rather than writing to
 * scene.userData['__brewsite_camera_focus'].
 *
 * RuntimeDriverImpl resolves the first registered ICameraFocusTarget from the
 * WidgetRegistry and injects it into AnimationTickContext before each tick.
 */
export interface ICameraFocusTarget extends IWidget {
  /**
   * Request a camera focus to a world-space position and target.
   *
   * When camera interaction is active: delegates to the interaction driver for
   * smooth motion. When not active: promotes to a camera override so authored
   * camera state does not overwrite the focus on the next apply().
   *
   * @param position  Camera world position [x, y, z].
   * @param target    Camera look-at target [x, y, z].
   * @param smooth    Animate (true) or snap (false). Default: true.
   */
  requestFocus(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
    smooth?: boolean,
  ): void;
}

/**
 * Widget that can temporarily suppress core scene lighting.
 *
 * Implemented by DiagramCanvasWidget to disable core lights when the diagram
 * canvas is active and manages its own lighting via HDR environment maps.
 *
 * LightingWidget checks all registered ILightingOverride implementors in
 * apply() and skips Three.js light updates when any returns { disableAll: true }.
 * Replaces the direct setSceneLightEnabled() call from @brewsite/diagram.
 */
export interface ILightingOverride extends IWidget {
  /**
   * Returns the current lighting override request, or null if not overriding.
   * Called every frame inside LightingWidget.apply() — keep implementation cheap.
   * Return { disableAll: true } to suppress ALL core lights for this frame.
   */
  getLightingOverride(): { readonly disableAll: boolean } | null;

  /**
   * Called once by LightingWidget during configureRegistry to inject a per-light
   * control setter. Widgets that expose `DiagramHoverControls.setLightEnabled` to
   * scene authors (DiagramWidget, DiagramCanvasWidget) must implement this method
   * and store the setter for use in their hover callbacks.
   *
   * This replaces the direct `setSceneLightEnabled(scene, lightId, enabled)` call
   * that previously bypassed the widget contract.
   *
   * Optional: widgets that only use `getLightingOverride()` (all-or-nothing suppression)
   * do not need to implement this.
   */
  receiveLightController?(setter: (lightId: string, enabled: boolean) => void): void;
}

/**
 * Widget that issues additional WebGL render passes after the main scene pass.
 *
 * Called once per frame by the render loop after `renderer.render(scene, camera)`
 * completes. Implement for widgets that require scissored sub-viewport passes
 * (e.g. DiagramCanvasWidget) or post-processing effects that must composite
 * on top of the main 3D scene.
 *
 * The main scene pass has already rendered when `renderPass()` is called.
 * The implementation must restore renderer state (scissor, viewport) to its
 * pre-call state before returning.
 *
 * @param renderer       - The active `THREE.WebGLRenderer` instance.
 * @param viewportWidth  - Current renderer output width in CSS pixels.
 * @param viewportHeight - Current renderer output height in CSS pixels.
 */
export interface IExtraRenderPass extends IWidget {
  renderPass(
    renderer: WebGLRenderer,
    viewportWidth: number,
    viewportHeight: number,
  ): void;
}

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
  /**
   * The widget's fully resolved state for this tick.
   *
   * For FunctionalTransitionSpec widgets: RuntimeDriverImpl evaluates the closure
   * at tick.blockProgress and places the result here so IAnimationController
   * implementors do not need to re-implement the runtime's state resolution.
   *
   * CameraWidget uses this to avoid its current duplicate evaluation of
   * functionalBlock.widgetFns[widgetId].fn(tick.blockProgress).
   *
   * Typed as unknown; cast to TState inside the widget's onTick() body.
   * Null when the widget has no compiled state for this tick.
   */
  resolvedState: unknown;
  /**
   * The registered ICameraFocusTarget, if any.
   *
   * DiagramCanvasWidget uses this to request a camera focus on node
   * double-click, replacing the scene.userData['__brewsite_camera_focus'] write.
   * Also serves as an implicit signal that a Camera DSL element is active —
   * context.cameraFocusTarget !== undefined replaces the __brewsite_cam_enabled flag.
   *
   * Null when no widget implements ICameraFocusTarget.
   */
  cameraFocusTarget: ICameraFocusTarget | null;
  /**
   * Active camera override, if set by the player layer.
   *
   * Replaces the __brewsite_camera_override scene.userData key.
   * Set by useSceneEngine when it needs to bypass authored camera state
   * (e.g. after a DiagramCanvasWidget focus request in non-interaction mode).
   */
  cameraOverride: RuntimeCameraOverride | null;
  /**
   * Callback to promote a pending focus request to a camera override.
   *
   * Injected by RuntimeDriverImpl. CameraWidget calls this in onTick() when a
   * focus request arrives in non-interaction mode — the override is stored on the
   * driver so the next frame's cameraOverride field is populated immediately.
   *
   * Replaces the __brewsite_camera_override_pending scene.userData key that the
   * original plan accidentally introduced. No new bus keys are needed.
   */
  setCameraOverride: (override: RuntimeCameraOverride | null) => void;
  // REMOVED: deltaSeconds — use clock.deltaSeconds or effectiveDeltaSeconds
  // REMOVED: wallTimeSeconds — use clock.wallTimeSeconds
};

// Re-export VariableStoreReader type
export type { VariableStoreReader, JsonPrimitive };

// Import VariableStore for AnimationTickContext
import type { VariableStore } from './VariableStore';
