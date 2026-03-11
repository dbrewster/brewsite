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

  it('getTimeSliceCount returns distinct value count for timeField', () => {
    store.register('heat', [
      { week: 'W1', v: 1 },
      { week: 'W2', v: 2 },
      { week: 'W3', v: 3 },
      { week: 'W1', v: 4 },
    ]);
    expect(store.getTimeSliceCount('heat', 'week')).toBe(3);
  });

  it('getTimeSliceCount returns 0 for unregistered source', () => {
    expect(store.getTimeSliceCount('nonexistent', 'week')).toBe(0);
  });

  it('registerInline registers under __inline__ key', () => {
    store.registerInline('chart-1', [{ x: 10 }, { x: 20 }]);
    const frame = store.resolve('__inline__chart-1', []);
    expect(frame.rows).toHaveLength(2);
    expect(frame.rows[0]!['x']).toBe(10);
  });

  it('register() accepts columnar data and transposes to rows', () => {
    store.register('columnar', { month: ['Jan', 'Feb', 'Mar'], rev: [100, 200, 300] });
    const frame = store.resolve('columnar', []);
    expect(frame.rows).toHaveLength(3);
    expect(frame.rows[0]).toEqual({ month: 'Jan', rev: 100 });
    expect(frame.rows[2]).toEqual({ month: 'Mar', rev: 300 });
  });

  it('register() with empty columnar data stores empty rows and empty fields', () => {
    store.register('empty-col', {});
    const frame = store.resolve('empty-col', []);
    expect(frame.rows).toHaveLength(0);
    expect(frame.fields).toHaveLength(0);
  });

  // ─── V2.1 live override methods ───────────────────────────────────────────

  it('setLiveOverride marks widgetId as having active override', () => {
    store.setLiveOverride('w1');
    expect(store.hasLiveOverride('w1')).toBe(true);
  });

  it('hasLiveOverride returns false for unknown widgetId', () => {
    expect(store.hasLiveOverride('no-such-id')).toBe(false);
  });

  it('deregisterInline clears override flag', () => {
    store.setLiveOverride('w1');
    store.deregisterInline('w1');
    expect(store.hasLiveOverride('w1')).toBe(false);
  });

  it('deregisterInline removes __inline__ data from store', () => {
    store.registerInline('w1', [{ x: 1 }, { x: 2 }]);
    store.setLiveOverride('w1');
    store.deregisterInline('w1');
    // After deregister the source should no longer be found
    const frame = store.resolve('__inline__w1', []);
    expect(frame.rows).toHaveLength(0);
  });

  it('deregisterInline on unregistered widgetId does not throw', () => {
    expect(() => store.deregisterInline('nonexistent')).not.toThrow();
  });

  it('onDeregisterInline callback fires when deregisterInline is called', () => {
    let fired = false;
    store.onDeregisterInline('w1', () => { fired = true; });
    store.deregisterInline('w1');
    expect(fired).toBe(true);
  });

  it('onDeregisterInline unsubscribe prevents callback from firing', () => {
    let fired = false;
    const unsub = store.onDeregisterInline('w1', () => { fired = true; });
    unsub();
    store.deregisterInline('w1');
    expect(fired).toBe(false);
  });

  it('full override lifecycle: register → override active → deregister → override cleared', () => {
    store.registerInline('chart-a', [{ v: 42 }]);
    store.setLiveOverride('chart-a');

    expect(store.hasLiveOverride('chart-a')).toBe(true);
    expect(store.resolve('__inline__chart-a', []).rows).toHaveLength(1);

    store.deregisterInline('chart-a');

    expect(store.hasLiveOverride('chart-a')).toBe(false);
    expect(store.resolve('__inline__chart-a', []).rows).toHaveLength(0);
  });
});
