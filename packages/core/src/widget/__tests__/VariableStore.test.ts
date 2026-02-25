// VariableStore tests — interface-based stateful tests.
// Tests exercise the public contract through real inputs and observable outputs.
// No mocks of internal calls.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VariableStore } from '../VariableStore';

describe('VariableStore', () => {
  let store: VariableStore;

  beforeEach(() => {
    store = new VariableStore();
  });

  // ─── get / set ────────────────────────────────────────────────────────────

  it('returns undefined for an unset key', () => {
    expect(store.get('ns', 'missing')).toBeUndefined();
  });

  it('round-trips a string value', () => {
    store.set('scene', 'id', 'intro');
    expect(store.get('scene', 'id')).toBe('intro');
  });

  it('round-trips a number value', () => {
    store.set('scene', 'progress', 0.42);
    expect(store.get('scene', 'progress')).toBe(0.42);
  });

  it('round-trips a boolean value', () => {
    store.set('flags', 'active', true);
    expect(store.get('flags', 'active')).toBe(true);
  });

  it('round-trips null', () => {
    store.set('ns', 'key', null);
    expect(store.get('ns', 'key')).toBeNull();
  });

  it('overwrites an existing value', () => {
    store.set('ns', 'key', 1);
    store.set('ns', 'key', 2);
    expect(store.get('ns', 'key')).toBe(2);
  });

  it('keeps keys in separate namespaces independent', () => {
    store.set('a', 'key', 10);
    store.set('b', 'key', 20);
    expect(store.get('a', 'key')).toBe(10);
    expect(store.get('b', 'key')).toBe(20);
  });

  // ─── subscribe / notify ───────────────────────────────────────────────────

  it('notifies a key-level subscriber when value changes', () => {
    const listener = vi.fn();
    store.subscribe('scene.id', listener);
    store.set('scene', 'id', 'intro');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does NOT notify when value is set to the same primitive', () => {
    store.set('ns', 'key', 42);
    const listener = vi.fn();
    store.subscribe('ns.key', listener);
    store.set('ns', 'key', 42); // unchanged
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('notifies after an unrelated key changes in the same namespace', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    store.subscribe('ns.a', listenerA);
    store.subscribe('ns.b', listenerB);
    store.set('ns', 'a', 1);
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(0);
  });

  it('unsubscribe stops further notifications', () => {
    const listener = vi.fn();
    const unsub = store.subscribe('ns.key', listener);
    store.set('ns', 'key', 1);
    unsub();
    store.set('ns', 'key', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies a namespace-level subscriber on any key change in that namespace', () => {
    const nsListener = vi.fn();
    store.subscribe('scene', nsListener);
    store.set('scene', 'id', 'intro');
    store.set('scene', 'index', 0);
    expect(nsListener).toHaveBeenCalledTimes(2);
  });

  it('does not notify namespace listener for changes in another namespace', () => {
    const nsListener = vi.fn();
    store.subscribe('scene', nsListener);
    store.set('other', 'key', 1);
    expect(nsListener).toHaveBeenCalledTimes(0);
  });

  // ─── getNamespace ─────────────────────────────────────────────────────────

  it('getNamespace returns all keys set in that namespace', () => {
    store.set('scene', 'id', 'intro');
    store.set('scene', 'index', 0);
    store.set('other', 'x', 99);
    const ns = store.getNamespace('scene');
    expect(ns).toEqual({ id: 'intro', index: 0 });
  });

  it('getNamespace returns empty object for unknown namespace', () => {
    expect(store.getNamespace('unknown')).toEqual({});
  });

  it('getNamespace returns latest value after overwrite', () => {
    store.set('ns', 'key', 1);
    store.set('ns', 'key', 2);
    expect(store.getNamespace('ns')).toEqual({ key: 2 });
  });
});
