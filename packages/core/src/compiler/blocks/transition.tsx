// <Transition> DSL component — declares per-channel timing and easing for a parent element's transition.
// Compiled as a child of renderable DSL elements (Model, ImagePanel, Screen, Diagram, Chart, etc.).
// The parent widget's CUSTOM_NODE_HANDLER collects <Transition> children and compiles them
// into CompiledTransitionGroup[] stored on the widget state as __transitionGroups.

import type { TransitionPhase } from '../transitions/transitionTypes';

/**
 * Props for the <Transition> DSL component.
 *
 * Usage inside a widget DSL element:
 * ```tsx
 * <Model id="hero" src="...">
 *   <Transition
 *     channels={['opacity']}
 *     exit={{ window: [0, 0.3], ease: easeOutCubic }}
 *     enter={{ window: [0.7, 1], ease: easeOutCubic }}
 *   />
 * </Model>
 * ```
 *
 * A <Transition> without `channels` is the "default group" — its config applies to all
 * properties not claimed by a named channel group.
 */
export type TransitionProps = {
  /**
   * Channel names this group controls. Absent or empty = default group (applies to all
   * properties not claimed by another group).
   */
  channels?: string[];
  /** Exit phase config: when/how the widget fades out. */
  exit?: TransitionPhase;
  /** Enter phase config: when/how the widget fades in. */
  enter?: TransitionPhase;
  /** Interpolate phase config. Only easing is supported here (no window for present-both transitions). */
  interpolate?: Pick<TransitionPhase, 'ease'>;
};

/**
 * <Transition> is a compile-only DSL element. It renders nothing at runtime.
 * It is collected by the parent widget's CUSTOM_NODE_HANDLER and compiled into
 * CompiledTransitionGroup[] stored on the widget state as __transitionGroups.
 */
export const Transition = (_props: TransitionProps): null => null;
Transition.displayName = 'Transition';
