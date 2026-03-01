// Minimal type declarations for crossfilter2.
// Full @types/crossfilter2 is not published; these cover the subset used by ChartDataStore.

declare module 'crossfilter2' {
  export interface Dimension<TRecord, TValue> {
    filter(value: TValue | readonly TValue[] | null): this;
    filterExact(value: TValue): this;
    filterRange(range: [TValue, TValue]): this;
    filterFunction(fn: (d: TValue) => boolean): this;
    filterAll(): this;
    top(k: number): TRecord[];
    bottom(k: number): TRecord[];
    dispose(): void;
  }

  export interface GroupAll<TRecord> {
    reduceCount(): { value(): number };
    value(): number;
  }

  export interface Group<TRecord, TKey, TValue> {
    all(): Array<{ key: TKey; value: TValue }>;
    top(k: number): Array<{ key: TKey; value: TValue }>;
    dispose(): void;
  }

  export interface Crossfilter<TRecord> {
    add(records: TRecord[]): this;
    remove(fn?: (d: TRecord, i: number) => boolean): this;
    dimension<TValue>(accessor: (d: TRecord) => TValue): Dimension<TRecord, TValue>;
    groupAll(): GroupAll<TRecord>;
    size(): number;
    all(): TRecord[];
    allFiltered(): TRecord[];
  }

  function crossfilter<TRecord>(records?: TRecord[]): Crossfilter<TRecord>;
  export default crossfilter;
}
