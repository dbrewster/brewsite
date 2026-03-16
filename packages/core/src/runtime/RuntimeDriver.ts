import * as THREE from 'three';
import type { PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { VariableStore } from '../widget/VariableStore';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import { createSceneTrackSampler } from '../compiler/sceneTrackSampler';
import type { RuntimeDriver as IRuntimeDriver, RealtimeClock } from './types';
import type {
  RenderContribution,
  AnimationTickContext,
  WidgetRenderContext,
  NVSCoordService,
  ISceneLifecycle,
  ICameraFocusTarget,
  RuntimeCameraOverride,
  AssetManifest,
} from '../widget/types';
import { isAttachmentHost, isRenderContributor, isCameraFocusTarget } from '../widget/WidgetRegistry';
import { createNVSCoordService, resolveNVSParamsFromCameraState } from '../layout/nvsCoordService';
import type { SceneCamera } from '../elements/camera/types';

export type SceneTrackSampler = ReturnType<typeof createSceneTrackSampler>;

export type RuntimeConfig = {
  widgetRegistry: WidgetRegistry;
  variableStore: VariableStore;
  manifest: AssetManifest | null;
  maxAnimBoostPerFrame?: number;
  onAssetsReady?: () => void;
  onError?: (error: Error) => void;
  /** Called when a single widget fails during load() or apply(). Engine continues. */
  onWidgetError?: (widgetId: string, error: Error) => void;
};

/**
 * Generic RuntimeDriver implementation using the widget-based architecture.
 *
 * Orchestrates:
 * 1. Scene track sampling (O(1))
 * 2. effectiveDeltaSeconds computation from animationTimeScale
 * 3. Animation controller tick loop (in priority order)
 * 4. Renderable widget application
 * 5. Render contribution collection (bone positions, target colors)
 */
export class RuntimeDriverImpl implements IRuntimeDriver {
  private widgetRegistry: WidgetRegistry;
  private variableStore: VariableStore;
  private manifest: AssetManifest | null;
  private sceneElements: Array<import('../widget/types').ISceneElement<unknown>>;
  private renderables: Array<import('../widget/types').IRenderable<unknown>>;
  private animationControllers: Array<import('../widget/types').IAnimationController>;
  private defaultStateById: Map<string, unknown>;
  private threeScene: ThreeScene | null = null;
  private camera: PerspectiveCamera | null = null;
  private renderer: WebGLRenderer | null = null;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private cameraFocusTarget: ICameraFocusTarget | null = null;
  private cameraOverride: RuntimeCameraOverride | null = null;
  private sampler: SceneTrackSampler | null = null;
  private track: SceneTrack | null = null;
  private currentTick: SceneTrackTick | null = null;
  private wallTimeSeconds = 0;
  private onAssetsReady?: () => void;
  private onError?: (error: Error) => void;
  private onWidgetError?: (widgetId: string, error: Error) => void;
  /** Widgets that failed during load() or initialize() — permanent for this session. */
  private readonly loadErroredWidgets = new Set<string>();
  /** Widgets that failed during apply() — cleared on scene change, allows recovery. */
  private readonly applyErroredWidgets = new Set<string>();
  private sceneLifecycleWidgets: ISceneLifecycle[];
  private readonly maxAnimBoostPerFrame: number;

  assetsReady = false;

  /** Widget state patches applied on top of compiled state each tick. Set via patchWidgetStates(). */
  private _widgetStatePatches: Record<string, unknown> = {};

  setAssetsReady(ready: boolean): void {
    this.assetsReady = ready;
    if (ready) {
      this.onAssetsReady?.();
    }
  }

  constructor(config: RuntimeConfig) {
    this.widgetRegistry = config.widgetRegistry;
    this.variableStore = config.variableStore;
    this.manifest = config.manifest;
    this.maxAnimBoostPerFrame = config.maxAnimBoostPerFrame ?? 0.2;
    this.onAssetsReady = config.onAssetsReady;
    this.onError = config.onError;
    this.onWidgetError = config.onWidgetError;
    this.sceneElements = this.widgetRegistry.getSceneElements();
    this.renderables = this.widgetRegistry.getRenderables();
    this.animationControllers = this.widgetRegistry.getAnimationControllers();
    this.sceneLifecycleWidgets = this.widgetRegistry.getSceneLifecycleWidgets();
    this.defaultStateById = new Map(
      this.sceneElements.map((el) => [el.widgetId, el.defaultState as unknown]),
    );
  }

  /**
   * Synchronously initializes the runtime with the Three.js scene, camera, and renderer.
   * - Re-reads widget lists to capture lazily-registered widgets from DSL compilation.
   * - Resolves the first ICameraFocusTarget from the registry (usually CameraWidget).
   * - Calls initialize() on all IRenderable widgets, injecting scene, camera, and renderer.
   * - Starts async asset loading as a fire-and-forget; completion fires onAssetsReady.
   */
  /** Update the canvas dimensions used for NVS→world coordinate conversion. */
  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  initialize(threeScene: ThreeScene, camera?: PerspectiveCamera, renderer?: WebGLRenderer): void {
    this.threeScene = threeScene;
    this.camera = camera ?? null;
    this.renderer = renderer ?? null;

    // Re-read widget lists so lazily-registered widgets (e.g. ChartWidgets registered during
    // scene compilation, after this driver was constructed) are included.
    this.sceneElements = this.widgetRegistry.getSceneElements();
    this.renderables = this.widgetRegistry.getRenderables();
    this.animationControllers = this.widgetRegistry.getAnimationControllers();
    this.sceneLifecycleWidgets = this.widgetRegistry.getSceneLifecycleWidgets();
    this.defaultStateById = new Map(
      this.sceneElements.map((el) => [el.widgetId, el.defaultState as unknown]),
    );

    // Resolve ICameraFocusTarget once — CameraWidget is the usual implementor.
    this.cameraFocusTarget = null;
    for (const widget of this.widgetRegistry.getAllWidgets()) {
      if (isCameraFocusTarget(widget)) {
        this.cameraFocusTarget = widget;
        break;
      }
    }

    // Initialize all IRenderable widgets (sync). Failures are fatal — a widget that fails
    // to initialize the Three.js scene graph is unrecoverable.
    for (const renderable of this.renderables) {
      try {
        renderable.initialize({ scene: threeScene, widgetId: renderable.widgetId, renderer, camera });
        // Register root Object3D for widgets that expose one (e.g. ViewWidget position delta).
        if ('rootObject' in renderable && renderable.rootObject instanceof THREE.Object3D) {
          this.widgetRegistry.setWidgetObject(renderable.widgetId, renderable.rootObject as THREE.Object3D);
        }
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.onError?.(err);
        throw new Error(`Widget "${renderable.widgetId}" failed to initialize: ${err.message}`);
      }
    }

    // Start async asset loading — fire-and-forget. Completion fires onAssetsReady callback.
    void this._loadAssets();
  }

  /**
   * Applies per-widget state patches that override compiled SceneTrack state.
   * Patches are applied each tick before widgets receive state.
   * Used by patchWidgetStates() in useSceneEngine for dynamic widget overrides.
   */
  setWidgetStatePatches(patches: Record<string, unknown>): void {
    this._widgetStatePatches = patches;
  }

  /** Set or clear the active camera override. Called by useSceneEngine. */
  setCameraOverride(override: RuntimeCameraOverride | null): void {
    this.cameraOverride = override;
  }

  private async _loadAssets(): Promise<void> {
    // Individual load() rejections are caught; the engine continues with remaining widgets.
    const loadables = this.widgetRegistry.getLoadables();
    await Promise.all(
      loadables.map((w) =>
        w.load(this.manifest).catch((e: unknown) => {
          const err = e instanceof Error ? e : new Error(String(e));
          this.loadErroredWidgets.add(w.widgetId);
          this.onWidgetError?.(w.widgetId, err);
        }),
      ),
    );
    this.attachContainedRenderables();
    this.assetsReady = true;
    this.onAssetsReady?.();
  }

  private attachContainedRenderables(): void {
    for (const widget of this.widgetRegistry.getContainedRenderables()) {
      const host = this.widgetRegistry.get(widget.anchorWidgetId);
      if (!host || !isAttachmentHost(host)) {
        console.warn(
          `[RuntimeDriver] No IAttachmentHost "${widget.anchorWidgetId}" ` +
          `for contained renderable "${widget.widgetId}". ` +
          `Ensure the host widget implements IAttachmentHost and is registered.`,
        );
        continue;
      }
      const point = host.getAttachmentPoint(widget.anchorKey);
      if (!point) {
        console.warn(
          `[RuntimeDriver] Attachment point "${widget.anchorKey}" not found on ` +
          `host "${widget.anchorWidgetId}" for widget "${widget.widgetId}".`,
        );
        continue;
      }
      point.add(widget.rootObject);
    }
  }

  setSceneTrack(track: SceneTrack): void {
    this.sampler = createSceneTrackSampler(track);
    this.track = track;

    // Re-read widget lists — compilation may have lazily registered new widgets
    // via type factories (e.g. ModelWidget created on first <Model> encounter).
    // Any new renderables discovered here need to be initialized and loaded.
    this._refreshWidgetLists();
  }

  /**
   * Re-reads widget lists from the registry, initializes any newly discovered
   * IRenderable widgets, and starts asset loading for new ILoadable widgets.
   * Called from setSceneTrack() to pick up widgets registered during compilation.
   */
  private _refreshWidgetLists(): void {
    // Snapshot which widgets were already initialized before re-reading the registry.
    const prevRenderableIds = new Set(this.renderables.map((r) => r.widgetId));

    // Re-read all widget lists from the live registry. Compilation may have
    // lazily registered new widgets via type factories.
    this.sceneElements = this.widgetRegistry.getSceneElements();
    this.renderables = this.widgetRegistry.getRenderables();
    this.animationControllers = this.widgetRegistry.getAnimationControllers();
    this.sceneLifecycleWidgets = this.widgetRegistry.getSceneLifecycleWidgets();
    this.defaultStateById = new Map(
      this.sceneElements.map((el) => [el.widgetId, el.defaultState as unknown]),
    );

    // Re-resolve camera focus target (new widgets may implement ICameraFocusTarget).
    this.cameraFocusTarget = null;
    for (const widget of this.widgetRegistry.getAllWidgets()) {
      if (isCameraFocusTarget(widget)) {
        this.cameraFocusTarget = widget;
        break;
      }
    }

    // Discover newly registered renderables that need initialization + loading.
    const newRenderableIds = new Set<string>();
    if (this.threeScene) {
      for (const renderable of this.renderables) {
        if (prevRenderableIds.has(renderable.widgetId)) continue;
        newRenderableIds.add(renderable.widgetId);
        try {
          renderable.initialize({
            scene: this.threeScene,
            widgetId: renderable.widgetId,
            renderer: this.renderer ?? undefined,
            camera: this.camera ?? undefined,
          });
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          this.loadErroredWidgets.add(renderable.widgetId);
          this.onWidgetError?.(renderable.widgetId, err);
        }
      }
    }

    // Load assets for the newly discovered widgets only.
    if (newRenderableIds.size > 0) {
      const newLoadables = this.widgetRegistry.getLoadables()
        .filter((l) => newRenderableIds.has(l.widgetId));
      if (newLoadables.length > 0) {
        void this._loadNewWidgets(newLoadables);
      }
    }
  }

  /**
   * Loads assets for newly discovered widgets and fires onAssetsReady when complete.
   */
  private async _loadNewWidgets(
    loadables: Array<import('../widget/types').ILoadable>,
  ): Promise<void> {
    this.assetsReady = false;
    await Promise.all(
      loadables.map((w) =>
        w.load(this.manifest).catch((e: unknown) => {
          const err = e instanceof Error ? e : new Error(String(e));
          this.loadErroredWidgets.add(w.widgetId);
          this.onWidgetError?.(w.widgetId, err);
        }),
      ),
    );
    this.attachContainedRenderables();
    this.assetsReady = true;
    this.onAssetsReady?.();
  }

  tick(options: {
    deltaSeconds: number;
    globalProgress: number;
    deltaProgress: number;
    wallTimeSeconds?: number;
  }): void {
    const { deltaSeconds, globalProgress, deltaProgress, wallTimeSeconds = 0 } = options;
    this.wallTimeSeconds = wallTimeSeconds;

    if (!this.threeScene || !this.sampler) return;

    // ── Step 1: Sample SceneTrack ────────────────────────────────────────────
    // O(1) lookup. Must run before animation controllers so they receive
    // effectiveDeltaSeconds computed from the current scene's animationTimeScale.
    const tick = this.sampler.sample(globalProgress);
    if (this.currentTick && tick.sceneIndex !== this.currentTick.sceneIndex) {
      const prevSceneId = this.currentTick.sceneId;
      const prevSceneIndex = this.currentTick.sceneIndex;
      const nextSceneId = tick.sceneId;
      const nextSceneIndex = tick.sceneIndex;

      // Fire onSceneExit for the departing scene
      for (const widget of this.sceneLifecycleWidgets) {
        try {
          widget.onSceneExit(prevSceneId, prevSceneIndex);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          console.warn(`[RuntimeDriver] onSceneExit error in widget "${widget.widgetId}":`, err);
        }
      }

      // Fire onSceneEnter for the arriving scene
      for (const widget of this.sceneLifecycleWidgets) {
        try {
          widget.onSceneEnter(nextSceneId, nextSceneIndex);
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          console.warn(`[RuntimeDriver] onSceneEnter error in widget "${widget.widgetId}":`, err);
        }
      }

      // Reset apply-errors on scene change (added in 6.2)
      this.applyErroredWidgets.clear();
    }
    this.currentTick = tick;

    // ── Step 2: Compute effectiveDeltaSeconds ────────────────────────────────
    // animationTimeScale is stored on the segment for the outgoing transition
    // from the current scene. Zero when not declared (no boost).
    const animationTimeScale =
      this.track?.progressProfile?.segments[tick.sceneIndex]?.animationTimeScale ?? 0;
    const rawBoost = deltaProgress * animationTimeScale;
    const cappedBoost = Math.min(rawBoost, this.maxAnimBoostPerFrame);
    // effectiveDeltaSeconds is always >= deltaSeconds: the floor ensures animation
    // never drops below real-time even with animationTimeScale declared.
    const effectiveDeltaSeconds = Math.max(deltaSeconds, cappedBoost);

    // ── Step 3: Build synchronized clock ────────────────────────────────────
    // wallTimeSeconds is from performance.now() / 1000, computed once per frame
    // in RuntimeLoop.runStep(). All widgets receive the same value this frame.
    const clock: RealtimeClock = { wallTimeSeconds, deltaSeconds };

    // ── Step 3.5: Build NVS from compiled camera state ──────────────────────
    // Must run BEFORE animation controllers (Step 4), because CameraWidget.onTick()
    // modifies the live Three.js camera for interaction overrides (orbit/dolly/pan).
    // NVS positions are derived from the scene author's intended camera — user
    // camera interaction changes the view, not the content positions.
    const compiledCameraState = this.resolveWidgetState('camera', tick) as SceneCamera | null;
    const nvsParams = compiledCameraState
      ? resolveNVSParamsFromCameraState(compiledCameraState)
      : null;
    const coords = nvsParams
      ? createNVSCoordService(nvsParams, this.viewportWidth || 1920, this.viewportHeight || 1080)
      : this._makeDefaultCoords();

    // ── Step 4: Tick animation controllers ──────────────────────────────────
    // Build a shared context template; resolvedState is overridden per-widget below.
    const animCtxBase = {
      clock,
      effectiveDeltaSeconds,
      scene: this.threeScene,
      variables: this.variableStore,
      tick,
      track: this.track,
      cameraFocusTarget: this.cameraFocusTarget,
      cameraOverride: this.cameraOverride,
      // Injected callback — CameraWidget calls this to promote a focus request to an
      // override without needing a scene.userData bus key.
      setCameraOverride: (override: RuntimeCameraOverride | null) => { this.cameraOverride = override; },
    };
    for (const controller of this.animationControllers) {
      if (this.loadErroredWidgets.has(controller.widgetId) || this.applyErroredWidgets.has(controller.widgetId)) continue;
      try {
        const resolvedState = this.resolveWidgetState(controller.widgetId, tick);
        controller.onTick({ ...animCtxBase, resolvedState } as AnimationTickContext);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.applyErroredWidgets.add(controller.widgetId);
        this.onWidgetError?.(controller.widgetId, err);
      }
    }

    // ── Step 5: Apply renderable widgets ────────────────────────────────────
    const renderCtx: WidgetRenderContext = {
      clock,
      effectiveDeltaSeconds,
      globalProgress,
      variables: this.variableStore,
      extra: undefined as unknown,
      tick,
      coords,
    };
    for (const renderable of this.renderables) {
      if (this.loadErroredWidgets.has(renderable.widgetId) || this.applyErroredWidgets.has(renderable.widgetId)) continue;
      try {
        // Functional transitions take priority: evaluate closure at blockProgress.
        // The closure itself handles window normalization and easing via makeResolver
        // (baked into the closure at compile time). No additional transformation here.
        // Falls back to pre-baked discrete state, then widget defaultState.
        const functionalBlock = this.track?.transitionBlocks?.[tick.sceneIndex];
        const functionalWidget = functionalBlock?.widgetFns[renderable.widgetId];
        let state: unknown;
        // Patches override both functional and compiled state.
        if (Object.prototype.hasOwnProperty.call(this._widgetStatePatches, renderable.widgetId)) {
          state = this._widgetStatePatches[renderable.widgetId];
        } else if (functionalWidget) {
          state = functionalWidget.fn(tick.blockProgress);
        } else {
          state =
            tick.state.widgets[renderable.widgetId] ??
            this.defaultStateById.get(renderable.widgetId);
        }
        const extra = tick.widgetExtras?.[renderable.widgetId];
        renderable.apply(state as never, { ...renderCtx, extra });
      } catch (e) {
        this.applyErroredWidgets.add(renderable.widgetId);
        const err = e instanceof Error ? e : new Error(String(e));
        this.onWidgetError?.(renderable.widgetId, err);
      }
    }
  }

  /**
   * Resolves the widget's state for a given tick.
   * Priority order: widgetStatePatches → functional closure → pre-baked discrete state.
   */
  private resolveWidgetState(widgetId: string, tick: SceneTrackTick | null): unknown {
    if (!tick) return null;
    // Patches from patchWidgetStates() override compiled state.
    if (Object.prototype.hasOwnProperty.call(this._widgetStatePatches, widgetId)) {
      return this._widgetStatePatches[widgetId];
    }
    const tBlock = this.track?.transitionBlocks?.[tick.sceneIndex];
    const funcOverride = tBlock?.widgetFns[widgetId];
    if (funcOverride) return funcOverride.fn(tick.blockProgress);
    return tick.state.widgets[widgetId] ?? null;
  }

  /**
   * Collects named world positions and target colors from all IRenderContributor
   * widgets. Called once per frame from the render loop, after renderer.render().
   *
   * Merges contributions from all widgets — last-write-wins on key collision
   * (contributors are processed in registration order).
   */
  collectRenderContributions(): RenderContribution {
    const namedPositions = new Map<string, [number, number, number]>();
    const targetColors = new Map<string, string>();
    for (const widget of this.widgetRegistry.getAll()) {
      if (!isRenderContributor(widget)) continue;
      const data = widget.contributeRenderData();
      data.namedPositions?.forEach((v, k) => namedPositions.set(k, v));
      data.targetColors?.forEach((v, k) => targetColors.set(k, v));
    }
    return {
      namedPositions: namedPositions.size > 0 ? namedPositions : undefined,
      targetColors: targetColors.size > 0 ? targetColors : undefined,
    };
  }

  /**
   * Fallback NVSCoordService used when no camera is available (e.g., before initialize()).
   * Uses worldScale=10 defaults (cameraZ≈12.07, fov=45).
   */
  private _makeDefaultCoords(): NVSCoordService {
    const vw = this.viewportWidth || 1920;
    const vh = this.viewportHeight || 1080;
    const aspect = vw / Math.max(1, vh);
    const visH = 10; // default worldScale=10
    const visW = visH * aspect;
    return {
      toWorld: (x: number, y: number, z: number = 0): readonly [number, number, number] =>
        [(x - 0.5) * visW, -(y - 0.5) * visH, z],
      toWorldSize: (w: number, h: number): readonly [number, number] =>
        [w * visW, h * visH],
      canvasAspect: aspect,
      visibleWorldHeight: visH,
      visibleWorldWidth: visW,
      viewportWidth: vw,
      viewportHeight: vh,
    };
  }

  getCurrentTick(): SceneTrackTick | null {
    return this.currentTick;
  }

  getWallTimeSeconds(): number {
    return this.wallTimeSeconds;
  }

  dispose(): void {
    this.loadErroredWidgets.clear();
    this.applyErroredWidgets.clear();
    for (const renderable of this.renderables) {
      try {
        renderable.dispose();
      } catch (e) {
        // Ignore disposal errors
      }
    }
    this.sampler = null;
    this.track = null;
    this.currentTick = null;
  }
}
