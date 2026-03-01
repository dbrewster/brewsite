// Compile-only metadata element. Declares per-scene scroll budget, pacing curve,
// auto-advance configuration, and animation time scale.
// Renders null. Registered via NodeHandler; consumed by sceneTrackCompiler aggregation pass.

import type { NodeHandler } from '../sceneDslTypes';
import { IDENTITY_FN } from '../../player/SceneProgressMapper';
import type { ProgressManagerSpec } from '../sceneTrackTypes';

export interface ProgressManagerProps {
  /**
   * Proportional scroll budget for this scene's outgoing transition.
   * Unitless — proportional across all scenes.
   * Must be > 0. Default: 1.
   */
  scrollUnits?: number;

  /**
   * Pure input pacing curve. Maps local raw input progress [0..1] to
   * local engine progress [0..1] within this scene's window.
   *
   * Constraints (compile-time validated):
   *   fn(0) === 0, fn(1) === 1, monotonically non-decreasing
   *
   * Default: t => t
   */
  fn?: (localT: number) => number;

  /**
   * Auto-advance configuration. When set, wall-clock time advances this scene's
   * outgoing transition progress automatically while the user is idle.
   *
   * Carry-forward semantics: auto-advance is part of the full ProgressManagerSpec
   * and carries forward to scenes that omit <ProgressManager>. Declare
   * autoAdvance={undefined} to explicitly clear auto-advance.
   *
   * @example
   * // Auto-advances through 80% of the scene window in 8 seconds while idle
   * autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
   */
  autoAdvance?: {
    /** Seconds to traverse the scene window from 0 to max while idle. Required. Must be > 0. */
    duration: number;
    /** Fraction of scene window to auto-advance through. Default: 1.0. Must be in (0, 1]. */
    max?: number;
    /** Pause while user scrolls; resume after 200ms idle. Default: true. */
    pauseOnScroll?: boolean;
  };

  /**
   * Animation time scale factor. Total animation-seconds that play when the user
   * scrolls through this scene's full raw input window in one smooth pass.
   * Animations run at 1× real-time when idle regardless of this value.
   * Undefined = no boost (always 1× real-time). Recommended range: 2–12.
   */
  animationTimeScale?: number;
}

/**
 * Declares per-scene scroll weight, input pacing curve, auto-advance configuration,
 * and animation time scale.
 *
 * Place inside a <Scene> to control how much of the scroll domain that
 * scene's outgoing transition consumes, how raw input progress maps
 * to engine progress within that window, and whether the scene auto-advances
 * while the user is idle.
 *
 * Carry-forward semantics: if omitted on a scene, the previous scene's
 * ProgressManager spec is inherited. The ultimate default is
 * { scrollUnits: 1, fn: t => t }, which preserves existing uniform behavior.
 *
 * @example
 * // Auto-advancing hero scene with animation boost on scroll
 * <Scene id="website-hero-00">
 *   <ProgressManager
 *     scrollUnits={1800}
 *     autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
 *     animationTimeScale={3}
 *   />
 * </Scene>
 */
export const ProgressManager = (_props: ProgressManagerProps): null => null;
ProgressManager.displayName = 'ProgressManager';

export const progressManagerHandler: NodeHandler = (node, api) => {
  const props = node.props as ProgressManagerProps;
  const scrollUnits = props.scrollUnits !== undefined
    ? Math.max(0.001, props.scrollUnits)
    : 1;
  // Use the canonical IDENTITY_FN reference — not an inline arrow — so that
  // buildProgressProfile's reference-equality check (spec.fn === IDENTITY_FN)
  // correctly identifies this scene as uniform when no fn is declared.
  const fn = props.fn ?? IDENTITY_FN;

  const spec: ProgressManagerSpec = { scrollUnits, fn };

  if (props.autoAdvance !== undefined) {
    spec.autoAdvance = {
      duration: props.autoAdvance.duration,
      max: props.autoAdvance.max ?? 1.0,
      pauseOnScroll: props.autoAdvance.pauseOnScroll ?? true,
    };
  }

  if (props.animationTimeScale !== undefined) {
    spec.animationTimeScale = props.animationTimeScale;
  }

  api.state.progressManager = spec;
};

// NOTE: registerNode() is NOT called here at module scope.
// Handler registration is done explicitly by registerCoreHandlers() in
// packages/core/src/compiler/coreHandlers.ts.
// This allows tree-shaking and prevents accidental double-registration.
