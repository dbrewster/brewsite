// RuntimeDriverImpl tests — interface-based stateful tests.
// Tests exercise the public IRuntimeDriver contract.
// Uses a real WidgetRegistry and real VariableStore; no mocks.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { RuntimeDriverImpl } from '../RuntimeDriver';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { VariableStore } from '../../widget/VariableStore';
import type { SceneTrack, SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';
import type { IAnimationController, ILoadable, IRenderable, ISceneElement, IAttachmentHost, IContainedRenderable, IRenderContributor, RenderContribution } from '../../widget/types';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

const makeEmptySceneTrack = (): SceneTrack => {
  const makeTick = (progress: number): SceneTrackTick => ({
    index: progress === 0 ? 0 : 1,
    progress,
    sceneId: 'test',
    sceneIndex: 0,
    blockProgress: progress,
    state: { id: 'test', scrollProgress: progress, widgets: {} },
    deltaForward: {},
    deltaBackward: {},
    widgetExtras: {},
  });

  return {
    ticks: [makeTick(0), makeTick(1)],
    tickStep: 1,
    subTickCount: 2,
    sceneWindows: [{ id: 'test', index: 0, start: 0, end: 1 }],
  };
};

const makeNoopSpec = <T,>(): ElementTransitionSpec<T> => ({
  exit: (frames, widgetId, fromState) => {
    for (const frame of frames) {
      frame.state.widgets[widgetId] = fromState;
    }
  },
  enter: (frames, widgetId, toState) => {
    for (const frame of frames) {
      frame.state.widgets[widgetId] = toState;
    }
  },
  interpolate: (frames, widgetId, _fromState, toState) => {
    for (const frame of frames) {
      frame.state.widgets[widgetId] = toState;
    }
  },
});

const makeTick = (options: {
  index: number;
  progress: number;
  sceneIndex: number;
  blockProgress: number;
  widgets?: Record<string, unknown>;
}): SceneTrackTick => ({
  index: options.index,
  progress: options.progress,
  sceneId: `scene-${options.sceneIndex}`,
  sceneIndex: options.sceneIndex,
  blockProgress: options.blockProgress,
  state: {
    id: `scene-${options.sceneIndex}`,
    scrollProgress: options.blockProgress,
    widgets: options.widgets ?? {},
  },
  deltaForward: {},
  deltaBackward: {},
  widgetExtras: {},
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RuntimeDriverImpl', () => {
  let driver: RuntimeDriverImpl;

  beforeEach(() => {
    driver = new RuntimeDriverImpl({
      widgetRegistry: new WidgetRegistry(),
      variableStore: new VariableStore(),
      manifest: null,
    });
  });

  it('starts with assetsReady = false', () => {
    expect(driver.assetsReady).toBe(false);
  });

  it('setAssetsReady(true) updates assetsReady', () => {
    driver.setAssetsReady(true);
    expect(driver.assetsReady).toBe(true);
  });

  it('setAssetsReady(false) sets assetsReady back to false', () => {
    driver.setAssetsReady(true);
    driver.setAssetsReady(false);
    expect(driver.assetsReady).toBe(false);
  });

  it('getCurrentTick() returns null before any tick', () => {
    driver.setSceneTrack(makeEmptySceneTrack());
    expect(driver.getCurrentTick()).toBeNull();
  });

  it('collectRenderContributions() returns empty contribution when no contributor is registered', () => {
    const contributions = driver.collectRenderContributions();
    expect(contributions.namedPositions).toBeUndefined();
    expect(contributions.targetColors).toBeUndefined();
  });

  it('getWallTimeSeconds() returns 0 before any tick', () => {
    expect(driver.getWallTimeSeconds()).toBe(0);
  });

  it('dispose() can be called without error', () => {
    expect(() => driver.dispose()).not.toThrow();
  });

  it('setAssetsReady calls onAssetsReady callback when set to true', () => {
    let called = false;
    const driverWithCb = new RuntimeDriverImpl({
      widgetRegistry: new WidgetRegistry(),
      variableStore: new VariableStore(),
      manifest: null,
      onAssetsReady: () => { called = true; },
    });
    driverWithCb.setAssetsReady(true);
    expect(called).toBe(true);
  });

  it('initializes renderables, loads assets, and attaches contained renderables via IAttachmentHost', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ enabled: boolean }>();

    class HostWidget
      implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable, IAttachmentHost {
      readonly widgetId = 'primary';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      private headBone: THREE.Bone | null = null;

      initialize(ctx: { scene: THREE.Scene; widgetId: string }): void {
        this.headBone = new THREE.Bone();
        this.headBone.name = 'headBone';
        ctx.scene.add(this.headBone);
      }
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
      getAttachmentPoint(key: string): THREE.Object3D | null {
        if (key === 'head') return this.headBone;
        return null;
      }
    }

    class ContainedWidget
      implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable, IContainedRenderable {
      readonly widgetId = 'brain';
      readonly anchorWidgetId = 'primary';
      readonly anchorKey = 'head';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      readonly rootObject: THREE.Group = new THREE.Group();

      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
    }

    const host = new HostWidget();
    const contained = new ContainedWidget();
    registry.register(host).register(contained);

    const assetsReady = new Promise<void>((resolve) => {
      const driver = new RuntimeDriverImpl({
        widgetRegistry: registry,
        variableStore,
        manifest: { version: 2, models: [], animations: [] },
        onAssetsReady: resolve,
      });
      driver.initialize(scene);
    });
    await assetsReady;

    // After assets load, the contained widget's rootObject should be parented
    // to the host's 'head' attachment point.
    expect(contained.rootObject.parent).not.toBeNull();
  });

  it('ticks animation controllers before renderables', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const order: string[] = [];

    const noopSpec = makeNoopSpec<{ value: number }>();

    class RenderWidget implements ISceneElement<{ value: number }>, IRenderable<{ value: number }> {
      readonly widgetId = 'renderable';
      readonly defaultState = { value: 1 };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(state: { value: number }): void { order.push(`render:${state.value}`); }
      dispose(): void {}
    }

    class ControllerWidget implements IAnimationController {
      readonly widgetId = 'controller';
      onTick(): void { order.push('tick'); }
    }

    registry.register(new RenderWidget()).register(new ControllerWidget());

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore,
      manifest: null,
    });

    driver.setSceneTrack(makeEmptySceneTrack());
    driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.5, deltaProgress: 0 });

    expect(order[0]).toBe('tick');
    expect(order[1]).toBe('render:1');
  });

  it('evaluates functional closure at tick.blockProgress', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ value: number }>();
    const applied: Array<{ widgetId: string; value: number }> = [];

    class FunctionalWidget implements ISceneElement<{ value: number }>, IRenderable<{ value: number }> {
      readonly widgetId = 'func';
      readonly defaultState = { value: 0 };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(state: { value: number }): void { applied.push({ widgetId: this.widgetId, value: state.value }); }
      dispose(): void {}
    }

    class DiscreteWidget implements ISceneElement<{ value: number }>, IRenderable<{ value: number }> {
      readonly widgetId = 'disc';
      readonly defaultState = { value: 0 };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(state: { value: number }): void { applied.push({ widgetId: this.widgetId, value: state.value }); }
      dispose(): void {}
    }

    registry.register(new FunctionalWidget()).register(new DiscreteWidget());

    const track: SceneTrack = {
      ticks: [
        makeTick({ index: 0, progress: 0, sceneIndex: 0, blockProgress: 0.5, widgets: { disc: { value: 3 } } }),
        makeTick({ index: 1, progress: 1, sceneIndex: 1, blockProgress: 0, widgets: { disc: { value: 5 } } }),
      ],
      tickStep: 1,
      subTickCount: 2,
      sceneWindows: [{ id: 'scene-0', index: 0, start: 0, end: 1 }],
      transitionBlocks: [{
        blockIndex: 0,
        widgetFns: {
          func: {
            kind: 'interpolate',
            fn: (bp: number) => ({ value: bp * 10 }),
          },
        },
      }],
    };

    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    driver.setSceneTrack(track);
    driver.initialize(scene);
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });

    const funcApplied = applied.find((entry) => entry.widgetId === 'func');
    const discApplied = applied.find((entry) => entry.widgetId === 'disc');
    expect(funcApplied?.value).toBeCloseTo(5);
    expect(discApplied?.value).toBe(3);
  });

  it('falls back to discrete state when no functional block exists for that sceneIndex', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ value: number }>();
    let appliedValue = 0;

    class RenderWidget implements ISceneElement<{ value: number }>, IRenderable<{ value: number }> {
      readonly widgetId = 'w';
      readonly defaultState = { value: 0 };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(state: { value: number }): void { appliedValue = state.value; }
      dispose(): void {}
    }

    registry.register(new RenderWidget());

    const track: SceneTrack = {
      ticks: [
        makeTick({ index: 0, progress: 0, sceneIndex: 1, blockProgress: 1, widgets: { w: { value: 7 } } }),
      ],
      tickStep: 1,
      subTickCount: 1,
      sceneWindows: [{ id: 'scene-1', index: 1, start: 0, end: 1 }],
      transitionBlocks: [],
    };

    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    driver.setSceneTrack(track);
    driver.initialize(scene);
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });

    expect(appliedValue).toBe(7);
  });

  it('falls back to discrete state when widget is not in functional block', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ value: number }>();
    let appliedValue = 0;

    class RenderWidget implements ISceneElement<{ value: number }>, IRenderable<{ value: number }> {
      readonly widgetId = 'w';
      readonly defaultState = { value: 0 };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(state: { value: number }): void { appliedValue = state.value; }
      dispose(): void {}
    }

    registry.register(new RenderWidget());

    const track: SceneTrack = {
      ticks: [
        makeTick({ index: 0, progress: 0, sceneIndex: 0, blockProgress: 0.5, widgets: { w: { value: 9 } } }),
      ],
      tickStep: 1,
      subTickCount: 1,
      sceneWindows: [{ id: 'scene-0', index: 0, start: 0, end: 1 }],
      transitionBlocks: [{
        blockIndex: 0,
        widgetFns: {
          other: {
            kind: 'interpolate',
            fn: () => ({ value: 1 }),
          },
        },
      }],
    };

    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    driver.setSceneTrack(track);
    driver.initialize(scene);
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });

    expect(appliedValue).toBe(9);
  });

  it('initialize reports errors from renderables', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    let errorCount = 0;

    class BadRenderable implements IRenderable<{ value: number }>, ISceneElement<{ value: number }> {
      readonly widgetId = 'bad';
      readonly defaultState = { value: 1 };
      readonly transitionSpec: ElementTransitionSpec<{ value: number }> = makeNoopSpec();
      readonly DslComponent = () => null;
      initialize(): void { throw new Error('init fail'); }
      apply(): void {}
      dispose(): void {}
    }

    registry.register(new BadRenderable());
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore,
      manifest: null,
      onError: () => { errorCount += 1; },
    });

    expect(() => driver.initialize(new THREE.Scene())).toThrow('init fail');
    expect(errorCount).toBe(1);
  });

  it('initialize reports errors from loadables via onWidgetError without throwing', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const widgetErrors: Array<{ widgetId: string; error: Error }> = [];
    let assetsReadyFired = false;

    class BadLoadable implements IRenderable<{ value: number }>, ISceneElement<{ value: number }>, ILoadable {
      readonly widgetId = 'bad-load';
      readonly defaultState = { value: 1 };
      readonly transitionSpec: ElementTransitionSpec<{ value: number }> = makeNoopSpec();
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { throw new Error('load fail'); }
      apply(): void {}
      dispose(): void {}
    }

    registry.register(new BadLoadable());
    // Per-widget isolation: load() failure does not prevent onAssetsReady from firing.
    const assetsReadyPromise = new Promise<void>((resolve) => {
      const driver = new RuntimeDriverImpl({
        widgetRegistry: registry,
        variableStore,
        manifest: null,
        onAssetsReady: () => { assetsReadyFired = true; resolve(); },
        onWidgetError: (widgetId, error) => { widgetErrors.push({ widgetId, error }); },
      });
      driver.initialize(new THREE.Scene());
    });
    await assetsReadyPromise;
    expect(widgetErrors).toHaveLength(1);
    expect(widgetErrors[0]!.widgetId).toBe('bad-load');
    expect(widgetErrors[0]!.error.message).toBe('load fail');
    // onAssetsReady still fires even when a widget fails to load.
    expect(assetsReadyFired).toBe(true);
  });

  it('attachContainedRenderables: missing IAttachmentHost host widget warns and does not throw', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ enabled: boolean }>();

    class ContainedWidget
      implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable, IContainedRenderable {
      readonly widgetId = 'child';
      readonly anchorWidgetId = 'missing-host';
      readonly anchorKey = 'head';
      readonly rootObject = new THREE.Group();
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
    }

    registry.register(new ContainedWidget());
    // Missing host — should warn to console but not throw.
    const assetsReady = new Promise<void>((resolve) => {
      const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null, onAssetsReady: resolve });
      driver.initialize(scene);
    });
    await assetsReady;
  });

  it('tick reports errors from controllers and renderables via onWidgetError', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const widgetErrors: Array<{ widgetId: string; error: Error }> = [];

    const noopSpec = makeNoopSpec<{ value: number }>();

    class BadRender implements ISceneElement<{ value: number }>, IRenderable<{ value: number }> {
      readonly widgetId = 'render';
      readonly defaultState = { value: 1 };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(): void { throw new Error('render fail'); }
      dispose(): void {}
    }

    class BadController implements IAnimationController {
      readonly widgetId = 'controller';
      onTick(): void { throw new Error('tick fail'); }
    }

    registry.register(new BadRender()).register(new BadController());
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore,
      manifest: null,
      onWidgetError: (widgetId, error) => { widgetErrors.push({ widgetId, error }); },
    });

    driver.setSceneTrack(makeEmptySceneTrack());
    driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.5, deltaProgress: 0 });
    // Both the controller and renderable should have reported errors.
    expect(widgetErrors.length).toBeGreaterThan(0);
    const widgetIds = widgetErrors.map((e) => e.widgetId);
    expect(widgetIds).toContain('controller');
    expect(widgetIds).toContain('render');
  });

  it('tick uses defaultState when widget state is missing', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const applied: Array<{ value: number }> = [];

    const noopSpec = makeNoopSpec<{ value: number }>();

    class DefaultWidget implements ISceneElement<{ value: number }>, IRenderable<{ value: number }> {
      readonly widgetId = 'default';
      readonly defaultState = { value: 7 };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(state: { value: number }): void { applied.push(state); }
      dispose(): void {}
    }

    registry.register(new DefaultWidget());
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore,
      manifest: null,
    });

    driver.setSceneTrack(makeEmptySceneTrack());
    driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.5, deltaProgress: 0 });

    expect(applied[0]?.value).toBe(7);
  });

  it('tick is a no-op when scene or sampler is missing', () => {
    const registry = new WidgetRegistry();
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });
    expect(() => driver.tick({ deltaSeconds: 0.016, globalProgress: 0.2, deltaProgress: 0 })).not.toThrow();
    expect(driver.getCurrentTick()).toBeNull();
  });

  it('collectRenderContributions() merges from IRenderContributor widgets', () => {
    const registry = new WidgetRegistry();
    class ContributorWidget implements IRenderable<{ value: number }>, ISceneElement<{ value: number }>, IRenderContributor {
      readonly widgetId = 'p';
      readonly defaultState = { value: 1 };
      readonly transitionSpec: ElementTransitionSpec<{ value: number }> = makeNoopSpec();
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(): void {}
      dispose(): void {}
      contributeRenderData(): RenderContribution {
        return {
          namedPositions: new Map([['bone', [1, 2, 3] as [number, number, number]]]),
          targetColors: new Map([['bone', '#ff0000']]),
        };
      }
    }
    registry.register(new ContributorWidget());
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });
    const result = driver.collectRenderContributions();
    expect(result.namedPositions?.get('bone')).toEqual([1, 2, 3]);
    expect(result.targetColors?.get('bone')).toBe('#ff0000');
  });

  it('attachContainedRenderables: IAttachmentHost returns null for key — warns but does not throw', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ enabled: boolean }>();

    class HostWidget
      implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable, IAttachmentHost {
      readonly widgetId = 'primary';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
      // Returns null for any key — simulates a host with no matching attachment point.
      getAttachmentPoint(_key: string): THREE.Object3D | null { return null; }
    }

    class ContainedWidget
      implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable, IContainedRenderable {
      readonly widgetId = 'contained';
      readonly anchorWidgetId = 'primary';
      readonly anchorKey = 'head';
      readonly rootObject = new THREE.Group();
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
    }

    registry.register(new HostWidget()).register(new ContainedWidget());
    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    expect(() => driver.initialize(scene)).not.toThrow();
  });

  it('attachContainedRenderables: host that is NOT IAttachmentHost — warns and does not throw', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ enabled: boolean }>();

    // A plain renderable that does NOT implement IAttachmentHost.
    class PlainHostWidget
      implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'primary';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
    }

    class ContainedWidget
      implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable, IContainedRenderable {
      readonly widgetId = 'contained';
      readonly anchorWidgetId = 'primary';
      readonly anchorKey = 'head';
      readonly rootObject = new THREE.Group();
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
    }

    registry.register(new PlainHostWidget()).register(new ContainedWidget());
    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    expect(() => driver.initialize(scene)).not.toThrow();
  });

  it('dispose ignores errors from renderables', () => {
    const registry = new WidgetRegistry();
    const bad = {
      widgetId: 'bad',
      initialize: () => {},
      apply: () => {},
      dispose: () => { throw new Error('boom'); },
    };
    registry.register(bad as unknown as IRenderable<unknown>);
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });
    expect(() => driver.dispose()).not.toThrow();
  });

  it('honors configured maxAnimBoostPerFrame', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();
    let effectiveDelta = 0;

    registry.register({
      widgetId: 'anim',
      onTick: (ctx) => {
        effectiveDelta = ctx.effectiveDeltaSeconds;
      },
    } as IAnimationController);

    const track: SceneTrack = {
      ticks: [makeTick({ index: 0, progress: 0, sceneIndex: 0, blockProgress: 0, widgets: {} })],
      tickStep: 1,
      subTickCount: 1,
      sceneWindows: [{ id: 'scene-0', index: 0, start: 0, end: 1 }],
      progressProfile: {
        isUniform: false,
        totalScrollUnits: 1,
        segments: [{
          sceneIndex: 0,
          rawStart: 0,
          rawEnd: 1,
          engineStart: 0,
          engineEnd: 1,
          fn: (t) => t,
          animationTimeScale: 10,
        }],
      },
    };

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore,
      manifest: null,
      maxAnimBoostPerFrame: 0.05,
    });
    driver.setSceneTrack(track);
    driver.initialize(scene);
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 1 });

    expect(effectiveDelta).toBeCloseTo(0.05, 6);
  });
});
