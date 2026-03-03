// Unit tests for SimpleFilterEngine — IFilterEngine implementation.

import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleFilterEngine } from '../SimpleFilterEngine';

type Row = Record<string, unknown>;

const ROWS: ReadonlyArray<Row> = [
  { region: 'east', product: 'A', revenue: 100 },
  { region: 'west', product: 'B', revenue: 200 },
  { region: 'east', product: 'B', revenue: 150 },
  { region: 'west', product: 'A', revenue: 250 },
];

describe('SimpleFilterEngine', () => {
  let engine: SimpleFilterEngine;

  beforeEach(() => {
    engine = new SimpleFilterEngine();
  });

  it('register + getRows with no filters returns all rows', () => {
    engine.register('sales', ROWS);
    expect(engine.getRows('sales')).toEqual(ROWS);
  });

  it('register with filterGroupId + applyFilter returns only matching rows', () => {
    engine.register('sales', ROWS, 'grp1');
    engine.applyFilter('grp1', 'region', ['east']);
    const result = engine.getRows('sales');
    expect(result).toHaveLength(2);
    expect(result.every((r) => r['region'] === 'east')).toBe(true);
  });

  it('applyFilter with multiple dimensions uses AND logic', () => {
    engine.register('sales', ROWS, 'grp1');
    engine.applyFilter('grp1', 'region', ['east']);
    engine.applyFilter('grp1', 'product', ['B']);
    const result = engine.getRows('sales');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ region: 'east', product: 'B' });
  });

  it('applyFilter with values=[] clears that dimension', () => {
    engine.register('sales', ROWS, 'grp1');
    engine.applyFilter('grp1', 'region', ['east']);
    expect(engine.getRows('sales')).toHaveLength(2);

    engine.applyFilter('grp1', 'region', []);
    expect(engine.getRows('sales')).toHaveLength(4);
  });

  it('clearFilters removes all dimension filters for a group', () => {
    engine.register('sales', ROWS, 'grp1');
    engine.applyFilter('grp1', 'region', ['east']);
    engine.applyFilter('grp1', 'product', ['A']);
    expect(engine.getRows('sales')).toHaveLength(1);

    engine.clearFilters('grp1');
    expect(engine.getRows('sales')).toHaveLength(4);
  });

  it('subscribe listener fires on applyFilter', () => {
    let callCount = 0;
    engine.register('sales', ROWS, 'grp1');
    engine.subscribe('grp1', () => { callCount++; });
    engine.applyFilter('grp1', 'region', ['east']);
    expect(callCount).toBe(1);
  });

  it('subscribe listener fires on clearFilters', () => {
    let callCount = 0;
    engine.register('sales', ROWS, 'grp1');
    engine.subscribe('grp1', () => { callCount++; });
    engine.clearFilters('grp1');
    expect(callCount).toBe(1);
  });

  it('unsubscribe function stops notifications', () => {
    let callCount = 0;
    engine.register('sales', ROWS, 'grp1');
    const unsub = engine.subscribe('grp1', () => { callCount++; });
    unsub();
    engine.applyFilter('grp1', 'region', ['east']);
    expect(callCount).toBe(0);
  });

  it('multiple sources in same group — filter affects all', () => {
    const rows2: ReadonlyArray<Row> = [
      { region: 'east', units: 10 },
      { region: 'west', units: 20 },
    ];
    engine.register('sales', ROWS, 'shared');
    engine.register('units', rows2, 'shared');
    engine.applyFilter('shared', 'region', ['west']);
    expect(engine.getRows('sales')).toHaveLength(2);
    expect(engine.getRows('units')).toHaveLength(1);
  });

  it('source with no filterGroup is unaffected by group filters', () => {
    engine.register('sales', ROWS, 'grp1');
    engine.register('standalone', [{ region: 'east', v: 1 }, { region: 'west', v: 2 }]);
    engine.applyFilter('grp1', 'region', ['east']);
    expect(engine.getRows('standalone')).toHaveLength(2);
  });

  it('dispose clears all state', () => {
    engine.register('sales', ROWS, 'grp1');
    engine.applyFilter('grp1', 'region', ['east']);
    let callCount = 0;
    engine.subscribe('grp1', () => { callCount++; });

    engine.dispose();

    expect(engine.getRows('sales')).toHaveLength(0);
    expect(engine.getFilterGroupForSource('sales')).toBeUndefined();
    expect(engine.getActiveFilters('grp1').size).toBe(0);
  });

  it('getActiveFilters returns current filter state', () => {
    engine.register('sales', ROWS, 'grp1');
    engine.applyFilter('grp1', 'region', ['east']);
    const filters = engine.getActiveFilters('grp1');
    expect(filters.size).toBe(1);
    const regionFilter = filters.get('region');
    expect(regionFilter).toBeDefined();
    expect(regionFilter!.has('east')).toBe(true);
  });

  it('getActiveFilters returns empty map for unknown group', () => {
    expect(engine.getActiveFilters('nonexistent').size).toBe(0);
  });

  it('getFilterGroupForSource returns correct group', () => {
    engine.register('sales', ROWS, 'grp1');
    expect(engine.getFilterGroupForSource('sales')).toBe('grp1');
  });

  it('getFilterGroupForSource returns undefined when no group set', () => {
    engine.register('sales', ROWS);
    expect(engine.getFilterGroupForSource('sales')).toBeUndefined();
  });

  it('unregister removes source from tracking', () => {
    engine.register('sales', ROWS, 'grp1');
    engine.unregister('sales');
    expect(engine.getRows('sales')).toHaveLength(0);
    expect(engine.getFilterGroupForSource('sales')).toBeUndefined();
  });
});
