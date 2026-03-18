// clearCarouselSelection — imperative deselect for non-React contexts.

import type { VariableStore } from './VariableStore';

/**
 * Programmatically clears the carousel selection.
 * Triggers reactive updates in any component using useCarouselSelection.
 *
 * For React consumers, prefer the `clearSelection()` method from useCarouselSelection.
 * This function is for imperative contexts (widget implementations, event handlers
 * that don't have hook access).
 *
 * @param layoutId - The ViewLayout `id` prop.
 * @param store - The VariableStore instance (from engine.variableStore).
 */
export function clearCarouselSelection(layoutId: string, store: VariableStore): void {
  store.set('carousel', `${layoutId}.selectedIndex`, null);
}
