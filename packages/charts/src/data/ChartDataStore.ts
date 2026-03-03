import { SimpleFilterEngine } from './SimpleFilterEngine';
import { applyTransforms } from './transforms';
import type { IFilterEngine } from './IFilterEngine';
import type { DataTransform, ResolvedDataFrame } from './types';

type Row = Record<string, unknown>;

const EMPTY_FRAME: ResolvedDataFrame = { rows: [], fields: [] };

function buildCacheKey(
  name: string,
  filteredRowCount: number,
  transforms: readonly DataTransform[],
): string {
  // Uses row count (not a content hash) for performance.
  // Stale-read is prevented because register() calls unregister() first,
  // which evicts the cache entry before new rows are stored.
  // applyFilter/clearFilters invalidate via invalidateCacheForGroup().
  return `${name}:${filteredRowCount}:${JSON.stringify(transforms)}`;
}

/**
 * Per-engine data registry for @brewsite/charts.
 *
 * One ChartDataStore is created per chartPlugin() call. Never shared across engines.
 *
 * Filtering is delegated to an IFilterEngine (default: SimpleFilterEngine).
 * To use a high-performance engine (e.g. crossfilter2 for large datasets),
 * construct ChartDataStore with a custom IFilterEngine instance.
 *
 * @example
 * // Default (SimpleFilterEngine):
 * const store = new ChartDataStore();
 *
 * // Custom engine:
 * const store = new ChartDataStore(new CrossfilterFilterEngine());
 */
export class ChartDataStore {
  private readonly filterEngine: IFilterEngine;
  // Tracks which sources are registered (separate from filterEngine for fast existence checks)
  private readonly registeredSources = new Set<string>();
  // Memoization cache: source name → { cacheKey, result }
  private readonly resolveCache = new Map<string, { key: string; result: ResolvedDataFrame }>();

  constructor(filterEngine: IFilterEngine = new SimpleFilterEngine()) {
    this.filterEngine = filterEngine;
  }

  /**
   * Register a data source by name.
   * If filterGroupId is provided, applyFilter(groupId, ...) will affect this source.
   *
   * @param name         Unique source name referenced in <ChartData source="..." />.
   * @param rows         Row data. Treated as immutable — do not mutate after registration.
   * @param filterGroupId  Optional filter group. Sources in the same group share filters.
   */
  register(
    name: string,
    rows: ReadonlyArray<Row>,
    filterGroupId?: string,
  ): void {
    this.unregister(name); // Clean up previous registration if any
    this.registeredSources.add(name);
    this.filterEngine.register(name, rows, filterGroupId);
    this.resolveCache.delete(name);
  }

  /** Remove a source and clean up filter state. */
  unregister(name: string): void {
    this.registeredSources.delete(name);
    this.filterEngine.unregister(name);
    this.resolveCache.delete(name);
  }

  /**
   * Resolve a data source, applying active group filters then serializable transforms.
   * Results are memoized by (name, filtered-row-count, transforms-hash) and
   * invalidated when filters change.
   */
  resolve(name: string, transforms: readonly DataTransform[]): ResolvedDataFrame {
    if (!this.registeredSources.has(name)) {
      console.warn(
        `[ChartDataStore] Unknown data source: "${name}". ` +
        `Did you register it via <ChartProvider data={{ ${name}: rows }} />?`
      );
      return EMPTY_FRAME;
    }

    const filteredRows = this.filterEngine.getRows(name);
    const cacheKey = buildCacheKey(name, filteredRows.length, transforms);
    const cached = this.resolveCache.get(name);
    if (cached?.key === cacheKey) return cached.result;

    const transformed = applyTransforms(filteredRows as Row[], transforms);
    const fields = transformed.length > 0
      ? Object.keys(transformed[0]!)
      : (filteredRows.length > 0 ? Object.keys(filteredRows[0]!) : []);
    const result: ResolvedDataFrame = { rows: transformed, fields };
    this.resolveCache.set(name, { key: cacheKey, result });
    return result;
  }

  /**
   * Get a time-slice of data by time-field value index.
   * Used by HeatmapRenderer for animated time-series animation.
   */
  getTimeSlice(
    name: string,
    timeField: string,
    sliceIndex: number,
  ): ResolvedDataFrame {
    if (!this.registeredSources.has(name)) return EMPTY_FRAME;
    const allRows = this.filterEngine.getRows(name);
    const uniqueValues = [...new Set(allRows.map((r) => r[timeField]))];
    const sliceValue = uniqueValues[sliceIndex];
    if (sliceValue === undefined) return EMPTY_FRAME;
    const rows = (allRows as Row[]).filter((r) => r[timeField] === sliceValue);
    const fields = rows.length > 0 ? Object.keys(rows[0]!) : [];
    return { rows, fields };
  }

  /**
   * Apply a value-set filter to all sources in a group.
   * Triggers reactive updates in useChartData hooks for affected sources.
   */
  applyFilter(groupId: string, dimension: string, values: ReadonlyArray<unknown>): void {
    this.filterEngine.applyFilter(groupId, dimension, values);
    this.invalidateCacheForGroup(groupId);
  }

  /** Clear all filters for a group and trigger reactive updates. */
  clearFilters(groupId: string): void {
    this.filterEngine.clearFilters(groupId);
    this.invalidateCacheForGroup(groupId);
  }

  /**
   * Subscribe to filter changes for a specific source.
   * Automatically subscribes to the source's filter group if one is set,
   * so linked-brush filter changes trigger re-renders in useChartData().
   *
   * Returns an unsubscribe function compatible with useSyncExternalStore.
   */
  subscribeToSource(name: string, listener: () => void): () => void {
    const groupId = this.filterEngine.getFilterGroupForSource(name) ?? name;
    return this.filterEngine.subscribe(groupId, listener);
  }

  /**
   * Return the current active filters for a group as a read-only map.
   * Used by useChartFilter to expose reactive read access to current filter state.
   */
  getActiveFilters(groupId: string): ReadonlyMap<string, ReadonlySet<unknown>> {
    return this.filterEngine.getActiveFilters(groupId);
  }

  /**
   * Subscribe directly to a filter group by ID.
   * Used by useChartFilter internally and advanced consumers.
   */
  subscribeToFilterGroup(groupId: string, listener: () => void): () => void {
    return this.filterEngine.subscribe(groupId, listener);
  }

  /** Release all sources, filters, and listeners. */
  clear(): void {
    for (const name of [...this.registeredSources]) {
      this.unregister(name);
    }
    this.resolveCache.clear();
    this.filterEngine.dispose();
  }

  private invalidateCacheForGroup(groupId: string): void {
    // Evict cached results for any source in this group
    for (const name of this.registeredSources) {
      if (this.filterEngine.getFilterGroupForSource(name) === groupId) {
        this.resolveCache.delete(name);
      }
    }
  }
}
