// @vitest-environment jsdom
// Tests for useAutoPlay: RAF-based wall-clock progress driver for auto-playing embeds.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAutoPlay } from '../useAutoPlay';
import { EngineContext } from '../EngineContext';
import type { UseSceneEngineResult } from '../useSceneEngine';

// ─── Minimal engine double ────────────────────────────────────────────────────

function makeEngine(initialProgress = 0): UseSceneEngineResult {
  let progress = initialProgress;
  const engine = {
    frameState: {
      tickIndex: 0,
      progress: initialProgress,
      sceneId: 's1',
      sceneIndex: 0,
      sceneProgress: 0,
      tick: null,
    },
    progress: initialProgress,
    variableStore: {} as UseSceneEngineResult['variableStore'],
    canvasRef: { current: null },
    canvasElement: null,
    setCanvasRef: vi.fn(),
    setViewportSize: vi.fn(),
    setBackgroundRef: vi.fn(),
    setControlledProgress: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    addPreTickCallback: vi.fn(),
    removePreTickCallback: vi.fn(),
    setRawProgress: vi.fn(),
    setProgress: vi.fn((v: number) => {
      progress = v;
      engine.frameState = { ...engine.frameState, progress: v };
      engine.progress = v;
    }),
    advanceProgress: vi.fn(),
    sceneTrack: null,
    sceneCount: 1,
    compiledScenes: [{ id: 's1', index: 0 }],
    progressMapper: null,
    getCamera: vi.fn(() => null),
    getRenderer: vi.fn(() => null),
    setCameraOverride: vi.fn(),
    getCameraOverride: vi.fn(() => null),
    setAutoAdvancePaused: vi.fn(),
    sceneOverlays: new Map(),
    debug: { assetsReady: false, viewport: { width: 800, height: 600 } },
  } as UseSceneEngineResult;

  return engine;
}

// ─── Fake RAF ─────────────────────────────────────────────────────────────────

let rafMap: Map<number, (ts: number) => void> = new Map();
let rafIdCounter = 0;
let currentTime = 0;

function setupFakeRaf(): void {
  rafMap = new Map();
  rafIdCounter = 0;
  currentTime = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (ts: number) => void) => {
    const id = ++rafIdCounter;
    rafMap.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafMap.delete(id);
  });
}

function flushRaf(deltaMs = 16): void {
  const pending = [...rafMap.values()];
  rafMap.clear();
  currentTime += deltaMs;
  pending.forEach((cb) => cb(currentTime));
}

function pendingRafCount(): number {
  return rafMap.size;
}

// ─── Fake matchMedia ──────────────────────────────────────────────────────────

type MotionChangeListener = (e: MediaQueryListEvent) => void;
let motionMatches = false;
let motionChangeListeners: MotionChangeListener[] = [];

function setupFakeMatchMedia(reducedMotion = false): void {
  motionMatches = reducedMotion;
  motionChangeListeners = [];
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: motionMatches,
    media: query,
    onchange: null,
    addEventListener: (_event: string, cb: MotionChangeListener) => {
      motionChangeListeners.push(cb);
    },
    removeEventListener: (_event: string, cb: MotionChangeListener) => {
      motionChangeListeners = motionChangeListeners.filter((l) => l !== cb);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }));
}

function setReducedMotion(value: boolean): void {
  motionMatches = value;
  const event = { matches: value } as MediaQueryListEvent;
  [...motionChangeListeners].forEach((cb) => cb(event));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeWrapper = (engine: UseSceneEngineResult) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(EngineContext.Provider, { value: engine }, children);

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  setupFakeRaf();
  setupFakeMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAutoPlay', () => {
  it('does not schedule RAF when active=false', () => {
    const engine = makeEngine(0);
    renderHook(
      () => useAutoPlay({ active: false, duration: 6, loop: true }),
      { wrapper: makeWrapper(engine) },
    );

    expect(pendingRafCount()).toBe(0);
    expect(engine.setProgress).not.toHaveBeenCalled();
  });

  it('schedules RAF and calls setProgress with increasing values when active=true', () => {
    const engine = makeEngine(0);
    renderHook(
      () => useAutoPlay({ active: true, duration: 1, loop: false }),
      { wrapper: makeWrapper(engine) },
    );

    // RAF should be scheduled
    expect(pendingRafCount()).toBe(1);

    // Frame 1: initialize timestamp (no setProgress call)
    act(() => { flushRaf(0); });
    expect(engine.setProgress).not.toHaveBeenCalled();

    // Frame 2: 100ms elapsed → delta = 0.1 / 1.0 = 0.1
    act(() => { flushRaf(100); });
    expect(engine.setProgress).toHaveBeenCalledWith(expect.closeTo(0.1, 5));

    // Frame 3: another 100ms → delta = 0.1 → progress = 0.1 + 0.1 = 0.2
    act(() => { flushRaf(100); });
    expect(engine.setProgress).toHaveBeenLastCalledWith(expect.closeTo(0.2, 5));
  });

  it('wraps progress to 0 when loop=true and progress reaches 1', () => {
    const engine = makeEngine(0.9);
    renderHook(
      () => useAutoPlay({ active: true, duration: 1, loop: true }),
      { wrapper: makeWrapper(engine) },
    );

    // Frame 1: initialize timestamp
    act(() => { flushRaf(0); });

    // Frame 2: 500ms elapsed → delta = 0.5 → 0.9 + 0.5 = 1.4 → 1.4 % 1 = 0.4
    act(() => { flushRaf(500); });

    const calls = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls;
    const lastArg = calls[calls.length - 1][0] as number;
    expect(lastArg).toBeCloseTo(0.4, 3);
  });

  it('clamps progress at 1 when loop=false', () => {
    const engine = makeEngine(0.95);
    renderHook(
      () => useAutoPlay({ active: true, duration: 1, loop: false }),
      { wrapper: makeWrapper(engine) },
    );

    // Frame 1: initialize
    act(() => { flushRaf(0); });

    // Frame 2: 500ms → delta = 0.5 → 0.95 + 0.5 = 1.45 → clamp to 1
    act(() => { flushRaf(500); });

    expect(engine.setProgress).toHaveBeenCalledWith(1);
  });

  it('respects duration: after duration seconds, progress reaches ~1', () => {
    const engine = makeEngine(0);
    const duration = 2; // 2 seconds
    renderHook(
      () => useAutoPlay({ active: true, duration, loop: false }),
      { wrapper: makeWrapper(engine) },
    );

    // Frame 1: initialize
    act(() => { flushRaf(0); });

    // Frame 2: 1000ms → delta = 1.0 / 2.0 = 0.5
    act(() => { flushRaf(1000); });
    expect(engine.setProgress).toHaveBeenCalledWith(expect.closeTo(0.5, 5));

    // Frame 3: another 1000ms → delta = 0.5 → 0.5 + 0.5 = 1.0
    act(() => { flushRaf(1000); });
    expect(engine.setProgress).toHaveBeenLastCalledWith(1);
  });

  it('cancels RAF when active changes from true to false', () => {
    const engine = makeEngine(0);
    const { rerender } = renderHook(
      (props: { active: boolean }) => useAutoPlay({ active: props.active, duration: 6, loop: true }),
      { wrapper: makeWrapper(engine), initialProps: { active: true } },
    );

    // RAF is scheduled
    expect(pendingRafCount()).toBe(1);

    // Deactivate: effect cleanup should cancel RAF
    act(() => {
      rerender({ active: false });
    });

    // After deactivation, no pending RAF callbacks (cancelled by cleanup)
    expect(pendingRafCount()).toBe(0);

    // No new setProgress calls from further flushes
    const callCountAfterDeactivate = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => { flushRaf(100); });
    expect((engine.setProgress as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountAfterDeactivate);
  });

  it('resets timestamp when active changes from false to true (no time jump)', () => {
    const engine = makeEngine(0.3);
    const { rerender } = renderHook(
      (props: { active: boolean }) => useAutoPlay({ active: props.active, duration: 1, loop: false }),
      { wrapper: makeWrapper(engine), initialProps: { active: false } },
    );

    // No RAF when inactive
    expect(pendingRafCount()).toBe(0);

    // Simulate time passing (advance currentTime by a lot)
    currentTime += 5000;

    // Activate — should reset timestamp, no time jump
    act(() => {
      rerender({ active: true });
    });

    // Frame 1: establish new baseline timestamp
    act(() => { flushRaf(0); });
    expect(engine.setProgress).not.toHaveBeenCalled();

    // Frame 2: only 100ms of delta (not 5000ms)
    act(() => { flushRaf(100); });
    const calls = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls;
    const lastArg = calls[calls.length - 1][0] as number;
    // 0.3 + 0.1 = 0.4, not 0.3 + 5.0 = clamped at 1.0
    expect(lastArg).toBeCloseTo(0.4, 2);
  });

  it('does not schedule RAF when prefers-reduced-motion is active', () => {
    setupFakeMatchMedia(true); // reduced motion active

    const engine = makeEngine(0);
    renderHook(
      () => useAutoPlay({ active: true, duration: 6, loop: true }),
      { wrapper: makeWrapper(engine) },
    );

    expect(pendingRafCount()).toBe(0);
    expect(engine.setProgress).not.toHaveBeenCalled();
  });

  it('stops RAF when prefers-reduced-motion activates mid-play', () => {
    const engine = makeEngine(0);
    renderHook(
      () => useAutoPlay({ active: true, duration: 1, loop: true }),
      { wrapper: makeWrapper(engine) },
    );

    // RAF is running — do a frame
    act(() => { flushRaf(0); });
    act(() => { flushRaf(100); });
    expect(engine.setProgress).toHaveBeenCalled();

    const callCountBefore = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls.length;

    // Activate reduced motion — this cancels the RAF via the change listener
    act(() => { setReducedMotion(true); });

    // No pending RAF after reduced motion activates
    expect(pendingRafCount()).toBe(0);

    // No new setProgress calls
    expect((engine.setProgress as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountBefore);
  });

  it('resumes RAF when prefers-reduced-motion deactivates mid-play', () => {
    setupFakeMatchMedia(true); // start with reduced motion active

    const engine = makeEngine(0);
    renderHook(
      () => useAutoPlay({ active: true, duration: 1, loop: false }),
      { wrapper: makeWrapper(engine) },
    );

    // No RAF scheduled due to reduced motion
    expect(pendingRafCount()).toBe(0);

    // Deactivate reduced motion
    act(() => { setReducedMotion(false); });

    // RAF should now be scheduled
    expect(pendingRafCount()).toBe(1);

    // Run a couple of frames
    act(() => { flushRaf(0); });
    act(() => { flushRaf(100); });

    expect(engine.setProgress).toHaveBeenCalledWith(expect.closeTo(0.1, 5));
  });

  it('clamps duration to minimum 0.001 to prevent division by zero', () => {
    const engine = makeEngine(0);
    renderHook(
      () => useAutoPlay({ active: true, duration: 0, loop: false }),
      { wrapper: makeWrapper(engine) },
    );

    // Frame 1: initialize
    act(() => { flushRaf(0); });

    // Frame 2: any time → with duration 0.001, should produce finite progress
    act(() => { flushRaf(16); });

    const calls = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastArg = calls[calls.length - 1][0] as number;
    expect(Number.isFinite(lastArg)).toBe(true);
  });
});
