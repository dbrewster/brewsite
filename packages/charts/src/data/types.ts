// Core data types for the @brewsite/charts data layer.

/**
 * A single data row — flat column-value pairs. Fully JSON-serializable.
 * Canonical definition: imported by elements/chart/types.ts from here.
 */
export type DataRow = Readonly<Record<string, unknown>>;

/**
 * Columnar data format: { month: ['Jan','Feb'], revenue: [128, 145] }.
 * Transposed to DataRow[] by normalizeDataInput() before storage.
 * Canonical definition: imported by elements/chart/types.ts from here.
 */
export type ColumnarData = Readonly<Record<string, ReadonlyArray<unknown>>>;

/**
 * Accepted data input formats for inline data prop and ChartProvider.
 * Canonical definition: imported by elements/chart/types.ts from here.
 */
export type DataInput = ReadonlyArray<DataRow> | ColumnarData;

/**
 * Normalizes DataInput to a flat row array.
 * - If input is an array → returned as-is.
 * - If input is a columnar object → transposed to row array.
 * Throws in dev mode if columnar columns have different lengths.
 * Implementation lives in data/transforms.ts; re-exported from here for convenience.
 */
export { normalizeDataInput } from './transforms';

/** Comparison operators for serializable filter predicates. */
export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

/**
 * Serializable filter transform — no function references.
 * Can be safely stored in SceneTrack (JSON-compatible predicate).
 */
export type FilterTransform = {
  readonly type: 'filter';
  readonly field: string;
  readonly op: FilterOp;
  readonly value: string | number | boolean | ReadonlyArray<string | number | boolean>;
};

/** Aggregation function for grouped data. */
export type AggregateOp = 'sum' | 'mean' | 'count' | 'min' | 'max';

/**
 * Groups rows by a field and aggregates a value field.
 */
export type GroupByTransform = {
  readonly type: 'groupBy';
  readonly field: string;
  readonly valueField?: string;
  readonly aggregate: AggregateOp;
};

/** Sort order for a field. */
export type SortTransform = {
  readonly type: 'sort';
  readonly field: string;
  readonly direction: 'asc' | 'desc';
};

/**
 * Bins a numeric field into histogram buckets.
 */
export type BinTransform = {
  readonly type: 'bin';
  readonly field: string;
  readonly thresholds?: number;
};

/**
 * V2.1: Derives a new computed column from an existing numeric field.
 * All operations are serializable — no function references.
 * Stored in ChartState.transforms[] and evaluated at runtime by ChartDataStore.resolve().
 */
export type ComputeTransform = {
  readonly type: 'compute';
  /** Name of the new computed output field added to each row. */
  readonly outputField: string;
  readonly operation:
    | { readonly fn: 'log'; readonly inputField: string; readonly base?: number }
    | { readonly fn: 'sqrt'; readonly inputField: string }
    | { readonly fn: 'normalize'; readonly inputField: string }
    | { readonly fn: 'scale'; readonly inputField: string; readonly factor: number }
    | { readonly fn: 'add'; readonly inputField: string; readonly value: number };
};

/** Union of all supported data transforms. All are serializable — no function references. */
export type DataTransform =
  | FilterTransform
  | GroupByTransform
  | SortTransform
  | BinTransform
  | ComputeTransform;

/** A resolved data frame after all transforms are applied. */
export type ResolvedDataFrame = {
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly fields: readonly string[];
};

/** Identifies a crossfilter group for linked-brush interactions. */
export type FilterGroupId = string;

/** Axis dimension configuration for chart DSL. */
export type ChartDimension = {
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
};
