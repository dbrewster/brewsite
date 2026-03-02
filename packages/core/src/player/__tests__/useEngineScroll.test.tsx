// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { useEngineScroll } from '../useEngineScroll';
import type { ScrollSource } from '../engineTypes';

type RenderHookOptions = {
  height: number;
  scrollSource?: ScrollSource;
  onRegionReady?: (el: HTMLDivElement) => void;
  getRegionTop?: () => number;
};

const renderHook = (options: RenderHookOptions) => {
  let result: ReturnType<typeof useEngineScroll> | null = null;

  const Test = () => {
    const ref = useRef<HTMLDivElement | null>(null);
    const res = useEngineScroll({
      scrollRegionRef: ref,
      scrollRegionHeightPx: options.height,
      scrollSource: options.scrollSource,
    });
    result = res;

    return (
      <div
        ref={(node) => {
          ref.current = node;
          if (!node) return;
          node.getBoundingClientRect = () => ({
            top: options.getRegionTop?.() ?? 0,
            left: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          });
          options.onRegionReady?.(node);
        }}
      />
    );
  };

  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(<Test />);
  });

  return { getResult: () => result!, unmount: () => root.unmount() };
};

describe('useEngineScroll', () => {
  it('computes progress based on window scroll position', () => {
    let scrollY = 0;
    Object.defineProperty(window, 'scrollY', {
      get: () => scrollY,
      configurable: true,
    });
    const { getResult, unmount } = renderHook({
      height: 1000,
      getRegionTop: () => -scrollY,
    });
    scrollY = 400;
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(getResult().progress).toBeCloseTo(0.5, 3);
    unmount();
  });

  it('scrollToProgress uses window.scrollTo for window source', () => {
    let scrollY = 0;
    Object.defineProperty(window, 'scrollY', {
      get: () => scrollY,
      configurable: true,
    });
    let target: number | undefined;
    window.scrollTo = ((options?: ScrollToOptions | number) => {
      if (typeof options === 'object') target = options.top as number;
      if (typeof options === 'number') target = options;
      scrollY = target ?? 0;
    }) as typeof window.scrollTo;

    const { getResult, unmount } = renderHook({
      height: 1000,
      getRegionTop: () => -scrollY,
    });
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });

    act(() => {
      getResult().scrollToProgress(0.5);
    });

    expect(typeof target).toBe('number');
    unmount();
  });

  it('reads element scroll source progress and scrollTo', () => {
    const elementRef = { current: document.createElement('div') as HTMLDivElement | null };
    const source = elementRef.current!;
    Object.defineProperty(source, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(source, 'scrollTop', { value: 300, configurable: true, writable: true });
    source.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      right: 500,
      bottom: 200,
      width: 500,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const scrollTo = vi.fn();
    source.scrollTo = scrollTo as unknown as typeof source.scrollTo;

    const { getResult, unmount } = renderHook({
      height: 1000,
      scrollSource: { kind: 'element', elementRef },
      getRegionTop: () => -source.scrollTop,
    });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(getResult().progress).toBeCloseTo(0.375, 3);

    act(() => {
      getResult().scrollToProgress(0.5);
    });
    expect(scrollTo).toHaveBeenCalled();
    unmount();
  });

  it('supports late-mounted element refs without crashing', () => {
    const elementRef = { current: null as HTMLDivElement | null };
    let sourceScrollTop = 0;
    const { getResult, unmount } = renderHook({
      height: 1000,
      scrollSource: { kind: 'element', elementRef },
      getRegionTop: () => -sourceScrollTop,
    });

    expect(getResult().progress).toBe(0);

    const source = document.createElement('div');
    elementRef.current = source;
    Object.defineProperty(source, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(source, 'scrollTop', {
      get: () => sourceScrollTop,
      set: (value: number) => {
        sourceScrollTop = value;
      },
      configurable: true,
    });
    sourceScrollTop = 400;
    source.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      right: 500,
      bottom: 200,
      width: 500,
      height: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(getResult().progress).toBeCloseTo(0.5, 3);
    unmount();
  });
});
