// React hook for applying linked-brush filters with reactive read access.

import { useSyncExternalStore, useCallback } from 'react';
import { useChartStore } from './ChartStoreContext';

export type UseChartFilterResult = {
  /** Apply a value-set filter on a dimension within the group. */
  applyFilter(dimension: string, values: ReadonlyArray<unknown>): void;
  /** Clear all active filters for the group. */
  clearFilters(): void;
  /**
   * Current active filters for the group.
   * Map of dimension field → set of allowed values.
   * Empty map when no filters are active.
   * Reactive — updates synchronously when applyFilter/clearFilters are called.
   */
  activeFilters: ReadonlyMap<string, ReadonlySet<unknown>>;
};

/**
 * Returns filter controls scoped to a filter group.
 * Linked charts sharing the same groupId will react to filter changes.
 */
export function useChartFilter(groupId: string): UseChartFilterResult {
  const store = useChartStore();

  const activeFilters = useSyncExternalStore(
    (cb) => store.subscribeToFilterGroup(groupId, cb),
    () => store.getActiveFilters(groupId),
  );

  const applyFilter = useCallback(
    (dimension: string, values: ReadonlyArray<unknown>) =>
      store.applyFilter(groupId, dimension, values),
    [store, groupId],
  );

  const clearFilters = useCallback(
    () => store.clearFilters(groupId),
    [store, groupId],
  );

  return { applyFilter, clearFilters, activeFilters };
}
