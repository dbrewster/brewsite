import type {Node} from '../../runtime/types';
import type {SceneModel} from './types';

/**
 * applyModelTransform applies position, rotation, and uniform scale from a SceneModel
 * state to a root Node. If the model is disabled, scales the root to zero (hiding it).
 *
 * Scope: transform only. Material overrides, anchored objects (brain, chest particles),
 * and animation/motion are the responsibility of ModelRenderer, which has the
 * model/world references those concerns require.
 */
export function applyModelTransform(state: SceneModel, root: Node): void {
  if (state.enabled === false) {
    root.localScale = [0, 0, 0];
    return;
  }

  root.localPosition = [state.position[0], state.position[1], state.position[2]];
  root.localRotation = [state.rotation[0], state.rotation[1], state.rotation[2]];
  root.localScale = [state.scale, state.scale, state.scale];
}
