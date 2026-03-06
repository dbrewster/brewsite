// Private render input types — bridge NVS-based SceneModel to world-space ModelRenderer.
// Never exported from index.ts.

import type { SceneModel, SceneModelInstanceState, Vec3 } from './types';

/**
 * World-space render input for ModelRenderer.apply() model field.
 * Replaces nvsX/nvsY/z with world-space position derived in ModelWidget.apply().
 * Not exported from the package — internal translation boundary only.
 */
export type ModelRenderInput = Omit<SceneModel, 'nvsX' | 'nvsY' | 'z'> & {
  readonly position: Vec3;
};

/**
 * Full instance state passed to ModelRenderer.apply().
 * model field is ModelRenderInput (world-space position) instead of SceneModel (NVS).
 * Not exported from the package — internal translation boundary only.
 */
export type ModelRenderInstanceState = Omit<SceneModelInstanceState, 'model'> & {
  readonly model: ModelRenderInput;
};
