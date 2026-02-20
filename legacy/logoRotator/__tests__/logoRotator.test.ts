import {describe, expect, it} from 'vitest';
import {createLogoRotator} from '../logoRotator';

describe('logoRotator', () => {
  it('advances based on interval and hold multiplier', () => {
    const rotator = createLogoRotator(['alpha', 'beta'], {
      intervalMs: 1000,
      holdMultiplier: (id) => (id === 'alpha' ? 2 : 1),
    });

    let state = rotator.getState();
    expect(state.currentId).toBe('alpha');
    expect(state.nextId).toBe('beta');

    state = rotator.tick(1000);
    expect(state.currentId).toBe('alpha');
    expect(state.progress).toBeCloseTo(0.5, 4);

    state = rotator.tick(1000);
    expect(state.currentId).toBe('beta');
    expect(state.elapsedMs).toBe(0);

    state = rotator.tick(1000);
    expect(state.currentId).toBe('alpha');
  });

  it('honors order when updating ids', () => {
    const rotator = createLogoRotator(['a', 'b', 'c'], {
      intervalMs: 1000,
      order: ['c', 'b', 'a'],
    });

    rotator.setIds(['a', 'c']);
    const state = rotator.getState();
    expect(state.currentId).toBe('c');
    expect(state.nextId).toBe('a');
  });
});
