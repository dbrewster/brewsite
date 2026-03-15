// inputHudTypes.ts — Data model for the InputHud overlay (deferred rendering).

import type { InputActionMap } from '../input/types';

/**
 * One displayable action hint in the InputHud.
 * Describes what the user can do and how to trigger it.
 */
export type InputHudHint = {
  /** Action ID from InputActionSpec. */
  actionId: string;
  /** Human-readable action type. */
  actionType: string;
  /** Human-readable input trigger descriptions (one per map). */
  triggers: string[];
  /** The original maps, for custom rendering. */
  maps: InputActionMap[];
};

/**
 * Full InputHud state for one frame.
 * Built from the current SceneInputControllerSpec + platform detection.
 */
export type InputHudState = {
  /** All action hints, sorted by action type for stable ordering. */
  hints: InputHudHint[];
  /** Detected platform (for key label rendering). */
  platform: 'mac' | 'windows' | 'linux' | 'unknown';
};
