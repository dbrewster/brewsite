// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEngineState } from '../useEngineState';
import { EngineStateContext } from '../EngineStateContext';
import {
  setEngineSnapshot,
  unregisterSceneRuntime,
} from '../ScenePlayerRegistry';
import type { EngineFrameState } from '../engineTypes';

afterEach(() => {
  cleanup();
  unregisterSceneRuntime('test-engine');
  vi.restoreAllMocks();
});

const makeFrameState = (overrides: Partial<EngineFrameState> = {}): EngineFrameState => ({
  tickIndex: 0,
  progress: 0.5,
  sceneId: 'scene-1',
  sceneIndex: 0,
  sceneProgress: 0.5,
  ...overrides,
});

describe('useEngineState (no id — local context path)', () => {
  it('reads EngineFrameState from nearest EngineStateContext', () => {
    const state = makeFrameState({ progress: 0.42, sceneId: 'intro' });

    const { result } = renderHook(() => useEngineState(), {
      wrapper: ({ children }) => (
        <EngineStateContext.Provider value={state}>
          {children}
        </EngineStateContext.Provider>
      ),
    });

    expect(result.current).toEqual(state);
  });

  it('throws when called outside SceneEngine context', () => {
    expect(() => renderHook(() => useEngineState())).toThrow(
      '[useEngineState] must be called inside a <SceneEngine>',
    );
  });
});

describe('useEngineState (with id — global registry path)', () => {
  it('returns null when engine with given id is not mounted', () => {
    const { result } = renderHook(() => useEngineState('nonexistent-engine'));
    expect(result.current).toBeNull();
  });

  it('returns snapshot when engine with given id is registered', () => {
    setEngineSnapshot('test-engine', {
      sceneId: 'scene-a',
      sceneIndex: 2,
      sceneProgress: 0.3,
      progress: 0.7,
    });

    const { result } = renderHook(() => useEngineState('test-engine'));

    expect(result.current).toEqual({
      sceneId: 'scene-a',
      sceneIndex: 2,
      sceneProgress: 0.3,
      progress: 0.7,
    });
  });

  it('updates live when the engine ticks (registry subscription)', () => {
    setEngineSnapshot('test-engine', {
      sceneId: 'scene-a',
      sceneIndex: 0,
      sceneProgress: 0,
      progress: 0,
    });

    const { result } = renderHook(() => useEngineState('test-engine'));

    expect(result.current?.progress).toBe(0);

    act(() => {
      setEngineSnapshot('test-engine', {
        sceneId: 'scene-b',
        sceneIndex: 1,
        sceneProgress: 0.5,
        progress: 0.5,
      });
    });

    expect(result.current?.progress).toBe(0.5);
    expect(result.current?.sceneId).toBe('scene-b');
  });

  it('returns null for a never-registered engine id', () => {
    // Verify that an id with no registered engine returns null (not stale data).
    const { result } = renderHook(() => useEngineState('completely-unknown'));
    expect(result.current).toBeNull();
  });
});
