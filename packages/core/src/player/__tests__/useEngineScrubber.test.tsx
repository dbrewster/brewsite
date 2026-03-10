// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEngineScrubber } from '../useEngineScrubber';
import { EngineContext } from '../EngineContext';
import type { UseSceneEngineResult } from '../useSceneEngine';

afterEach(() => cleanup());

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
    media: '',
    onchange: null,
  }));
  window.requestAnimationFrame = vi.fn().mockReturnValue(1);
  window.cancelAnimationFrame = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

/** Builds a minimal engine double sufficient for useEngineScrubber. */
const makeEngine = (): UseSceneEngineResult => ({
  frameState: { tickIndex: 0, progress: 0.3, sceneId: 's1', sceneIndex: 0, sceneProgress: 0.3, tick: null },
  progress: 0.3,
  variableStore: {} as UseSceneEngineResult['variableStore'],
  setCanvasRef: vi.fn(),
  setViewportSize: vi.fn(),
  setBackgroundRef: vi.fn(),
  setRawProgress: vi.fn(),
  setProgress: vi.fn(),
  advanceProgress: vi.fn(),
  sceneTrack: null,
  sceneCount: 2,
  compiledScenes: [{ id: 's1', index: 0 }],
  progressMapper: null,
  getCamera: () => null,
  getRenderer: () => null,
  setCameraOverride: vi.fn(),
  getCameraOverride: () => null,
  setAutoAdvancePaused: vi.fn(),
  sceneOverlays: new Map(),
  debug: { assetsReady: false, viewport: { width: 800, height: 600 } },
});

const makeWrapper = (engine: UseSceneEngineResult) =>
  ({ children }: { children: React.ReactNode }) => (
    <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
  );

describe('useEngineScrubber', () => {
  it('starts with isScrubbing=false', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useEngineScrubber(), { wrapper: makeWrapper(engine) });
    expect(result.current.isScrubbing).toBe(false);
  });

  it('startScrub sets isScrubbing to true', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useEngineScrubber(), { wrapper: makeWrapper(engine) });
    act(() => result.current.startScrub());
    expect(result.current.isScrubbing).toBe(true);
  });

  it('stopScrub sets isScrubbing to false', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useEngineScrubber(), { wrapper: makeWrapper(engine) });
    act(() => result.current.startScrub());
    act(() => result.current.stopScrub());
    expect(result.current.isScrubbing).toBe(false);
  });

  it('setProgress calls engine.setProgress with clamped value', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useEngineScrubber(), { wrapper: makeWrapper(engine) });
    act(() => result.current.setProgress(0.6));
    expect(engine.setProgress).toHaveBeenCalledWith(0.6);
  });

  it('setProgress clamps value below 0 to 0', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useEngineScrubber(), { wrapper: makeWrapper(engine) });
    act(() => result.current.setProgress(-0.5));
    expect(engine.setProgress).toHaveBeenCalledWith(0);
  });

  it('setProgress clamps value above 1 to 1', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useEngineScrubber(), { wrapper: makeWrapper(engine) });
    act(() => result.current.setProgress(1.5));
    expect(engine.setProgress).toHaveBeenCalledWith(1);
  });

  it('throws when used outside SceneEngine context', () => {
    expect(() => renderHook(() => useEngineScrubber())).toThrow(
      '[useSceneEngineContext] must be used inside <SceneEngine>',
    );
  });
});
