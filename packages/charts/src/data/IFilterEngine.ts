/**
 * IFilterEngine — abstract contract for multi-dimensional, multi-group filtering.
 *
 * Consumer code (ChartProvider, useChartData, useChartFilter) never references
 * this interface. It is injected into ChartDataStore via constructor.
 *
 * Swap implementations (e.g. CrossfilterFilterEngine for large datasets)
 * without changing any consumer code.
 */
export interface IFilterEngine {
  /**
   * Register a named data source. If filterGroupId is provided, the source
   * participates in group filtering: applyFilter(groupId, ...) will affect
   * what getRows(name) returns.
   */
  register(name: string, rows: ReadonlyArray<Record<string, unknown>>, filterGroupId?: string): void;

  /**
   * Unregister a source and release any associated filter state.
   */
  unregister(name: string): void;

  /**
   * Apply a value-set filter on a field for all sources in a group.
   * Passing values=[] removes the filter for that dimension (same as clearFilters
   * for that one dimension).
   *
   * Implementations MUST call all subscribe() listeners registered for groupId
   * after applying the filter.
   */
  applyFilter(groupId: string, dimension: string, values: ReadonlyArray<unknown>): void;

  /**
   * Remove all active filters for a group.
   * Implementations MUST notify all subscribers for groupId.
   */
  clearFilters(groupId: string): void;

  /**
   * Return the current rows for a source after applying all active filters
   * from the group the source belongs to (if any). Returns the full row array
   * if the source has no filter group or the group has no active filters.
   */
  getRows(name: string): ReadonlyArray<Record<string, unknown>>;

  /**
   * Return the filter group ID for a source, or undefined if none was set.
   * Used by ChartDataStore.subscribeToSource() to wire reactive subscriptions.
   */
  getFilterGroupForSource(name: string): string | undefined;

  /**
   * Return the current active filters for a group as a read-only map of
   * dimension → allowed value set. Returns an empty map if no filters are active.
   * Used by useChartFilter to expose reactive read access to current filter state.
   */
  getActiveFilters(groupId: string): ReadonlyMap<string, ReadonlySet<unknown>>;

  /**
   * Subscribe to filter-change notifications for a group.
   * Returns an unsubscribe function. Safe to call multiple times.
   */
  subscribe(groupId: string, listener: () => void): () => void;

  /**
   * Release all internal state. Called when ChartDataStore.clear() is invoked.
   */
  dispose(): void;
}
