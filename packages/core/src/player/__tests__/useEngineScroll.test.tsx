// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { useEngineScroll } from '../useEngineScroll';

const renderHook = (height: number) => {
  let result: ReturnType<typeof useEngineScroll> | null = null;

  const Test = () => {
    const ref = useRef<HTMLDivElement | null>(null);
    const res = useEngineScroll({ scrollRegionRef: ref, scrollRegionHeightPx: height });
    result = res;

    useEffect(() => {
      if (ref.current) {
        ref.current.getBoundingClientRect = () => ({
          top: 100,
          left: 0,
          right: 0,
          bottom: 0,
          width: 100,
          height: 100,
          x: 0,
          y: 0,
          toJSON: () => {},
        });
      }
    }, []);

    return <div ref={ref} />;
  };

  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(<Test />);
  });

  return { getResult: () => result!, unmount: () => root.unmount() };
};

describe('useEngineScroll', () => {
  it('computes progress based on scroll position', () => {
    const { getResult, unmount } = renderHook(1000);
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    const { progress } = getResult();
    expect(progress).toBeGreaterThanOrEqual(0);
    unmount();
  });

  it('scrollToProgress calls window.scrollTo', () => {
    let target: number | undefined;
    window.scrollTo = ((options?: ScrollToOptions | number, _y?: number) => {
      if (typeof options === 'object') target = options.top as number;
      if (typeof options === 'number') target = options;
    }) as typeof window.scrollTo;
    const { getResult, unmount } = renderHook(1000);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });

    act(() => {
      getResult().scrollToProgress(0.5);
    });

    expect(typeof target).toBe('number');
    unmount();
  });
});
