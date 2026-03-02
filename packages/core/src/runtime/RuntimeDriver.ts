import type { Scene as ThreeScene, WebGLRenderer } from 'three';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { VariableStore } from '../widget/VariableStore';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import { createSceneTrackSampler } from '../compiler/sceneTrackSampler';
import type { RuntimeDriver as IRuntimeDriver, RealtimeClock } from './types';
import type { RenderContribution, AnimationTickContext, WidgetRenderContext } from '../widget/types';
import { isAttachmentHost, isRenderContributor } from '../widget/WidgetRegistry';

export type SceneTrackSampler = ReturnType<typeof createSceneTrackSampler>;

// AssetManifest type is defined in widget/types.ts
type AssetManifest = { version: number; models: unknown[]; animations: unknown[] };

/**
 * Maximum animation-seconds that can be added per frame from animationTimeScale.
 * Caps the boost so that programmatic navigation jumps (e.g., NavMenu "Scene 5" from "Scene 1")
 * do not produce multi-second animation jumps in a single frame.
 * 0.2s = 12× real-time at 60fps.
 */
const MAX_ANIM_BOOST_PER_FRAME = 0.2;

export type RuntimeConfig = {
  widgetRegistry: WidgetRegistry;
  variableStore: VariableStore;
  manifest: AssetManifest | null;
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
  private sampler: SceneTrackSampler | null = null;
  private track: SceneTrack | null = null;
  private currentTick: SceneTrackTick | null = null;
  private wallTimeSeconds = 0;
  private onAssetsReady?: () => void;
  private onError?: (error: Error) => void;
  private onWidgetError?: (widgetId: string, error: Error) => void;
  private erroredWidgets = new Set<string>();

  assetsReady = false;

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
    this.onAssetsReady = config.onAssetsReady;
    this.onError = config.onError;
    this.onWidgetError = config.onWidgetError;
    this.sceneElements = this.widgetRegistry.getSceneElements();
    this.renderables = this.widgetRegistry.getRenderables();
    this.animationControllers = this.widgetRegistry.getAnimationControllers();
    this.defaultStateById = new Map(
      this.sceneElements.map((el) => [el.widgetId, el.defaultState as unknown]),
    );
  }

  async initialize(threeScene: ThreeScene, renderer?: WebGLRenderer): Promise<void> {
    this.threeScene = threeScene;

    // Step 1: Initialize all renderable widgets (sync)
    // initialize() failures are fatal — a widget that fails to initialize the Three.js
    // scene graph is unrecoverable.
    for (const renderable of this.renderables) {
      try {
        renderable.initialize({ scene: threeScene, widgetId: renderable.widgetId, renderer });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.onError?.(err);
        throw new Error(`Widget "${renderable.widgetId}" failed to initialize: ${err.message}`);
      }
    }

    // Step 2: Load all async assets in parallel — per-widget isolation.
    // Individual load() rejections are caught; the engine continues with remaining widgets.
    const loadables = this.widgetRegistry.getLoadables();
    await Promise.all(
      loadables.map((w) =>
        w.load(this.manifest).catch((e: unknown) => {
          const err = e instanceof Error ? e : new Error(String(e));
          this.erroredWidgets.add(w.widgetId);
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
    this.currentTick = tick;

    // ── Step 2: Compute effectiveDeltaSeconds ────────────────────────────────
    // animationTimeScale is stored on the segment for the outgoing transition
    // from the current scene. Zero when not declared (no boost).
    const animationTimeScale =
      this.track?.progressProfile?.segments[tick.sceneIndex]?.animationTimeScale ?? 0;
    const rawBoost = deltaProgress * animationTimeScale;
    const cappedBoost = Math.min(rawBoost, MAX_ANIM_BOOST_PER_FRAME);
    // effectiveDeltaSeconds is always >= deltaSeconds: the floor ensures animation
    // never drops below real-time even with animationTimeScale declared.
    const effectiveDeltaSeconds = Math.max(deltaSeconds, cappedBoost);

    // ── Step 3: Build synchronized clock ────────────────────────────────────
    // wallTimeSeconds is from performance.now() / 1000, computed once per frame
    // in RuntimeLoop.runStep(). All widgets receive the same value this frame.
    const clock: RealtimeClock = { wallTimeSeconds, deltaSeconds };

    // ── Step 4: Tick animation controllers ──────────────────────────────────
    const animCtx: AnimationTickContext = {
      clock,
      effectiveDeltaSeconds,
      scene: this.threeScene,
      variables: this.variableStore,
      tick,
      track: this.track,
    };
    for (const controller of this.animationControllers) {
      if (this.erroredWidgets.has(controller.widgetId)) continue;
      try {
        controller.onTick(animCtx);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.erroredWidgets.add(controller.widgetId);
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
    };
    for (const renderable of this.renderables) {
      if (this.erroredWidgets.has(renderable.widgetId)) continue;
      try {
        // Functional transitions take priority: evaluate closure at blockProgress.
        // The closure itself handles window normalization and easing via makeResolver
        // (baked into the closure at compile time). No additional transformation here.
        // Falls back to pre-baked discrete state, then widget defaultState.
        const functionalBlock = this.track?.transitionBlocks?.[tick.sceneIndex];
        const functionalWidget = functionalBlock?.widgetFns[renderable.widgetId];
        let state: unknown;
        if (functionalWidget) {
          state = functionalWidget.fn(tick.blockProgress);
        } else {
          state =
            tick.state.widgets[renderable.widgetId] ??
            this.defaultStateById.get(renderable.widgetId);
        }
        const extra = tick.widgetExtras?.[renderable.widgetId];
        renderable.apply(state as never, { ...renderCtx, extra });
      } catch (e) {
        this.erroredWidgets.add(renderable.widgetId);
        const err = e instanceof Error ? e : new Error(String(e));
        this.onWidgetError?.(renderable.widgetId, err);
      }
    }
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

  getCurrentTick(): SceneTrackTick | null {
    return this.currentTick;
  }

  getWallTimeSeconds(): number {
    return this.wallTimeSeconds;
  }

  dispose(): void {
    this.erroredWidgets.clear();
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
