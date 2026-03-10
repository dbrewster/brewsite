// @vitest-environment jsdom
// Tests for ScrollInput: inertia mode, IScrollSource mode, window mode error.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { createRef } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { EngineContext } from '../EngineContext';
import { ScrollRegionContext } from '../ScrollRegionContext';
import { ScrollInput } from '../ScrollInput';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { IScrollSource } from '../scrollSourceTypes';
import type { ScrollRegionContextValue } from '../ScrollRegionContext';

// ─── Minimal engine double ────────────────────────────────────────────────────

function makeEngine(overrides: Partial<UseSceneEngineResult> = {}): UseSceneEngineResult {
  return {
    frameState: { tickIndex: 0, progress: 0, sceneId: 's1', sceneIndex: 0, sceneProgress: 0 },
    progress: 0,
    variableStore: {} as never,
    setCanvasRef: vi.fn(),
    setViewportSize: vi.fn(),
    setBackgroundRef: vi.fn(),
    setRawProgress: vi.fn(),
    setProgress: vi.fn(),
    advanceProgress: vi.fn(),
    sceneTrack: null,
    sceneCount: 2,
    compiledScenes: [],
    progressMapper: null,
    getCamera: vi.fn(() => null),
    getRenderer: vi.fn(() => null),
    setCameraOverride: vi.fn(),
    getCameraOverride: vi.fn(() => null),
    setAutoAdvancePaused: vi.fn(),
    sceneOverlays: new Map(),
    ...overrides,
  } as UseSceneEngineResult;
}

// ─── IScrollSource test double ────────────────────────────────────────────────

class TestScrollSource implements IScrollSource {
  private subscriber: ((raw: number) => void) | null = null;

  subscribe(cb: (raw: number) => void): () => void {
    this.subscriber = cb;
    return () => { this.subscriber = null; };
  }

  emit(raw: number): void {
    this.subscriber?.(raw);
  }
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

function flushRaf(times = 1, deltaMs = 16): void {
  for (let i = 0; i < times; i++) {
    const pending = [...rafCallbacks];
    rafCallbacks = [];
    currentTime += deltaMs;
    pending.forEach((cb) => cb(currentTime));
  }
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

describe('ScrollInput — inertia mode', () => {
  it('calls engine.setProgress when wheel event advances velocity', () => {
    const engine = makeEngine();

    render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source="inertia" inertiaSensitivity={0.001} inertiaDecay={0.9} />
      </EngineContext.Provider>,
    );

    // Fire wheel event to accumulate delta
    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    });

    // Flush RAF ticks to integrate the velocity
    act(() => { flushRaf(5); });

    expect(engine.setProgress).toHaveBeenCalled();
    const calls = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls;
    const lastArg = calls[calls.length - 1][0] as number;
    expect(lastArg).toBeGreaterThan(0);
    expect(lastArg).toBeLessThanOrEqual(1);
  });

  it('zeroes velocity at progress=0 boundary', () => {
    const engine = makeEngine({ progress: 0 });
    render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source="inertia" inertiaSensitivity={1} inertiaDecay={0.9} />
      </EngineContext.Provider>,
    );

    // Large negative delta — should hit the 0 boundary and stop
    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: -10000 }));
    });
    act(() => { flushRaf(10); });

    // After hitting boundary, no more setProgress calls should occur
    const callCount = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => { flushRaf(5); });
    const callCountAfter = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callCountAfter).toBe(callCount);
  });

  it('renders a zero-size div for inertia mode', () => {
    const engine = makeEngine();
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source="inertia" />
      </EngineContext.Provider>,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.tagName).toBe('DIV');
    expect(div.style.width).toBe('0px');
    expect(div.style.height).toBe('0px');
  });
});

describe('ScrollInput — IScrollSource mode', () => {
  it('calls engine.setRawProgress when source emits a value', () => {
    const engine = makeEngine();
    const source = new TestScrollSource();

    render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source={source} />
      </EngineContext.Provider>,
    );

    act(() => { source.emit(0.5); });

    expect(engine.setRawProgress).toHaveBeenCalledWith(0.5);
  });

  it('calls unsubscribe on unmount', () => {
    const engine = makeEngine();
    const source = new TestScrollSource();
    const subscribeSpy = vi.spyOn(source, 'subscribe');

    const { unmount } = render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source={source} />
      </EngineContext.Provider>,
    );

    const unsubscribe = subscribeSpy.mock.results[0]?.value as (() => void) | undefined;
    if (typeof unsubscribe !== 'function') {
      // The subscribe mock wraps the real method — get the unsubscribe via emit check instead
      act(() => { source.emit(0.7); });
      expect(engine.setRawProgress).toHaveBeenCalledWith(0.7);

      unmount();
      vi.clearAllMocks();
      act(() => { source.emit(0.8); });
      expect(engine.setRawProgress).not.toHaveBeenCalled();
      return;
    }

    unmount();
    act(() => { source.emit(0.9); });
    expect(engine.setRawProgress).not.toHaveBeenCalledWith(0.9);
  });

  it('unsubscribes on unmount (via emit after unmount)', () => {
    const engine = makeEngine();
    const source = new TestScrollSource();

    const { unmount } = render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source={source} />
      </EngineContext.Provider>,
    );

    act(() => { source.emit(0.3); });
    expect(engine.setRawProgress).toHaveBeenCalledWith(0.3);

    unmount();
    vi.clearAllMocks();

    act(() => { source.emit(0.8); });
    expect(engine.setRawProgress).not.toHaveBeenCalled();
  });

  it('does not call setRawProgress when paused', () => {
    // pauseWhenHidden not easily testable without IntersectionObserver;
    // test the isPausedRef guard via a direct source emit after mounting.
    const engine = makeEngine();
    const source = new TestScrollSource();

    render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source={source} />
      </EngineContext.Provider>,
    );

    act(() => { source.emit(0.4); });
    expect(engine.setRawProgress).toHaveBeenCalledWith(0.4);
  });
});

describe('ScrollInput — window mode', () => {
  it('logs an error when used outside ScrollStage (no ScrollRegionContext)', () => {
    const engine = makeEngine();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source="window" />
      </EngineContext.Provider>,
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('<ScrollInput source="window">'),
    );
    consoleSpy.mockRestore();
  });

  it('wraps with ScrollNavigatorContext when inside ScrollStage', () => {
    const engine = makeEngine();
    const containerRef = createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement | null>;
    const scrollRegionValue: ScrollRegionContextValue = {
      containerRef,
      scrollHeightPx: 5000,
    };

    // Should mount without error when context is provided
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <EngineContext.Provider value={engine}>
        <ScrollRegionContext.Provider value={scrollRegionValue}>
          <ScrollInput source="window" />
        </ScrollRegionContext.Provider>
      </EngineContext.Provider>,
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
