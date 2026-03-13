// Input system type contracts. No DOM, Three.js, or React imports.

// DEBT: These types should be defined here, not imported from camera element
import type { ModifierKey, KeyCombo } from '../elements/camera/types';
export type { ModifierKey, KeyCombo };

/** Mouse button identifier. */
export type MouseButton = 'left' | 'middle' | 'right';

// ─── Action-based Scene Input Controller (DSL/runtime) ──────────────────────

export type InputControllerScope = 'canvas' | 'window';

/**
 * Core-defined action types for the ActionInputController.
 *
 * `(string & {})` extends the union to accept any string literal, allowing
 * downstream packages (@brewsite/diagram) to define their own action types
 * (e.g. 'diagram-canvas.move') without modifying core.
 *
 * The diagram-canvas.* types that previously lived here have been removed;
 * they are now string literals owned by @brewsite/diagram.
 */
export type InputActionType =
  | 'camera.orbit'
  | 'camera.dolly'
  | 'camera.reset'
  | 'canvas.pan'
  | 'scene.next'
  | 'scene.prev'
  | 'carousel.next'
  | 'carousel.prev'
  | (string & {}); // open union — allows downstream extension

export type InputPointerMap = {
  kind: 'pointer';
  event: 'drag' | 'click';
  button?: MouseButton;
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
  /**
   * Axis lock behavior for drag gestures.
   * 'sticky' chooses the dominant axis early in the drag and locks to it
   * until pointerup.
   */
  lockAxis?: 'sticky' | 'free';
  /**
   * Minimum movement in pixels before sticky axis lock is chosen.
   * Default: 2.
   */
  lockThreshold?: number;
};

export type InputWheelMap = {
  kind: 'wheel';
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
  /**
   * Axis lock behavior for wheel gestures.
   * 'sticky' uses the dominant wheel delta axis for that event.
   */
  lockAxis?: 'sticky' | 'free';
};

export type InputPinchMap = {
  kind: 'pinch';
  direction?: 'in' | 'out' | 'both';
  modifiers?: ModifierKey[];
  /**
   * Minimum pinch distance delta (pixels) needed to dispatch.
   * Default: 1.
   */
  threshold?: number;
};

export type InputKeyMap = {
  kind: 'key';
  key: string;
  modifiers?: ModifierKey[];
};

export type InputActionMap = InputPointerMap | InputWheelMap | InputPinchMap | InputKeyMap;

export type InputActionSpec = {
  id: string;
  type: InputActionType;
  cameraId?: string;
  canvasId?: string;
  /**
   * Optional focus center used by diagram-canvas.focus.
   * Z is ignored by the canvas focus logic; focus operates on X/Y.
   * When provided on the action, it overrides the canvas default focus center.
   */
  focusCenter?: [number, number] | [number, number, number];
  speed?: number;
  stepScenes?: number;
  /** Target ViewLayout ID for carousel actions. Required when type is 'carousel.next'/'carousel.prev'. */
  layoutId?: string;
  /** Number of slides to advance per carousel step. Default: 1. */
  stepSlides?: number;
  maps: InputActionMap[];
};

export type SceneInputControllerSpec = {
  id: string;
  scope: InputControllerScope;
  actions: InputActionSpec[];
};
