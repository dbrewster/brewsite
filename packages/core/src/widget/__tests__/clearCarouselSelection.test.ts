// Tests for clearCarouselSelection — imperative deselect for non-React contexts.

import { describe, it, expect } from 'vitest';
import { clearCarouselSelection } from '../clearCarouselSelection';
import { VariableStore } from '../VariableStore';

describe('clearCarouselSelection', () => {
  it('sets the selectedIndex key to null in the VariableStore', () => {
    const store = new VariableStore();
    store.set('carousel', 'products.selectedIndex', 2);
    expect(store.get('carousel', 'products.selectedIndex')).toBe(2);

    clearCarouselSelection('products', store);
    expect(store.get('carousel', 'products.selectedIndex')).toBe(null);
  });

  it('sets null even when no prior selection exists', () => {
    const store = new VariableStore();
    clearCarouselSelection('products', store);
    expect(store.get('carousel', 'products.selectedIndex')).toBe(null);
  });

  it('notifies subscribers when the selection is cleared', () => {
    const store = new VariableStore();
    store.set('carousel', 'my-layout.selectedIndex', 1);

    let notified = false;
    store.subscribe('carousel.my-layout.selectedIndex', () => { notified = true; });

    clearCarouselSelection('my-layout', store);
    expect(notified).toBe(true);
  });
});
