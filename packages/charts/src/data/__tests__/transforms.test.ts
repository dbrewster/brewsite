import { describe, it, expect } from 'vitest';
import {
  applyFilter,
  applyGroupBy,
  applySort,
  applyBin,
  applyCompute,
  applyTransforms,
  evaluateFilterOp,
  normalizeDataInput,
  parseCsv,
} from '../transforms';

describe('evaluateFilterOp', () => {
  it('eq compares by strict equality', () => {
    expect(evaluateFilterOp(2025, 'eq', 2025)).toBe(true);
    expect(evaluateFilterOp(2024, 'eq', 2025)).toBe(false);
    expect(evaluateFilterOp('APAC', 'eq', 'APAC')).toBe(true);
  });

  it('neq compares by strict inequality', () => {
    expect(evaluateFilterOp(2025, 'neq', 2024)).toBe(true);
    expect(evaluateFilterOp(2025, 'neq', 2025)).toBe(false);
  });

  it('in checks membership', () => {
    expect(evaluateFilterOp('APAC', 'in', ['APAC', 'EMEA'])).toBe(true);
    expect(evaluateFilterOp('AMER', 'in', ['APAC', 'EMEA'])).toBe(false);
  });

  it('gt / lt work for numbers', () => {
    expect(evaluateFilterOp(10, 'gt', 5)).toBe(true);
    expect(evaluateFilterOp(3, 'gt', 5)).toBe(false);
    expect(evaluateFilterOp(3, 'lt', 5)).toBe(true);
  });

  it('gte / lte are inclusive', () => {
    expect(evaluateFilterOp(5, 'gte', 5)).toBe(true);
    expect(evaluateFilterOp(5, 'lte', 5)).toBe(true);
  });
});

describe('applyFilter', () => {
  const rows = [
    { year: 2024, region: 'APAC' },
    { year: 2025, region: 'EMEA' },
    { year: 2025, region: 'AMER' },
  ];

  it('eq operator filters correctly', () => {
    const result = applyFilter(rows, { type: 'filter', field: 'year', op: 'eq', value: 2025 });
    expect(result).toHaveLength(2);
  });

  it('in operator filters correctly', () => {
    const result = applyFilter(rows, {
      type: 'filter',
      field: 'region',
      op: 'in',
      value: ['APAC'],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!['region']).toBe('APAC');
  });

  it('gt operator filters correctly', () => {
    const result = applyFilter(rows, { type: 'filter', field: 'year', op: 'gt', value: 2024 });
    expect(result).toHaveLength(2);
  });
});

describe('applyGroupBy', () => {
  const rows = [
    { region: 'APAC', revenue: 100 },
    { region: 'APAC', revenue: 200 },
    { region: 'EMEA', revenue: 150 },
  ];

  it('sum aggregates correctly', () => {
    const result = applyGroupBy(rows, {
      type: 'groupBy',
      field: 'region',
      valueField: 'revenue',
      aggregate: 'sum',
    });
    const apac = result.find((r) => r['region'] === 'APAC');
    expect(apac?.['revenue']).toBe(300);
  });

  it('count aggregates correctly', () => {
    const result = applyGroupBy(rows, {
      type: 'groupBy',
      field: 'region',
      aggregate: 'count',
    });
    const apac = result.find((r) => r['region'] === 'APAC');
    expect(apac?.['count']).toBe(2);
  });

  it('mean aggregates correctly', () => {
    const result = applyGroupBy(rows, {
      type: 'groupBy',
      field: 'region',
      valueField: 'revenue',
      aggregate: 'mean',
    });
    const apac = result.find((r) => r['region'] === 'APAC');
    expect(apac?.['revenue']).toBe(150);
  });
});

describe('applySort', () => {
  const rows = [
    { value: 30 },
    { value: 10 },
    { value: 20 },
  ];

  it('sorts ascending', () => {
    const result = applySort(rows, { type: 'sort', field: 'value', direction: 'asc' });
    expect(result.map((r) => r['value'])).toEqual([10, 20, 30]);
  });

  it('sorts descending', () => {
    const result = applySort(rows, { type: 'sort', field: 'value', direction: 'desc' });
    expect(result.map((r) => r['value'])).toEqual([30, 20, 10]);
  });

  it('does not mutate the input array', () => {
    const original = [...rows];
    applySort(rows, { type: 'sort', field: 'value', direction: 'asc' });
    expect(rows).toEqual(original);
  });
});

describe('applyBin', () => {
  const rows = [{ v: 1 }, { v: 2 }, { v: 5 }, { v: 8 }, { v: 9 }];

  it('returns bins with x0, x1, count', () => {
    const result = applyBin(rows, { type: 'bin', field: 'v', thresholds: 2 });
    expect(result.length).toBeGreaterThan(0);
    for (const b of result) {
      expect(b).toHaveProperty('x0');
      expect(b).toHaveProperty('x1');
      expect(b).toHaveProperty('count');
    }
  });
});

describe('normalizeDataInput', () => {
  it('row array passthrough: returns same values', () => {
    const input = [{ a: 1 }];
    const result = normalizeDataInput(input);
    expect(result).toEqual([{ a: 1 }]);
  });

  it('columnar 2-column input is transposed to rows', () => {
    const input = { month: ['Jan', 'Feb'], rev: [128, 145] };
    const result = normalizeDataInput(input);
    expect(result).toEqual([
      { month: 'Jan', rev: 128 },
      { month: 'Feb', rev: 145 },
    ]);
  });

  it('empty columnar object returns empty array', () => {
    expect(normalizeDataInput({})).toEqual([]);
  });

  it('single-column columnar is transposed', () => {
    const result = normalizeDataInput({ x: [1, 2, 3] });
    expect(result).toEqual([{ x: 1 }, { x: 2 }, { x: 3 }]);
  });
});

describe('parseCsv', () => {
  it('basic 2-column CSV produces correct rows with numeric coercion', () => {
    const result = parseCsv('a,b\n1,2\n3,4');
    expect(result).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
  });

  it('quoted field containing comma is parsed as single field', () => {
    const result = parseCsv('name,val\n"Foo, Inc",42');
    expect(result).toEqual([{ name: 'Foo, Inc', val: 42 }]);
  });

  it('trailing newline does not produce empty row', () => {
    const result = parseCsv('a,b\n1,2\n');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ a: 1, b: 2 });
  });

  it('date-like string stays as string; numeric string is coerced to number', () => {
    const result = parseCsv('date,amount\n2024-01-01,123.45');
    expect(result[0]!['date']).toBe('2024-01-01');
    expect(result[0]!['amount']).toBe(123.45);
  });

  it('returns empty array when input has fewer than 2 lines', () => {
    expect(parseCsv('a,b')).toEqual([]);
    expect(parseCsv('')).toEqual([]);
  });

  it('double-quoted quotes within a quoted field are unescaped', () => {
    const result = parseCsv('name,val\n"Say ""Hello""",1');
    expect(result[0]!['name']).toBe('Say "Hello"');
  });
});

describe('applyCompute', () => {
  const rows = [
    { v: 100 },
    { v: 4 },
    { v: 0 },
  ];

  it('log (natural): computes ln of each positive value', () => {
    const result = applyCompute(rows.slice(0, 2), {
      type: 'compute',
      outputField: 'logV',
      operation: { fn: 'log', inputField: 'v' },
    });
    expect(result[0]!['logV']).toBeCloseTo(Math.log(100));
    expect(result[1]!['logV']).toBeCloseTo(Math.log(4));
  });

  it('log (base 10): log10(100) = 2', () => {
    const result = applyCompute([{ v: 100 }], {
      type: 'compute',
      outputField: 'logV',
      operation: { fn: 'log', inputField: 'v', base: 10 },
    });
    expect(result[0]!['logV']).toBeCloseTo(2);
  });

  it('log with zero input uses Number.EPSILON to avoid -Infinity', () => {
    const result = applyCompute([{ v: 0 }], {
      type: 'compute',
      outputField: 'logV',
      operation: { fn: 'log', inputField: 'v' },
    });
    expect(Number.isFinite(result[0]!['logV'] as number)).toBe(true);
  });

  it('sqrt: computes square root', () => {
    const result = applyCompute([{ v: 9 }, { v: 25 }], {
      type: 'compute',
      outputField: 'sqrtV',
      operation: { fn: 'sqrt', inputField: 'v' },
    });
    expect(result[0]!['sqrtV']).toBeCloseTo(3);
    expect(result[1]!['sqrtV']).toBeCloseTo(5);
  });

  it('sqrt with negative value clamps to 0', () => {
    const result = applyCompute([{ v: -4 }], {
      type: 'compute',
      outputField: 'sqrtV',
      operation: { fn: 'sqrt', inputField: 'v' },
    });
    expect(result[0]!['sqrtV']).toBe(0);
  });

  it('normalize: maps values to [0, 1] range', () => {
    const result = applyCompute([{ v: 0 }, { v: 5 }, { v: 10 }], {
      type: 'compute',
      outputField: 'norm',
      operation: { fn: 'normalize', inputField: 'v' },
    });
    expect(result[0]!['norm']).toBeCloseTo(0);
    expect(result[1]!['norm']).toBeCloseTo(0.5);
    expect(result[2]!['norm']).toBeCloseTo(1);
  });

  it('normalize with all-same-value input returns 0 (range=0 edge case)', () => {
    const result = applyCompute([{ v: 7 }, { v: 7 }, { v: 7 }], {
      type: 'compute',
      outputField: 'norm',
      operation: { fn: 'normalize', inputField: 'v' },
    });
    expect(result[0]!['norm']).toBe(0);
    expect(result[1]!['norm']).toBe(0);
    expect(result[2]!['norm']).toBe(0);
  });

  it('scale: multiplies by factor', () => {
    const result = applyCompute([{ v: 4 }, { v: 10 }], {
      type: 'compute',
      outputField: 'scaled',
      operation: { fn: 'scale', inputField: 'v', factor: 2.5 },
    });
    expect(result[0]!['scaled']).toBeCloseTo(10);
    expect(result[1]!['scaled']).toBeCloseTo(25);
  });

  it('add: adds a constant value', () => {
    const result = applyCompute([{ v: 10 }, { v: 20 }], {
      type: 'compute',
      outputField: 'shifted',
      operation: { fn: 'add', inputField: 'v', value: 5 },
    });
    expect(result[0]!['shifted']).toBeCloseTo(15);
    expect(result[1]!['shifted']).toBeCloseTo(25);
  });

  it('preserves all existing fields on each row', () => {
    const result = applyCompute([{ v: 4, label: 'foo' }], {
      type: 'compute',
      outputField: 'sqrtV',
      operation: { fn: 'sqrt', inputField: 'v' },
    });
    expect(result[0]!['label']).toBe('foo');
    expect(result[0]!['sqrtV']).toBeCloseTo(2);
  });

  it('does not mutate input rows', () => {
    const input = [{ v: 9 }];
    applyCompute(input, {
      type: 'compute',
      outputField: 'out',
      operation: { fn: 'sqrt', inputField: 'v' },
    });
    expect(Object.keys(input[0]!)).not.toContain('out');
  });
});

describe('applyTransforms', () => {
  const rows = [
    { region: 'APAC', year: 2024, revenue: 100 },
    { region: 'APAC', year: 2025, revenue: 200 },
    { region: 'EMEA', year: 2025, revenue: 150 },
  ];

  it('composes filter + sort in order', () => {
    const result = applyTransforms(rows, [
      { type: 'filter', field: 'year', op: 'eq', value: 2025 },
      { type: 'sort', field: 'revenue', direction: 'asc' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!['revenue']).toBe(150);
    expect(result[1]!['revenue']).toBe(200);
  });

  it('returns copy of rows when transforms is empty', () => {
    const result = applyTransforms(rows, []);
    expect(result).toHaveLength(rows.length);
  });

  it('handles compute transform in pipeline', () => {
    const data = [{ region: 'APAC', revenue: 100 }, { region: 'EMEA', revenue: 400 }];
    const result = applyTransforms(data, [
      { type: 'compute', outputField: 'sqrtRev', operation: { fn: 'sqrt', inputField: 'revenue' } },
    ]);
    expect(result[0]!['sqrtRev']).toBeCloseTo(10);
    expect(result[1]!['sqrtRev']).toBeCloseTo(20);
  });
});
