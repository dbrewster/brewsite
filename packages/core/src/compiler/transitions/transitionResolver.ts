// Runtime factory for TransitionContext — builds per-channel normalized progress from block progress.
// Called by sceneTrackCompiler to wrap FunctionalTransitionSpec closures with window/ease resolution.

import { clamp01 } from './transitionTypes';
import type { CompiledTransitionGroup, EaseFn, TransitionContext, TransitionPhase } from './transitionTypes';

/**
 * Normalizes blockProgress (bp) within a [start, end] window, then applies an optional easing fn.
 * Returns a value in [0, 1].
 *
 * - If start === end, returns 1 (degenerate window = instant transition).
 * - bp outside the window is clamped: bp < start → 0, bp > end → 1.
 */
const resolveProgress = (bp: number, phase: TransitionPhase | undefined, fallback: [number, number]): number => {
  const window = phase?.window ?? fallback;
  const [wStart, wEnd] = window;
  const raw = wStart >= wEnd ? 1 : clamp01((bp - wStart) / (wEnd - wStart));
  return phase?.ease ? phase.ease(raw) : raw;
};

/**
 * Creates a minimal TransitionContext from a scalar progress value.
 * Used by ElementTransitionSpec implementations that delegate internally to
 * FunctionalTransitionSpec closures for code reuse (e.g., camera's discrete spec).
 * channel() always returns the same scalar t — no per-channel windowing.
 *
 * @deprecated Used only by ElementTransitionSpec delegates. Prefer FunctionalTransitionSpec
 * closures which receive a proper TransitionContext from the compiler's makeResolver.
 */
export function makeSimpleContext(t: number): TransitionContext {
  return {
    t,
    bp: t,
    channel: () => t,
  };
}

/**
 * Builds a TransitionContext for the given block progress, optional compiled groups,
 * fallback window, and phase.
 *
 * @param bp            Raw blockProgress ∈ [0, 1] from the compiled closure wrapper.
 * @param groups        CompiledTransitionGroup[] from state.__transitionGroups, or undefined.
 * @param fallbackWindow Scene-level window for this phase (exit or enter). Ignored for interpolate.
 * @param phase         Which transition phase is active: 'exit' | 'enter' | 'interpolate'.
 *
 * Resolution rules:
 *   1. Default group: first group whose `channels` array is absent or empty.
 *      ctx.t uses the default group's window + ease (or fallbackWindow if absent).
 *   2. Named channel groups: first group that lists the channel name wins.
 *      ctx.channel(name) uses that group's window + ease.
 *   3. If no group claims a channel, ctx.channel(name) falls back to ctx.t.
 *   4. For 'interpolate' phase, window has no meaning (full [0,1] range always).
 *      Only ease is applied.
 */
export function makeResolver(
  bp: number,
  groups: readonly CompiledTransitionGroup[] | undefined,
  fallbackWindow: [number, number],
  phase: 'exit' | 'enter' | 'interpolate',
): TransitionContext {
  // Build channel → group index map (first declaration wins per channel).
  const channelGroupIndex = new Map<string, number>();
  let defaultGroupIndex: number | undefined;

  if (groups) {
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (!group) continue;
      if (!group.channels || group.channels.length === 0) {
        // First group without channels = default group
        if (defaultGroupIndex === undefined) defaultGroupIndex = i;
      } else {
        for (const ch of group.channels) {
          if (!channelGroupIndex.has(ch)) {
            channelGroupIndex.set(ch, i);
          }
        }
      }
    }
  }

  // Compute default t from the default group (or raw fallback for interpolate).
  const defaultGroup = defaultGroupIndex !== undefined ? groups![defaultGroupIndex] : undefined;
  let defaultT: number;

  if (phase === 'interpolate') {
    // Interpolate: t = bp across the full block. The widget's interpolateFn
    // controls how to use t (e.g., diagram's base-flip at t=0.5 for
    // non-interpolated fields). Apply only the default group's ease (if any).
    const ease: EaseFn | undefined = defaultGroup?.interpolate?.ease;
    defaultT = ease ? ease(bp) : bp;
  } else {
    // Exit or enter: normalize bp within the default group's window or fallback.
    const defaultPhase = phase === 'exit' ? defaultGroup?.exit : defaultGroup?.enter;
    defaultT = resolveProgress(bp, defaultPhase, fallbackWindow);
  }

  return {
    t: defaultT,
    bp,
    channel(name: string): number {
      const groupIdx = channelGroupIndex.get(name);
      if (groupIdx === undefined) return defaultT;

      const group = groups![groupIdx];
      if (!group) return defaultT;

      if (phase === 'interpolate') {
        const ease: EaseFn | undefined = group.interpolate?.ease;
        return ease ? ease(bp) : bp;
      }

      const phaseConfig = phase === 'exit' ? group.exit : group.enter;
      return resolveProgress(bp, phaseConfig, fallbackWindow);
    },
  };
}
