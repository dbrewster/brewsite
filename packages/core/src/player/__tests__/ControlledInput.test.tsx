// @vitest-environment jsdom
// Tests for ControlledInput: value write, onChange provision, KeyboardInput interop.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act, useState } from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { EngineContext } from '../EngineContext';
import { ControlledProgressContext } from '../ControlledProgressContext';
import { ControlledInput } from '../ControlledInput';
import { KeyboardInput } from '../KeyboardInput';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { ControlledProgressContextValue } from '../ControlledProgressContext';

// ─── Minimal engine double ────────────────────────────────────────────────────

function makeEngine(initialProgress = 0): UseSceneEngineResult {
  return {
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
  } as UseSceneEngineResult;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ControlledInput — progress write', () => {
  it('calls engine.setProgress with the value prop on mount', () => {
    const engine = makeEngine(0);

    render(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={0.7} />
      </EngineContext.Provider>,
    );

    expect(engine.setProgress).toHaveBeenCalledWith(0.7);
  });

  it('clamps value to [0, 1] — values above 1', () => {
    const engine = makeEngine(0);

    render(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={1.5} />
      </EngineContext.Provider>,
    );

    expect(engine.setProgress).toHaveBeenCalledWith(1);
  });

  it('clamps value to [0, 1] — values below 0', () => {
    const engine = makeEngine(0);

    render(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={-0.2} />
      </EngineContext.Provider>,
    );

    expect(engine.setProgress).toHaveBeenCalledWith(0);
  });

  it('calls engine.setProgress when value prop changes', () => {
    const engine = makeEngine(0);

    const { rerender } = render(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={0.3} />
      </EngineContext.Provider>,
    );

    expect(engine.setProgress).toHaveBeenCalledWith(0.3);
    vi.clearAllMocks();

    rerender(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={0.6} />
      </EngineContext.Provider>,
    );

    expect(engine.setProgress).toHaveBeenCalledWith(0.6);
  });

  it('renders no DOM elements', () => {
    const engine = makeEngine(0);

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={0.5} />
      </EngineContext.Provider>,
    );

    // ControlledProgressContext.Provider renders no DOM output
    expect(container.firstChild).toBeNull();
  });
});

describe('ControlledInput — ControlledProgressContext provision', () => {
  it('provides onChange to child consumers via children prop', () => {
    const engine = makeEngine(0);
    const onChange = vi.fn();
    let capturedCtx: ControlledProgressContextValue | null = null;

    const Consumer = () => {
      capturedCtx = React.useContext(ControlledProgressContext);
      return null;
    };

    render(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={0.5} onChange={onChange}>
          <Consumer />
        </ControlledInput>
      </EngineContext.Provider>,
    );

    expect(capturedCtx).not.toBeNull();
    capturedCtx?.onChange?.(0.8);
    expect(onChange).toHaveBeenCalledWith(0.8);
  });

  it('provides onChange=undefined when no onChange prop', () => {
    const engine = makeEngine(0);
    let capturedCtx: ControlledProgressContextValue | null = null;

    const Consumer = () => {
      capturedCtx = React.useContext(ControlledProgressContext);
      return null;
    };

    render(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={0.5}>
          <Consumer />
        </ControlledInput>
      </EngineContext.Provider>,
    );

    expect(capturedCtx?.onChange).toBeUndefined();
  });
});

describe('ControlledInput + KeyboardInput interop', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: (ts: number) => void) => { cb(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('KeyboardInput calls onChange from ControlledInput when wrapped as child', () => {
    const engine = makeEngine();
    (engine as { sceneCount: number }).sceneCount = 3;
    (engine.frameState as { progress: number }).progress = 0;
    const onChange = vi.fn();

    // KeyboardInput must be a CHILD of ControlledInput to receive its context
    render(
      <EngineContext.Provider value={engine}>
        <ControlledInput value={0} onChange={onChange}>
          <KeyboardInput manageFocus={false} />
        </ControlledInput>
      </EngineContext.Provider>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowRight' });
    });

    expect(onChange).toHaveBeenCalledWith(expect.closeTo(0.5, 5));
    expect(engine.setProgress).toHaveBeenCalled(); // called by ControlledInput's useLayoutEffect
  });
});
