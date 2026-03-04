// Named transition types, resolver function, and easing functions for scene authoring.

import type { EaseFn } from './transitionTypes';
import type { TransitionWindow } from '../sceneTrackTypes';

// ====================
// Named Transition Types
// ====================

/**
 * Named transition types accepted by the <Scene transition="..."> prop.
 *
 * 'dissolve': Through-black transition. The outgoing scene holds at full opacity until exitStart,
 *             then fades to nothing. The incoming scene fades in symmetrically.
 *             This is the system default.
 *
 * 'crossfade': Equal-blend. Both scenes simultaneously visible across the full transition block.
 *              Outgoing opacity: 1→0, incoming opacity: 0→1. Sum = 1 at every blockProgress.
 *              No double-exposure zone. exitStart is ignored (enforced by TypeScript).
 *
 * FUTURE: 'cut' requires new architecture — zero-tick block or separate compiler path.
 * Not supported in MVP. See note_transition-timing-redesign.md Q4.
 */
export type TransitionName = 'dissolve' | 'crossfade';

/**
 * The value accepted by <Scene transition={...}>.
 * Either a named string (TransitionName) or a raw TransitionWindow escape hatch.
 * When using a raw TransitionWindow, exitStart is not applicable (enforced at TypeScript level
 * via the SceneTransitionProps discriminated union in sceneDslCompiler.ts).
 */
export type SceneTransitionProp = TransitionName | TransitionWindow;

/** Default blockProgress value at which the outgoing scene begins fading. */
const DEFAULT_EXIT_START = 0.8;

/**
 * Resolves a SceneTransitionProp + exitStart to a concrete TransitionWindow.
 * Pure function — no side effects. Called by the <Scene> node handler in sceneDslCompiler.ts.
 * The runtime never calls this function; the resolved window is stored on SceneFrame.transitionWindow.
 *
 * Resolution rules:
 * - undefined or 'dissolve':
 *     exitStart clamped to [0, 0.99] (prevents degenerate window where exitStart >= 1).
 *     mid = (exitStart + 1.0) / 2
 *     → exit: [exitStart, mid], enter: [mid, 1.0]
 *     Example (exitStart=0.8, default): exit:[0.8,0.9], enter:[0.9,1.0]
 *     Example (exitStart=0.9): exit:[0.9,0.95], enter:[0.95,1.0]  ← matches old DISSOLVE_TO_BLACK
 *
 * - 'crossfade':
 *     Equal-blend. exitStart is ignored.
 *     → exit: [0, 1], enter: [0, 1]
 *
 * - TransitionWindow (raw object):
 *     Pass through unchanged. exitStart is not applicable.
 *
 * @param prop      Named type, raw window, or undefined (defaults to 'dissolve').
 * @param exitStart Normalized blockProgress where outgoing scene starts fading. Only for 'dissolve'.
 *                  Default: 0.8. Clamped to [0, 0.99].
 */
export function resolveSceneTransition(
  prop: SceneTransitionProp | undefined,
  exitStart?: number,
): TransitionWindow {
  if (!prop || prop === 'dissolve') {
    const eos = Math.min(Math.max(exitStart ?? DEFAULT_EXIT_START, 0), 0.99);
    const mid = (eos + 1.0) / 2;
    return { exit: [eos, mid], enter: [mid, 1.0] };
  }
  if (prop === 'crossfade') {
    // True equal-blend crossfade: both scenes fade simultaneously across the full block.
    // At any blockProgress bp: outgoing opacity = (1 - bp), incoming opacity = bp.
    // Opacity sums to 1 throughout. No double-exposure zone.
    return { exit: [0, 1], enter: [0, 1] };
  }
  // Raw TransitionWindow escape hatch — pass through unchanged.
  return prop;
}

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
