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
    sceneProgress: progress,
    state: { id: 'test', scrollProgress: progress, widgets: {} },
    deltaForward: {},
    deltaBackward: {},
    widgetExtras: {},
  });

  return {
    ticks: [makeTick(0), makeTick(1)],
    tickStep: 1,
    subTickCount: 2,
    sceneWindows: [{ id: 'test', index: 0, start: 0, end: 1, entryStart: 0 }],
  };
};

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

    const noopSpec: ElementTransitionSpec<{ enabled: boolean }> = {
      exit: (s) => s,
      enter: (s) => s,
      interpolate: (_a, b) => b,
    };

    class AnchorWidget implements ISceneElement<{ enabled: boolean }>, IRenderable<{ enabled: boolean }>, ILoadable {
      readonly widgetId = 'primary';
      readonly defaultState = { enabled: true };
      readonly transitionSpec = noopSpec;
      readonly DslComponent = () => null;
      isLoaded = false;
      private anchor: THREE.Bone | null = null;
      private anchorTargets = { head: 'headBone' };

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

    const noopSpec: ElementTransitionSpec<{ value: number }> = {
      exit: (s) => s,
      enter: (s) => s,
      interpolate: (_a, b) => b,
    };

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
});
