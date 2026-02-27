import type { Scene as ThreeScene, WebGLRenderer } from 'three';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { VariableStore } from '../widget/VariableStore';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import { createSceneTrackSampler } from '../compiler/sceneTrackSampler';
import type { RuntimeDriver as IRuntimeDriver } from './types';

export type SceneTrackSampler = ReturnType<typeof createSceneTrackSampler>;

// AssetManifest type is defined in widget/types.ts
type AssetManifest = { version: number; models: unknown[]; animations: unknown[] };

export type RuntimeConfig = {
  widgetRegistry: WidgetRegistry;
  variableStore: VariableStore;
  manifest: AssetManifest | null;
  onAssetsReady?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Generic RuntimeDriver implementation using the widget-based architecture.
 *
 * Orchestrates:
 * 1. Animation controller tick loop (in priority order)
 * 2. Scene track sampling
 * 3. Renderable widget application
 * 4. Bone world position extraction for annotation positioner
 *
 * Phase 7: Generic RuntimeDriver
 */
export class RuntimeDriverImpl implements IRuntimeDriver {
  private widgetRegistry: WidgetRegistry;
  private variableStore: VariableStore;
  private manifest: AssetManifest | null;
  private sceneElements: Array<import('../widget/types').ISceneElement<unknown>>;
  private renderables: Array<import('../widget/types').IRenderable<unknown>>;
  private animationControllers: Array<import('../widget/types').IAnimationController>;
  private containedModels: Array<import('../widget/types').IContainedModel<unknown>>;
  private defaultStateById: Map<string, unknown>;
  private threeScene: ThreeScene | null = null;
  private sampler: SceneTrackSampler | null = null;
  private track: SceneTrack | null = null;
  private currentTick: SceneTrackTick | null = null;
  private wallTimeSeconds = 0;
  private onAssetsReady?: () => void;
  private onError?: (error: Error) => void;

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
    this.sceneElements = this.widgetRegistry.getSceneElements();
    this.renderables = this.widgetRegistry.getRenderables();
    this.animationControllers = this.widgetRegistry.getAnimationControllers();
    this.containedModels = this.widgetRegistry.getContainedModels();
    this.defaultStateById = new Map(
      this.sceneElements.map((el) => [el.widgetId, el.defaultState as unknown]),
    );
  }

  async initialize(threeScene: ThreeScene, renderer?: WebGLRenderer): Promise<void> {
    this.threeScene = threeScene;

    // Step 1: Initialize all renderable widgets (sync)
    for (const renderable of this.renderables) {
      try {
        renderable.initialize({ scene: threeScene, widgetId: renderable.widgetId, renderer });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.onError?.(err);
        throw err;
      }
    }

    // Step 2: Load all async assets in parallel
    const loadables = this.widgetRegistry.getLoadables();
    try {
      await Promise.all(loadables.map((w) => w.load(this.manifest)));
      this.attachContainedModels();
      this.assetsReady = true;
      this.onAssetsReady?.();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.onError?.(err);
      throw err;
    }
  }

  private attachContainedModels(): void {
    for (const widget of this.containedModels) {
      const anchorModel = this.widgetRegistry.get(widget.anchorModelId);
      if (!anchorModel) {
        console.warn(`[RuntimeDriver] Anchor model "${widget.anchorModelId}" not found for "${widget.widgetId}"`);
        continue;
      }

      const anchorName =
        (anchorModel as { getAnchorBoneName?: (key: string) => string | undefined })
          .getAnchorBoneName?.(widget.anchorKey) ?? widget.anchorKey;
      if (!anchorName) {
        console.warn(`[RuntimeDriver] Anchor key "${widget.anchorKey}" not resolved for "${widget.widgetId}"`);
        continue;
      }

      const anchorNode =
        (anchorModel as { findBoneNode?: (name: string) => unknown })
          .findBoneNode?.(anchorName) as { add?: (obj: unknown) => void } | undefined;
      if (!anchorNode || typeof anchorNode.add !== 'function') {
        console.warn(`[RuntimeDriver] Anchor bone "${anchorName}" not found for "${widget.widgetId}"`);
        continue;
      }

      const obj =
        (widget as unknown as { getObject3D?: () => unknown; object3D?: unknown; group?: unknown })
          .getObject3D?.() ??
        (widget as unknown as { object3D?: unknown }).object3D ??
        (widget as unknown as { group?: unknown }).group;
      if (!obj) {
        console.warn(`[RuntimeDriver] Contained model "${widget.widgetId}" has no Object3D to attach`);
        continue;
      }

      anchorNode.add(obj);
    }
  }

  setSceneTrack(track: SceneTrack): void {
    this.sampler = createSceneTrackSampler(track);
    this.track = track;
  }

  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds?: number }): void {
    const { deltaSeconds, globalProgress, wallTimeSeconds = 0 } = options;
    this.wallTimeSeconds = wallTimeSeconds;

    if (!this.threeScene || !this.sampler) return;

    // Step 1: Tick all animation controllers in priority order
    const animCtx = {
      deltaSeconds,
      wallTimeSeconds,
      scene: this.threeScene,
      variables: this.variableStore,
      tick: this.currentTick,
      track: this.track,
    };
    for (const controller of this.animationControllers) {
      try {
        controller.onTick(animCtx);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.onError?.(err);
      }
    }

    // Step 2: Sample scene track
    const tick = this.sampler.sample(globalProgress);
    this.currentTick = tick;

    // Step 3: Apply all renderable widgets
    const renderCtx = {
      deltaSeconds,
      globalProgress,
      wallTimeSeconds,
      variables: this.variableStore,
      extra: undefined as unknown,
      tick,
    };
    for (const renderable of this.renderables) {
      try {
        // Functional transitions take priority: evaluate closure at blockProgress.
        // Falls back to pre-baked discrete state, then widget defaultState.
        const functionalBlock = this.track?.transitionBlocks?.[tick.sceneIndex];
        const functionalWidget = functionalBlock?.widgetFns[renderable.widgetId];
        const state = functionalWidget
          ? functionalWidget.fn(tick.blockProgress)
          : (tick.state.widgets[renderable.widgetId] ??
            this.defaultStateById.get(renderable.widgetId));
        const extra = tick.widgetExtras?.[renderable.widgetId];
        renderable.apply(state as never, { ...renderCtx, extra });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.onError?.(err);
      }
    }
  }

  getBoneWorldPositions(): Map<string, [number, number, number]> {
    const result = new Map<string, [number, number, number]>();
    for (const renderable of this.renderables) {
      // IRenderable may optionally expose getBoneWorldPositions (e.g. ModelWidget).
      const provider = renderable as unknown as {
        getBoneWorldPositions?: () => Map<string, [number, number, number]>;
      };
      if (typeof provider.getBoneWorldPositions === 'function') {
        for (const [key, pos] of provider.getBoneWorldPositions()) {
          result.set(key, pos);
        }
      }
    }
    return result;
  }

  getTargetColors(): Map<string, string> {
    const result = new Map<string, string>();
    for (const renderable of this.renderables) {
      const provider = renderable as unknown as {
        getTargetColors?: () => Map<string, string>;
      };
      if (typeof provider.getTargetColors === 'function') {
        for (const [key, color] of provider.getTargetColors()) {
          result.set(key, color);
        }
      }
    }
    return result;
  }

  getCurrentTick(): SceneTrackTick | null {
    return this.currentTick;
  }

  getWallTimeSeconds(): number {
    return this.wallTimeSeconds;
  }

  dispose(): void {
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
