// @vitest-environment jsdom
// Tests for KeyboardInput: arrow key navigation, ControlledProgressContext interop, manageFocus.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import { EngineContext } from '../EngineContext';
import { ControlledProgressContext } from '../ControlledProgressContext';
import { KeyboardInput } from '../KeyboardInput';
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
    sceneCount: 3, // 3 scenes: step = 1/2 = 0.5
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

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: (ts: number) => void) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('KeyboardInput — arrow key navigation', () => {
  it('ArrowRight advances progress by 1/(sceneCount-1)', () => {
    const engine = makeEngine({
      sceneCount: 3,
      frameState: { tickIndex: 0, progress: 0, sceneId: 's1', sceneIndex: 0, sceneProgress: 0 },
    });

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput manageFocus={false} />
      </EngineContext.Provider>,
    );

    // manageFocus=false: InputController attaches keydown to document (not window)
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowRight' });
    });

    expect(engine.setProgress).toHaveBeenCalledWith(expect.closeTo(0.5, 5));
  });

  it('ArrowLeft retreats progress by 1/(sceneCount-1)', () => {
    const engine = makeEngine({
      sceneCount: 3,
      frameState: { tickIndex: 0, progress: 0.5, sceneId: 's2', sceneIndex: 1, sceneProgress: 0 },
    });

    render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput manageFocus={false} />
      </EngineContext.Provider>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowLeft' });
    });

    expect(engine.setProgress).toHaveBeenCalledWith(expect.closeTo(0, 5));
  });

  it('Home key jumps to scene 0', () => {
    const engine = makeEngine({
      sceneCount: 3,
      frameState: { tickIndex: 0, progress: 0.5, sceneId: 's2', sceneIndex: 1, sceneProgress: 0 },
    });

    render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput manageFocus={false} />
      </EngineContext.Provider>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'Home' });
    });

    expect(engine.setProgress).toHaveBeenCalledWith(0);
  });

  it('End key jumps to last scene', () => {
    const engine = makeEngine({
      sceneCount: 3,
      frameState: { tickIndex: 0, progress: 0, sceneId: 's1', sceneIndex: 0, sceneProgress: 0 },
    });

    render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput manageFocus={false} />
      </EngineContext.Provider>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'End' });
    });

    expect(engine.setProgress).toHaveBeenCalledWith(1);
  });

  it('clamps progress at 0 when ArrowLeft at start', () => {
    const engine = makeEngine({
      sceneCount: 3,
      frameState: { tickIndex: 0, progress: 0, sceneId: 's1', sceneIndex: 0, sceneProgress: 0 },
    });

    render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput manageFocus={false} />
      </EngineContext.Provider>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowLeft' });
    });

    expect(engine.setProgress).toHaveBeenCalledWith(0);
  });

  it('clamps progress at 1 when ArrowRight at end', () => {
    const engine = makeEngine({
      sceneCount: 3,
      frameState: { tickIndex: 0, progress: 1.0, sceneId: 's3', sceneIndex: 2, sceneProgress: 0 },
    });

    render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput manageFocus={false} />
      </EngineContext.Provider>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowRight' });
    });

    expect(engine.setProgress).toHaveBeenCalledWith(1);
  });
});

describe('KeyboardInput — ControlledProgressContext interop', () => {
  it('calls onChange from ControlledProgressContext instead of engine.setProgress', () => {
    const engine = makeEngine({
      sceneCount: 3,
      frameState: { tickIndex: 0, progress: 0, sceneId: 's1', sceneIndex: 0, sceneProgress: 0 },
    });
    const onChange = vi.fn();

    render(
      <EngineContext.Provider value={engine}>
        <ControlledProgressContext.Provider value={{ onChange }}>
          <KeyboardInput manageFocus={false} />
        </ControlledProgressContext.Provider>
      </EngineContext.Provider>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowRight' });
    });

    expect(onChange).toHaveBeenCalledWith(expect.closeTo(0.5, 5));
    expect(engine.setProgress).not.toHaveBeenCalled();
  });
});

describe('KeyboardInput — manageFocus', () => {
  it('renders a focusable div when manageFocus=true (default)', () => {
    const engine = makeEngine();

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput />
      </EngineContext.Provider>,
    );

    const div = container.firstChild as HTMLElement;
    expect(div).not.toBeNull();
    expect(div.tagName).toBe('DIV');
    expect(div.getAttribute('tabindex')).toBe('-1');
  });

  it('renders null when manageFocus=false', () => {
    const engine = makeEngine();

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput manageFocus={false} />
      </EngineContext.Provider>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('focuses the div on pointer down when manageFocus=true', () => {
    const engine = makeEngine();

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <KeyboardInput />
      </EngineContext.Provider>,
    );

    const div = container.firstChild as HTMLElement;
    const focusSpy = vi.spyOn(div, 'focus').mockImplementation(() => {});

    act(() => {
      fireEvent.pointerDown(div);
    });

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });
});
