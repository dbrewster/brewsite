// Core data contracts for the scene compilation pipeline.
// Types here flow compiler → runtime → player with no circular dependencies.

import type { JsonPrimitive } from '../widget/VariableStore';

/**
 * Per-scene transition window configuration.
 * exit — sub-window within block progress [0,1] where the outgoing scene fades out.
 * enter — sub-window within block progress [0,1] where the incoming scene fades in.
 * When absent, each widget's defaultWindow (or the system default [0,0.5]/[0.5,1]) applies.
 */
export type TransitionWindow = {
  exit?: [number, number];
  enter?: [number, number];
};

// ─── CompileWarning ───────────────────────────────────────────────────────────

export type CompileWarningCode =
  | 'MISSING_WIDGET'
  | 'DUPLICATE_WIDGET_ID'
  | 'UNRESOLVED_REFERENCE'
  | 'PROGRESS_MANAGER'
  | 'TRANSITION_TIMING';

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
   * When true, any user scroll on the current scene permanently disables
   * auto-advance for the remainder of that scene. It resets on scene transition.
   * Default: true.
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
   * runtime maxAnimBoostPerFrame cap (default 0.2s) mitigates large jumps.
   *
   * Formula: effectiveDelta = max(deltaSeconds, min(deltaProgress × animationTimeScale, maxAnimBoostPerFrame))
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

  /**
   * Sum of scrollUnits across all N scenes (including the last scene).
   *
   * Used by the player to compute `scrollRegionHeightPx` when `pixelsPerScene` is set:
   *   scrollRegionHeightPx = pixelsPerScene × totalScrollUnits
   *
   * This makes `pixelsPerScene={1}` mean "one pixel per scrollUnit", so that
   * SCENE_SCROLL_OFFSETS (cumulative scrollUnits per scene) align with pixel
   * scroll positions. The last scene's scrollUnits are included to provide
   * natural "scroll-through" space for the final scene even though it has no
   * outgoing transition.
   */
  totalScrollUnits: number;
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
   * Transition window configuration governing THIS scene's fade behavior in both directions.
   * Set by the <Scene> node handler via resolveSceneTransition(props.transition, props.exitStart).
   * Always a concrete TransitionWindow by the time it reaches SceneFrame — string names are
   * resolved at compile time; the runtime never sees TransitionName values.
   *
   * exit  — controls when THIS scene fades out (when it is the departing scene in block N→N+1).
   *         Read as fromSnap.transitionWindow.exit during transition block N.
   * enter — controls when THIS scene fades in (when it is the arriving scene in block N-1→N).
   *         Read as toSnap.transitionWindow.enter during transition block N-1.
   *
   * Both fields are set from a single resolveSceneTransition() call on this scene's <Scene> node.
   * For 'dissolve' (the default), the windows are symmetric: exit:[exitStart, mid], enter:[mid, 1.0].
   *
   * IMPORTANT LIMITATION: Only affects widgets using FunctionalTransitionSpec.
   * Widgets using ElementTransitionSpec are pre-baked at compile time using a hardcoded
   * mid = Math.floor(blockSize / 2) split and do NOT read this field.
   * All new renderable elements should use FunctionalTransitionSpec.
   */
  transitionWindow?: TransitionWindow;
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
   * Warnings accumulated during compilation. Empty/undefined when no issues.
   */
  warnings?: CompileWarning[];
  /**
   * Per-scene scroll weights and pacing curves.
   * Undefined when no <ProgressManager> was declared (identity mapping applies,
   * zero overhead). Never undefined when any scene declares a non-default spec.
   */
  progressProfile?: SceneProgressProfile;
};
