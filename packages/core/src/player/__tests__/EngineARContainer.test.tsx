// @vitest-environment jsdom
// Tests for EngineARContainer: computeContainerDims pure function and --scene-scale injection.
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { cleanup, render, act } from '@testing-library/react';
import { computeContainerDims, EngineARContainer } from '../EngineARContainer';

// ─── ResizeObserver polyfill for jsdom ────────────────────────────────────────

type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

class StubResizeObserver implements ResizeObserver {
  private _cb: ResizeObserverCallback;
  private _targets: Element[] = [];

  constructor(cb: ResizeObserverCallback) {
    this._cb = cb;
  }

  observe(target: Element): void {
    this._targets.push(target);
  }

  unobserve(target: Element): void {
    this._targets = this._targets.filter((t) => t !== target);
  }

  disconnect(): void {
    this._targets = [];
  }

  /**
   * Test-only helper: simulate a resize event with the given dimensions.
   */
  simulateResize(width: number, height: number): void {
    const entry = {
      contentRect: { width, height } as DOMRectReadOnly,
      target: this._targets[0] ?? document.createElement('div'),
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    } as ResizeObserverEntry;
    this._cb([entry], this as unknown as ResizeObserver);
  }
}

// Track the last created observer so tests can trigger resize events.
let lastObserver: StubResizeObserver | null = null;

beforeEach(() => {
  lastObserver = null;
  globalThis.ResizeObserver = vi.fn().mockImplementation((cb: ResizeObserverCallback) => {
    lastObserver = new StubResizeObserver(cb);
    return lastObserver;
  }) as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Delete the stub so subsequent test files in the same fork see the original
// (or undefined) ResizeObserver rather than a cleared vi.fn() that returns undefined.
afterAll(() => {
  delete (globalThis as Record<string, unknown>).ResizeObserver;
});

// ─── computeContainerDims — pure function tests ────────────────────────────────

describe('computeContainerDims', () => {
  describe('fit-width', () => {
    it('derives height from width and AR: 1000x600 at 16/9 → content 1000x562.5', () => {
      const result = computeContainerDims(1000, 600, 16 / 9, 'fit-width', 1920);
      expect(result.containerW).toBe(1000);
      expect(result.containerH).toBeCloseTo(562.5, 1);
    });

    it('sets sceneScale to containerW / referenceWidth', () => {
      const result = computeContainerDims(1000, 600, 16 / 9, 'fit-width', 1920);
      expect(result.sceneScale).toBeCloseTo(1000 / 1920, 5);
    });
  });

  describe('fit-height', () => {
    it('derives width from height and AR: 1000x600 at 16/9 → content ~1066.7x600', () => {
      const result = computeContainerDims(1000, 600, 16 / 9, 'fit-height', 1920);
      expect(result.containerH).toBe(600);
      expect(result.containerW).toBeCloseTo(600 * (16 / 9), 1);
    });

    it('sets sceneScale to containerW / referenceWidth', () => {
      const result = computeContainerDims(1000, 600, 16 / 9, 'fit-height', 1920);
      expect(result.sceneScale).toBeCloseTo((600 * (16 / 9)) / 1920, 5);
    });
  });

  describe('contain', () => {
    it('wide container (1000x300 at 16/9): constrained by height → content ~533.3x300', () => {
      // byWidth = 1000 / (16/9) = 562.5; 562.5 > 300 → constrained by height
      const result = computeContainerDims(1000, 300, 16 / 9, 'contain', 1920);
      expect(result.containerH).toBe(300);
      expect(result.containerW).toBeCloseTo(300 * (16 / 9), 1);
    });

    it('tall container (400x600 at 16/9): constrained by width → content 400x225', () => {
      // byWidth = 400 / (16/9) = 225; 225 <= 600 → constrained by width
      const result = computeContainerDims(400, 600, 16 / 9, 'contain', 1920);
      expect(result.containerW).toBe(400);
      expect(result.containerH).toBeCloseTo(400 / (16 / 9), 1);
    });
  });

  describe('cover', () => {
    it('wide viewport (1920x800 at 16/9): byWidth=1080 >= 800 → content 1920x1080', () => {
      // byWidth = 1920 / (16/9) = 1080; 1080 >= 800 → use width as base
      const result = computeContainerDims(1920, 800, 16 / 9, 'cover', 1920);
      expect(result.containerW).toBe(1920);
      expect(result.containerH).toBeCloseTo(1920 / (16 / 9), 1);
    });

    it('tall viewport (600x1000 at 16/9): byWidth=337.5 < 1000 → content ~1777.8x1000', () => {
      // byWidth = 600 / (16/9) = 337.5; 337.5 < 1000 → use height as base
      const result = computeContainerDims(600, 1000, 16 / 9, 'cover', 1920);
      expect(result.containerH).toBe(1000);
      expect(result.containerW).toBeCloseTo(1000 * (16 / 9), 1);
    });
  });

  describe('degenerate inputs', () => {
    it('returns zeros when outerWidth is 0', () => {
      const result = computeContainerDims(0, 600, 16 / 9, 'fit-width', 1920);
      expect(result.containerW).toBe(0);
      expect(result.containerH).toBe(0);
      expect(result.sceneScale).toBe(0);
    });

    it('returns zeros when outerHeight is 0', () => {
      const result = computeContainerDims(1000, 0, 16 / 9, 'contain', 1920);
      expect(result.containerW).toBe(0);
      expect(result.containerH).toBe(0);
      expect(result.sceneScale).toBe(0);
    });

    it('returns zeros when both dimensions are 0', () => {
      const result = computeContainerDims(0, 0, 16 / 9, 'cover', 1920);
      expect(result.containerW).toBe(0);
      expect(result.containerH).toBe(0);
      expect(result.sceneScale).toBe(0);
    });
  });

  describe('--scene-scale formula', () => {
    it('sceneScale=0.5 when containerW=960 and referenceWidth=1920', () => {
      // fit-width: containerW = outerWidth = 960
      const result = computeContainerDims(960, 540, 16 / 9, 'fit-width', 1920);
      expect(result.sceneScale).toBeCloseTo(0.5, 5);
    });

    it('sceneScale=1.0 when containerW=1920 and referenceWidth=1920', () => {
      const result = computeContainerDims(1920, 1080, 16 / 9, 'fit-width', 1920);
      expect(result.sceneScale).toBeCloseTo(1.0, 5);
    });
  });
});

// ─── EngineARContainer — DOM integration tests ────────────────────────────────

describe('EngineARContainer', () => {
  it('renders children inside the AR container', () => {
    const { getByText } = render(
      <EngineARContainer>
        <span>hello world</span>
      </EngineARContainer>,
    );
    expect(getByText('hello world')).toBeTruthy();
  });

  it('applies className to the inner AR-locked div', () => {
    const { container } = render(
      <EngineARContainer className="my-ar-container">
        <span>content</span>
      </EngineARContainer>,
    );
    const inner = container.querySelector('.my-ar-container');
    expect(inner).not.toBeNull();
  });

  it('applies style to the outer wrapper div', () => {
    const { container } = render(
      <EngineARContainer style={{ backgroundColor: 'black' }}>
        <span>content</span>
      </EngineARContainer>,
    );
    const outer = container.firstElementChild as HTMLDivElement;
    expect(outer.style.backgroundColor).toBe('black');
  });

  it('sets position: relative on the outer wrapper div', () => {
    const { container } = render(
      <EngineARContainer>
        <span>content</span>
      </EngineARContainer>,
    );
    const outer = container.firstElementChild as HTMLDivElement;
    expect(outer.style.position).toBe('relative');
  });

  it('injects --scene-scale=0.5 on outer div when containerW=960 and referenceWidth=1920', async () => {
    const { container } = render(
      <EngineARContainer referenceWidth={1920} aspectRatio={16 / 9} scaleMode="fit-width">
        <span>content</span>
      </EngineARContainer>,
    );

    const outer = container.firstElementChild as HTMLDivElement;

    // Trigger the ResizeObserver callback with width=960, height=540.
    await act(async () => {
      lastObserver?.simulateResize(960, 540);
    });

    const sceneScale = outer.style.getPropertyValue('--scene-scale');
    expect(Number(sceneScale)).toBeCloseTo(0.5, 5);
  });

  it('injects --scene-scale=1.0 on outer div when containerW=1920 and referenceWidth=1920', async () => {
    const { container } = render(
      <EngineARContainer referenceWidth={1920} aspectRatio={16 / 9} scaleMode="fit-width">
        <span>content</span>
      </EngineARContainer>,
    );

    const outer = container.firstElementChild as HTMLDivElement;

    await act(async () => {
      lastObserver?.simulateResize(1920, 1080);
    });

    const sceneScale = outer.style.getPropertyValue('--scene-scale');
    expect(Number(sceneScale)).toBeCloseTo(1.0, 5);
  });
});
