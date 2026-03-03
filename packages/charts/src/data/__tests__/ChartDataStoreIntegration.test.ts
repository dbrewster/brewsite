// Integration tests for ChartDataStore — caching, filtering, subscriptions.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChartDataStore } from '../ChartDataStore';

type Row = Record<string, unknown>;

const ROWS: ReadonlyArray<Row> = [
  { region: 'east', revenue: 100 },
  { region: 'west', revenue: 200 },
  { region: 'east', revenue: 150 },
];

describe('ChartDataStore integration', () => {
  let store: ChartDataStore;

  beforeEach(() => {
    store = new ChartDataStore();
  });

  it('resolve returns memoized result on second call (same reference)', () => {
    store.register('sales', ROWS);
    const first = store.resolve('sales', []);
    const second = store.resolve('sales', []);
    expect(first).toBe(second);
  });

  it('resolve cache is invalidated after applyFilter', () => {
    store.register('sales', ROWS, 'grp1');
    const before = store.resolve('sales', []);
    store.applyFilter('grp1', 'region', ['east']);
    const after = store.resolve('sales', []);
    expect(before).not.toBe(after);
    expect(after.rows).toHaveLength(2);
  });

  it('register replaces existing source cleanly', () => {
    store.register('sales', [{ x: 1 }]);
    const first = store.resolve('sales', []);
    expect(first.rows).toHaveLength(1);

    store.register('sales', [{ x: 1 }, { x: 2 }, { x: 3 }]);
    const second = store.resolve('sales', []);
    expect(second.rows).toHaveLength(3);
    expect(first).not.toBe(second);
  });

  it('unregister evicts cache entry', () => {
    store.register('sales', ROWS);
    store.resolve('sales', []);
    store.unregister('sales');
    const frame = store.resolve('sales', []);
    expect(frame.rows).toHaveLength(0);
  });

  it('subscribeToSource fires when filter group changes', () => {
    let callCount = 0;
    store.register('sales', ROWS, 'grp1');
    store.subscribeToSource('sales', () => { callCount++; });
    store.applyFilter('grp1', 'region', ['east']);
    expect(callCount).toBe(1);
  });

  it('subscribeToSource falls back to source-name group when no filterGroupId', () => {
    let callCount = 0;
    store.register('sales', ROWS);
    const unsub = store.subscribeToSource('sales', () => { callCount++; });
    // Trigger on the fallback group (source name)
    store.applyFilter('sales', 'region', ['east']);
    expect(callCount).toBe(1);
    unsub();
  });

  it('unknown source returns EMPTY_FRAME with console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const frame = store.resolve('nonexistent', []);
    expect(frame.rows).toHaveLength(0);
    expect(frame.fields).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('getTimeSlice returns correct slice by field value index', () => {
    store.register('heat', [
      { t: 'jan', v: 1 },
      { t: 'feb', v: 2 },
      { t: 'jan', v: 3 },
      { t: 'mar', v: 4 },
    ]);
    const janSlice = store.getTimeSlice('heat', 't', 0);
    expect(janSlice.rows).toHaveLength(2);
    expect(janSlice.rows.every((r) => r['t'] === 'jan')).toBe(true);

    const febSlice = store.getTimeSlice('heat', 't', 1);
    expect(febSlice.rows).toHaveLength(1);
    expect(febSlice.rows[0]!['t']).toBe('feb');
  });

  it('getTimeSlice returns empty frame for out-of-range index', () => {
    store.register('heat', [{ t: 'jan', v: 1 }]);
    const frame = store.getTimeSlice('heat', 't', 99);
    expect(frame.rows).toHaveLength(0);
  });

  it('two ChartDataStore instances are fully isolated', () => {
    const store2 = new ChartDataStore();
    store.register('data', [{ v: 1 }]);
    store2.register('data', [{ v: 2 }, { v: 3 }]);

    expect(store.resolve('data', []).rows).toHaveLength(1);
    expect(store2.resolve('data', []).rows).toHaveLength(2);

    store.applyFilter('grp', 'v', [1]);
    // store2 should be unaffected
    expect(store2.resolve('data', []).rows).toHaveLength(2);
  });

  it('getActiveFilters returns current state via store', () => {
    store.register('sales', ROWS, 'grp1');
    store.applyFilter('grp1', 'region', ['east']);
    const filters = store.getActiveFilters('grp1');
    expect(filters.size).toBe(1);
    expect(filters.get('region')!.has('east')).toBe(true);
  });

  it('clearFilters clears and notifies', () => {
    let callCount = 0;
    store.register('sales', ROWS, 'grp1');
    store.subscribeToFilterGroup('grp1', () => { callCount++; });
    store.applyFilter('grp1', 'region', ['east']);
    expect(callCount).toBe(1);
    store.clearFilters('grp1');
    expect(callCount).toBe(2);
    expect(store.getActiveFilters('grp1').size).toBe(0);
  });

  it('clear releases all sources and filters', () => {
    store.register('a', [{ x: 1 }], 'grp1');
    store.register('b', [{ x: 2 }]);
    store.applyFilter('grp1', 'x', [1]);
    store.clear();
    expect(store.resolve('a', []).rows).toHaveLength(0);
    expect(store.resolve('b', []).rows).toHaveLength(0);
  });

  it('resolve applies transforms in order', () => {
    store.register('items', [
      { n: 1 },
      { n: 2 },
      { n: 3 },
      { n: 4 },
    ]);
    const frame = store.resolve('items', [
      { type: 'filter', field: 'n', op: 'gt', value: 1 },
      { type: 'sort', field: 'n', direction: 'desc' },
    ]);
    expect(frame.rows).toHaveLength(3);
    expect(frame.rows[0]!['n']).toBe(4);
  });
});
