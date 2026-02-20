import type {SceneBackground} from './types';

export type BackgroundDomRefs = {
  element: HTMLElement;
};

/**
 * Apply background state to a DOM element.
 *
 * This is a utility for non-React rendering contexts (e.g. tests, server-side, or imperative
 * host environments). In the React/Three.js pipeline, a RuntimeDriver background renderer
 * calls this function to apply `tick.state.background` directly to the DOM element.
 *
 * The element should be a positioned container (e.g., position: absolute or position: fixed).
 */
export function applyBackground(state: SceneBackground, refs: BackgroundDomRefs): void {
  const element = refs.element;

  // Apply background image
  if (state.imageUrl) {
    element.style.backgroundImage = `url('${state.imageUrl}')`;
  } else {
    element.style.backgroundImage = '';
  }

  // Apply opacity
  element.style.opacity = String(state.opacity ?? 1);

  // Apply CSS position if provided
  if (state.cssPosition) {
    element.style.backgroundPosition = state.cssPosition;
  }

  // Apply CSS size if provided
  if (state.cssSize) {
    element.style.backgroundSize = state.cssSize;
  }

  // Apply CSS repeat if provided
  if (state.cssRepeat) {
    element.style.backgroundRepeat = state.cssRepeat;
  }

  // Apply 3D position if provided (using CSS transform)
  if (state.position) {
    const [x, y, z] = state.position;
    element.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
  } else {
    element.style.transform = '';
  }
}
