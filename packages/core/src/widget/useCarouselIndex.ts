// useCarouselState — reactive hook for carousel ViewLayout state.

import { useVariable } from './useVariable';

/**
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
  const activeIndex = useVariable<number>('carousel', `${layoutId}.activeIndex`) ?? 0;
  const childCount = useVariable<number>('carousel', `${layoutId}.childCount`) ?? 0;
  return [activeIndex, childCount];
}
