// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSceneRuntime } from '../useSceneRuntime';
import { setSceneRuntimeState, unregisterSceneRuntime } from '../ScenePlayerRegistry';

describe('useSceneRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    unregisterSceneRuntime('present-player');
    vi.restoreAllMocks();
  });

  it('warns in development when target player is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(() => useSceneRuntime('missing-player'));
    vi.advanceTimersByTime(1001);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing-player'));
  });

  it('returns published runtime state', () => {
    setSceneRuntimeState('present-player', {
      assetsReady: true,
      viewport: { width: 640, height: 480, aspectRatio: 640 / 480 },
      variables: undefined,
      numScenes: 2,
    });

    const { result } = renderHook(() => useSceneRuntime('present-player'));
    expect(result.current.assetsReady).toBe(true);
    expect(result.current.viewport.width).toBe(640);
    expect(result.current.numScenes).toBe(2);
  });
});
