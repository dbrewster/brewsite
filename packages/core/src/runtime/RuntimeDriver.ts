import * as THREE from 'three';
import type { PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { VariableStore } from '../widget/VariableStore';
import { ABSENT_STATE, type SceneTrack, type SceneTrackTick } from '../compiler/sceneTrackTypes';
import { createSceneTrackSampler } from '../compiler/sceneTrackSampler';
import type { RuntimeDriver as IRuntimeDriver, RealtimeClock, SceneLoadPolicy, SceneMembership } from './types';
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

  /** Scene load policy. When null, all widgets load upfront (backward compat). */
  private loadPolicy: SceneLoadPolicy | null = null;

  /** Scene-to-widget membership mapping. Set by setSceneTrack(). */
  private _sceneMembership: SceneMembership | null = null;

  /** Scenes whose ILoadable widgets have finished loading. */
  private _loadedScenes = new Set<number>();

  /** Scenes currently being loaded. */
  private _loadingScenes = new Set<number>();

  /** Listeners notified when loadedScenes/loadingScenes change. */
  private _sceneLoadListeners = new Set<() => void>();

  /**
   * Cached snapshot for useSyncExternalStore. A new object is created only
   * when _loadedScenes or _loadingScenes actually change (in _notifySceneLoadListeners).
   * Between changes, getSceneLoadState() returns the same reference — this satisfies
   * useSyncExternalStore's requirement for referential stability of unchanged snapshots.
   * Sets are defensively copied so consumers cannot corrupt driver state.
   */
  private _sceneLoadStateSnapshot: { loadedScenes: ReadonlySet<number>; loadingScenes: ReadonlySet<number> } = {
    loadedScenes: new Set(),
    loadingScenes: new Set(),
  };

  /** Last observed scene index — used for preload-ahead triggers. */
  private _lastObservedSceneIndex = -1;

  assetsReady = false;

  /** Widget state patches applied on top of compiled state each tick. Set via patchWidgetStates(). */
  private _widgetStatePatches: Record<string, unknown> = {};

  /** Widget IDs whose root Three.js objects we have hidden due to ABSENT_STATE.
   *  Tracked so we restore visibility only for widgets WE hid, not those hidden
   *  externally (e.g. by ViewWidget for opacity=0 reasons). */
  private absentHiddenWidgets = new Set<string>();


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

  /** Scene-to-widget membership mapping, populated after setSceneTrack(). */
  get sceneMembership(): SceneMembership | null {
    return this._sceneMembership;
  }

  /**
   * Configures scene-level lazy loading. Must be called before initialize().
   * When set, _loadAssets() in initialize() becomes a no-op; partitioned
   * loading is triggered from setSceneTrack() instead.
   */
  setLoadPolicy(policy: SceneLoadPolicy): void {
    this.loadPolicy = policy;
  }

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
    // When loadPolicy is configured, skip upfront loading.
    // Partitioned loading is triggered from setSceneTrack().
    if (this.loadPolicy) {
      return;
    }

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

    // Store scene membership from compilation output.
    this._sceneMembership = track.sceneMembership ?? null;

    // Re-read widget lists — compilation may have lazily registered new widgets
    // via type factories (e.g. ModelWidget created on first <Model> encounter).
    // Any new renderables discovered here need to be initialized and loaded.
    this._refreshWidgetLists();

    // Trigger partitioned loading when a load policy is configured.
    if (this.loadPolicy && this._sceneMembership) {
      void this._loadEagerScenes();
    }
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

  /**
   * Loads assets for eager scenes (blocking assetsReady) then starts
   * preloading ahead scenes in the background.
   */
  private async _loadEagerScenes(): Promise<void> {
    const policy = this.loadPolicy!;
    const eagerIndices = policy.eager ?? [0];

    // Load eager scenes — these block assetsReady.
    await this._loadScenesAssets(eagerIndices);

    // Mark assets ready once eager scenes are loaded.
    this.attachContainedRenderables();
    this.assetsReady = true;
    this.onAssetsReady?.();

    // Preload ahead from the first eager scene.
    const currentScene = eagerIndices[0] ?? 0;
    this._preloadAhead(currentScene);
  }

  /**
   * Loads ILoadable widgets for the given scene indices.
   * Skips widgets that are already loaded or currently loading.
   * Updates _loadedScenes and _loadingScenes sets.
   */
  private async _loadScenesAssets(sceneIndices: number[]): Promise<void> {
    const membership = this._sceneMembership;
    if (!membership) return;

    // Collect widget IDs from requested scenes that haven't been loaded yet.
    const widgetIdsToLoad = new Set<string>();
    const scenesToMark = new Set<number>();

    for (const idx of sceneIndices) {
      if (this._loadedScenes.has(idx)) continue;
      scenesToMark.add(idx);
      const widgetIds = membership.get(idx);
      if (!widgetIds) continue;
      for (const id of widgetIds) {
        widgetIdsToLoad.add(id);
      }
    }

    if (widgetIdsToLoad.size === 0) {
      // All widgets for these scenes are already loaded.
      for (const idx of scenesToMark) {
        this._loadedScenes.add(idx);
      }
      this._notifySceneLoadListeners();
      return;
    }

    // Mark scenes as loading.
    for (const idx of scenesToMark) {
      this._loadingScenes.add(idx);
    }
    this._notifySceneLoadListeners();

    // Load only the ILoadable widgets in the requested scenes that aren't already loaded.
    const loadables = this.widgetRegistry.getLoadables()
      .filter((w) => widgetIdsToLoad.has(w.widgetId) && !w.isLoaded);

    await Promise.all(
      loadables.map((w) =>
        w.load(this.manifest).catch((e: unknown) => {
          const err = e instanceof Error ? e : new Error(String(e));
          this.loadErroredWidgets.add(w.widgetId);
          this.onWidgetError?.(w.widgetId, err);
        }),
      ),
    );

    // Attach any IContainedRenderable widgets that were just loaded.
    // Without this, contained models loaded via preload-ahead would never
    // be parented to their host's attachment point.
    this.attachContainedRenderables();

    // Mark scenes as loaded (not loading).
    for (const idx of scenesToMark) {
      this._loadingScenes.delete(idx);
      this._loadedScenes.add(idx);
    }
    this._notifySceneLoadListeners();
  }

  /**
   * Preloads scenes ahead of the current scene index (non-blocking).
   */
  private _preloadAhead(currentSceneIndex: number): void {
    const policy = this.loadPolicy;
    if (!policy || !this._sceneMembership) return;
    // Use sceneWindows.length as the authoritative scene count, not
    // _sceneMembership.size — empty scenes (no widgets) may be absent
    // from the membership map but still exist in the track.
    const totalScenes = this.track?.sceneWindows.length ?? 0;
    const ahead = policy.preloadAhead ?? 1;

    const indicesToPreload: number[] = [];
    for (let i = 1; i <= ahead; i++) {
      const idx = currentSceneIndex + i;
      if (idx < totalScenes && !this._loadedScenes.has(idx) && !this._loadingScenes.has(idx)) {
        indicesToPreload.push(idx);
      }
    }

    if (indicesToPreload.length > 0) {
      void this._loadScenesAssets(indicesToPreload);
    }
  }

  /** Subscribe to scene load state changes. Returns unsubscribe function. */
  subscribeSceneLoadState(listener: () => void): () => void {
    this._sceneLoadListeners.add(listener);
    return () => this._sceneLoadListeners.delete(listener);
  }

  /**
   * Returns the cached snapshot. Same object reference between state changes —
   * required by useSyncExternalStore for referential stability.
   */
  getSceneLoadState(): { loadedScenes: ReadonlySet<number>; loadingScenes: ReadonlySet<number> } {
    return this._sceneLoadStateSnapshot;
  }

  /**
   * Creates a new snapshot (new object identity signals change to useSyncExternalStore),
   * then notifies all subscribed listeners. Sets are defensively copied so consumers
   * cannot mutate driver internals.
   */
  private _notifySceneLoadListeners(): void {
    this._sceneLoadStateSnapshot = {
      loadedScenes: new Set(this._loadedScenes),
      loadingScenes: new Set(this._loadingScenes),
    };
    for (const listener of this._sceneLoadListeners) {
      listener();
    }
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

    // Trigger preload-ahead on scene change (lazy loading mode).
    // Also clear widget state patches — patches from carousel rotations etc.
    // are scene-local and must not persist across scene boundaries. Keeping
    // them would override compiled state (e.g., tray viewHighlights=[]) on
    // scenes where the carousel is absent, causing stale highlights.
    if (tick && tick.sceneIndex !== this._lastObservedSceneIndex) {
      if (this._lastObservedSceneIndex !== -1 && Object.keys(this._widgetStatePatches).length > 0) {
        this._widgetStatePatches = {};
      }
      this._lastObservedSceneIndex = tick.sceneIndex;
      if (this.loadPolicy) {
        this._preloadAhead(tick.sceneIndex);
      }
    }

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

        // Runtime-managed visibility: when the state is the disabled default
        // (tagged with ABSENT_STATE by makeDisabledDefault), skip apply() and
        // hide the widget's root Three.js object. This centralizes the
        // absent-widget hide logic — individual widgets don't need enabled checks.
        if (state && typeof state === 'object' && (state as any)[ABSENT_STATE]) {
          const root = 'rootObject' in renderable ? (renderable as any).rootObject : null;
          if (root && 'visible' in root) root.visible = false;
          this.absentHiddenWidgets.add(renderable.widgetId);
          continue;
        }

        // If the runtime previously hid this widget, restore visibility now
        // that it has a real (non-absent) state. Only restore for widgets WE
        // hid — not widgets hidden by ViewWidget for opacity=0 reasons.
        if (this.absentHiddenWidgets.has(renderable.widgetId)) {
          this.absentHiddenWidgets.delete(renderable.widgetId);
          const root = 'rootObject' in renderable ? (renderable as any).rootObject : null;
          if (root && 'visible' in root) root.visible = true;
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
   *
   * Public so that InputCoordinator (and similar) can read widget state through
   * the full resolution chain. Reading tick.state.widgets directly misses
   * functional-closure-only widgets (e.g. CarouselScrubberWidget whose state is
   * absent from tick.state.widgets during transition blocks).
   */
  resolveWidgetState(widgetId: string, tick: SceneTrackTick | null): unknown {
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
    this.absentHiddenWidgets.clear();
    this._loadedScenes.clear();
    this._loadingScenes.clear();
    this._sceneLoadListeners.clear();
    this._sceneMembership = null;
    this._lastObservedSceneIndex = -1;
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
