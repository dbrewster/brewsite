import { describe, it, expect, beforeEach } from 'vitest';
import { ChartDataStore } from '../ChartDataStore';

describe('ChartDataStore', () => {
  let store: ChartDataStore;

  beforeEach(() => {
    store = new ChartDataStore();
  });

  it('resolves registered source with no transforms', () => {
    store.register('test', [{ x: 1 }, { x: 2 }]);
    const frame = store.resolve('test', []);
    expect(frame.rows).toHaveLength(2);
    expect(frame.fields).toContain('x');
  });

  it('returns empty frame with warning for unknown source', () => {
    const frame = store.resolve('unknown', []);
    expect(frame.rows).toHaveLength(0);
    expect(frame.fields).toHaveLength(0);
  });

  it('unregister removes source', () => {
    store.register('test', [{ x: 1 }]);
    store.unregister('test');
    const frame = store.resolve('test', []);
    expect(frame.rows).toHaveLength(0);
  });

  it('re-registration replaces existing source', () => {
    store.register('test', [{ x: 1 }]);
    store.register('test', [{ x: 1 }, { x: 2 }, { x: 3 }]);
    const frame = store.resolve('test', []);
    expect(frame.rows).toHaveLength(3);
  });

  it('instances are isolated — different data for same name', () => {
    const store2 = new ChartDataStore();
    store.register('shared-name', [{ v: 1 }]);
    store2.register('shared-name', [{ v: 2 }, { v: 3 }]);
    expect(store.resolve('shared-name', []).rows).toHaveLength(1);
    expect(store2.resolve('shared-name', []).rows).toHaveLength(2);
  });

  it('applies transforms during resolve', () => {
    store.register('items', [
      { n: 1 },
      { n: 2 },
      { n: 3 },
    ]);
    const frame = store.resolve('items', [
      { type: 'filter', field: 'n', op: 'gt', value: 1 },
    ]);
    expect(frame.rows).toHaveLength(2);
  });

  it('subscribeToFilterGroup returns unsubscribe fn', () => {
    let callCount = 0;
    const unsub = store.subscribeToFilterGroup('grp', () => { callCount++; });
    store.register('src', [{ x: 1 }]);
    // Manually trigger notification via a filter clear (no CF attached — just verify unsubscribe)
    unsub();
    expect(callCount).toBe(0); // no notifications were fired before unsubscribe
  });

  it('clear removes all sources', () => {
    store.register('a', [{ x: 1 }]);
    store.register('b', [{ x: 2 }]);
    store.clear();
    expect(store.resolve('a', []).rows).toHaveLength(0);
    expect(store.resolve('b', []).rows).toHaveLength(0);
  });

  it('getTimeSlice returns correct slice', () => {
    store.register('heat', [
      { t: 'jan', v: 1 },
      { t: 'feb', v: 2 },
      { t: 'jan', v: 3 },
    ]);
    const frame = store.getTimeSlice('heat', 't', 0);
    expect(frame.rows).toHaveLength(2); // two 'jan' rows
  });
});
