// Core data contracts for the scene compilation pipeline.
// Types here flow compiler → runtime → player with no circular dependencies.

import type { HudItemDefinition, HudItemResolved } from '../hud/types';
import type { LabelResolved } from '../labels/types';
import type { JsonPrimitive } from '../widget/VariableStore';

// Re-export for consumers that import from here for convenience
export type { LabelResolved } from '../labels/types';
export type { HudItemResolved } from '../hud/types';

// ─── ClipMeta ─────────────────────────────────────────────────────────────────

/** Metadata about a single animation clip, used in CompileExtraContext. */
export type ClipMeta = {
  name: string;
  duration: number;
  clipStart?: number;
  clipEnd?: number;
};

// ─── SceneFrame ───────────────────────────────────────────────────────────────

/**
 * The declared state of a scene at a single point in time.
 * Produced by the DSL compiler. Consumed by the track compiler to bake SceneTrackTick[].
 */
export type SceneFrame = {
  id: string;
  scrollProgress: number;
  widgets: Record<string, unknown>;
  meta?: Record<string, JsonPrimitive>;
  /** HUD overlay items authored for this scene. Compiled to hudPrimitives per tick. */
  hudItems?: HudItemDefinition[];
  /** Label definitions authored for this scene. Compiled to labelPrimitives per tick. */
  labels?: LabelResolved[];
};

// ─── SceneFrameDelta ──────────────────────────────────────────────────────────

/**
 * A sparse diff between two SceneFrame states.
 * Fields are only present when the value changed.
 */
export type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  hudItems?: HudItemDefinition[];
  labels?: SceneFrame['labels'];
};

// ─── SceneWindow ─────────────────────────────────────────────────────────────

export type SceneWindow = {
  id: string;
  index: number;
  start: number;
  end: number;
};

// ─── SceneTrackTick ───────────────────────────────────────────────────────────

/**
 * A single pre-baked frame in the scene track. Indexed for O(1) sampling.
 * Produced by sceneTrackCompiler. Consumed by RuntimeDriver and ScenePlayer.
 */
export type SceneTrackTick = {
  index: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  blockProgress: number;
  state: SceneFrame;
  /** Resolved HUD items for this tick. Rendered by HudOverlay in ScenePlayer. */
  hudPrimitives?: HudItemResolved[];
  /** Resolved labels for this tick. Positioned by LabelPositioner in render loop. */
  labelPrimitives?: LabelResolved[];
  deltaForward: SceneFrameDelta;
  deltaBackward: SceneFrameDelta;
  widgetExtras?: Record<string, unknown>;
};

// ─── SceneTrack ───────────────────────────────────────────────────────────────

export type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
};
