// @vitest-environment jsdom
// SceneReel tests — verifies container layout, plugin forwarding, and AR context interop.
// SceneCanvas and EngineOverlayHost are stubbed to avoid WebGL initialization in jsdom.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { EngineARContainerContext } from '../EngineARContainer';
import type { WidgetPlugin } from '../../widget/WidgetPlugin';

// ─── Stub SceneCanvas and EngineOverlayHost to avoid Three.js WebGL in jsdom ──
vi.mock('../SceneCanvas', () => ({
  SceneCanvas: () => <canvas data-testid="scene-canvas" />,
}));

vi.mock('../EngineOverlayHost', () => ({
  EngineOverlayHost: () => <div data-testid="overlay-host" />,
}));

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
  // Stub IntersectionObserver for scrollSource tests
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [0];
  } as unknown as typeof globalThis.IntersectionObserver;
});

afterEach(() => vi.restoreAllMocks());

// Import SceneReel AFTER mocks are declared
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SceneReel } = await import('../SceneReel');

const makePlugin = (): WidgetPlugin => ({
  registerHandlers: vi.fn(),
  createWidgets: vi.fn().mockReturnValue([]),
  configureRegistry: vi.fn(),
  wrapProvider: undefined,
});

describe('SceneReel', () => {
  it('renders a container div with the specified numeric height', () => {
    const { container } = render(
      <SceneReel height={400} plugins={[makePlugin()]}>
        <div data-testid="content" />
      </SceneReel>,
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toBeTruthy();
    expect(outerDiv.style.height).toBe('400px');
    expect(outerDiv.style.position).toBe('relative');
    expect(outerDiv.style.overflow).toBe('hidden');
  });

  it('renders a container div with string height', () => {
    const { container } = render(
      <SceneReel height="50vh" plugins={[makePlugin()]}>
        <div />
      </SceneReel>,
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.style.height).toBe('50vh');
  });

  it('renders with custom width', () => {
    const { container } = render(
      <SceneReel height="300px" width="50%" plugins={[makePlugin()]}>
        <div />
      </SceneReel>,
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.style.width).toBe('50%');
  });

  it('defaults width to 100% when omitted', () => {
    const { container } = render(
      <SceneReel height="300px" plugins={[makePlugin()]}>
        <div />
      </SceneReel>,
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.style.width).toBe('100%');
  });

  it('accepts numeric width and converts to px', () => {
    const { container } = render(
      <SceneReel height={300} width={640} plugins={[makePlugin()]}>
        <div />
      </SceneReel>,
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.style.width).toBe('640px');
    expect(outerDiv.style.height).toBe('300px');
  });

  it('applies className to the outer container', () => {
    const { container } = render(
      <SceneReel height={300} className="my-reel" plugins={[makePlugin()]}>
        <div />
      </SceneReel>,
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.classList.contains('my-reel')).toBe(true);
  });

  it('renders SceneCanvas inside the engine', () => {
    render(
      <SceneReel height={400} plugins={[makePlugin()]}>
        <div />
      </SceneReel>,
    );
    expect(screen.getByTestId('scene-canvas')).toBeTruthy();
  });

  it('renders EngineOverlayHost inside the engine', () => {
    render(
      <SceneReel height={400} plugins={[makePlugin()]}>
        <div />
      </SceneReel>,
    );
    expect(screen.getByTestId('overlay-host')).toBeTruthy();
  });

  it('forwards children into the engine tree', () => {
    render(
      <SceneReel height={400} plugins={[makePlugin()]}>
        <div data-testid="consumer-child" />
      </SceneReel>,
    );
    expect(screen.getByTestId('consumer-child')).toBeTruthy();
  });

  it('EngineARContainerContext computedArHeight overrides height prop when non-zero', () => {
    const arContextValue = {
      containerWidth: 1200,
      containerHeight: 675,
      computedArHeight: 480,
      referenceWidth: 1920,
      scaleMode: 'fit-width' as const,
    };

    const { container } = render(
      <EngineARContainerContext.Provider value={arContextValue}>
        <SceneReel height={300} plugins={[makePlugin()]}>
          <div />
        </SceneReel>
      </EngineARContainerContext.Provider>,
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.style.height).toBe('480px');
  });

  it('accepts theme prop without error', () => {
    const { container } = render(
      <SceneReel height={400} plugins={[makePlugin()]} theme={{ family: 'darkGlass', polarity: 'dark' }}>
        <div />
      </SceneReel>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts scrollSource prop without error', () => {
    const containerRef = { current: document.createElement('div') };
    const canvasRef = { current: document.createElement('canvas') };
    const { container } = render(
      <SceneReel
        height={400}
        plugins={[makePlugin()]}
        scrollSource={{ kind: 'viewport-relative', containerRef, canvasRef }}
      >
        <div />
      </SceneReel>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts defaultTransitionDuration prop without error', () => {
    const { container } = render(
      <SceneReel height={400} plugins={[makePlugin()]} defaultTransitionDuration={600}>
        <div />
      </SceneReel>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('accepts defaultTransitionEasing prop without error', () => {
    const { container } = render(
      <SceneReel height={400} plugins={[makePlugin()]} defaultTransitionEasing={(t: number) => t}>
        <div />
      </SceneReel>,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('uses height prop when EngineARContainerContext computedArHeight is zero', () => {
    const arContextValue = {
      containerWidth: 1200,
      containerHeight: 675,
      computedArHeight: 0,
      referenceWidth: 1920,
      scaleMode: 'fit-width' as const,
    };

    const { container } = render(
      <EngineARContainerContext.Provider value={arContextValue}>
        <SceneReel height={300} plugins={[makePlugin()]}>
          <div />
        </SceneReel>
      </EngineARContainerContext.Provider>,
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.style.height).toBe('300px');
  });
});
