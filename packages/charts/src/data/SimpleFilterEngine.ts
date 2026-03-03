import type { IFilterEngine } from './IFilterEngine';

type Row = Record<string, unknown>;

/**
 * SimpleFilterEngine — built-in IFilterEngine with no external dependencies.
 *
 * Uses plain Map + Set structures for multi-dimensional, multi-group filtering.
 * Suitable for datasets up to ~100k rows at interactive frame rates.
 *
 * To use a more capable engine (e.g. crossfilter2 for large datasets), implement
 * IFilterEngine and pass an instance to ChartDataStore's constructor.
 */
export class SimpleFilterEngine implements IFilterEngine {
  // source name → filter group ID
  private readonly sourceGroups = new Map<string, string | undefined>();
  // source name → rows
  private readonly sourceRows = new Map<string, ReadonlyArray<Row>>();
  // group ID → (dimension field → set of allowed values)
  private readonly activeFilters = new Map<string, Map<string, Set<unknown>>>();
  // group ID → listener set
  private readonly listeners = new Map<string, Set<() => void>>();

  register(name: string, rows: ReadonlyArray<Row>, filterGroupId?: string): void {
    this.sourceRows.set(name, rows);
    this.sourceGroups.set(name, filterGroupId);
  }

  unregister(name: string): void {
    this.sourceRows.delete(name);
    this.sourceGroups.delete(name);
  }

  applyFilter(groupId: string, dimension: string, values: ReadonlyArray<unknown>): void {
    let dims = this.activeFilters.get(groupId);
    if (!dims) {
      dims = new Map();
      this.activeFilters.set(groupId, dims);
    }
    if (values.length === 0) {
      dims.delete(dimension);
    } else {
      dims.set(dimension, new Set(values));
    }
    this.notify(groupId);
  }

  clearFilters(groupId: string): void {
    this.activeFilters.delete(groupId);
    this.notify(groupId);
  }

  getRows(name: string): ReadonlyArray<Row> {
    const rows = this.sourceRows.get(name) ?? [];
    const groupId = this.sourceGroups.get(name);
    if (!groupId) return rows;
    const dims = this.activeFilters.get(groupId);
    if (!dims || dims.size === 0) return rows;
    return (rows as Row[]).filter((row) =>
      [...dims.entries()].every(([dim, vals]) => vals.has(row[dim]))
    );
  }

  getFilterGroupForSource(name: string): string | undefined {
    return this.sourceGroups.get(name);
  }

  getActiveFilters(groupId: string): ReadonlyMap<string, ReadonlySet<unknown>> {
    return this.activeFilters.get(groupId) ?? new Map();
  }

  subscribe(groupId: string, listener: () => void): () => void {
    let set = this.listeners.get(groupId);
    if (!set) {
      set = new Set();
      this.listeners.set(groupId, set);
    }
    set.add(listener);
    return () => {
      this.listeners.get(groupId)?.delete(listener);
    };
  }

  dispose(): void {
    this.sourceGroups.clear();
    this.sourceRows.clear();
    this.activeFilters.clear();
    this.listeners.clear();
  }

  private notify(groupId: string): void {
    this.listeners.get(groupId)?.forEach((fn) => fn());
  }
}
