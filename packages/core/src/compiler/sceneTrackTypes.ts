// Core data contracts for the scene compilation pipeline.
// Types here flow compiler → runtime → player with no circular dependencies.

import type { HudItemDefinition, HudItemResolved } from '../hud/types';
import type { LabelResolved } from '../labels/types';
import type { JsonPrimitive } from '../widget/VariableStore';
import type { EasingName } from './transitions/easingFunctions';
export type { EasingName } from './transitions/easingFunctions';

// Re-export for consumers that import from here for convenience
export type { LabelResolved } from '../labels/types';
export type { HudItemResolved } from '../hud/types';

// ─── CompileWarning ───────────────────────────────────────────────────────────

export type CompileWarningCode =
  | 'MISSING_WIDGET'
  | 'DUPLICATE_WIDGET_ID'
  | 'UNRESOLVED_REFERENCE';

export type CompileWarning = {
  code: CompileWarningCode;
  message: string;
  widgetId?: string;
  sceneIndex?: number;
};

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
  /**
   * Multiplier applied to base material metalness for all models in this scene.
   */
  materialMetalnessMultiplier?: number;
  /**
   * Multiplier applied to base material roughness for all models in this scene.
   */
  materialRoughnessMultiplier?: number;
  /** HUD overlay items authored for this scene. Compiled to hudPrimitives per tick. */
  hudItems?: HudItemDefinition[];
  /** Label definitions authored for this scene. Compiled to labelPrimitives per tick. */
  labels?: LabelResolved[];
  /**
   * Easing curve for the transition INTO this scene (from the preceding scene).
   * Declared via `transition={{ easing: '...' }}` on the `<Scene>` DSL element.
   *
   * Scope limitation: this easing only applies to widgets that use
   * FunctionalTransitionSpec. Widgets using ElementTransitionSpec do not read it -
   * those transitions are pre-baked at compile time.
   */
  transitionEasing?: EasingName;
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

// ─── Functional Transition Types ──────────────────────────────────────────────

/**
 * A compiled functional transition closure for one widget in one transition block.
 * fn accepts blockProgress ∈ [0, 1] (the same coordinate as SceneTrackTick.blockProgress).
 * Half-block remapping for exit/enter is applied by the compiler before this closure
 * is stored, so the caller (RuntimeDriver) passes blockProgress directly with no
 * additional transformation.
 */
export type FunctionalWidgetTransition = {
  /**
   * Evaluate this widget's state at blockProgress ∈ [0, 1].
   * For exit/enter closures: returns absentDefault when blockProgress is outside
   * the active half-block — the remapping is already baked into this closure.
   * For interpolate closures: maps blockProgress 0→1 to fromState→toState.
   */
  fn: (blockProgress: number) => unknown;
  /** Diagnostic tag — identifies which transition scenario produced this closure. */
  kind: 'exit' | 'enter' | 'interpolate';
};

/**
 * Functional transition overrides for one scene-to-scene transition block.
 * blockIndex N corresponds to the transition from scenes[N] to scenes[N+1].
 * Only present when at least one widget in that block uses FunctionalTransitionSpec.
 */
export type SceneTrackTransitionBlock = {
  blockIndex: number;
  widgetFns: Record<string, FunctionalWidgetTransition>;
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
  /**
   * Functional transition closures, indexed by block index (0 = scene 0→1 transition).
   * Present only when at least one widget uses FunctionalTransitionSpec.
   * Length ≤ numScenes - 1.
   */
  transitionBlocks?: SceneTrackTransitionBlock[];
  /**
   * Per-block easing overrides. Key N = easing name for the transition from
   * scene N to scene N+1, sourced from scene N+1's `transition.easing` prop.
   * Only present when at least one incoming scene declares a transition easing.
   */
  transitionEasings?: Partial<Record<number, EasingName>>;
  /**
   * Warnings accumulated during compilation. Empty/undefined when no issues.
   */
  warnings?: CompileWarning[];
};
