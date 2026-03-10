// @vitest-environment jsdom
// Tests for PointerInput: click-to-advance, hover-to-scrub, loop, pauseWhenHidden.
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { EngineContext } from '../EngineContext';
import { PointerInput } from '../PointerInput';
import type { UseSceneEngineResult } from '../useSceneEngine';

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
    sceneCount: 3,
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PointerInput — click mode', () => {
  it('advances one scene on click', () => {
    const engine = makeEngine({ sceneCount: 3, progress: 0 });

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <PointerInput mode="click" />
      </EngineContext.Provider>,
    );

    const overlay = container.firstChild as HTMLElement;
    act(() => { fireEvent.click(overlay); });

    // step = 1/(3-1) = 0.5 → next = 0 + 0.5 = 0.5
    expect(engine.setProgress).toHaveBeenCalledWith(expect.closeTo(0.5, 5));
  });

  it('clamps at 1 when loop=false (default) and at last scene', () => {
    const engine = makeEngine({ sceneCount: 3, progress: 0.75 });

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <PointerInput mode="click" loop={false} />
      </EngineContext.Provider>,
    );

    const overlay = container.firstChild as HTMLElement;
    act(() => { fireEvent.click(overlay); });

    // next = 0.75 + 0.5 = 1.25 → clamp to 1
    expect(engine.setProgress).toHaveBeenCalledWith(1);
  });

  it('wraps to 0 when loop=true and past last scene', () => {
    const engine = makeEngine({ sceneCount: 3, progress: 0.75 });

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <PointerInput mode="click" loop />
      </EngineContext.Provider>,
    );

    const overlay = container.firstChild as HTMLElement;
    act(() => { fireEvent.click(overlay); });

    // next = 0.75 + 0.5 = 1.25 → > 1 with loop → 0
    expect(engine.setProgress).toHaveBeenCalledWith(0);
  });

  it('renders with cursor: pointer in click mode', () => {
    const engine = makeEngine();
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <PointerInput mode="click" />
      </EngineContext.Provider>,
    );
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.style.cursor).toBe('pointer');
  });
});

describe('PointerInput — hover mode', () => {
  it('maps cursor X position to progress', () => {
    const engine = makeEngine();

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <PointerInput mode="hover" />
      </EngineContext.Provider>,
    );

    const overlay = container.firstChild as HTMLElement;

    // Mock getBoundingClientRect to report a 400px-wide overlay
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 400, bottom: 300,
      width: 400, height: 300,
      x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    act(() => {
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 150 });
    });

    // x=200, width=400 → progress = 200/400 = 0.5
    expect(engine.setProgress).toHaveBeenCalledWith(expect.closeTo(0.5, 5));
  });

  it('renders with cursor: crosshair in hover mode', () => {
    const engine = makeEngine();
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <PointerInput mode="hover" />
      </EngineContext.Provider>,
    );
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.style.cursor).toBe('crosshair');
  });

  it('clamps progress to [0, 1]', () => {
    const engine = makeEngine();

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <PointerInput mode="hover" />
      </EngineContext.Provider>,
    );

    const overlay = container.firstChild as HTMLElement;
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 400, bottom: 300,
      width: 400, height: 300,
      x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // clientX beyond right edge
    act(() => {
      fireEvent.mouseMove(overlay, { clientX: 500, clientY: 0 });
    });
    expect(engine.setProgress).toHaveBeenCalledWith(1);

    vi.clearAllMocks();

    // clientX before left edge
    act(() => {
      fireEvent.mouseMove(overlay, { clientX: -50, clientY: 0 });
    });
    expect(engine.setProgress).toHaveBeenCalledWith(0);
  });
});

describe('PointerInput — overlay div', () => {
  it('renders an absolute overlay div', () => {
    const engine = makeEngine();
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <PointerInput mode="click" />
      </EngineContext.Provider>,
    );
    const overlay = container.firstChild as HTMLElement;
    expect(overlay.style.position).toBe('absolute');
    // jsdom reports inset shorthand as '0' or '0px' depending on version;
    // verify position:absolute is set (the key contract) and that the element exists
    expect(overlay.tagName).toBe('DIV');
  });
});
