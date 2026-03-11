// @vitest-environment jsdom
// Tests for ScrollInput: inertia mode, IScrollSource mode, and native DOM scroll modes.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { createRef } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { EngineContext } from '../EngineContext';
import { ScrollRegionContext } from '../ScrollRegionContext';
import { ScrollInput } from '../ScrollInput';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { IScrollSource } from '../scrollSourceTypes';
import type { ScrollRegionContextValue } from '../ScrollRegionContext';

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

    act(() => {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    });
    act(() => { flushRaf(5); });

    expect(engine.setProgress).toHaveBeenCalled();
    const calls = (engine.setProgress as ReturnType<typeof vi.fn>).mock.calls;
    const lastArg = calls[calls.length - 1][0] as number;
    expect(lastArg).toBeGreaterThan(0);
    expect(lastArg).toBeLessThanOrEqual(1);
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

  it('unsubscribes on unmount', () => {
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
});

describe('ScrollInput — native DOM scroll modes', () => {
  it('uses the ScrollStage container when ScrollRegionContext is present', () => {
    const engine = makeEngine();
    const containerRef = createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement | null>;
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    container.scrollTop = 300;
    containerRef.current = container;

    const scrollRegionValue: ScrollRegionContextValue = {
      containerRef,
      scrollHeightPx: 1000,
    };

    render(
      <EngineContext.Provider value={engine}>
        <ScrollRegionContext.Provider value={scrollRegionValue}>
          <ScrollInput source="window" />
        </ScrollRegionContext.Provider>
      </EngineContext.Provider>,
    );

    act(() => {
      container.dispatchEvent(new Event('scroll'));
    });

    expect(engine.setRawProgress).toHaveBeenLastCalledWith(0.5);
  });

  it('falls back to window scroll when no ScrollStage context is present', () => {
    const engine = makeEngine();
    Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1500, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 250, configurable: true });

    render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source="window" />
      </EngineContext.Provider>,
    );

    expect(engine.setRawProgress).toHaveBeenLastCalledWith(0.25);
  });

  it('reads scrollTop from an explicit elementRef source', () => {
    const engine = makeEngine();
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(element, 'scrollHeight', { value: 900, configurable: true });
    element.scrollTop = 150;

    const elementRef = createRef<HTMLElement>() as React.RefObject<HTMLElement | null>;
    elementRef.current = element;

    render(
      <EngineContext.Provider value={engine}>
        <ScrollInput source={{ elementRef }} />
      </EngineContext.Provider>,
    );

    act(() => {
      element.dispatchEvent(new Event('scroll'));
    });

    expect(engine.setRawProgress).toHaveBeenLastCalledWith(0.25);
  });
});
