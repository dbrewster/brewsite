// @vitest-environment jsdom
// useSceneLoadState.test.ts — Hook tests for per-scene loading state.

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import { SceneLoadStateContext, useSceneLoadState } from '../useSceneLoadState';

// ---------------------------------------------------------------------------
// Minimal test double for the driver's scene load state API
// ---------------------------------------------------------------------------

class FakeDriver {
  private listeners = new Set<() => void>();
  private snapshot: { loadedScenes: ReadonlySet<number>; loadingScenes: ReadonlySet<number> } = {
    loadedScenes: new Set<number>(),
    loadingScenes: new Set<number>(),
  };

  subscribeSceneLoadState(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSceneLoadState(): { loadedScenes: ReadonlySet<number>; loadingScenes: ReadonlySet<number> } {
    return this.snapshot;
  }

  /** Test helper: update snapshot and notify listeners. */
  setSnapshot(loaded: number[], loading: number[]): void {
    this.snapshot = {
      loadedScenes: new Set(loaded),
      loadingScenes: new Set(loading),
    };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSceneLoadState', () => {
  it('returns empty sets when no driver is provided', () => {
    const { result } = renderHook(() => useSceneLoadState());

    expect(result.current.loadedScenes.size).toBe(0);
    expect(result.current.loadingScenes.size).toBe(0);
  });

  it('returns current loaded/loading sets from driver', () => {
    const fakeDriver = new FakeDriver();
    fakeDriver.setSnapshot([0, 1], [2]);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(
        SceneLoadStateContext.Provider,
        // Cast FakeDriver as the expected type since it implements the same API shape
        { value: { driver: fakeDriver as never } },
        children,
      );

    const { result } = renderHook(() => useSceneLoadState(), { wrapper });

    expect(result.current.loadedScenes.has(0)).toBe(true);
    expect(result.current.loadedScenes.has(1)).toBe(true);
    expect(result.current.loadingScenes.has(2)).toBe(true);
  });

  it('re-renders when driver notifies scene load state change', () => {
    const fakeDriver = new FakeDriver();
    fakeDriver.setSnapshot([], [0]);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(
        SceneLoadStateContext.Provider,
        { value: { driver: fakeDriver as never } },
        children,
      );

    const { result } = renderHook(() => useSceneLoadState(), { wrapper });

    expect(result.current.loadingScenes.has(0)).toBe(true);
    expect(result.current.loadedScenes.has(0)).toBe(false);

    // Simulate load completion
    act(() => {
      fakeDriver.setSnapshot([0], []);
    });

    expect(result.current.loadedScenes.has(0)).toBe(true);
    expect(result.current.loadingScenes.size).toBe(0);
  });
});
