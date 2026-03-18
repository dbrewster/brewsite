// Transition type definitions and re-exports for backward compatibility.
import type { SceneTrackTick, TransitionWindow } from '../sceneTrackTypes';

// Compiler transition contract — batch-fill model.
// The compiler calls exactly one method per widget per transition block.
// The widget writes frame.state.widgets[widgetId] for every frame in its slice.

/**
 * Computes the normalized progress scalar for frame i within a slice of length len.
 * Use this inside enter/exit/interpolate loops.
 * Returns 1 when len === 1 (single-frame edge case).
 *
 * @deprecated Used only by ElementTransitionSpec implementations, which are deprecated.
 * Use FunctionalTransitionSpec closures with TransitionContext instead.
 */
export const transitionT = (i: number, len: number): number => (len > 1 ? i / (len - 1) : 1);

/**
 * @deprecated Use FunctionalTransitionSpec instead. ElementTransitionSpec pre-bakes state
 * into SceneTrack ticks at compile time, preventing per-frame window/ease resolution.
 * The compiler will emit a console.warn and fill with absentDefault for any remaining
 * ElementTransitionSpec implementations.
 */
export type ElementTransitionSpec<T> = {
  /**
   * Widget is leaving (present in scene N, absent from scene N+1).
   * frames is the first half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  exit: (frames: SceneTrackTick[], widgetId: string, fromState: T) => void;

  /**
   * Widget is arriving (absent from scene N, present in scene N+1).
   * frames is the second half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  enter: (frames: SceneTrackTick[], widgetId: string, toState: T) => void;

  /**
   * Widget is present in both scenes.
   * frames is the full transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  interpolate: (frames: SceneTrackTick[], widgetId: string, fromState: T, toState: T) => void;
};

// ====================
// Transition Control Types
// ====================

/**
 * A pure easing function that maps t ∈ [0, 1] → [0, 1].
 * Must satisfy f(0) = 0 and f(1) = 1.
 */
export type EaseFn = (t: number) => number;

/**
 * A single transition phase configuration (exit or enter window + easing).
 * The window defines the active sub-range within the block's [0, 1] progress.
 * bp is normalized within the window before easing is applied.
 */
export type TransitionPhase = {
  /** Active sub-window within block progress. bp is clamped to this range then normalized to [0,1]. */
  window?: [number, number];
  /** Easing applied after window normalization. */
  ease?: EaseFn;
};

/**
 * Per-channel transition group compiled from <Transition> DSL children.
 * A group without channels is the "default group" — applies to all channels
 * not claimed by a named group. First default group wins.
 * Named channel groups override the default for their specific properties.
 */
export type CompiledTransitionGroup = {
  /** Channel names this group controls. Absent = default group (applies to all unclaimed channels). */
  channels?: string[];
  /** Exit phase config for this group's channels. */
  exit?: TransitionPhase;
  /** Enter phase config for this group's channels. */
  enter?: TransitionPhase;
  /** Interpolate phase config. Only ease is supported for interpolate (no window). */
  interpolate?: Pick<TransitionPhase, 'ease'>;
};

/**
 * Mixin added to compiled widget state when <Transition> DSL children are present.
 * Contains EaseFn closures — not structuredClone-safe; must be stripped before cloning.
 */
export type WithTransitionConfig = {
  __transitionGroups?: CompiledTransitionGroup[];
};

/**
 * Runtime context passed to FunctionalTransitionSpec closures.
 * Provides per-channel normalized progress and the raw block progress.
 *
 * ctx.t  — normalized progress for the default group (window + ease applied).
 *           Equivalent to the old scalar t parameter.
 * ctx.bp — raw blockProgress ∈ [0, 1] before any window normalization.
 * ctx.channel(name) — normalized progress for the named channel's group.
 *                     Falls back to ctx.t if no group claims this channel.
 */
export interface TransitionContext {
  /** Default normalized progress, [0,1]. Derived from the default group's window + ease. */
  readonly t: number;
  /** Raw block progress, [0,1], as passed by the compiler wrapper. */
  readonly bp: number;
  /**
   * Returns normalized progress for a named property channel.
   * Uses the CompiledTransitionGroup that claims this channel name.
   * Falls back to ctx.t if no group claims this channel.
   */
  channel(name: string): number;
}

/**
 * Functional transition spec — closure-based alternative to ElementTransitionSpec.
 *
 * The compiler calls these once at compile time with the known endpoint states,
 * capturing them into closures. Each closure is stored in SceneTrack.transitionBlocks
 * and evaluated by the runtime at tick.blockProgress each frame.
 *
 * TransitionContext semantics (analogous to the old scalar t):
 *   exitFn:        ctx.t = 0 → widget at fromState.  ctx.t = 1 → widget fully absent.
 *   enterFn:       ctx.t = 0 → widget fully absent.  ctx.t = 1 → widget at toState.
 *   interpolateFn: ctx.t = 0 → widget at fromState.  ctx.t = 1 → widget at toState.
 *
 * Window/ease semantics are handled by makeResolver in transitionResolver.ts.
 * Widget authors write closures that expect ctx.t ∈ [0, 1] only.
 * Use ctx.channel('channelName') for per-property control when <Transition> children are present.
 */
export type FunctionalTransitionSpec<T> = {
  /**
   * Widget is leaving (present in scene N, absent from N+1).
   * Called once with fromState. Returns a closure accepting TransitionContext.
   * Active over the exit window of the block.
   */
  exitFn: (fromState: T) => (ctx: TransitionContext) => T;

  /**
   * Widget is arriving (absent from scene N, present in scene N+1).
   * Called once with toState. Returns a closure accepting TransitionContext.
   * Active over the enter window of the block.
   */
  enterFn: (toState: T) => (ctx: TransitionContext) => T;

  /**
   * Widget present in both scenes.
   * Called once with (fromState, toState). Returns a closure accepting TransitionContext.
   * Active over the full block (blockProgress ∈ [0, 1]).
   */
  interpolateFn: (fromState: T, toState: T) => (ctx: TransitionContext) => T;

  /**
   * Optional default window spec for this widget type.
   * Overridden by scene-level transition config on <Scene transition={...}>.
   * When absent, compiler-level system defaults apply.
   */
  defaultWindow?: TransitionWindow;
};

/**
 * Type guard: returns true if spec is a FunctionalTransitionSpec.
 * Used by the compiler to branch between discrete fill and closure capture.
 *
 * @deprecated Will be removed when ElementTransitionSpec is deleted.
 * All specs should be FunctionalTransitionSpec.
 */
export const isFunctionalSpec = <T>(
  spec: ElementTransitionSpec<T> | FunctionalTransitionSpec<T>,
): spec is FunctionalTransitionSpec<T> => 'interpolateFn' in spec;

// ====================
// Math Utilities — re-exported from canonical math module
// ====================

export { clamp01, lerp, lerpVec3 } from '../../math';

// ====================
// Blend Helpers — re-exported from transitionBlendHelpers for backward compatibility
// ====================

export {
  blendNumber,
  blendDistance,
  blendOpacity,
  blendVec3,
  blendColor,
  blendAxisRotation,
  blendAxisTranslation,
  mergeCssOpacity,
  blendStyleValues,
  blendStyleValuesPartial,
  resolveTransitionOpacity,
  resolveEnabledByOpacity,
  blendMaterialApplication,
} from './transitionBlendHelpers';
