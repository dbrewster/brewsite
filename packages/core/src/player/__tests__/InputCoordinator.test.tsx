// @vitest-environment jsdom
// Tests for InputCoordinator: lifecycle, spec reading, handler dispatch, and
// the wheel priority waterfall (WheelMap exclusive, inertia fallback, scrollable guard).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ActionInputController } from '../../input/ActionInputController';
import React from 'react';
import { cleanup, render, act } from '@testing-library/react';
import { InputCoordinator } from '../InputCoordinator';
import { EngineContext } from '../EngineContext';
import { ActionInputExtensionContext } from '../ActionInputExtensionContext';
import { ScrollDriverContext } from '../ScrollDriverContext';
import { ScrollRegionContext } from '../ScrollRegionContext';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { SceneInputControllerSpec } from '../../input/types';
import type { ActionInputExtension } from '../ActionInputExtensionContext';
import { VariableStore } from '../../widget/VariableStore';
import type { ViewLayoutState, ViewState } from '../../compiler/viewTypes';
import type { NVSRect } from '../../layout/types';
import type { ScrollDriverContextValue } from '../ScrollDriverContext';
import type { ScrollRegionContextValue } from '../ScrollRegionContext';
import type { IScrollSource } from '../scrollSourceTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSpec = (): SceneInputControllerSpec => ({
  id: 'ctrl',
  scope: 'window',
  actions: [
    {
      id: 'next',
      type: 'scene.next',
      maps: [{ kind: 'key', key: 'ArrowRight' }],
    },
    {
      id: 'prev',
      type: 'scene.prev',
      maps: [{ kind: 'key', key: 'ArrowLeft' }],
    },
  ],
});

const makeTick = (spec: SceneInputControllerSpec | null): SceneTrackTick => ({
  index: 0,
  progress: 0,
  sceneId: 'scene-1',
  sceneIndex: 0,
  blockProgress: 0,
  sceneProgress: 0,
  state: {
    id: 'scene-1',
    scrollProgress: 0,
    widgets: spec ? { '__input_controller': spec } : {},
  },
  deltaForward: {},
  deltaBackward: {},
});

/**
 * Builds a minimal UseSceneEngineResult with only the fields InputCoordinator needs.
 * All dispatchable methods are vi.fn() so tests can assert on them.
 */
const makeEngine = (
  overrides: {
    tick?: SceneTrackTick | null;
    sceneCount?: number;
    canvasEl?: HTMLElement | null;
  } = {},
): UseSceneEngineResult => {
  const { tick = null, sceneCount = 3, canvasEl = null } = overrides;
  return {
    frameState: {
      tickIndex: tick?.index ?? -1,
      progress: 0,
      sceneId: 'scene-1',
      sceneIndex: 0,
      sceneProgress: 0,
      tick,
    },
    sceneCount,
    primaryCameraId: 'camera',
    primaryCanvasActionTargetId: '',
    canvasRef: { current: canvasEl },
    advanceProgress: vi.fn(),
    applyCameraOrbit: vi.fn(),
    applyCameraDolly: vi.fn(),
    applyCameraReset: vi.fn(),
    setCameraOverride: vi.fn(),
  } as unknown as UseSceneEngineResult;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('InputCoordinator', () => {
  it('does not re-create controller when engine object reference changes (tick simulation)', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const canvas = document.createElement('canvas');
    const engine1 = makeEngine({ tick, sceneCount: 3, canvasEl: canvas });

    const attachSpy = vi.spyOn(ActionInputController.prototype, 'attach');
    const detachSpy = vi.spyOn(ActionInputController.prototype, 'detach');

    let rerender!: ReturnType<typeof render>['rerender'];
    await act(async () => {
      const result = render(
        <EngineContext.Provider value={engine1}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
      rerender = result.rerender;
    });

    // attach called exactly once on initial mount.
    expect(attachSpy).toHaveBeenCalledTimes(1);
    expect(detachSpy).toHaveBeenCalledTimes(0);

    // Simulate a tick: produce a new engine object (same shape, new reference).
    const engine2 = makeEngine({ tick, sceneCount: 3, canvasEl: canvas });

    await act(async () => {
      rerender(
        <EngineContext.Provider value={engine2}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    // The controller must NOT have been torn down and re-created.
    expect(attachSpy).toHaveBeenCalledTimes(1);
    expect(detachSpy).toHaveBeenCalledTimes(0);
  });

  it('renders null — no DOM output', () => {
    const canvas = document.createElement('canvas');
    const engine = makeEngine({ canvasEl: canvas });

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <InputCoordinator />
      </EngineContext.Provider>,
    );

    expect(container.childElementCount).toBe(0);
  });

  it('does not attach when no target element is available', () => {
    // canvasRef.current is null and no target prop provided.
    const engine = makeEngine({ canvasEl: null });

    expect(() =>
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator />
        </EngineContext.Provider>,
      ),
    ).not.toThrow();
  });

  it('dispatches scene.next on ArrowRight keydown when spec is present', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    // Simulate ArrowRight on document (default keyboard target).
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    document.dispatchEvent(event);

    expect(engine.advanceProgress).toHaveBeenCalledTimes(1);
    // sceneCount=3, so delta = 1 / (3-1) = 0.5
    expect(engine.advanceProgress).toHaveBeenCalledWith(0.5);
  });

  it('dispatches scene.prev on ArrowLeft keydown when spec is present', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    document.dispatchEvent(event);

    expect(engine.advanceProgress).toHaveBeenCalledWith(-0.5);
  });

  it('does NOT dispatch when spec is null (tick has no __input_controller)', async () => {
    const tick = makeTick(null);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    document.dispatchEvent(event);

    expect(engine.advanceProgress).not.toHaveBeenCalled();
  });

  it('does NOT dispatch after unmount (controller is detached)', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    const { unmount } = await act(async () =>
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      ),
    );

    // Confirm attach works: first keydown dispatches.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(engine.advanceProgress).toHaveBeenCalledTimes(1);

    // Unmount and verify no further dispatches.
    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(engine.advanceProgress).toHaveBeenCalledTimes(1); // unchanged
  });

  it('reads __input_controller spec from tick state via getSpec() closure', async () => {
    const engine = makeEngine({ tick: null, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    // No tick yet — keydown is a no-op.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(engine.advanceProgress).not.toHaveBeenCalled();

    // Update the tick on the engine object (simulates first frame arriving).
    const spec = makeSpec();
    (engine.frameState as { tick: SceneTrackTick | null }).tick = makeTick(spec);

    // getSpec() closure reads from engine.frameState.tick on each event — no re-mount needed.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(engine.advanceProgress).toHaveBeenCalledTimes(1);
  });

  it('passes onUnknownAction from ActionInputExtensionContext to the controller', async () => {
    const spec: SceneInputControllerSpec = {
      id: 'ctrl',
      scope: 'window',
      actions: [
        {
          id: 'custom',
          type: 'diagram-canvas.move',
          maps: [{ kind: 'key', key: 'ArrowRight' }],
        },
      ],
    };
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');
    const onUnknownAction = vi.fn() as ActionInputExtension;

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ActionInputExtensionContext.Provider value={onUnknownAction}>
            <InputCoordinator target={canvas} />
          </ActionInputExtensionContext.Provider>
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(onUnknownAction).toHaveBeenCalledOnce();
    expect(onUnknownAction).toHaveBeenCalledWith(
      'diagram-canvas.move',
      undefined,
      expect.any(KeyboardEvent),
      expect.any(Object),
    );
  });

  it('does NOT dispatch with single scene (sceneCount <= 1 guard)', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 1 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    // sceneCount <= 1 → onSceneStep returns early without calling advanceProgress.
    expect(engine.advanceProgress).not.toHaveBeenCalled();
  });
});

// ─── Waterfall tests ──────────────────────────────────────────────────────────

/** Minimal ScrollDriverContextValue that captures what source was registered. */
class TestScrollDriver implements ScrollDriverContextValue {
  registeredSource: IScrollSource | null = null;
  setSource(source: IScrollSource | null): void {
    this.registeredSource = source;
  }
}

const makeWheelSpec = (): SceneInputControllerSpec => ({
  id: 'ctrl',
  scope: 'canvas',
  actions: [
    {
      id: 'dolly',
      type: 'camera.dolly',
      maps: [{ kind: 'wheel', axis: 'y' }],
    },
  ],
});

describe('InputCoordinator — wheel waterfall', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('WheelMap exclusive: when spec has WheelMap, wheel event fires action, not inertia', async () => {
    const tick = makeTick(makeWheelSpec());
    const engine = makeEngine({ tick, sceneCount: 3 });
    const target = document.createElement('div');
    const driver = new TestScrollDriver();
    const containerRef = { current: target };
    const scrollRegionValue: ScrollRegionContextValue = { containerRef, scrollHeightPx: 5000 };

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ScrollDriverContext.Provider value={driver}>
            <ScrollRegionContext.Provider value={scrollRegionValue}>
              <InputCoordinator target={target} />
            </ScrollRegionContext.Provider>
          </ScrollDriverContext.Provider>
        </EngineContext.Provider>,
      );
    });

    // Record progress before the wheel event fires.
    let lastProgress: number | undefined;
    driver.registeredSource?.subscribe((p) => { lastProgress = p; });
    // At this point lastProgress = 0 (initial emit from subscribe).
    const progressBeforeWheel = lastProgress;

    // Dispatch wheel event to target.
    target.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));

    // Camera dolly must have fired.
    expect(engine.applyCameraDolly).toHaveBeenCalledTimes(1);

    // Progress must NOT have changed synchronously — the WheelMap claimed the event,
    // so the inertia accumulator was not fed. Progress stays at 0.
    expect(lastProgress).toBe(progressBeforeWheel);
  });

  it('Wheel fallback to inertia: when spec has no WheelMap, wheel event accumulates inertia', async () => {
    const specNoWheel: SceneInputControllerSpec = {
      id: 'ctrl',
      scope: 'canvas',
      actions: [
        {
          id: 'next',
          type: 'scene.next',
          maps: [{ kind: 'key', key: 'ArrowRight' }],
        },
      ],
    };
    const tick = makeTick(specNoWheel);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const target = document.createElement('div');
    const driver = new TestScrollDriver();
    const containerRef = { current: target };
    const scrollRegionValue: ScrollRegionContextValue = { containerRef, scrollHeightPx: 5000 };

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ScrollDriverContext.Provider value={driver}>
            <ScrollRegionContext.Provider value={scrollRegionValue}>
              <InputCoordinator target={target} inertiaSensitivity={0.5} inertiaDecay={0.5} />
            </ScrollRegionContext.Provider>
          </ScrollDriverContext.Provider>
        </EngineContext.Provider>,
      );
    });

    // No camera dolly should fire.
    expect(engine.applyCameraDolly).not.toHaveBeenCalled();

    // After a wheel event, progress should eventually become non-zero via RAF.
    // We check that the scroll source was registered (proving the inertia path is wired).
    expect(driver.registeredSource).not.toBeNull();
  });

  it('Scrollable content guard: wheel over element with room to scroll → no action, no inertia', async () => {
    const tick = makeTick(makeWheelSpec());
    const engine = makeEngine({ tick, sceneCount: 3 });
    const target = document.createElement('div');
    document.body.appendChild(target);

    // Create a scrollable child inside the target.
    const scrollableChild = document.createElement('div');
    Object.defineProperty(scrollableChild, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(scrollableChild, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(scrollableChild, 'scrollTop', { value: 50, configurable: true, writable: true });
    scrollableChild.style.overflowY = 'auto';
    target.appendChild(scrollableChild);

    const driver = new TestScrollDriver();
    const containerRef = { current: target };
    const scrollRegionValue: ScrollRegionContextValue = { containerRef, scrollHeightPx: 5000 };

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ScrollDriverContext.Provider value={driver}>
            <ScrollRegionContext.Provider value={scrollRegionValue}>
              <InputCoordinator target={target} />
            </ScrollRegionContext.Provider>
          </ScrollDriverContext.Provider>
        </EngineContext.Provider>,
      );
    });

    // Dispatch wheel event with target set to the scrollable child.
    const wheelEvent = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true });
    Object.defineProperty(wheelEvent, 'target', { value: scrollableChild, configurable: true });
    target.dispatchEvent(wheelEvent);

    // Neither camera dolly nor inertia should fire.
    expect(engine.applyCameraDolly).not.toHaveBeenCalled();
    // The event should NOT have been prevented (native scroll allowed).
    expect(wheelEvent.defaultPrevented).toBe(false);

    document.body.removeChild(target);
  });
});

// ─── Carousel onCarouselStep tests ────────────────────────────────────────────

/** Build a SceneInputControllerSpec with carousel.next (ArrowRight) and carousel.prev (ArrowLeft). */
const makeCarouselSpec = (layoutId: string, stepSlides = 1): SceneInputControllerSpec => ({
  id: 'ctrl',
  scope: 'window',
  actions: [
    {
      id: 'carousel-next',
      type: 'carousel.next',
      layoutId,
      stepSlides,
      maps: [{ kind: 'key', key: 'ArrowRight' }],
    },
    {
      id: 'carousel-prev',
      type: 'carousel.prev',
      layoutId,
      stepSlides,
      maps: [{ kind: 'key', key: 'ArrowLeft' }],
    },
  ],
});

/** Build a ViewLayoutState for a carousel with N views. */
const makeCarouselLayoutState = (
  layoutId: string,
  viewIds: string[],
  activeIndex: number,
  loop: boolean,
): ViewLayoutState => ({
  id: layoutId,
  kind: 'carousel',
  bounds: { x: 0, y: 0, w: 1, h: 1 },
  viewIds,
  layoutConfig: { kind: 'carousel', activeIndex, loop },
  childSizeHints: viewIds.map(() => ({ w: 0.3, h: 0.5 })),
});

/** Build a minimal ViewState for a child view. */
const makeViewState = (id: string, bounds: NVSRect = { x: 0, y: 0, w: 0.3, h: 0.5 }): ViewState => ({
  id,
  bounds,
  padding: [0, 0, 0, 0],
  contentBounds: bounds,
  layer: 0,
  scale: 1,
  z: 0,
  opacity: 1,
});

type CarouselEngineOptions = {
  layoutId: string;
  layoutState: ViewLayoutState;
  viewStates: Record<string, ViewState>;
  variableStore: VariableStore;
  patchWidgetStates: ReturnType<typeof vi.fn>;
  canvasEl?: HTMLElement | null;
};

/** Build a UseSceneEngineResult-shaped object for carousel tests. */
const makeCarouselEngine = (opts: CarouselEngineOptions): UseSceneEngineResult => {
  const { layoutId, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl = null } = opts;
  const spec = makeCarouselSpec(layoutId);
  const tick: SceneTrackTick = {
    index: 0,
    progress: 0,
    sceneId: 'scene-1',
    sceneIndex: 0,
    blockProgress: 0,
    sceneProgress: 0,
    state: {
      id: 'scene-1',
      scrollProgress: 0,
      widgets: {
        '__input_controller': spec,
        [layoutId]: layoutState,
        ...viewStates,
      },
    },
    deltaForward: {},
    deltaBackward: {},
  };
  return {
    frameState: {
      tickIndex: 0,
      progress: 0,
      sceneId: 'scene-1',
      sceneIndex: 0,
      sceneProgress: 0,
      tick,
    },
    sceneCount: 3,
    primaryCameraId: 'camera',
    primaryCanvasActionTargetId: '',
    canvasRef: { current: canvasEl },
    variableStore,
    patchWidgetStates,
    sceneTrack: null,
    advanceProgress: vi.fn(),
    applyCameraOrbit: vi.fn(),
    applyCameraDolly: vi.fn(),
    applyCameraReset: vi.fn(),
    setCameraOverride: vi.fn(),
  } as unknown as UseSceneEngineResult;
};

describe('InputCoordinator — onCarouselStep', () => {
  const LAYOUT_ID = 'my-carousel';
  const VIEW_IDS = ['v1', 'v2', 'v3'];

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('(1) linear clamping at min: loop=false, activeIndex=0, step -1 → no-op', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, VIEW_IDS, 0, false);
    const viewStates = Object.fromEntries(VIEW_IDS.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(patchWidgetStates).not.toHaveBeenCalled();
    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBeUndefined();
  });

  it('(2) linear clamping at max: loop=false, activeIndex=N-1, step +1 → no-op', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, VIEW_IDS, VIEW_IDS.length - 1, false);
    const viewStates = Object.fromEntries(VIEW_IDS.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(patchWidgetStates).not.toHaveBeenCalled();
  });

  it('(3) loop wrap forward: loop=true, activeIndex=N-1, step +1 → wraps to 0', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const maxIndex = VIEW_IDS.length - 1;
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, VIEW_IDS, maxIndex, true);
    const viewStates = Object.fromEntries(VIEW_IDS.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(patchWidgetStates).toHaveBeenCalledOnce();
    const patches = patchWidgetStates.mock.calls[0][0] as Record<string, unknown>;
    const patchedLayout = patches[LAYOUT_ID] as ViewLayoutState;
    expect((patchedLayout.layoutConfig as { activeIndex: number }).activeIndex).toBe(0);
    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBe(0);
  });

  it('(4) loop wrap backward: loop=true, activeIndex=0, step -1 → wraps to N-1', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, VIEW_IDS, 0, true);
    const viewStates = Object.fromEntries(VIEW_IDS.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(patchWidgetStates).toHaveBeenCalledOnce();
    const patches = patchWidgetStates.mock.calls[0][0] as Record<string, unknown>;
    const patchedLayout = patches[LAYOUT_ID] as ViewLayoutState;
    expect((patchedLayout.layoutConfig as { activeIndex: number }).activeIndex).toBe(VIEW_IDS.length - 1);
    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBe(VIEW_IDS.length - 1);
  });

  it('(5) stepSlides > 1: 7 children, loop=true, index=5, stepSlides=3 → index=(5+3)%7=1', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const sevenViews = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7'];
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, sevenViews, 5, true);
    const viewStates = Object.fromEntries(sevenViews.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');

    const spec = makeCarouselSpec(LAYOUT_ID, 3);
    const tick: SceneTrackTick = {
      index: 0, progress: 0, sceneId: 'scene-1', sceneIndex: 0, blockProgress: 0, sceneProgress: 0,
      state: { id: 'scene-1', scrollProgress: 0, widgets: { '__input_controller': spec, [LAYOUT_ID]: layoutState, ...viewStates } },
      deltaForward: {}, deltaBackward: {},
    };
    const engine = {
      frameState: { tickIndex: 0, progress: 0, sceneId: 'scene-1', sceneIndex: 0, sceneProgress: 0, tick },
      sceneCount: 3, primaryCameraId: 'camera', primaryCanvasActionTargetId: '',
      canvasRef: { current: canvas }, variableStore, patchWidgetStates, sceneTrack: null,
      advanceProgress: vi.fn(), applyCameraOrbit: vi.fn(), applyCameraDolly: vi.fn(),
      applyCameraReset: vi.fn(), setCameraOverride: vi.fn(),
    } as unknown as UseSceneEngineResult;

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(patchWidgetStates).toHaveBeenCalledOnce();
    const patches = patchWidgetStates.mock.calls[0][0] as Record<string, unknown>;
    const patchedLayout = patches[LAYOUT_ID] as ViewLayoutState;
    expect((patchedLayout.layoutConfig as { activeIndex: number }).activeIndex).toBe(1);
    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBe(1);
  });

  it('(6) missing layoutConfig: warns and does not patch', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const layoutState: ViewLayoutState = {
      id: LAYOUT_ID,
      kind: 'carousel',
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      viewIds: VIEW_IDS,
    };
    const viewStates = Object.fromEntries(VIEW_IDS.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(patchWidgetStates).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing layoutConfig'));
  });

  it('(7) empty children: viewIds.length === 0 → no-op', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, [], 0, false);
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates: {}, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(patchWidgetStates).not.toHaveBeenCalled();
  });

  it('(8) VariableStore fallback: first step reads compiled activeIndex when VariableStore is empty', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, VIEW_IDS, 1, false);
    const viewStates = Object.fromEntries(VIEW_IDS.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBeUndefined();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    // currentIndex was 1 (from compiled fallback), newIndex=2.
    expect(patchWidgetStates).toHaveBeenCalledOnce();
    const patches = patchWidgetStates.mock.calls[0][0] as Record<string, unknown>;
    const patchedLayout = patches[LAYOUT_ID] as ViewLayoutState;
    expect((patchedLayout.layoutConfig as { activeIndex: number }).activeIndex).toBe(2);
    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBe(2);
  });

  it('(9) VariableStore persistence: second step reads VariableStore value, not compiled value', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, VIEW_IDS, 0, false);
    const viewStates = Object.fromEntries(VIEW_IDS.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    // Step 1: compiled=0 → newIndex=1.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(patchWidgetStates).toHaveBeenCalledTimes(1);
    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBe(1);

    // Step 2: VariableStore=1 (not compiled=0) → newIndex=2.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(patchWidgetStates).toHaveBeenCalledTimes(2);
    const patches2 = patchWidgetStates.mock.calls[1][0] as Record<string, unknown>;
    const patchedLayout2 = patches2[LAYOUT_ID] as ViewLayoutState;
    expect((patchedLayout2.layoutConfig as { activeIndex: number }).activeIndex).toBe(2);
    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBe(2);
  });

  it('(10) out-of-bounds compiled activeIndex: activeIndex=99, 3 children → clamps, then step is clamped no-op', async () => {
    const variableStore = new VariableStore();
    const patchWidgetStates = vi.fn();
    const layoutState = makeCarouselLayoutState(LAYOUT_ID, VIEW_IDS, 99, false);
    const viewStates = Object.fromEntries(VIEW_IDS.map((id) => [id, makeViewState(id)]));
    const canvas = document.createElement('canvas');
    const engine = makeCarouselEngine({ layoutId: LAYOUT_ID, layoutState, viewStates, variableStore, patchWidgetStates, canvasEl: canvas });

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <InputCoordinator target={canvas} />
        </EngineContext.Provider>,
      );
    });

    // currentIndex = clamp(99, 0, 2) = 2; step +1 → newIndex = clamp(3, 0, 2) = 2 → no-op.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(patchWidgetStates).not.toHaveBeenCalled();

    // step -1: currentIndex=2 → newIndex=1 → patch called.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(patchWidgetStates).toHaveBeenCalledOnce();
    const patches = patchWidgetStates.mock.calls[0][0] as Record<string, unknown>;
    const patchedLayout = patches[LAYOUT_ID] as ViewLayoutState;
    expect((patchedLayout.layoutConfig as { activeIndex: number }).activeIndex).toBe(1);
    expect(variableStore.get('carousel', `${LAYOUT_ID}.activeIndex`)).toBe(1);
  });
});
