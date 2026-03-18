// @vitest-environment jsdom
// Tests for useCarouselSelection — reactive hook for carousel selection and focus state.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useCarouselSelection } from '../useCarouselSelection';
import { VariableStore } from '../VariableStore';
import { VariableStoreContext } from '../VariableStoreContext';

const wrap = (store: VariableStore, child: React.ReactElement): React.ReactElement => (
  <VariableStoreContext.Provider value={store}>
    {child}
  </VariableStoreContext.Provider>
);

const renderWithStore = (store: VariableStore, layoutId: string) =>
  renderHook(() => useCarouselSelection(layoutId), {
    wrapper: ({ children }) => wrap(store, children as React.ReactElement),
  });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCarouselSelection', () => {
  it('returns selectedIndex: null initially', () => {
    const store = new VariableStore();
    const { result } = renderWithStore(store, 'products');
    expect(result.current.selectedIndex).toBe(null);
  });

  it('returns the selected index after store.set', () => {
    const store = new VariableStore();
    const { result } = renderWithStore(store, 'products');

    act(() => { store.set('carousel', 'products.selectedIndex', 2); });
    expect(result.current.selectedIndex).toBe(2);
  });

  it('clearSelection sets selectedIndex back to null', () => {
    const store = new VariableStore();
    const { result } = renderWithStore(store, 'products');

    act(() => { store.set('carousel', 'products.selectedIndex', 3); });
    expect(result.current.selectedIndex).toBe(3);

    act(() => { result.current.clearSelection(); });
    expect(result.current.selectedIndex).toBe(null);
  });

  it('reads focusedIndex from the focusedIndex key', () => {
    const store = new VariableStore();
    store.set('carousel', 'products.focusedIndex', 5);
    const { result } = renderWithStore(store, 'products');
    expect(result.current.focusedIndex).toBe(5);
  });

  it('falls back to activeIndex when focusedIndex is not set', () => {
    const store = new VariableStore();
    store.set('carousel', 'products.activeIndex', 2);
    const { result } = renderWithStore(store, 'products');
    expect(result.current.focusedIndex).toBe(2);
  });

  it('prefers focusedIndex over activeIndex when both are set', () => {
    const store = new VariableStore();
    store.set('carousel', 'products.focusedIndex', 7);
    store.set('carousel', 'products.activeIndex', 3);
    const { result } = renderWithStore(store, 'products');
    expect(result.current.focusedIndex).toBe(7);
  });

  it('returns focusedIndex: 0 when neither key is set', () => {
    const store = new VariableStore();
    const { result } = renderWithStore(store, 'products');
    expect(result.current.focusedIndex).toBe(0);
  });

  it('returns childCount: 0 initially', () => {
    const store = new VariableStore();
    const { result } = renderWithStore(store, 'products');
    expect(result.current.childCount).toBe(0);
  });

  it('updates childCount when set in the store', () => {
    const store = new VariableStore();
    const { result } = renderWithStore(store, 'products');

    act(() => { store.set('carousel', 'products.childCount', 4); });
    expect(result.current.childCount).toBe(4);
  });

  it('throws when used outside VariableStoreContext', () => {
    expect(() => renderHook(() => useCarouselSelection('x'))).toThrow('[useCarouselSelection]');
  });
});
