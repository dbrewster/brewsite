// Core data contracts for the scene compilation pipeline.
// Types here flow compiler → runtime → player with no circular dependencies.

import type { ReactNode } from 'react';
import type { JsonPrimitive } from '../widget/VariableStore';
import type { EasingName } from './transitions/easingFunctions';
export type { EasingName } from './transitions/easingFunctions';

// ─── CompileWarning ───────────────────────────────────────────────────────────

export type CompileWarningCode =
  | 'MISSING_WIDGET'
  | 'DUPLICATE_WIDGET_ID'
  | 'UNRESOLVED_REFERENCE'
  | 'PROGRESS_MANAGER';

export type CompileWarning = {
  code: CompileWarningCode;
  message: string;
  widgetId?: string;
  sceneIndex?: number;
};

// ─── ProgressManager Types ────────────────────────────────────────────────────

/**
 * Per-scene auto-advance configuration. When set, wall-clock time advances
 * rawProgress automatically while the user is idle.
 *
 * Carry-forward semantics: same as ProgressManagerSpec — the last declared
 * spec carries forward to scenes that omit <ProgressManager>. Declare
 * autoAdvance={undefined} to explicitly clear auto-advance.
 */
export type AutoAdvanceSpec = {
  /**
   * Seconds to traverse the scene window from rawStart to rawStart + (max × segmentWidth)
   * while the user is idle. Must be > 0.
   * This is the primary authoring knob: "play this scene in N seconds while idle."
   */
  duration: number;
  /**
   * Fraction of the scene's raw input window where auto-advance stops.
   * Must be in (0, 1]. Default: 1.0 (play through the full window).
   * Set to 0.80 to auto-advance through the first 80%, requiring the user to
   * scroll for the final 20%.
   */
  max: number;
  /**
   * When true, auto-advance pauses while the user is scrolling and resumes
   * after 200ms of scroll inactivity. Default: true.
   */
  pauseOnScroll: boolean;
};

/**
 * Per-scene scroll weight and input pacing curve.
 * Declared via <ProgressManager> DSL component inside <Scene>.
 * Stored on SceneFrame; consumed by the SceneProgressProfile aggregation pass.
 */
export type ProgressManagerSpec = {
  /**
   * Proportional scroll budget for this scene's outgoing transition.
   * Unitless — normalized across all scenes. A scene with scrollUnits={2400}
   * and a neighbor with scrollUnits={400} means the first transition window
   * is 6× wider in raw input space.
   * Must be > 0. Default: 1.
   */
  scrollUnits: number;

  /**
   * Pure curve function mapping raw local input progress [0..1] to
   * engine progress [0..1] within this scene's window.
   *
   * Hard constraints (validated at compile time):
   *   fn(0) === 0
   *   fn(1) === 1
   *   Monotonically non-decreasing (never goes backward)
   *
   * Default: t => t (identity / linear)
   */
  fn: (localT: number) => number;

  /**
   * Auto-advance config. Undefined = no auto-advance for this scene's window.
   * Carry-forward: if a previous scene declared autoAdvance and this scene
   * omits <ProgressManager>, the spec (including autoAdvance) carries forward.
   * Use autoAdvance={undefined} to explicitly clear.
   */
  autoAdvance?: AutoAdvanceSpec;

  /**
   * Total animation-seconds that play when the user scrolls through this scene's
   * full raw input window in one smooth pass. Undefined = no boost (1× real-time always).
   * Recommended range: 2–12. Values > 20 may produce jarring jumps; the
   * MAX_ANIM_BOOST_PER_FRAME cap (0.2s) mitigates programmatic navigation jumps.
   *
   * Formula: effectiveDelta = max(deltaSeconds, min(deltaProgress × animationTimeScale, 0.2))
   */
  animationTimeScale?: number;
};

/**
 * One segment per outgoing transition (N-1 segments for N scenes).
 * Segment i covers the transition from scene i to scene i+1.
 */
export type SceneProgressSegment = {
  /** Source scene index (0-based). */
  sceneIndex: number;

  /** Start of this segment in normalized raw input space [0..1]. */
  rawStart: number;

  /** End of this segment in normalized raw input space [0..1]. */
  rawEnd: number;

  /** Start of this segment in normalized engine progress space [0..1]. */
  engineStart: number;

  /** End of this segment in normalized engine progress space [0..1]. */
  engineEnd: number;

  /**
   * Input pacing curve for this segment.
   * Input: localT in [0..1] (normalized position within rawStart..rawEnd).
   * Output: local engine progress in [0..1] (normalized within engineStart..engineEnd).
   */
  fn: (localT: number) => number;

  /**
   * Pre-computed auto-advance values. Only present when the source scene
   * declared autoAdvance. Pre-computing avoids division in the RAF hot path.
   *
   * rawRate  = (spec.max × segmentWidth) / spec.duration
   * maxRaw   = rawStart + spec.max × segmentWidth
   * segmentWidth = rawEnd - rawStart
   */
  autoAdvance?: {
    /** Pre-computed advance rate in raw-progress per second. */
    rawRate: number;
    /** Pre-computed ceiling: auto-advance stops when getRawProgress() >= maxRaw. */
    maxRaw: number;
    pauseOnScroll: boolean;
  };

  /**
   * Animation time scale factor for this scene.
   * Passed to RuntimeDriverImpl.tick() to boost effectiveDeltaSeconds
   * proportionally to deltaProgress.
   * Undefined = no boost (always 1× real-time).
   */
  animationTimeScale?: number;
};

/**
 * Aggregated scroll-weight profile for a compiled scene track.
 * Attached to SceneTrack only when at least one scene declares a non-default
 * <ProgressManager>. Absent when all scenes are uniform linear (zero overhead).
 */
export type SceneProgressProfile = {
  segments: SceneProgressSegment[];

  /**
   * True when all scrollUnits are equal AND all fn are the identity function.
   * When true, SceneProgressMapper is not instantiated — identity mapping applies.
   * Set to true by the aggregation pass when no <ProgressManager> was declared,
   * or when all declarations are equivalent to the default.
   */
  isUniform: boolean;
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
  /**
   * Easing curve for the transition INTO this scene (from the preceding scene).
   * Declared via `transition={{ easing: '...' }}` on the `<Scene>` DSL element.
   *
   * Scope limitation: this easing only applies to widgets that use
   * FunctionalTransitionSpec. Widgets using ElementTransitionSpec do not read it -
   * those transitions are pre-baked at compile time.
   */
  transitionEasing?: EasingName;
  /**
   * Non-DSL React children collected from <Scene> during compilation.
   * These are HTML elements and non-registered React components that the
   * compiler passed over. They are NOT stored in the tick array — they are
   * rendered by EngineOverlayHost in the player layer when this scene is active.
   */
  sceneOverlay?: ReactNode;
  /**
   * Per-scene scroll weight and pacing curve.
   * Declared via <ProgressManager scrollUnits={N} fn={...} /> inside a <Scene>.
   * Undefined means "not declared on this scene" — the carry-forward pass in
   * buildProgressProfile resolves it.
   */
  progressManager?: ProgressManagerSpec;
};

// ─── SceneFrameDelta ──────────────────────────────────────────────────────────

/**
 * A sparse diff between two SceneFrame states.
 * Fields are only present when the value changed.
 */
export type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
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
  /**
   * Map from sceneId to overlay ReactNode for all scenes that declared
   * non-DSL React children. Built by sceneTrackCompiler from SceneFrame.sceneOverlay.
   *
   * Absent from the SceneTrack cache serialization concern because the cache
   * is in-memory only — Map<string, ReactNode> is safe here.
   *
   * EngineOverlayHost reads this to render the active scene's content.
   */
  sceneOverlays: Map<string, ReactNode>;
  /**
   * Per-scene scroll weights and pacing curves.
   * Undefined when no <ProgressManager> was declared (identity mapping applies,
   * zero overhead). Never undefined when any scene declares a non-default spec.
   */
  progressProfile?: SceneProgressProfile;
};
