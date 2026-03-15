// Public exports for the input module.

export type {
  KeyCombo,
  ModifierKey,
  MouseButton,
  SceneInputControllerSpec,
  InputControllerScope,
  InputActionType,
  InputActionSpec,
  InputActionMap,
  InputPointerMap,
  InputWheelMap,
  InputPinchMap,
  InputKeyMap,
  ActionInputHandler,
} from './types';

export type {
  ActionFiredListener,
  ActionFiredDetail,
  ActionInputControllerOptions,
} from './ActionInputController';

export { ActionInputController } from './ActionInputController';

export {
  createDefaultInputSpec,
  DEFAULT_INPUT_CONTROLLER_ID,
  PRIMARY_CAROUSEL_SENTINEL,
} from './defaultInputSpec';
export type { DefaultInputSpecOptions } from './defaultInputSpec';

export {
  detectPlatform,
  formatModifier,
  formatKey,
  formatKeyCombo,
  formatInputMap,
} from './platformKeys';
export type { Platform } from './platformKeys';

export type { TransitionEasing } from './transitionAnimator';
