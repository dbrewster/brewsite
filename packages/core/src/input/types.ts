// Input system type contracts. No DOM, Three.js, or React imports.

import type { ModifierKey, KeyCombo } from '../elements/camera/types';
export type { ModifierKey, KeyCombo };

/** Mouse button identifier. */
export type MouseButton = 'left' | 'middle' | 'right';

/** Scroll/wheel configuration. */
export type WheelConfig = {
  /**
   * Fraction of total progress to advance per wheel tick (normalized to 100px).
   * Default: 1 / (sceneCount - 1), i.e. one scene per standard wheel tick.
   */
  sensitivity?: number;
  /** Required modifiers (all must be held). Empty array = no modifiers required. */
  modifiers?: ModifierKey[];
};

/** Pointer drag configuration for direct-mode navigation. */
export type DragConfig = {
  button?: MouseButton;
  modifiers?: ModifierKey[];
  /**
   * Pixels of drag required to advance one scene.
   * Default: 200.
   */
  pixelsPerScene?: number;
  axis?: 'x' | 'y'; // default 'y'
};

/** Touch swipe configuration. */
export type SwipeConfig = {
  direction?: 'horizontal' | 'vertical' | 'both'; // default 'vertical'
  /**
   * Minimum velocity (px/ms) to trigger a scene jump.
   * Default: 0.3.
   */
  velocityThreshold?: number;
};

/** Click configuration for scene navigation. */
export type ClickConfig = {
  /** Mouse button to trigger this action. Default 'left'. */
  button?: MouseButton;
  /** Required modifiers (all must be held). */
  modifiers?: ModifierKey[];
  /** Navigation action to perform. */
  action: 'nextScene' | 'prevScene';
  /**
   * Number of scenes to advance. Default 1.
   * For example, 2 advances two scenes per click.
   */
  stepScenes?: number;
  /**
   * Maximum pointer movement (px) between pointerdown and click that still
   * counts as a click. If the pointer moves further than this the click is
   * treated as a drag gesture and navigation is suppressed.
   *
   * This prevents conflicts when camera-controls orbit is bound to the same
   * button: a short tap navigates, a drag orbits.
   *
   * Default: 8 px.
   */
  dragThreshold?: number;
};

/**
 * Named keyboard actions for scene navigation.
 * Each can be assigned a KeyCombo. null = disable.
 */
export type SceneNavKeys = {
  nextScene?: KeyCombo | null;
  prevScene?: KeyCombo | null;
  nextFrame?: KeyCombo | null;
  prevFrame?: KeyCombo | null;
  home?: KeyCombo | null;
  end?: KeyCombo | null;
};

/**
 * Scene navigation input map.
 * All fields are optional; omitting a field disables that input method.
 */
export type SceneNavInputMap = {
  /**
   * 'scroll'  — page-scroll drives progress (current behavior, default).
   * 'direct'  — canvas-local events drive progress; no tall spacer div.
   */
  mode?: 'scroll' | 'direct';

  /**
   * Mouse wheel / trackpad scroll.
   * Set to false to disable. Default: enabled in both modes.
   */
  wheel?: WheelConfig | false;

  /**
   * Pointer drag (direct mode only; ignored in scroll mode).
   * Set to false to disable.
   */
  drag?: DragConfig | false;

  /**
   * Touch swipe (direct mode only).
   * Set to false to disable.
   */
  swipe?: SwipeConfig | false;

  /**
   * Click navigation (direct mode only; ignored in scroll mode).
   * Set to false to disable.
   */
  click?: ClickConfig | ClickConfig[] | false;

  /**
   * Keyboard navigation shortcuts.
   * Set to false to disable all keyboard navigation.
   * Default shortcuts:
   *   nextScene:  ArrowRight / ArrowDown
   *   prevScene:  ArrowLeft / ArrowUp
   *   nextFrame:  Period (.)
   *   prevFrame:  Comma (,)
   *   home:       Home
   *   end:        End
   */
  keys?: SceneNavKeys | false;
};

/** Callback interface the InputController uses to report navigation. */
export type InputNavigationHandler = {
  /** Advance/retreat progress by a fraction (0..1). Negative = backward. */
  onScroll: (delta: number) => void;
  /** Jump directly to a scene by index. */
  onJumpToScene: (sceneIndex: number) => void;
  /** Get current progress (0..1). */
  getProgress: () => number;
  /** Get total number of scenes. */
  getSceneCount: () => number;
};

// ─── Action-based Scene Input Controller (DSL/runtime) ──────────────────────

export type InputControllerScope = 'canvas' | 'window';

export type InputActionType =
  | 'camera.orbit'
  | 'camera.dolly'
  | 'camera.reset'
  | 'canvas.pan'
  | 'diagram-canvas.move'
  | 'diagram-canvas.rotate'
  | 'diagram-canvas.reset'
  | 'diagram-canvas.focus'
  | 'scene.next'
  | 'scene.prev';

export type InputPointerMap = {
  kind: 'pointer';
  event: 'drag' | 'click';
  button?: MouseButton;
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
};

export type InputWheelMap = {
  kind: 'wheel';
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
};

export type InputKeyMap = {
  kind: 'key';
  key: string;
  modifiers?: ModifierKey[];
};

export type InputActionMap = InputPointerMap | InputWheelMap | InputKeyMap;

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
  maps: InputActionMap[];
};

export type SceneInputControllerSpec = {
  id: string;
  scope: InputControllerScope;
  actions: InputActionSpec[];
};
