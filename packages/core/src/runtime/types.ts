// Runtime types — interfaces used by the generic widget-based runtime layer.
// Only types that are consumed outside the mocks/ directory live here.

import type { PerspectiveCamera, Scene as ThreeScene, WebGLRenderer } from 'three';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import type { RenderContribution, RuntimeCameraOverride } from '../widget/types';

// ─── RealtimeClock ────────────────────────────────────────────────────────────

/**
 * Synchronized real-time clock. Identical values reach every widget every frame.
 * wallTimeSeconds is derived from performance.now() once per frame at the top of
 * RuntimeLoop.runStep() — it never drifts or backlogs after tab hide/show.
 *
 * NEVER use a private `this.localTime += deltaSeconds` accumulator inside a widget.
 * It drifts between widgets (different start times) and backlogs when a hidden tab
 * becomes visible. Use clock.wallTimeSeconds for phase-coherent oscillations.
 */
export type RealtimeClock = {
  /**
   * Absolute seconds since page load (performance.now() / 1000).
   * Use for: ambient oscillations, procedural animations, phase offsets.
   * Example: Math.sin(clock.wallTimeSeconds * Math.PI * 2 * 0.5) → 0.5 Hz oscillation
   */
  wallTimeSeconds: number;
  /**
   * Real-time elapsed since last frame (~0.0167s at 60fps).
   * Unaffected by scroll, effectiveDeltaSeconds, or animationTimeScale.
   * Use for: physics integration, particle simulation, smooth increment-based effects.
   */
  deltaSeconds: number;
};

// ─── Vec3 ─────────────────────────────────────────────────────────────────────

import type { Vec3 } from '../math';
export type { Vec3 } from '../math';

// ─── Scene-Graph Node ─────────────────────────────────────────────────────────

/**
 * A node in the runtime scene graph.
 * Consumed by pose utilities in src/math/pose.ts.
 * In the Three.js layer this is backed by THREE.Object3D.
 */
export type Node = {
  readonly name: string;
  parent?: Node;
  children: Node[];
  localPosition: Vec3;
  localRotation: Vec3;
  localScale: Vec3;
  readonly worldPosition: Vec3;
  readonly worldRotation: Vec3;
  readonly worldScale: Vec3;
  readonly components?: Array<{ type: string; props: Record<string, unknown> }>;
  readonly matrixWorld?: number[];
  add(child: Node): void;
  remove(child: Node): void;
};

// ─── Pose Snapshot ────────────────────────────────────────────────────────────

export type PoseSnapshot = { position: Vec3; rotation: Vec3; scale: Vec3 };
export type PoseSnapshotMap = Map<string, PoseSnapshot>;

// ─── Animation Track ──────────────────────────────────────────────────────────

/**
 * A single GLTF animation track.
 * Consumed by @brewsite/model's animationTrackMapping.ts.
 *
 * Exported from @brewsite/core public barrel via src/index.ts.
 */
export type AnimationTrack = {
  targetName: string;
  property: 'position' | 'rotation' | 'scale' | 'component';
  componentType?: string;
  componentKey?: string;
  keyframes: Array<{ t: number; value: number | number[] }>;
};

// ─── Generic Runtime Driver Interface ─────────────────────────────────────────

/**
 * Minimal contract for the generic, widget-based runtime driver.
 * Contains only the methods needed by the engine layer and RuntimeLoop.
 * Model-specific concepts live inside widget implementations (IAttachmentHost,
 * IRenderContributor, etc.) — not on this interface.
 */
export type RuntimeDriver = {
  /** True once all ILoadable widgets have resolved their load() promises. */
  assetsReady: boolean;

  /** Update assetsReady and notify any waiting subscribers. */
  setAssetsReady(ready: boolean): void;

  /** Install a compiled SceneTrack so the driver can sample it each tick. */
  setSceneTrack(track: SceneTrack): void;

  /**
   * Initialize the runtime with the Three.js scene and optional camera/renderer.
   * Synchronously initializes all IRenderable widgets and resolves ICameraFocusTarget.
   * Asset loading is started internally as a fire-and-forget operation.
   */
  initialize(scene: ThreeScene, camera?: PerspectiveCamera, renderer?: WebGLRenderer): void;

  /** Set or clear the active camera override. Called by useSceneEngine. */
  setCameraOverride(override: RuntimeCameraOverride | null): void;

  /** Advance the runtime by one frame. */
  tick(options: {
    deltaSeconds: number;
    globalProgress: number;
    /**
     * Non-negative forward progress delta this frame.
     * Computed by RuntimeLoop as Math.max(0, currentGlobalProgress - prevGlobalProgress).
     * Zero on the first frame, zero on backward navigation.
     * Used by RuntimeDriverImpl to compute effectiveDeltaSeconds via animationTimeScale.
     */
    deltaProgress: number;
    wallTimeSeconds?: number;
  }): void;

  /**
   * Collects named world positions and target colors from all IRenderContributor
   * widgets registered in this driver. Called once per render frame.
   */
  collectRenderContributions(): RenderContribution;

  /** Returns the SceneTrackTick sampled during the most recent tick(). */
  getCurrentTick(): SceneTrackTick | null;

  /** Returns cumulative wall-clock time at the end of the last tick(). */
  getWallTimeSeconds(): number;

  /**
   * Resolves a widget's state through the full priority chain:
   * widgetStatePatches → functional closure → pre-baked discrete state.
   *
   * Use this instead of reading tick.state.widgets directly when the widget
   * may have a FunctionalTransitionSpec (whose state is absent from
   * tick.state.widgets during transition blocks).
   */
  resolveWidgetState(widgetId: string, tick: SceneTrackTick | null): unknown;

  /**
   * Scene-to-widget membership mapping. Populated after setSceneTrack().
   * Used by the player layer and useSceneLoadState() hook.
   * Null when no SceneTrack has been set.
   */
  readonly sceneMembership: SceneMembership | null;

  /** Dispose all widget resources and release internal state. */
  dispose(): void;
};

// ─── Scene Load Policy ───────────────────────────────────────────────────────

/**
 * Controls when widget assets are loaded relative to scene navigation.
 *
 * When omitted from SceneEngine, all ILoadable widgets load upfront
 * (backward-compatible default).
 *
 * When provided, assets are partitioned by scene membership:
 * - `eager` scenes load immediately after setSceneTrack() (blocking assetsReady).
 * - `preloadAhead` scenes load in the background on navigation.
 *
 * Phase 1: assets are loaded but never unloaded. Memory grows monotonically.
 */
export type SceneLoadPolicy = {
  /**
   * Scene indices to load eagerly after compilation.
   * These block assetsReady — the engine won't tick until they're loaded.
   * Default: [0] (first scene only).
   */
  eager?: number[];

  /**
   * How many scenes ahead of the current scene to preload.
   * Preloading is non-blocking — it happens in the background.
   * Default: 1.
   */
  preloadAhead?: number;
};

// ─── Scene Membership ────────────────────────────────────────────────────────

/**
 * Maps scene indices to the set of widget IDs that appear in each scene.
 * Produced as a side-output of compileSceneTrack() and consumed by
 * RuntimeDriverImpl for partitioned asset loading.
 *
 * Widget "appearance" means the widget has non-default state in that scene's
 * compiled SceneFrame — i.e., the scene's DSL references that widget.
 */
export type SceneMembership = Map<number, Set<string>>;
