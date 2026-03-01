// Pure data transformation functions — no Three.js, no React DOM.

import { rollup, bin, ascending, descending, sum, mean, min, max } from 'd3-array';
import type {
  DataTransform,
  FilterTransform,
  GroupByTransform,
  SortTransform,
  BinTransform,
  FilterOp,
} from './types';

type Row = Record<string, unknown>;

/**
 * Evaluates a single FilterOp against a field value and a comparison value.
 * Pure function — no closures, fully serializable.
 */
export function evaluateFilterOp(
  fieldValue: unknown,
  op: FilterOp,
  compareValue: FilterTransform['value'],
): boolean {
  switch (op) {
    case 'eq':
      return fieldValue === compareValue;
    case 'neq':
      return fieldValue !== compareValue;
    case 'gt':
      return typeof fieldValue === 'number' && typeof compareValue === 'number'
        ? fieldValue > compareValue
        : String(fieldValue) > String(compareValue);
    case 'gte':
      return typeof fieldValue === 'number' && typeof compareValue === 'number'
        ? fieldValue >= compareValue
        : String(fieldValue) >= String(compareValue);
    case 'lt':
      return typeof fieldValue === 'number' && typeof compareValue === 'number'
        ? fieldValue < compareValue
        : String(fieldValue) < String(compareValue);
    case 'lte':
      return typeof fieldValue === 'number' && typeof compareValue === 'number'
        ? fieldValue <= compareValue
        : String(fieldValue) <= String(compareValue);
    case 'in':
      return Array.isArray(compareValue) &&
        (compareValue as ReadonlyArray<unknown>).includes(fieldValue);
    default: {
      const _exhaustive: never = op;
      console.warn(`[charts/transforms] Unknown filter op: ${String(_exhaustive)}`);
      return true;
    }
  }
}

/**
 * Applies a FilterTransform to rows — structural predicate, no closures.
 */
export function applyFilter(rows: ReadonlyArray<Row>, transform: FilterTransform): Row[] {
  return rows.filter((row) =>
    evaluateFilterOp(row[transform.field], transform.op, transform.value),
  ) as Row[];
}

/**
 * Groups rows by a field and aggregates a numeric value field.
 * Returns one row per group with `key` (group value) and `value` (aggregate).
 */
export function applyGroupBy(rows: ReadonlyArray<Row>, transform: GroupByTransform): Row[] {
  const { field, valueField, aggregate } = transform;

  if (aggregate === 'count') {
    const groups = rollup(rows as Row[], (group) => group.length, (row) => row[field]);
    return Array.from(groups.entries()).map(([key, value]) => ({
      [field]: key,
      [valueField ?? 'count']: value,
    }));
  }

  const groups = rollup(
    rows as Row[],
    (group) => {
      const nums = group.map((r) => Number(r[valueField ?? field])).filter(isFinite);
      switch (aggregate) {
        case 'sum':   return sum(nums);
        case 'mean':  return mean(nums) ?? 0;
        case 'min':   return min(nums) ?? 0;
        case 'max':   return max(nums) ?? 0;
        default:      return 0;
      }
    },
    (row) => row[field],
  );

  return Array.from(groups.entries()).map(([key, value]) => ({
    [field]: key,
    [valueField ?? field]: value,
  }));
}

/**
 * Sorts rows by a field, ascending or descending.
 * Returns a new array — does not mutate.
 */
export function applySort(rows: ReadonlyArray<Row>, transform: SortTransform): Row[] {
  const { field, direction } = transform;
  const compareFn = direction === 'asc' ? ascending : descending;
  return [...rows].sort((a, b) => {
    const av = a[field] as Parameters<typeof ascending>[0];
    const bv = b[field] as Parameters<typeof ascending>[0];
    return compareFn(av, bv);
  });
}

/**
 * Bins a numeric field using d3-array's bin() generator.
 * Returns one row per bin with `x0`, `x1`, and `count` fields.
 */
export function applyBin(rows: ReadonlyArray<Row>, transform: BinTransform): Row[] {
  const { field, thresholds } = transform;
  const values = rows.map((r) => Number(r[field])).filter(isFinite);
  const binner = bin<number, number>().value((d) => d);
  if (thresholds !== undefined) binner.thresholds(thresholds);
  const bins = binner(values);
  return bins.map((b) => ({
    x0: b.x0 ?? 0,
    x1: b.x1 ?? 0,
    count: b.length,
    [field]: (b.x0 ?? 0 + (b.x1 ?? 0)) / 2,
  }));
}

/**
 * Composes multiple data transforms in order.
 */
export function applyTransforms(
  rows: ReadonlyArray<Row>,
  transforms: readonly DataTransform[],
): Row[] {
  let result: Row[] = rows as Row[];
  for (const t of transforms) {
    switch (t.type) {
      case 'filter':  result = applyFilter(result, t);  break;
      case 'groupBy': result = applyGroupBy(result, t); break;
      case 'sort':    result = applySort(result, t);    break;
      case 'bin':     result = applyBin(result, t);     break;
      default: {
        const _exhaustive: never = t;
        console.warn(`[charts/transforms] Unknown transform type: ${String((_exhaustive as DataTransform).type)}`);
      }
    }
  }
  return result;
}
