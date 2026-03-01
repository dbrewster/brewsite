// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { EngineStateContext } from '../EngineStateContext';
import { useSceneProgress } from '../useSceneProgress';
import { useCurrentScene } from '../useCurrentScene';

describe('Engine state hooks', () => {
  it('useSceneProgress reads sceneProgress (blockProgress) from context', () => {
    const { result } = renderHook(() => useSceneProgress(), {
      wrapper: ({ children }) => (
        <EngineStateContext.Provider value={{ progress: 0.42, sceneId: 'a', sceneIndex: 0, sceneProgress: 0.1 }}>
          {children}
        </EngineStateContext.Provider>
      ),
    });
    // Returns scene-local blockProgress [0, 1], not global progress.
    expect(result.current).toBe(0.1);
  });

  it('useCurrentScene reads id and index from context', () => {
    const { result } = renderHook(() => useCurrentScene(), {
      wrapper: ({ children }) => (
        <EngineStateContext.Provider value={{ progress: 0.2, sceneId: 'intro', sceneIndex: 3, sceneProgress: 0.5 }}>
          {children}
        </EngineStateContext.Provider>
      ),
    });
    expect(result.current).toEqual({ id: 'intro', index: 3 });
  });

  it('throws when hooks are used outside provider', () => {
    expect(() => renderHook(() => useSceneProgress())).toThrow('[useEngineState]');
  });
});
