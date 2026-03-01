// Compile-only metadata element. Declares per-scene scroll budget and pacing curve.
// Renders null. Registered via NodeHandler; consumed by sceneTrackCompiler aggregation pass.

import type { NodeHandler } from '../sceneDslTypes';
import { registerNode } from '../registry';
import { IDENTITY_FN } from '../../player/SceneProgressMapper';

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
}

/**
 * Declares per-scene scroll weight and input pacing curve.
 * Place inside a <Scene> to control how much of the scroll domain that
 * scene's outgoing transition consumes, and how raw input progress maps
 * to engine progress within that window.
 *
 * Carry-forward semantics: if omitted on a scene, the previous scene's
 * ProgressManager spec is inherited. The ultimate default is
 * { scrollUnits: 1, fn: t => t }, which preserves existing uniform behavior.
 *
 * @example
 * // Long content scene — 3× the scroll budget of a default scene
 * <Scene id="camera-docs">
 *   <ProgressManager
 *     scrollUnits={2400}
 *     fn={(t) => Math.min(1, t * 4)}  // animate in first 25% of scroll, then dwell
 *   />
 *   <Camera type="world" position={[2, 1.5, 6]} />
 * </Scene>
 */
export const ProgressManager = (_props: ProgressManagerProps): null => null;
ProgressManager.displayName = 'ProgressManager';

const progressManagerHandler: NodeHandler = (node, api) => {
  const props = node.props as ProgressManagerProps;
  const scrollUnits = props.scrollUnits !== undefined
    ? Math.max(0.001, props.scrollUnits)
    : 1;
  // Use the canonical IDENTITY_FN reference — not an inline arrow — so that
  // buildProgressProfile's reference-equality check (spec.fn === IDENTITY_FN)
  // correctly identifies this scene as uniform when no fn is declared.
  const fn = props.fn ?? IDENTITY_FN;

  api.state.progressManager = { scrollUnits, fn };
};

registerNode(ProgressManager, progressManagerHandler);
