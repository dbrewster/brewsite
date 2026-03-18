// Tests for applyErroredWidgets/loadErroredWidgets split in RuntimeDriverImpl.
// Verifies that apply-errors clear on scene change while load-errors persist.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RuntimeDriverImpl } from '../RuntimeDriver';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { VariableStore } from '../../widget/VariableStore';
import type { SceneTrack, SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { ILoadable, IRenderable, ISceneElement, IAnimationController } from '../../widget/types';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const makeNoopSpec = <T,>(): FunctionalTransitionSpec<T> => ({
  exitFn: (from) => () => from,
  enterFn: (to) => () => to,
  interpolateFn: (_from, to) => () => to,
});

const makeTick = (sceneIndex: number, progress: number): SceneTrackTick => ({
  index: sceneIndex,
  progress,
  sceneId: `scene-${sceneIndex}`,
  sceneIndex,
  blockProgress: 0,
  state: { id: `scene-${sceneIndex}`, scrollProgress: 0, widgets: {} },
  deltaForward: {},
  deltaBackward: {},
  widgetExtras: {},
});

/** Two-scene track: progress 0 → sceneIndex 0, progress 1 → sceneIndex 1. */
const makeTwoSceneTrack = (): SceneTrack => ({
  ticks: [makeTick(0, 0), makeTick(1, 1)],
  tickStep: 1,
  subTickCount: 2,
  sceneWindows: [
    { id: 'scene-0', index: 0, start: 0, end: 0.5 },
    { id: 'scene-1', index: 1, start: 0.5, end: 1 },
  ],
});

// ---------------------------------------------------------------------------
// applyErroredWidgets — cleared on scene change
// ---------------------------------------------------------------------------

describe('applyErroredWidgets', () => {
  it('clears on scene change — a renderable that failed in apply() is retried in the new scene', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    let applyCount = 0;
    let shouldThrow = true;

    class RecoveringRenderable implements ISceneElement<{ x: number }>, IRenderable<{ x: number }> {
      readonly widgetId = 'recovering';
      readonly defaultState = { x: 0 };
      readonly transitionSpec = makeNoopSpec<{ x: number }>();
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(): void {
        if (shouldThrow) throw new Error('transient apply fail');
        applyCount++;
      }
      dispose(): void {}
    }

    registry.register(new RecoveringRenderable());

    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());

    // Scene 0: apply() throws → widget added to applyErroredWidgets
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    expect(applyCount).toBe(0);

    // Allow apply to succeed on retry
    shouldThrow = false;

    // Scene 1: scene change clears applyErroredWidgets → widget is retried
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });
    expect(applyCount).toBe(1);
  });

  it('clears on scene change — an animation controller that failed in onTick() is retried in the new scene', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    let tickCount = 0;
    let shouldThrow = true;

    class RecoveringController implements IAnimationController {
      readonly widgetId = 'recovering-ctrl';
      onTick(): void {
        if (shouldThrow) throw new Error('transient tick fail');
        tickCount++;
      }
    }

    registry.register(new RecoveringController());

    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());

    // Scene 0: onTick() throws
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    expect(tickCount).toBe(0);

    shouldThrow = false;

    // Scene 1: scene change clears applyErroredWidgets → controller retried
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });
    expect(tickCount).toBe(1);
  });

  it('does NOT clear between ticks in the same scene', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    let applyCount = 0;

    class AlwaysThrowsRenderable implements ISceneElement<{ x: number }>, IRenderable<{ x: number }> {
      readonly widgetId = 'always-fails';
      readonly defaultState = { x: 0 };
      readonly transitionSpec = makeNoopSpec<{ x: number }>();
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(): void { throw new Error('always fails'); }
      dispose(): void {}
    }

    class SuccessRenderable implements ISceneElement<{ x: number }>, IRenderable<{ x: number }> {
      readonly widgetId = 'succeeds';
      readonly defaultState = { x: 0 };
      readonly transitionSpec = makeNoopSpec<{ x: number }>();
      readonly DslComponent = () => null;
      initialize(): void {}
      apply(): void { applyCount++; }
      dispose(): void {}
    }

    registry.register(new AlwaysThrowsRenderable()).register(new SuccessRenderable());

    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());

    // First tick in scene 0: always-fails errors; succeeds is called once
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    // Second tick in the same scene 0: always-fails is still blacklisted
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });

    // succeeds should be called twice (once per tick), always-fails never
    expect(applyCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// loadErroredWidgets — persists across scene changes
// ---------------------------------------------------------------------------

describe('loadErroredWidgets', () => {
  it('persists on scene change — a widget that failed load() is never applied', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    let applyCount = 0;

    class BadLoadRenderable implements ISceneElement<{ x: number }>, IRenderable<{ x: number }>, ILoadable {
      readonly widgetId = 'bad-load';
      readonly defaultState = { x: 0 };
      readonly transitionSpec = makeNoopSpec<{ x: number }>();
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { throw new Error('asset missing'); }
      apply(): void { applyCount++; }
      dispose(): void {}
    }

    registry.register(new BadLoadRenderable());

    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene()); // load() fails → loadErroredWidgets

    // Scene 0: apply() never called
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    expect(applyCount).toBe(0);

    // Scene 1: scene change does NOT clear loadErroredWidgets → still skipped
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });
    expect(applyCount).toBe(0);
  });

  it('persists — multiple ticks across multiple scene changes never call apply()', async () => {
    const registry = new WidgetRegistry();
    const variableStore = new VariableStore();
    let applyCount = 0;

    class BadLoadRenderable implements ISceneElement<{ x: number }>, IRenderable<{ x: number }>, ILoadable {
      readonly widgetId = 'bad-load-multi';
      readonly defaultState = { x: 0 };
      readonly transitionSpec = makeNoopSpec<{ x: number }>();
      readonly DslComponent = () => null;
      isLoaded = false;
      initialize(): void {}
      async load(): Promise<void> { throw new Error('permanent failure'); }
      apply(): void { applyCount++; }
      dispose(): void {}
    }

    registry.register(new BadLoadRenderable());

    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore, manifest: null });
    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());

    // Alternate between scenes multiple times
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 }); // scene 0
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 }); // scene 1
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 }); // scene 0 again
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 }); // scene 1 again

    expect(applyCount).toBe(0);
  });
});
