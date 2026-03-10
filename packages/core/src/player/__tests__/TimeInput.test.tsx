// @vitest-environment jsdom
// Tests for TimeInput: time-based progress advance, loop, max, resetOnExit.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { EngineContext } from '../EngineContext';
import { TimeInput } from '../TimeInput';
import type { UseSceneEngineResult } from '../useSceneEngine';

// ─── Minimal engine double ────────────────────────────────────────────────────

function makeEngine(initialProgress = 0): { engine: UseSceneEngineResult; getProgress: () => number } {
  let progress = initialProgress;
  const engine = {
    frameState: {
      tickIndex: 0,
      progress: initialProgress,
      sceneId: 's1',
      sceneIndex: 0,
      sceneProgress: 0,
    },
    progress: initialProgress,
    variableStore: {} as never,
    setCanvasRef: vi.fn(),
    setViewportSize: vi.fn(),
    setBackgroundRef: vi.fn(),
    setRawProgress: vi.fn(),
    setProgress: vi.fn((v: number) => {
      progress = v;
      engine.frameState = { ...engine.frameState, progress: v };
      engine.progress = v;
    }),
    advanceProgress: vi.fn(),
    sceneTrack: null,
    sceneCount: 3,
    compiledScenes: [],
    progressMapper: null,
    getCamera: vi.fn(() => null),
    getRenderer: vi.fn(() => null),
    setCameraOverride: vi.fn(),
    getCameraOverride: vi.fn(() => null),
    setAutoAdvancePaused: vi.fn(),
    sceneOverlays: new Map(),
  } as UseSceneEngineResult;

  return { engine, getProgress: () => progress };
}

// ─── RAF control ──────────────────────────────────────────────────────────────

let rafCallbacks: Array<(ts: number) => void> = [];
let currentTime = 0;

function setupFakeRaf(): void {
  rafCallbacks = [];
  currentTime = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (ts: number) => void) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

function flushRaf(deltaMs = 16): void {
  const pending = [...rafCallbacks];
  rafCallbacks = [];
  currentTime += deltaMs;
  pending.forEach((cb) => cb(currentTime));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setupFakeRaf();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TimeInput — time-based advance', () => {
  it('does not advance on first tick (initializes timestamp)', () => {
    const { engine } = makeEngine(0);
    render(
      <EngineContext.Provider value={engine}>
        <TimeInput duration={1} />
      </EngineContext.Provider>,
    );

    act(() => { flushRaf(16); });
    // First frame sets lastTimestamp — no setProgress yet
    expect(engine.setProgress).not.toHaveBeenCalled();
  });

  it('advances progress by elapsed/duration on subsequent ticks', () => {
    const { engine } = makeEngine(0);
    render(
      <EngineContext.Provider value={engine}>
        <TimeInput duration={1} />
      </EngineContext.Provider>,
    );

    // Frame 1: initialize timestamp
    act(() => { flushRaf(0); });
    // Frame 2: 100ms elapsed → delta = 0.1 / 1.0 = 0.1
    act(() => { flushRaf(100); });

    expect(engine.setProgress).toHaveBeenCalledWith(expect.closeTo(0.1, 5));
  });

  it('clamps at max=1.0 when loop=false (default)', () => {
    const { engine } = makeEngine(0.95);
    render(
      <EngineContext.Provider value={engine}>
        <TimeInput duration={1} />
      </EngineContext.Provider>,
    );

    act(() => { flushRaf(0); });
    // 500ms elapsed → delta=0.5 → 0.95+0.5 = 1.45 → clamp to 1.0
    act(() => { flushRaf(500); });

    expect(engine.setProgress).toHaveBeenCalledWith(1);
  });

  it('wraps to 0 when loop=true and progress exceeds max', () => {
    const { engine } = makeEngine(0.9);
    render(
      <EngineContext.Provider value={engine}>
        <TimeInput duration={1} max={1.0} loop />
      </EngineContext.Provider>,
    );

    act(() => { flushRaf(0); });
    // 500ms elapsed → delta=0.5 → 0.9+0.5 = 1.4 → 1.4 % 1.0 = 0.4
    act(() => { flushRaf(500); });

    const calls = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls;
    const lastArg = calls[calls.length - 1][0] as number;
    expect(lastArg).toBeCloseTo(0.4, 3);
  });

  it('respects custom max value', () => {
    const { engine } = makeEngine(0.4);
    render(
      <EngineContext.Provider value={engine}>
        <TimeInput duration={1} max={0.5} />
      </EngineContext.Provider>,
    );

    act(() => { flushRaf(0); });
    // 500ms → delta=0.5 → 0.4+0.5 = 0.9 → clamp to max=0.5
    act(() => { flushRaf(500); });

    expect(engine.setProgress).toHaveBeenCalledWith(0.5);
  });

  it('stops advancing after reaching max (no more setProgress calls)', () => {
    const { engine } = makeEngine(0.99);
    render(
      <EngineContext.Provider value={engine}>
        <TimeInput duration={1} />
      </EngineContext.Provider>,
    );

    act(() => { flushRaf(0); });
    act(() => { flushRaf(500); }); // hits max

    const countAfterMax = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => { flushRaf(500); });
    act(() => { flushRaf(500); });
    expect((engine.setProgress as ReturnType<typeof vi.fn>).mock.calls.length).toBe(countAfterMax);
  });
});

describe('TimeInput — pauseWhenHidden / resetOnExit', () => {
  it('renders a zero-size anchor div', () => {
    const { engine } = makeEngine(0);
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <TimeInput duration={1} />
      </EngineContext.Provider>,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.tagName).toBe('DIV');
    expect(div.style.width).toBe('0px');
    expect(div.style.height).toBe('0px');
  });
});
