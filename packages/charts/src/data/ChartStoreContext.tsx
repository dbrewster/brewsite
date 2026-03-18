// React context providing the per-engine ChartDataStore instance.

import { createContext, useContext } from 'react';
import type { ChartDataStore } from './ChartDataStore';

/**
 * Context holding the per-engine ChartDataStore.
 * Provided by chartPlugin().wrapProvider() — do NOT instantiate separately.
 */
export const ChartStoreContext = createContext<ChartDataStore | null>(null);

/**
 * Access the per-engine ChartDataStore from within a SceneEngine tree.
 * Throws if called outside a tree that includes chartPlugin().
 */
export function useChartStore(): ChartDataStore {
  const store = useContext(ChartStoreContext);
  if (!store) {
    throw new Error(
      '[ChartStoreContext] useChartStore() must be called inside a <SceneEngine> with chartPlugin().',
    );
  }
  return store;
}
