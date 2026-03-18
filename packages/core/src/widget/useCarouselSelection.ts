// useCarouselSelection — reactive hook for carousel selection and focus state.

import { useCallback, useContext } from 'react';
import { useVariable } from './useVariable';
import { VariableStoreContext } from './VariableStoreContext';

/**
 * Returns the current selection state and focus state of a carousel ViewLayout.
 * Re-renders whenever the focused index, selected index, or child count changes.
 *
 * @param layoutId - The ViewLayout `id` prop (e.g. `"products"`).
 *
 * @example
 * ```tsx
 * const { selectedIndex, focusedIndex, childCount, clearSelection } = useCarouselSelection('products');
 * if (selectedIndex !== null) {
 *   // A carousel item was selected — show detail view
 * }
 * ```
 */
export function useCarouselSelection(layoutId: string): {
  /** Index of the selected item, or null if nothing is selected. */
  selectedIndex: number | null;
  /** Index of the currently focused (front) carousel item. */
  focusedIndex: number;
  /** Number of child views in the carousel. */
  childCount: number;
  /** Programmatically clear the selection. Triggers reactive updates. */
  clearSelection: () => void;
} {
  const store = useContext(VariableStoreContext);
  if (!store) throw new Error('[useCarouselSelection] must be used inside <SceneEngine>');

  const selectedRaw = useVariable<number>('carousel', `${layoutId}.selectedIndex`);
  const selectedIndex = typeof selectedRaw === 'number' ? selectedRaw : null;

  // Read focusedIndex first, fall back to activeIndex for backward compat
  const focusedRaw = useVariable<number>('carousel', `${layoutId}.focusedIndex`);
  const activeRaw = useVariable<number>('carousel', `${layoutId}.activeIndex`);
  const focusedIndex = (typeof focusedRaw === 'number' ? focusedRaw : undefined)
    ?? (typeof activeRaw === 'number' ? activeRaw : 0);

  const childCount = useVariable<number>('carousel', `${layoutId}.childCount`) ?? 0;

  const clearSelection = useCallback(() => {
    store.set('carousel', `${layoutId}.selectedIndex`, null);
  }, [store, layoutId]);

  return { selectedIndex, focusedIndex, childCount, clearSelection };
}
