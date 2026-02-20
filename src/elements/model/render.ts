/**
 * Model element render helpers - transform application.
 *
 * Scope: transform only. This is a stateless utility.
 * Material overrides, anchored objects, and animation are the responsibility of
 * the widget's renderer implementation.
 */

import type { SceneModel } from './types';

/**
 * Represents a 3D object with position, rotation, and scale.
 */
export interface IRenderable {
  localPosition: [number, number, number];
  localRotation: [number, number, number];
  localScale: [number, number, number];
}

/**
 * Applies position, rotation, and uniform scale from SceneModel to a renderable.
 * If the model is disabled, scales to zero (hiding it).
 */
export function applyModelTransform(state: SceneModel, root: IRenderable): void {
  if (state.enabled === false) {
    root.localScale = [0, 0, 0];
    return;
  }

  root.localPosition = [state.position[0], state.position[1], state.position[2]];
  root.localRotation = [state.rotation[0], state.rotation[1], state.rotation[2]];
  root.localScale = [state.scale, state.scale, state.scale];
}
