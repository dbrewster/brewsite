// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { EngineScrollRegion } from '../EngineScrollRegion';

class TestResizeObserver {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(): void {
    this.cb([], this);
  }
  unobserve(): void {}
  disconnect(): void {}
}

describe('EngineScrollRegion', () => {
  it('calls setViewportSize on mount and resize', () => {
    const calls: Array<{ w: number; h: number }> = [];
    const engine = {
      scrollRegionRef: { current: null as HTMLDivElement | null },
      scrollRegionHeightPx: 500,
      setViewportSize: (w: number, h: number) => { calls.push({ w, h }); },
      setCanvasRef: () => {},
    } as never;

    globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);
    act(() => {
      root.render(
        <EngineScrollRegion engine={engine}>
          <div>child</div>
        </EngineScrollRegion>,
      );
    });

    const sticky = container.querySelector('div div') as HTMLDivElement | null;
    if (sticky) {
      sticky.getBoundingClientRect = () => ({
        width: 320,
        height: 240,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
    }

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(calls.length).toBeGreaterThan(0);
    root.unmount();
  });
});
