// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useGoToScene } from '../useGoToScene';
import { EngineContext } from '../EngineContext';
import { ScrollNavigatorContext } from '../ScrollNavigatorContext';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { ScrollNavigatorContextValue } from '../ScrollNavigatorContext';

afterEach(() => cleanup());

/** Builds a minimal engine double for useGoToScene. */
const makeEngine = (
  overrides: Partial<UseSceneEngineResult> = {},
): UseSceneEngineResult => ({
  frameState: { tickIndex: 0, progress: 0, sceneId: 's1', sceneIndex: 0, sceneProgress: 0, tick: null },
  progress: 0,
  variableStore: {} as UseSceneEngineResult['variableStore'],
  setCanvasRef: vi.fn(),
  setViewportSize: vi.fn(),
  setBackgroundRef: vi.fn(),
  setRawProgress: vi.fn(),
  setProgress: vi.fn(),
  advanceProgress: vi.fn(),
  sceneTrack: null,
  sceneCount: 3,
  compiledScenes: [
    { id: 's1', index: 0 },
    { id: 's2', index: 1 },
    { id: 's3', index: 2 },
  ],
  progressMapper: null,
  getCamera: () => null,
  getRenderer: () => null,
  setCameraOverride: vi.fn(),
  getCameraOverride: () => null,
  setAutoAdvancePaused: vi.fn(),
  sceneOverlays: new Map(),
  debug: { assetsReady: false, viewport: { width: 800, height: 600 } },
  ...overrides,
});

const makeWrapper = (
  engine: UseSceneEngineResult,
  scrollNavigator: ScrollNavigatorContextValue | null = null,
) =>
  ({ children }: { children: React.ReactNode }) => (
    <EngineContext.Provider value={engine}>
      <ScrollNavigatorContext.Provider value={scrollNavigator}>
        {children}
      </ScrollNavigatorContext.Provider>
    </EngineContext.Provider>
  );

describe('useGoToScene', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigation by id calls engine.setProgress with correct target progress', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useGoToScene(), { wrapper: makeWrapper(engine) });

    act(() => result.current('s3'));

    // s3 is index 2, sceneCount=3: progress = 2 / (3-1) = 1.0
    expect(engine.setProgress).toHaveBeenCalledWith(1.0);
  });

  it('navigation to first scene (id) gives progress 0', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useGoToScene(), { wrapper: makeWrapper(engine) });

    act(() => result.current('s1'));

    expect(engine.setProgress).toHaveBeenCalledWith(0);
  });

  it('navigation by index calls engine.setProgress with correct target progress', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useGoToScene(), { wrapper: makeWrapper(engine) });

    act(() => result.current(1));

    // index 1, sceneCount=3: progress = 1 / (3-1) = 0.5
    expect(engine.setProgress).toHaveBeenCalledWith(0.5);
  });

  it('unknown id logs a warning and does not call engine.setProgress', () => {
    const engine = makeEngine();
    const { result } = renderHook(() => useGoToScene(), { wrapper: makeWrapper(engine) });

    act(() => result.current('nonexistent'));

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('"nonexistent" not found'),
    );
    expect(engine.setProgress).not.toHaveBeenCalled();
  });

  it('calls scrollNavigator.scrollTo when present (no mapper)', () => {
    const engine = makeEngine();
    const scrollTo = vi.fn();
    const scrollNavigator: ScrollNavigatorContextValue = { scrollTo };

    const { result } = renderHook(() => useGoToScene(), {
      wrapper: makeWrapper(engine, scrollNavigator),
    });

    act(() => result.current('s2'));

    // s2 is index 1, sceneCount=3: targetProgress = 0.5; no mapper → scrollTo(0.5)
    expect(scrollTo).toHaveBeenCalledWith(0.5);
    expect(engine.setProgress).not.toHaveBeenCalled();
  });

  it('calls scrollNavigator.scrollTo with inverse-mapped progress when mapper is present', () => {
    const mockProgressMapper = {
      remap: (raw: number) => raw * 2,
      inverse: (mapped: number) => mapped / 2,
    };
    const engine = makeEngine({ progressMapper: mockProgressMapper as UseSceneEngineResult['progressMapper'] });
    const scrollTo = vi.fn();
    const scrollNavigator: ScrollNavigatorContextValue = { scrollTo };

    const { result } = renderHook(() => useGoToScene(), {
      wrapper: makeWrapper(engine, scrollNavigator),
    });

    act(() => result.current('s2'));

    // s2 is index 1, sceneCount=3: targetProgress = 0.5
    // inverse(0.5) = 0.5 / 2 = 0.25
    expect(scrollTo).toHaveBeenCalledWith(0.25);
  });

  it('single scene: progress is always 0', () => {
    const engine = makeEngine({
      sceneCount: 1,
      compiledScenes: [{ id: 'only', index: 0 }],
    });
    const { result } = renderHook(() => useGoToScene(), { wrapper: makeWrapper(engine) });

    act(() => result.current('only'));

    expect(engine.setProgress).toHaveBeenCalledWith(0);
  });
});
