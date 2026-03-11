// Pure data transformation functions — no Three.js, no React DOM.

import { rollup, bin, ascending, descending, sum, mean, min, max } from 'd3-array';
import type {
  DataTransform,
  FilterTransform,
  GroupByTransform,
  SortTransform,
  BinTransform,
  ComputeTransform,
  FilterOp,
} from './types';

type Row = Record<string, unknown>;

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  // Attempt numeric coercion
  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) {
    return na - nb;
  }
  // String fallback
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

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
    case 'gt':  return compareValues(fieldValue, compareValue) > 0;
    case 'gte': return compareValues(fieldValue, compareValue) >= 0;
    case 'lt':  return compareValues(fieldValue, compareValue) < 0;
    case 'lte': return compareValues(fieldValue, compareValue) <= 0;
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
 * Normalizes a DataInput (row array or columnar object) to a flat row array.
 * - Array input → returned as-is.
 * - Columnar input → each column key becomes a field; rows are built by index.
 * Throws in dev mode if columnar columns have different lengths.
 */
export function normalizeDataInput(
  input: ReadonlyArray<Record<string, unknown>> | Readonly<Record<string, ReadonlyArray<unknown>>>,
): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(input)) {
    return input as ReadonlyArray<Record<string, unknown>>;
  }
  // Columnar path
  const columnar = input as Readonly<Record<string, ReadonlyArray<unknown>>>;
  const keys = Object.keys(columnar);
  if (keys.length === 0) return [];
  const length = columnar[keys[0]].length;
  if (process.env.NODE_ENV !== 'production') {
    for (const key of keys) {
      if (columnar[key].length !== length) {
        throw new Error(
          `[charts/normalizeDataInput] Column "${key}" has length ${columnar[key].length}, expected ${length}.`,
        );
      }
    }
  }
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < length; i++) {
    const row: Record<string, unknown> = {};
    for (const key of keys) {
      row[key] = columnar[key][i];
    }
    rows.push(row);
  }
  return rows;
}

// --- CSV parsing helpers ---

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      // End of line — push empty field if line ends with comma, handled by loop exit
      break;
    }
    if (line[i] === '"') {
      // Quoted field
      let field = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i];
          i++;
        }
      }
      fields.push(field);
      if (i < line.length && line[i] === ',') i++; // skip comma after closing quote
    } else {
      // Unquoted field
      const end = line.indexOf(',', i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, end));
        i = end + 1;
        // If line ends with comma, push empty string
        if (i === line.length) {
          fields.push('');
          break;
        }
      }
    }
  }
  return fields;
}

function coerceCsvValue(raw: string): unknown {
  if (raw === '') return raw;
  // Match pure numerics: optional sign, digits, optional decimal, optional exponent
  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) {
    return parseFloat(raw);
  }
  return raw;
}

/**
 * Lightweight CSV parser.
 * - First row is the header.
 * - Numeric strings (e.g. "123.45") are coerced to number.
 * - Date-like strings (e.g. "2024-01-01") remain as string.
 * - Quoted fields (including commas within quotes) are handled.
 * - Skips empty rows.
 */
export function parseCsv(text: string): ReadonlyArray<Record<string, unknown>> {
  const lines = text.split('\n').map((l) => l.trimEnd());
  const nonEmpty = lines.filter((l) => l.length > 0);
  if (nonEmpty.length < 2) return [];

  const headers = parseCsvLine(nonEmpty[0]!);
  const result: Record<string, unknown>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const fields = parseCsvLine(nonEmpty[i]!);
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = fields[j] ?? '';
      row[headers[j]!] = coerceCsvValue(raw);
    }
    result.push(row);
  }
  return result;
}

/**
 * V2.1: Applies a ComputeTransform — derives a new column from an existing numeric field.
 * For 'normalize': uses min/max of the current rows (dataset range, not fixed domain).
 * This means normalize re-computes its range when filtered data changes — intended behavior.
 */
export function applyCompute(rows: ReadonlyArray<Row>, transform: ComputeTransform): Row[] {
  const { outputField, operation } = transform;
  const inputValues = rows.map((r) => Number(r[operation.inputField]) || 0);

  let normalMin = 0;
  let normalMax = 1;
  if (operation.fn === 'normalize') {
    normalMin = min(inputValues) ?? 0;
    normalMax = max(inputValues) ?? 1;
  }

  return rows.map((r) => {
    const v = Number(r[operation.inputField]) || 0;
    let computed: number;
    switch (operation.fn) {
      case 'log': {
        const base = operation.base ?? Math.E;
        computed = Math.log(Math.max(v, Number.EPSILON)) / Math.log(base);
        break;
      }
      case 'sqrt':
        computed = Math.sqrt(Math.max(v, 0));
        break;
      case 'normalize': {
        const range = normalMax - normalMin;
        computed = range === 0 ? 0 : (v - normalMin) / range;
        break;
      }
      case 'scale':
        computed = v * operation.factor;
        break;
      case 'add':
        computed = v + operation.value;
        break;
      default: {
        const _exhaustive: never = operation;
        console.warn(`[charts/transforms] Unknown compute fn: ${String((_exhaustive as { fn: string }).fn)}`);
        computed = v;
      }
    }
    return { ...r, [outputField]: computed };
  });
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
      case 'compute': result = applyCompute(result, t); break;
      default: {
        const _exhaustive: never = t;
        console.warn(`[charts/transforms] Unknown transform type: ${String((_exhaustive as DataTransform).type)}`);
      }
    }
  }
  return result;
}
