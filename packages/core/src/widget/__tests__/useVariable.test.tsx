// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useVariable } from '../useVariable';
import { VariableStore } from '../VariableStore';
import { VariableStoreContext } from '../VariableStoreContext';

const wrap = (store: VariableStore, child: React.ReactElement): React.ReactElement => (
  <VariableStoreContext.Provider value={store}>
    {child}
  </VariableStoreContext.Provider>
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useVariable', () => {
  it('returns undefined when key has not been set', () => {
    const store = new VariableStore();
    const { result } = renderHook(() => useVariable('ns', 'missing'), {
      wrapper: ({ children }) => wrap(store, children as React.ReactElement),
    });
    expect(result.current).toBeUndefined();
  });

  it('returns the current value from the store at render time', () => {
    const store = new VariableStore();
    store.set('scene', 'id', 'intro');
    const { result } = renderHook(() => useVariable('scene', 'id'), {
      wrapper: ({ children }) => wrap(store, children as React.ReactElement),
    });
    expect(result.current).toBe('intro');
  });

  it('returns a number value', () => {
    const store = new VariableStore();
    store.set('scene', 'progress', 0.5);
    const { result } = renderHook(() => useVariable<number>('scene', 'progress'), {
      wrapper: ({ children }) => wrap(store, children as React.ReactElement),
    });
    expect(result.current).toBe(0.5);
  });

  it('re-renders and returns the new value when the variable changes', () => {
    const store = new VariableStore();
    store.set('scene', 'index', 0);
    const values: unknown[] = [];
    const { result } = renderHook(() => {
      const val = useVariable('scene', 'index');
      values.push(val);
      return val;
    }, {
      wrapper: ({ children }) => wrap(store, children as React.ReactElement),
    });

    act(() => { store.set('scene', 'index', 1); });
    expect(values).toContain(0);
    expect(values).toContain(1);
    expect(result.current).toBe(1);
  });

  it('does NOT re-render when the value is set to the same primitive', () => {
    const store = new VariableStore();
    store.set('ns', 'key', 99);
    let renderCount = 0;
    renderHook(() => {
      useVariable('ns', 'key');
      renderCount++;
      return null;
    }, {
      wrapper: ({ children }) => wrap(store, children as React.ReactElement),
    });
    const countAfterMount = renderCount;
    act(() => { store.set('ns', 'key', 99); });
    expect(renderCount).toBe(countAfterMount);
  });

  it('throws a descriptive error when used outside VariableStoreContext', () => {
    expect(() => renderHook(() => useVariable('ns', 'key'))).toThrow('[useVariable]');
  });
});
