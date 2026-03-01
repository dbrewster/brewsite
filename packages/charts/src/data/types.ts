// Core data types for the @brewsite/charts data layer.

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

/** Union of all supported data transforms. All are serializable — no function references. */
export type DataTransform = FilterTransform | GroupByTransform | SortTransform | BinTransform;

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
