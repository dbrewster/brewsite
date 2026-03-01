// Per-engine ChartDataStore — one instance per chartPlugin() call. No global singleton.

import crossfilter from 'crossfilter2';
import type { Crossfilter, Dimension } from 'crossfilter2';
import { applyTransforms } from './transforms';
import type { DataTransform, ResolvedDataFrame } from './types';

type Row = Record<string, unknown>;

type SourceEntry = {
  rows: ReadonlyArray<Row>;
  cf?: Crossfilter<Row>;
  dimensions: Map<string, Dimension<Row, unknown>>;
};

/**
 * Per-engine data registry for @brewsite/charts.
 *
 * Each chartPlugin() call creates exactly one ChartDataStore instance.
 * Injected into ChartWidgets via constructor and provided to React via
 * ChartStoreContext (wrapProvider).
 *
 * Isolation guarantee: two chartPlugin() instances never share data.
 */
export class ChartDataStore {
  private readonly sources = new Map<string, SourceEntry>();
  private readonly filterListeners = new Map<string, Set<() => void>>();

  /**
   * Register a data source by name.
   * Replaces any existing registration with the same name.
   */
  register(name: string, rows: ReadonlyArray<Row>): void {
    this.unregister(name);
    this.sources.set(name, { rows, dimensions: new Map() });
  }

  /**
   * Register a data source with crossfilter support for linked-brush filtering.
   */
  registerWithFilter(
    name: string,
    rows: ReadonlyArray<Row>,
    _groupId: string,
  ): void {
    this.unregister(name);
    const cf = crossfilter(rows as Row[]);
    this.sources.set(name, { rows, cf, dimensions: new Map() });
  }

  /**
   * Remove a source by name. Called by ChartProvider on cleanup.
   */
  unregister(name: string): void {
    const entry = this.sources.get(name);
    if (entry) {
      for (const dim of entry.dimensions.values()) {
        dim.dispose();
      }
      this.sources.delete(name);
    }
  }

  /**
   * Resolve a data source, applying all transforms in order.
   * Returns an empty frame (with a console.warn) for unknown sources.
   */
  resolve(name: string, transforms: readonly DataTransform[]): ResolvedDataFrame {
    const entry = this.sources.get(name);
    if (!entry) {
      console.warn(`[ChartDataStore] Unknown data source: "${name}". Did you register it via ChartProvider?`);
      return { rows: [], fields: [] };
    }

    // When crossfilter is active, use its filtered view; otherwise use raw rows.
    const baseRows = entry.cf ? entry.cf.allFiltered() : (entry.rows as Row[]);
    const rows = applyTransforms(baseRows, transforms);
    const fields = rows.length > 0 ? Object.keys(rows[0]!) : Object.keys(entry.rows[0] ?? {});
    return { rows, fields };
  }

  /**
   * Get a time-slice of data by splitting on sliceIndex.
   * Used by HeatmapRenderer for animated time series.
   */
  getTimeSlice(name: string, timeField: string, sliceIndex: number): ResolvedDataFrame {
    const entry = this.sources.get(name);
    if (!entry) {
      return { rows: [], fields: [] };
    }
    const uniqueValues = [...new Set(entry.rows.map((r) => r[timeField]))];
    const sliceValue = uniqueValues[sliceIndex];
    if (sliceValue === undefined) return { rows: [], fields: [] };
    const rows = (entry.rows as Row[]).filter((r) => r[timeField] === sliceValue);
    const fields = rows.length > 0 ? Object.keys(rows[0]!) : [];
    return { rows, fields };
  }

  /**
   * Apply a filter on a crossfilter dimension within a group.
   */
  applyFilter(groupId: string, dimension: string, values: ReadonlyArray<unknown>): void {
    for (const [name, entry] of this.sources.entries()) {
      if (!entry.cf) continue;
      let dim = entry.dimensions.get(dimension);
      if (!dim) {
        dim = entry.cf.dimension((row) => row[dimension]);
        entry.dimensions.set(dimension, dim);
      }
      if (values.length === 0) {
        dim.filterAll();
      } else {
        dim.filterFunction((v: unknown) => values.includes(v));
      }
      this._notifyFilterGroup(name);
      this._notifyFilterGroup(groupId);
    }
  }

  /**
   * Clear all dimension filters for a group.
   */
  clearFilters(groupId: string): void {
    for (const [name, entry] of this.sources.entries()) {
      if (!entry.cf) continue;
      for (const dim of entry.dimensions.values()) {
        dim.filterAll();
      }
      this._notifyFilterGroup(name);
      this._notifyFilterGroup(groupId);
    }
  }

  /**
   * Subscribe to filter changes for a group.
   * Returns an unsubscribe function.
   */
  subscribeToFilterGroup(groupId: string, callback: () => void): () => void {
    let listeners = this.filterListeners.get(groupId);
    if (!listeners) {
      listeners = new Set();
      this.filterListeners.set(groupId, listeners);
    }
    listeners.add(callback);
    return () => {
      this.filterListeners.get(groupId)?.delete(callback);
    };
  }

  /** Release all sources and listeners. */
  clear(): void {
    for (const [name] of this.sources.entries()) {
      this.unregister(name);
    }
    this.filterListeners.clear();
  }

  private _notifyFilterGroup(groupId: string): void {
    const listeners = this.filterListeners.get(groupId);
    if (listeners) {
      for (const cb of listeners) cb();
    }
  }
}
