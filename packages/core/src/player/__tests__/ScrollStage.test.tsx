// @vitest-environment jsdom
// ScrollStage tests — verifies contained-scroll layout, context provision, and handle APIs.

import { describe, it, expect, afterEach, vi } from 'vitest';
import React, { createRef, useContext } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { ScrollStage, type ScrollStageHandle } from '../ScrollStage';
import { CustomScrollSource } from '../StageScrollSources';
import { EngineContext } from '../EngineContext';
import { ScrollRegionContext } from '../ScrollRegionContext';
import { ViewportScaleContext } from '../EngineARContainer';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { ViewportScaleContextValue } from '../EngineARContainer';
import type { IScrollSource } from '../scrollSourceTypes';

afterEach(() => cleanup());

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

describe('ScrollStage — contained host layout', () => {
  it('renders a scroll host with intrinsic overflow defaults', () => {
    const { container } = renderScrollStage({ children: <div /> }, { sceneCount: 1 });
    const host = container.firstChild as HTMLDivElement;
    expect(host.style.position).toBe('relative');
    expect(host.style.width).toBe('100%');
    expect(host.style.height).toBe('100%');
    expect(host.style.overflowY).toBe('auto');
    expect(host.style.overflowX).toBe('hidden');
  });

  it('computes spacer minHeight = pixelsPerScene × sceneCount', () => {
    const { container } = renderScrollStage(
      { pixelsPerScene: 400, children: <div /> },
      { sceneCount: 3 },
    );
    const spacer = (container.firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(spacer.style.minHeight).toBe('1200px');
  });

  it('computes spacer minHeight from scroll-units mode', () => {
    const { container } = renderScrollStage(
      { scrollHeightMode: 'scroll-units', pixelsPerScrollUnit: 2, children: <div /> },
      { totalScrollUnits: 5000 },
    );
    const spacer = (container.firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(spacer.style.minHeight).toBe('10000px');
  });
});

describe('ScrollStage — sticky viewport', () => {
  it('renders a sticky inner stage with explicit height override', () => {
    const { container } = renderScrollStage(
      { stageHeight: 480, children: <div data-testid="content" /> },
      { sceneCount: 1 },
    );
    const stage = ((container.firstChild as HTMLDivElement).firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(stage.style.position).toBe('sticky');
    expect(stage.style.top).toBe('0px');
    expect(stage.style.height).toBe('480px');
    expect(stage.querySelector('[data-testid="content"]')).not.toBeNull();
  });

  it('uses computedArHeight when provided by context', () => {
    const { container } = renderScrollStage(
      { children: <div /> },
      { sceneCount: 1 },
      640,
    );
    const stage = ((container.firstChild as HTMLDivElement).firstChild as HTMLDivElement).firstChild as HTMLDivElement;
    expect(stage.style.height).toBe('640px');
  });
});

describe('ScrollStage — ScrollRegionContext provision', () => {
  it('provides containerRef and computed scrollHeightPx to children', () => {
    let capturedScrollHeight = 0;
    let capturedRef: unknown = null;

    function ScrollRegionConsumer(): React.ReactElement {
      const ctx = useContext(ScrollRegionContext);
      capturedScrollHeight = ctx?.scrollHeightPx ?? 0;
      capturedRef = ctx?.containerRef;
      return <div />;
    }

    renderScrollStage(
      { pixelsPerScene: 300, children: <ScrollRegionConsumer /> },
      { sceneCount: 4 },
    );

    expect(capturedScrollHeight).toBe(1200);
    expect(capturedRef).toBeDefined();
  });
});

describe('ScrollStage — imperative handle', () => {
  it('exposes snapshot reads, programmatic scroll, and subscription', () => {
    const ref = createRef<ScrollStageHandle>();
    const engine = makeEngine({ sceneCount: 3 });
    const arCtx = makeArCtx(0);

    const { container } = render(
      <ViewportScaleContext.Provider value={arCtx}>
        <EngineContext.Provider value={engine}>
          <ScrollStage ref={ref} pixelsPerScene={400}>
            <div />
          </ScrollStage>
        </EngineContext.Provider>
      </ViewportScaleContext.Provider>,
    );

    const host = container.firstChild as HTMLDivElement;
    Object.defineProperty(host, 'clientHeight', { value: 400, configurable: true });
    host.scrollTo = ((options?: ScrollToOptions | number, _y?: number) => {
      if (typeof options === 'number') {
        host.scrollTop = options;
        return;
      }
      host.scrollTop = options?.top ?? 0;
    }) as typeof host.scrollTo;

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const snapshots: number[] = [];
    const unsubscribe = ref.current!.subscribe((snapshot) => {
      snapshots.push(snapshot.rawProgress);
    });

    act(() => {
      ref.current!.scrollToProgress(0.5);
      host.dispatchEvent(new Event('scroll'));
    });

    expect(ref.current!.getScrollTop()).toBe(400);
    expect(ref.current!.getMaxScrollTop()).toBe(800);
    expect(ref.current!.getRawProgress()).toBe(0.5);
    expect(snapshots.at(-1)).toBe(0.5);

    unsubscribe();
  });

  it('switches to a child-provided custom scroll source', () => {
    const ref = createRef<ScrollStageHandle>();
    const engine = makeEngine({ sceneCount: 3 });
    const arCtx = makeArCtx(0);
    let subscriber: ((rawProgress: number) => void) | null = null;

    const source: IScrollSource = {
      subscribe(onProgress) {
        subscriber = onProgress;
        onProgress(0.1);
        return () => { subscriber = null; };
      },
      scrollTo(rawProgress) {
        subscriber?.(rawProgress);
      },
    };

    render(
      <ViewportScaleContext.Provider value={arCtx}>
        <EngineContext.Provider value={engine}>
          <ScrollStage ref={ref} pixelsPerScene={400}>
            <CustomScrollSource source={source} />
            <div />
          </ScrollStage>
        </EngineContext.Provider>
      </ViewportScaleContext.Provider>,
    );

    expect(engine.setRawProgress).toHaveBeenCalledWith(0.1);

    act(() => {
      ref.current!.scrollToProgress(0.75);
    });

    expect(engine.setRawProgress).toHaveBeenLastCalledWith(0.75);
    expect(ref.current!.getRawProgress()).toBe(0.75);
  });
});
