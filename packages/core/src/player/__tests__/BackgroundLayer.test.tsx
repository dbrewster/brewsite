// @vitest-environment jsdom
// BackgroundLayer tests — verifies ref wiring, default styles, style merging, and className.

import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { BackgroundLayer } from '../BackgroundLayer';
import { EngineContext } from '../EngineContext';
import type { UseSceneEngineResult } from '../useSceneEngine';

afterEach(() => cleanup());

/**
 * Builds a minimal engine double that captures what element gets passed to setBackgroundRef.
 */
const makeEngine = (): {
  engine: UseSceneEngineResult;
  capturedEl: HTMLDivElement | null;
  setBackgroundRef: (el: HTMLDivElement | null) => void;
} => {
  let capturedEl: HTMLDivElement | null = null;
  const setBackgroundRef = (el: HTMLDivElement | null) => {
    capturedEl = el;
  };
  const engine = {
    frameState: { tickIndex: -1, progress: 0, sceneId: '', sceneIndex: 0, sceneProgress: 0, tick: null },
    setBackgroundRef,
  } as unknown as UseSceneEngineResult;

  return { engine, get capturedEl() { return capturedEl; }, setBackgroundRef };
};

describe('BackgroundLayer', () => {
  it('renders a div with engine.setBackgroundRef as the ref callback', () => {
    const { engine, setBackgroundRef } = makeEngine();
    const setBackgroundRefSpy = vi.fn(setBackgroundRef);
    (engine as unknown as Record<string, unknown>).setBackgroundRef = setBackgroundRefSpy;

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <BackgroundLayer />
      </EngineContext.Provider>,
    );

    expect(setBackgroundRefSpy).toHaveBeenCalled();
    // The ref callback should have been called with the rendered div element
    const calledWith = setBackgroundRefSpy.mock.calls[0]?.[0];
    expect(calledWith).toBe(container.firstChild);
  });

  it('applies default background styles', () => {
    const { engine } = makeEngine();
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <BackgroundLayer />
      </EngineContext.Provider>,
    );
    const div = container.firstChild as HTMLDivElement;
    expect(div.style.backgroundPosition).toBe('center');
    expect(div.style.backgroundSize).toBe('cover');
    expect(div.style.backgroundRepeat).toBe('no-repeat');
    expect(div.style.pointerEvents).toBe('none');
  });

  it('merges consumer style prop over defaults', () => {
    const { engine } = makeEngine();
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <BackgroundLayer style={{ position: 'absolute', inset: '0' }} />
      </EngineContext.Provider>,
    );
    const div = container.firstChild as HTMLDivElement;
    expect(div.style.position).toBe('absolute');
    // Default styles remain
    expect(div.style.backgroundPosition).toBe('center');
  });

  it('applies className prop to the rendered div', () => {
    const { engine } = makeEngine();
    const { container } = render(
      <EngineContext.Provider value={engine}>
        <BackgroundLayer className="my-bg-layer" />
      </EngineContext.Provider>,
    );
    const div = container.firstChild as HTMLDivElement;
    expect(div.className).toBe('my-bg-layer');
  });

  it('throws when mounted outside SceneEngine context', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      render(<BackgroundLayer />);
    }).toThrow();
    consoleSpy.mockRestore();
  });
});
