import { describe, it, expect } from 'vitest';
import {
  applyFilter,
  applyGroupBy,
  applySort,
  applyBin,
  applyTransforms,
  evaluateFilterOp,
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
});
