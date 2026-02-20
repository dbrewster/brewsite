// Runtime types — interfaces used by the generic widget-based runtime layer.
// Only types that are consumed outside the mocks/ directory live here.

import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';

// ─── Vec3 ─────────────────────────────────────────────────────────────────────

/** Three-component vector: [x, y, z]. */
export type Vec3 = [number, number, number];

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
 * A single GLTF animation track, consumed by
 * src/elements/model/animationTrackMapping.ts.
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
 * Robot/model-specific concepts live inside widget implementations.
 */
export type RuntimeDriver = {
  /** True once all ILoadable widgets have resolved their load() promises. */
  assetsReady: boolean;

  /** Update assetsReady and notify any waiting subscribers. */
  setAssetsReady(ready: boolean): void;

  /** Install a compiled SceneTrack so the driver can sample it each tick. */
  setSceneTrack(track: SceneTrack): void;

  /** Advance the runtime by one frame. */
  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds?: number }): void;

  /**
   * Returns bone/node world positions contributed by IRenderable widgets.
   * Used by the annotation positioner to project 3-D targets to screen space.
   */
  getBoneWorldPositions(): Map<string, [number, number, number]>;

  /** Returns the SceneTrackTick sampled during the most recent tick(). */
  getCurrentTick(): SceneTrackTick | null;

  /** Returns cumulative wall-clock time at the end of the last tick(). */
  getWallTimeSeconds(): number;

  /** Dispose all widget resources and release internal state. */
  dispose(): void;
};
