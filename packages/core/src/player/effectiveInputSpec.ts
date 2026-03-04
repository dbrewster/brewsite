// Pure function: selects the effective SceneInputControllerSpec for the current frame.
// Explicit <InputController> spec wins entirely over widget-provided defaults.

import type { SceneInputControllerSpec } from '../input/types';
import type { IInputDefaultProvider } from '../widget/types';

/**
 * Determines the effective SceneInputControllerSpec to pass to ActionInputController.
 *
 * Resolution order (replace-not-merge):
 *   1. If tickInputSpec is non-null, it was authored via <InputController> DSL in the
 *      current scene — return it unchanged. Explicit always wins.
 *   2. Otherwise, collect all actions from IInputDefaultProvider widgets. If any
 *      actions exist, return a constructed SceneInputControllerSpec with scope='canvas'.
 *   3. If no actions, return null (no action-based input controller is attached).
 *
 * Merge is intentionally not performed. An explicit <InputController> is a full
 * authoring decision for that scene; combining it with theme defaults would produce
 * unexpected duplicate or conflicting action bindings.
 *
 * @param tickInputSpec - The compiled InputController spec for the current tick,
 *   or null/undefined if no <InputController> is present in this scene.
 * @param providers - All IInputDefaultProvider widgets from the registry.
 *   Their getDefaultInputActions() returns currentInputActions updated by apply()
 *   each frame — never defaultState.
 * @returns The effective SceneInputControllerSpec, or null if no input is configured.
 */
export function buildEffectiveInputSpec(
  tickInputSpec: SceneInputControllerSpec | null | undefined,
  providers: readonly IInputDefaultProvider[],
): SceneInputControllerSpec | null {
  // Explicit scene spec wins entirely — do not merge with provider defaults.
  if (tickInputSpec != null) return tickInputSpec;

  // Aggregate actions from all IInputDefaultProvider widgets.
  const allActions = providers.flatMap((p) => p.getDefaultInputActions());
  if (allActions.length === 0) return null;

  return {
    id: '__input_controller',
    scope: 'canvas',
    actions: allActions,
  };
}
