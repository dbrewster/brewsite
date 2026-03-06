/**
 * Background element DOM renderer.
 * Excluded from test coverage - DOM manipulation logic.
 */

import type { SceneBackground } from './types';

export type BackgroundDomRefs = {
  element: HTMLElement;
  /**
   * Second DOM element positioned above the background, below scene content.
   * Managed by BackgroundWidget — created when setDomElement() is called,
   * removed on dispose(). Used for overlayGradient and backdropFilter.
   * null when BackgroundWidget has not yet been attached to a DOM element.
   */
  overlayElement: HTMLElement | null;
};

/**
 * Apply background state to DOM elements.
 *
 * Fill resolution order (first non-undefined wins):
 *   gradient → imageUrl → color → clear all
 *
 * When switching between fill kinds, the unused properties are cleared to prevent
 * leftover styles from the previous fill kind bleeding through.
 *
 * The CSS filter is applied to `element` (the background element).
 * The overlayGradient and backdropFilter are applied to `refs.overlayElement`.
 *
 * This is a utility for non-React rendering contexts. The element should be
 * a positioned container (e.g., position: absolute or position: fixed).
 */
export function applyBackground(state: SceneBackground, refs: BackgroundDomRefs): void {
  const element = refs.element;

  // Fill: gradient takes absolute precedence over color and imageUrl
  if (state.gradient) {
    element.style.background = state.gradient;
    element.style.backgroundColor = '';
    element.style.backgroundImage = '';
  } else if (state.imageUrl) {
    element.style.background = '';
    element.style.backgroundColor = '';
    element.style.backgroundImage = `url('${state.imageUrl}')`;
  } else if (state.color) {
    element.style.background = '';
    element.style.backgroundColor = state.color;
    element.style.backgroundImage = '';
  } else {
    element.style.background = '';
    element.style.backgroundColor = '';
    element.style.backgroundImage = '';
  }

  // CSS filter on the background element
  element.style.filter = state.cssFilter ?? '';

  // Opacity and layout
  element.style.opacity = String(state.opacity ?? 1);
  if (state.cssPosition) { element.style.backgroundPosition = state.cssPosition; }
  if (state.cssSize)     { element.style.backgroundSize = state.cssSize; }
  if (state.cssRepeat)   { element.style.backgroundRepeat = state.cssRepeat; }

  // Overlay element: overlayGradient + backdropFilter
  const overlay = refs.overlayElement;
  if (overlay) {
    if (state.overlayGradient || state.backdropFilter) {
      overlay.style.display = '';
      overlay.style.background = state.overlayGradient ?? '';
      overlay.style.backdropFilter = state.backdropFilter ?? '';
      // webkit prefix for Safari
      (overlay.style as unknown as Record<string, string>)['webkitBackdropFilter'] = state.backdropFilter ?? '';
    } else {
      overlay.style.display = 'none';
    }
  }
}
