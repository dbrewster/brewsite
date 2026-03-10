// @vitest-environment jsdom
// Tests for useViewportRelativeScroll: scroll progress computation and WebGL context lifecycle.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { useViewportRelativeScroll } from '../useViewportRelativeScroll';
import type { ViewportRelativeScrollSource } from '../engineTypes';

// ─── IntersectionObserver mock ────────────────────────────────────────────────

let intersectionCallback: IntersectionObserverCallback | null = null;
const mockObserver = {
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
};

vi.stubGlobal('IntersectionObserver', vi.fn((cb: IntersectionObserverCallback, _options?: IntersectionObserverInit) => {
  intersectionCallback = cb;
  return mockObserver;
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fireIntersection(isIntersecting: boolean): void {
  intersectionCallback?.(
    [{ isIntersecting } as IntersectionObserverEntry],
    mockObserver as unknown as IntersectionObserver,
  );
}

function setScrollY(value: number): void {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true });
}

function makeContainerEl(opts: {
  offsetHeight: number;
  /**
   * Absolute document top offset (pixels from document top to element top).
   * getBoundingClientRect().top is computed as absoluteTop - window.scrollY,
   * matching real browser behavior.
   */
  absoluteTop?: number;
}): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetHeight', { value: opts.offsetHeight, configurable: true });
  el.getBoundingClientRect = (): DOMRect => ({
    top: (opts.absoluteTop ?? 0) - window.scrollY,
    left: 0, right: 0, bottom: 0, width: 0, height: 0,
    toJSON: () => ({}),
  } as DOMRect);
  return el;
}

function makeSource(
  containerEl: HTMLElement | null,
  canvasEl: HTMLCanvasElement | null,
): ViewportRelativeScrollSource {
  const containerRef = createRef<HTMLElement | null>();
  const canvasRef = createRef<HTMLCanvasElement | null>();
  // Assign via cast — createRef returns a readonly ref in types but is mutable at runtime
  (containerRef as { current: HTMLElement | null }).current = containerEl;
  (canvasRef as { current: HTMLCanvasElement | null }).current = canvasEl;
  return { kind: 'viewport-relative', containerRef, canvasRef };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Reset intersection callback between tests
  intersectionCallback = null;
  mockObserver.observe.mockClear();
  mockObserver.disconnect.mockClear();
});

// ─── Scroll progress tests ────────────────────────────────────────────────────

describe('useViewportRelativeScroll — scroll progress', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });
  });

  it('calls onProgress with 0 when scrollY is at panel top', () => {
    // panelHeight=1500, innerHeight=768, panelTop=0
    // maxScroll = 1500 - 768 = 732; scrollY=0 → progress=0
    const containerEl = makeContainerEl({ offsetHeight: 1500, rectTop: 0 });
    setScrollY(0);

    const source = makeSource(containerEl, null);
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source, onProgress }));

    // onProgress is called synchronously on mount with initial position
    expect(onProgress).toHaveBeenCalledWith(0);
  });

  it('calls onProgress with 1 when scrollY is at panel bottom', () => {
    // panelTop=0, maxScroll=732; scrollY=732 → progress=1
    const containerEl = makeContainerEl({ offsetHeight: 1500, rectTop: 0 });
    setScrollY(732);

    const source = makeSource(containerEl, null);
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source, onProgress }));

    expect(onProgress).toHaveBeenCalledWith(1);
  });

  it('calls onProgress with 0.5 at midpoint', () => {
    // panelTop=0, maxScroll=732; scrollY=366 → progress=0.5
    const containerEl = makeContainerEl({ offsetHeight: 1500, rectTop: 0 });
    setScrollY(366);

    const source = makeSource(containerEl, null);
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source, onProgress }));

    expect(onProgress).toHaveBeenCalledWith(expect.closeTo(0.5, 5));
  });

  it('clamps progress to [0,1] — scrollY before panel top produces 0', () => {
    // Panel starts at absoluteTop=500; scrollY=0 → scrolled=-500 → clamped to 0
    const containerEl = makeContainerEl({ offsetHeight: 1500, absoluteTop: 500 });
    setScrollY(0);

    const source = makeSource(containerEl, null);
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source, onProgress }));

    expect(onProgress).toHaveBeenCalledWith(0);
  });

  it('returns progress=1 (terminal state) when panel shorter than viewport', () => {
    // offsetHeight=500, innerHeight=768 → maxScroll<=0 → returns 1
    const containerEl = makeContainerEl({ offsetHeight: 500, rectTop: 0 });
    setScrollY(0);

    const source = makeSource(containerEl, null);
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source, onProgress }));

    expect(onProgress).toHaveBeenCalledWith(1);
  });

  it('fires onProgress on scroll event', () => {
    const containerEl = makeContainerEl({ offsetHeight: 1500, rectTop: 0 });
    setScrollY(0);

    const source = makeSource(containerEl, null);
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source, onProgress }));
    onProgress.mockClear();

    // Move to midpoint and fire scroll
    setScrollY(366);
    act(() => { window.dispatchEvent(new Event('scroll')); });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(expect.closeTo(0.5, 5));
  });

  it('fires onProgress on resize event', () => {
    const containerEl = makeContainerEl({ offsetHeight: 1500, rectTop: 0 });
    setScrollY(0);

    const source = makeSource(containerEl, null);
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source, onProgress }));
    onProgress.mockClear();

    act(() => { window.dispatchEvent(new Event('resize')); });

    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it('fires onProgress synchronously on mount with initial position', () => {
    // scrollY already at midpoint before hook mounts
    const containerEl = makeContainerEl({ offsetHeight: 1500, rectTop: 0 });
    setScrollY(366);

    const source = makeSource(containerEl, null);
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source, onProgress }));

    // Should have been called immediately during mount
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(expect.closeTo(0.5, 5));
  });

  it('is a no-op when source is null', () => {
    const onProgress = vi.fn();

    renderHook(() => useViewportRelativeScroll({ source: null, onProgress: null }));

    act(() => { window.dispatchEvent(new Event('scroll')); });

    expect(onProgress).not.toHaveBeenCalled();
  });
});

// ─── Context lifecycle tests ──────────────────────────────────────────────────

describe('useViewportRelativeScroll — context lifecycle', () => {
  it('does not call restoreContext on first intersection (initializedRef=false)', () => {
    const canvas = document.createElement('canvas');
    const mockExt = { loseContext: vi.fn(), restoreContext: vi.fn() };
    canvas.getContext = vi.fn(() => ({
      getExtension: vi.fn(() => mockExt),
    })) as unknown as typeof canvas.getContext;

    const source = makeSource(null, canvas);

    renderHook(() => useViewportRelativeScroll({ source, onProgress: null }));

    act(() => { fireIntersection(true); });

    expect(mockExt.restoreContext).not.toHaveBeenCalled();
  });

  it('sets initializedRef=true on first intersection', () => {
    const canvas = document.createElement('canvas');
    const mockExt = { loseContext: vi.fn(), restoreContext: vi.fn() };
    canvas.getContext = vi.fn(() => ({
      getExtension: vi.fn(() => mockExt),
    })) as unknown as typeof canvas.getContext;

    const source = makeSource(null, canvas);

    renderHook(() => useViewportRelativeScroll({ source, onProgress: null }));

    // First intersection: initializes
    act(() => { fireIntersection(true); });
    // Exit: should call loseContext (only if initialized)
    act(() => { fireIntersection(false); });

    expect(mockExt.loseContext).toHaveBeenCalledTimes(1);
  });

  it('calls loseContext on intersection exit after first initialization', () => {
    const canvas = document.createElement('canvas');
    const mockExt = { loseContext: vi.fn(), restoreContext: vi.fn() };
    canvas.getContext = vi.fn(() => ({
      getExtension: vi.fn(() => mockExt),
    })) as unknown as typeof canvas.getContext;

    const source = makeSource(null, canvas);

    renderHook(() => useViewportRelativeScroll({ source, onProgress: null }));

    // Initialize
    act(() => { fireIntersection(true); });
    // Exit
    act(() => { fireIntersection(false); });

    expect(canvas.getContext).toHaveBeenCalledWith('webgl2');
    expect(mockExt.loseContext).toHaveBeenCalledTimes(1);
  });

  it('calls restoreContext on re-entry after loseContext', () => {
    const canvas = document.createElement('canvas');
    const mockExt = { loseContext: vi.fn(), restoreContext: vi.fn() };
    canvas.getContext = vi.fn(() => ({
      getExtension: vi.fn(() => mockExt),
    })) as unknown as typeof canvas.getContext;

    const source = makeSource(null, canvas);

    renderHook(() => useViewportRelativeScroll({ source, onProgress: null }));

    // Init → lose → restore
    act(() => { fireIntersection(true); });
    act(() => { fireIntersection(false); });
    act(() => { fireIntersection(true); });

    expect(mockExt.restoreContext).toHaveBeenCalledTimes(1);
  });

  it('creates IntersectionObserver with rootMargin 200px', () => {
    const canvas = document.createElement('canvas');
    const source = makeSource(null, canvas);

    renderHook(() => useViewportRelativeScroll({ source, onProgress: null }));

    const ctor = vi.mocked(IntersectionObserver as unknown as ReturnType<typeof vi.fn>);
    const callArgs = ctor.mock.calls[ctor.mock.calls.length - 1] as [IntersectionObserverCallback, IntersectionObserverInit];
    expect(callArgs[1]).toMatchObject({ rootMargin: '200px' });
  });

  it('disconnects IntersectionObserver on unmount', () => {
    const canvas = document.createElement('canvas');
    const source = makeSource(null, canvas);

    const { unmount } = renderHook(() => useViewportRelativeScroll({ source, onProgress: null }));

    unmount();

    expect(mockObserver.disconnect).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when canvasRef is null (source is null)', () => {
    renderHook(() => useViewportRelativeScroll({ source: null, onProgress: null }));

    // No IntersectionObserver should be created
    const ctor = vi.mocked(IntersectionObserver as unknown as ReturnType<typeof vi.fn>);
    expect(ctor).not.toHaveBeenCalled();
  });
});
