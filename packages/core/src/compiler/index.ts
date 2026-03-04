// DSL authoring surface — the only things scene authors need to import.
// Infrastructure types (SceneTrack, compileSceneTrack, cache functions) are
// imported directly from their source files by the engine/player layer.

export { Scene, resolveSceneFromDsl } from './sceneDslCompiler';
export type { SceneSnapshotContext } from './sceneTypes';
export type { CompileApi, CompileHelpers, NodeHandler } from './sceneDslTypes';
export { ProgressManager } from './primitives/progressManager';
export type { ProgressManagerProps } from './primitives/progressManager';
export { InputController, Action, PointerMap, WheelMap, PinchMap, KeyMap } from './blocks/inputController';
export type {
  InputControllerProps,
  ActionProps,
  PointerMapProps,
  WheelMapProps,
  PinchMapProps,
  KeyMapProps,
} from './blocks/inputController';
export { Transition } from './blocks/transition';
export type { TransitionProps } from './blocks/transition';
export { registerNode } from './registry';

// Transition control types — used in FunctionalTransitionSpec closures and DSL authoring.
export type {
  EaseFn,
  TransitionContext,
  CompiledTransitionGroup,
  WithTransitionConfig,
  TransitionPhase,
} from './transitions/transitionTypes';

// TransitionWindow lives in sceneTrackTypes (shared with SceneFrame.transitionWindow).
export type { TransitionWindow } from './sceneTrackTypes';

// makeResolver + makeSimpleContext — resolver for FunctionalTransitionSpec closures.
// makeResolver: full window/ease resolution from CompiledTransitionGroup[].
// makeSimpleContext: minimal context from scalar t (for ElementTransitionSpec delegates).
export { makeResolver, makeSimpleContext } from './transitions/transitionResolver';

// Named transition types, resolver function, and easing functions for scene authoring.
export type { TransitionName, SceneTransitionProp } from './transitions/transitionPresets';
export { resolveSceneTransition } from './transitions/transitionPresets';
export {
  easeLinear,
  easeOutCubic,
  easeOutExpo,
  easeInOutSine,
  easeInOutCubic,
  easeInSquared,
  easeOutQuart,
} from './transitions/transitionPresets';
