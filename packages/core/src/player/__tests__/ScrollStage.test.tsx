// @vitest-environment jsdom
// ScrollStage tests — verifies scroll height computation, sticky layout, and context provision.

import { describe, it, expect, afterEach, useContext as _useContext, vi } from 'vitest';
import React, { useContext } from 'react';
import { cleanup, render } from '@testing-library/react';
import { ScrollStage } from '../ScrollStage';
import { EngineContext } from '../EngineContext';
import { ScrollRegionContext } from '../ScrollRegionContext';
import { ViewportScaleContext } from '../EngineARContainer';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { ViewportScaleContextValue } from '../EngineARContainer';

afterEach(() => cleanup());

// ─── Engine test double ────────────────────────────────────────────────────────

type MockEngineOptions = {
  sceneCount?: number;
  totalScrollUnits?: number;
};

const makeEngine = (options: MockEngineOptions = {}): UseSceneEngineResult => {
  const { sceneCount = 0, totalScrollUnits } = options;
  const sceneTrack = totalScrollUnits !== undefined
    ? { progressProfile: { totalScrollUnits }, sceneWindows: [] }
    : sceneCount > 0
      ? { sceneWindows: Array.from({ length: sceneCount }, (_, i) => ({ id: `scene-${i}`, index: i })) }
      : null;

  return {
    frameState: { tickIndex: -1, progress: 0, sceneId: '', sceneIndex: 0, sceneProgress: 0, tick: null },
    sceneCount,
    sceneTrack,
    progress: 0,
    variableStore: {} as never,
    setCanvasRef: vi.fn(),
    setViewportSize: vi.fn(),
    setBackgroundRef: vi.fn(),
    setRawProgress: vi.fn(),
    setProgress: vi.fn(),
    advanceProgress: vi.fn(),
    compiledScenes: [],
    progressMapper: null,
    getCamera: () => null,
    getRenderer: () => null,
    setCameraOverride: vi.fn(),
    getCameraOverride: () => null,
    setAutoAdvancePaused: vi.fn(),
    sceneOverlays: new Map(),
  } as unknown as UseSceneEngineResult;
};

const makeArCtx = (computedArHeight: number): ViewportScaleContextValue => ({
  containerWidth: 1920,
  containerHeight: 1080,
  computedArHeight,
  referenceWidth: 1920,
  scaleMode: 'fit-width',
});

// ─── Helper: render ScrollStage inside engine context ─────────────────────────

const renderScrollStage = (
  stageProps: React.ComponentProps<typeof ScrollStage>,
  engineOptions: MockEngineOptions = {},
  arHeight = 0,
) => {
  const engine = makeEngine(engineOptions);
  const arCtx = makeArCtx(arHeight);

  return render(
    <ViewportScaleContext.Provider value={arCtx}>
      <EngineContext.Provider value={engine}>
        <ScrollStage {...stageProps} />
      </EngineContext.Provider>
    </ViewportScaleContext.Provider>,
  );
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScrollStage — scene-count mode (default)', () => {
  it('computes height = pixelsPerScene × sceneCount', () => {
    const { container } = renderScrollStage(
      { pixelsPerScene: 400, children: <div /> },
      { sceneCount: 3 },
    );
    const spacer = container.firstChild as HTMLDivElement;
    // The outer spacer div has inline height
    expect(spacer.style.height).toBe('1200px');
  });

  it('defaults pixelsPerScene to 1200 when omitted', () => {
    const { container } = renderScrollStage(
      { children: <div /> },
      { sceneCount: 2 },
    );
    const spacer = container.firstChild as HTMLDivElement;
    expect(spacer.style.height).toBe('2400px');
  });

  it('uses min sceneCount of 1 when sceneCount === 0 (not yet compiled)', () => {
    const { container } = renderScrollStage(
      { pixelsPerScene: 500, children: <div /> },
      { sceneCount: 0 },
    );
    const spacer = container.firstChild as HTMLDivElement;
    expect(spacer.style.height).toBe('500px');
  });
});

describe('ScrollStage — scroll-units mode', () => {
  it('computes height = totalScrollUnits × pixelsPerScrollUnit', () => {
    const { container } = renderScrollStage(
      { scrollHeightMode: 'scroll-units', pixelsPerScrollUnit: 2, children: <div /> },
      { totalScrollUnits: 5000 },
    );
    const spacer = container.firstChild as HTMLDivElement;
    expect(spacer.style.height).toBe('10000px');
  });

  it('defaults pixelsPerScrollUnit to 1 when omitted', () => {
    const { container } = renderScrollStage(
      { scrollHeightMode: 'scroll-units', children: <div /> },
      { totalScrollUnits: 3000 },
    );
    const spacer = container.firstChild as HTMLDivElement;
    expect(spacer.style.height).toBe('3000px');
  });
});

describe('ScrollStage — explicit scrollHeightPx', () => {
  it('overrides all calculation when scrollHeightPx is provided', () => {
    const { container } = renderScrollStage(
      { scrollHeightPx: 99999, pixelsPerScene: 400, children: <div /> },
      { sceneCount: 5 },
    );
    const spacer = container.firstChild as HTMLDivElement;
    expect(spacer.style.height).toBe('99999px');
  });
});

describe('ScrollStage — sticky inner stage', () => {
  it('renders a sticky inner div with default 100vh height', () => {
    const { container } = renderScrollStage(
      { children: <div data-testid="content" /> },
      { sceneCount: 1 },
    );
    const stage = (container.firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(stage.style.position).toBe('sticky');
    expect(stage.style.top).toBe('0px');
    expect(stage.style.overflow).toBe('hidden');
    expect(stage.style.height).toBe('100vh');
  });

  it('applies custom stageHeight (number) to the sticky inner div', () => {
    const { container } = renderScrollStage(
      { stageHeight: 480, children: <div /> },
      { sceneCount: 1 },
    );
    const stage = (container.firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(stage.style.height).toBe('480px');
  });

  it('applies custom stageHeight (string) to the sticky inner div', () => {
    const { container } = renderScrollStage(
      { stageHeight: '50vh', children: <div /> },
      { sceneCount: 1 },
    );
    const stage = (container.firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(stage.style.height).toBe('50vh');
  });

  it('children are rendered inside the sticky stage', () => {
    const { container } = renderScrollStage(
      { children: <div data-testid="inner-child" /> },
      { sceneCount: 1 },
    );
    const stage = (container.firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(stage.querySelector('[data-testid="inner-child"]')).not.toBeNull();
  });
});

describe('ScrollStage — EngineARContainerContext interop', () => {
  it('uses computedArHeight for sticky stage height when non-zero', () => {
    const { container } = renderScrollStage(
      { stageHeight: '100vh', children: <div /> },
      { sceneCount: 1 },
      640, // computedArHeight
    );
    const stage = (container.firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(stage.style.height).toBe('640px');
  });

  it('falls back to stageHeight when computedArHeight is 0', () => {
    const { container } = renderScrollStage(
      { stageHeight: 500, children: <div /> },
      { sceneCount: 1 },
      0, // computedArHeight = 0 → use stageHeight
    );
    const stage = (container.firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(stage.style.height).toBe('500px');
  });
});

describe('ScrollStage — ScrollRegionContext provision', () => {
  it('provides ScrollRegionContext to children with correct scrollHeightPx', () => {
    let capturedCtx: { containerRef: unknown; scrollHeightPx: number } | null = null;

    function ScrollRegionConsumer(): React.ReactElement {
      const ctx = useContext(ScrollRegionContext);
      capturedCtx = ctx as typeof capturedCtx;
      return <div />;
    }

    renderScrollStage(
      { pixelsPerScene: 300, children: <ScrollRegionConsumer /> },
      { sceneCount: 4 },
    );

    expect(capturedCtx).not.toBeNull();
    expect(capturedCtx!.scrollHeightPx).toBe(1200); // 300 × 4
    expect(capturedCtx!.containerRef).toBeDefined();
  });
});
