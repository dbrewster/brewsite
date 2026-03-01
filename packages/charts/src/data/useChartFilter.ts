// React hook for applying crossfilter linked-brush filters.

import { useCallback } from 'react';
import { useChartStore } from './ChartStoreContext';
import type { FilterGroupId } from './types';

/**
 * Returns filter controls scoped to a crossfilter group.
 * Linked charts sharing the same groupId will react to filter changes.
 */
export function useChartFilter(groupId: FilterGroupId): {
  applyFilter(dimension: string, values: ReadonlyArray<unknown>): void;
  clearFilters(): void;
} {
  const store = useChartStore();

  const applyFilter = useCallback(
    (dimension: string, values: ReadonlyArray<unknown>): void => {
      store.applyFilter(groupId, dimension, values);
    },
    [store, groupId],
  );

  const clearFilters = useCallback((): void => {
    store.clearFilters(groupId);
  }, [store, groupId]);

  return { applyFilter, clearFilters };
}
