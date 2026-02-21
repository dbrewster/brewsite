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
import type { IAnimationController, IContainedModel, ILoadable, IRenderable, ISceneElement } from '../../widget/types';

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

  it('getBoneWorldPositions() returns an empty map when no renderable provides positions', () => {
    const positions = driver.getBoneWorldPositions();
    expect(positions instanceof Map).toBe(true);
    expect(positions.size).toBe(0);
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

  it('initializes renderables, loads assets, and attaches contained models', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ enabled: boolean }>();

    class AnchorWidget implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'primary';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      private anchor: THREE.Bone | null = null;
      private anchorTargets: Record<string, string> = { head: 'headBone' };

      initialize(ctx: { scene: THREE.Scene; widgetId: string }): void {
        this.anchor = new THREE.Bone();
        this.anchor.name = 'headBone';
        ctx.scene.add(this.anchor);
      }
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
      getAnchorBoneName(key: string): string | undefined { return this.anchorTargets[key]; }
      findBoneNode(name: string): THREE.Object3D | undefined {
        if (this.anchor?.name === name) return this.anchor;
        return undefined;
      }
    }

    class ContainedWidget implements ISceneElement<{ enabled: boolean }>, IContainedModel<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'brain';
      readonly anchorModelId = 'primary';
      readonly anchorKey = 'head';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      private group: THREE.Group | null = null;

      initialize(ctx: { scene: THREE.Scene; widgetId: string }): void {
        this.group = new THREE.Group();
        this.group.name = 'brainGroup';
        ctx.scene.add(this.group);
      }
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
      getObject3D(): THREE.Object3D | null { return this.group; }
    }

    const anchor = new AnchorWidget();
    const contained = new ContainedWidget();
    registry.register(anchor).register(contained);

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore,
      manifest: { version: 2, models: [], containedModels: [], animations: [] },
    });

    await driver.initialize(scene);

    const group = contained.getObject3D();
    expect(group?.parent).toBe(anchor.findBoneNode('headBone'));
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
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.5 });

    expect(order[0]).toBe('tick');
    expect(order[1]).toBe('render:1');
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

    await expect(driver.initialize(new THREE.Scene())).rejects.toThrow('init fail');
    expect(errorCount).toBe(1);
  });

  it('initialize reports errors from loadables', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    let errorCount = 0;

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
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore,
      manifest: null,
      onError: () => { errorCount += 1; },
    });

    await expect(driver.initialize(new THREE.Scene())).rejects.toThrow('load fail');
    expect(errorCount).toBe(1);
  });

  it('attachContainedModels handles missing anchor info safely', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ enabled: boolean }>();

    class ContainedWidget implements ISceneElement<{ enabled: boolean }>, IContainedModel<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'child';
      readonly anchorModelId = 'missing';
      readonly anchorKey = 'head';
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
    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    await expect(driver.initialize(scene)).resolves.toBeUndefined();
  });

  it('tick reports errors from controllers and renderables', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    let errorCount = 0;

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
      onError: () => { errorCount += 1; },
    });

    driver.setSceneTrack(makeEmptySceneTrack());
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.5 });
    expect(errorCount).toBeGreaterThan(0);
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
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.5 });

    expect(applied[0]?.value).toBe(7);
  });

  it('tick is a no-op when scene or sampler is missing', () => {
    const registry = new WidgetRegistry();
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });
    expect(() => driver.tick({ deltaSeconds: 0.016, globalProgress: 0.2 })).not.toThrow();
    expect(driver.getCurrentTick()).toBeNull();
  });

  it('getBoneWorldPositions merges from renderables with providers', () => {
    const registry = new WidgetRegistry();
    class ProviderWidget implements IRenderable<{ value: number }>, ISceneElement<{ value: number }> {
      readonly widgetId = 'p';
      readonly defaultState = { value: 1 };
      readonly transitionSpec: ElementTransitionSpec<{ value: number }> = makeNoopSpec();
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(): void {}
      dispose(): void {}
      getBoneWorldPositions(): Map<string, [number, number, number]> {
        return new Map([['bone', [1, 2, 3]]]);
      }
    }
    registry.register(new ProviderWidget());
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });
    const result = driver.getBoneWorldPositions();
    expect(result.get('bone')).toEqual([1, 2, 3]);
  });

  it('attachContainedModels handles missing anchor details without throwing', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ enabled: boolean }>();

    class AnchorWidget implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'primary';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
      getAnchorBoneName(): string | undefined { return undefined; }
      findBoneNode(): undefined { return undefined; }
    }

    class ContainedWidget implements ISceneElement<{ enabled: boolean }>, IContainedModel<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'contained';
      readonly anchorModelId = 'primary';
      readonly anchorKey = 'head';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
    }

    registry.register(new AnchorWidget()).register(new ContainedWidget());
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore,
      manifest: null,
    });
    await expect(driver.initialize(scene)).resolves.toBeUndefined();
  });

  it('attachContainedModels warns when contained model has no Object3D', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    const scene = new THREE.Scene();

    const noopSpec = makeNoopSpec<{ enabled: boolean }>();

    class AnchorWidget implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'primary';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      private anchor = new THREE.Bone();
      initialize(ctx: { scene: THREE.Scene }): void {
        this.anchor.name = 'headBone';
        ctx.scene.add(this.anchor);
      }
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
      getAnchorBoneName(): string | undefined { return 'headBone'; }
      findBoneNode(): THREE.Object3D | undefined { return this.anchor; }
    }

    class ContainedWidget implements ISceneElement<{ enabled: boolean }>, IContainedModel<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'contained';
      readonly anchorModelId = 'primary';
      readonly anchorKey = 'head';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { this.isLoaded = true; }
      apply(): void {}
      dispose(): void {}
    }

    registry.register(new AnchorWidget()).register(new ContainedWidget());
    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    await expect(driver.initialize(scene)).resolves.toBeUndefined();
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
});
