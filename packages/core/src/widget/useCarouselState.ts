// useCarouselState — reactive hook for carousel ViewLayout state.

import { useVariable } from './useVariable';

/**
 * @deprecated Use `useCarouselSelection(layoutId)` instead, which provides
 * `focusedIndex`, `selectedIndex`, `childCount`, and `clearSelection()`.
 * This hook will be removed in the next major version.
 *
 * Returns the current active index and child count of a carousel ViewLayout.
 * Re-renders whenever the carousel advances or retreats.
 *
 * Both values are `0` before the first user interaction (the VariableStore
 * is populated on the first carousel.next / carousel.prev action).
 *
 * @param layoutId - The ViewLayout `id` prop (e.g. `"ring-carousel-layout"`).
 * @returns `[activeIndex, childCount]`
 *
 * @example
 * ```tsx
 * const [idx, count] = useCarouselState('my-carousel');
 * // idx = 0..count-1 as the user navigates
 * ```
 */
export function useCarouselState(layoutId: string): [activeIndex: number, childCount: number] {
  // Read focusedIndex first, fall back to activeIndex for compat
  const focusedIndex = useVariable<number>('carousel', `${layoutId}.focusedIndex`);
  const activeIndex = useVariable<number>('carousel', `${layoutId}.activeIndex`);
  const childCount = useVariable<number>('carousel', `${layoutId}.childCount`) ?? 0;
  const resolved = (typeof focusedIndex === 'number' ? focusedIndex : undefined)
    ?? (typeof activeIndex === 'number' ? activeIndex : 0);
  return [resolved, childCount];
}
