// inputSpecMerger.ts — Pure merge of scene input spec with defaults.

import type { SceneInputControllerSpec, InputActionSpec, InputSpecMergeMode } from './types';

/**
 * Merges a scene-authored input spec with the default spec.
 *
 * 'merge' mode (default):
 * - Scene actions with an `id` matching a default action REPLACE that default.
 * - Scene actions with a new `id` are APPENDED.
 * - Default actions not overridden are PRESERVED.
 * - The `scope` field from the scene spec takes precedence.
 *
 * 'replace' mode:
 * - Scene spec completely replaces defaults (current behavior, opt-in only).
 */
export function mergeInputSpecs(
  defaults: SceneInputControllerSpec,
  scene: SceneInputControllerSpec,
  mode: InputSpecMergeMode,
): SceneInputControllerSpec {
  if (mode === 'replace') return scene;

  const mergedActions: InputActionSpec[] = [];
  const sceneActionIds = new Set(scene.actions.map(a => a.id));

  // 1. Keep defaults that aren't overridden
  for (const defaultAction of defaults.actions) {
    if (!sceneActionIds.has(defaultAction.id)) {
      mergedActions.push(defaultAction);
    }
  }

  // 2. Add all scene actions (these override defaults with same id)
  for (const sceneAction of scene.actions) {
    mergedActions.push(sceneAction);
  }

  return {
    id: scene.id,
    scope: scene.scope,
    actions: mergedActions,
  };
}
