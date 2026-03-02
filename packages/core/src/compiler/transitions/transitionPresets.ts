// Named transition window presets and easing functions for scene authoring.
// Replaces the old EasingName string enum with first-class EaseFn constants.

import type { EaseFn } from './transitionTypes';
import type { TransitionWindow } from '../sceneTrackTypes';

// ====================
// Window Presets
// ====================

/**
 * Standard crossfade: exit finishes at block midpoint, enter starts at block midpoint.
 * This matches the historical default [0, 0.5] / [0.5, 1] split.
 */
export const TRANSITION_CROSSFADE: TransitionWindow = { exit: [0, 0.5], enter: [0.5, 1] };

/**
 * Default window — lets each widget's `defaultWindow` (or the system default) apply.
 * Equivalent to omitting the `transition` prop on <Scene>.
 */
export const TRANSITION_DEFAULT: TransitionWindow = {};

/**
 * Sequential: exit completes before enter begins, with a small gap.
 * Exit: [0, 0.4], Enter: [0.6, 1.0] — 20% gap at the center.
 */
export const TRANSITION_SEQUENTIAL: TransitionWindow = { exit: [0, 0.4], enter: [0.6, 1] };

/**
 * Exit-first: exit completes before the enter begins, overlapping near the center.
 * Exit: [0, 0.6], Enter: [0.4, 1.0] — outgoing scene finishes slightly before enter starts.
 */
export const TRANSITION_EXIT_FIRST: TransitionWindow = { exit: [0, 0.6], enter: [0.4, 1] };

/**
 * Instant cut: exit at bp=0, enter at bp=1 — no blending, pure cut.
 * The window collapses to a point so degenerate math returns 1 immediately.
 */
export const TRANSITION_CUT: TransitionWindow = { exit: [0, 0], enter: [1, 1] };

// ====================
// Easing Functions
// ====================

/**
 * Linear easing: constant rate. f(t) = t.
 */
export const easeLinear: EaseFn = (t) => t;

/**
 * Ease-out cubic: fast start, smooth deceleration. f(t) = 1 - (1-t)³.
 */
export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Ease-out expo: exponential deceleration; sharp snap to rest. f(t) = 1 - 2^(-10t).
 */
export const easeOutExpo: EaseFn = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Ease-in-out sine: sinusoidal symmetric acceleration/deceleration.
 */
export const easeInOutSine: EaseFn = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * Ease-in-out cubic: cubic symmetric in/out curve.
 */
export const easeInOutCubic: EaseFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Ease-in squared: starts slow, accelerates. f(t) = t².
 */
export const easeInSquared: EaseFn = (t) => t * t;

/**
 * Ease-out quart: smooth quartic deceleration. f(t) = 1 - (1-t)⁴.
 */
export const easeOutQuart: EaseFn = (t) => 1 - Math.pow(1 - t, 4);
