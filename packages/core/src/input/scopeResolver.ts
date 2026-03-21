// Resolves scope to DOM targets.

import type { InputControllerScope } from './types';

/** Resolved DOM targets for pointer and keyboard event listeners. */
export type ResolvedTargets = {
  pointerTarget: HTMLElement | Window;
  keyboardTarget: HTMLElement | Document;
};

/**
 * Resolves the input controller scope to concrete DOM elements.
 *
 * 'canvas': pointer events on canvasContainer, keyboard on stageContainer (focus-gated).
 * 'window': pointer events on window, keyboard on document.
 */
export function resolveInputTargets(
  scope: InputControllerScope,
  canvasContainer: HTMLElement | null,
  stageContainer: HTMLElement | null,
): ResolvedTargets {
  if (scope === 'window') {
    return {
      pointerTarget: window,
      keyboardTarget: document,
    };
  }

  // scope === 'canvas' (default)
  // Prefer stageContainer for keyboard events (focus-gated scroll stage),
  // then canvasContainer (multi-engine: each canvas receives its own keyboard
  // events when focused), then document as last resort.
  return {
    pointerTarget: canvasContainer ?? window,
    keyboardTarget: stageContainer ?? canvasContainer ?? document,
  };
}
