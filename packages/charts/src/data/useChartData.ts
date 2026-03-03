// React hook for subscribing to a chart data source with reactive filter updates.

import { useSyncExternalStore } from 'react';
import { useChartStore } from './ChartStoreContext';
import type { DataTransform, ResolvedDataFrame } from './types';

/**
 * Subscribes to a named data source from the nearest ChartDataStore.
 * Re-renders when filter group state changes (linked-brush filtering).
 *
 * @param sourceName - The data source name registered via ChartProvider.
 * @param transforms - Optional array of serializable data transforms to apply.
 */
export function useChartData(
  sourceName: string,
  transforms?: readonly DataTransform[],
): ResolvedDataFrame {
  const store = useChartStore();
  const resolvedTransforms = transforms ?? [];

  return useSyncExternalStore(
    (cb) => store.subscribeToSource(sourceName, cb),
    () => store.resolve(sourceName, resolvedTransforms),
    () => store.resolve(sourceName, resolvedTransforms),
  );
}
