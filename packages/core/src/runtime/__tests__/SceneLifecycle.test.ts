// Tests for ISceneLifecycle hooks in RuntimeDriverImpl.
// Verifies onSceneExit and onSceneEnter fire at the correct tick, in the correct order,
// with the correct args, and that hook errors do not blacklist the widget.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RuntimeDriverImpl } from '../RuntimeDriver';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { VariableStore } from '../../widget/VariableStore';
import type { ISceneLifecycle, ISceneElement, IRenderable, WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import type { SceneTrack } from '../../compiler/sceneTrackTypes';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ─── Test doubles ─────────────────────────────────────────────────────────────

const makeNoopSpec = <T,>(): FunctionalTransitionSpec<T> => ({
  exitFn: (from) => () => from,
  enterFn: (to) => () => to,
  interpolateFn: (_from, to) => () => to,
});

/**
 * Creates a minimal 2-scene SceneTrack.
 * Tick 0 (progress=0) → sceneIndex=0, sceneId='scene-0'
 * Tick 1 (progress=1) → sceneIndex=1, sceneId='scene-1'
 */
const makeTwoSceneTrack = (): SceneTrack => ({
  ticks: [
    {
      index: 0,
      progress: 0,
      sceneId: 'scene-0',
      sceneIndex: 0,
      blockProgress: 0,
      state: { id: 'scene-0', scrollProgress: 0, widgets: {} },
      deltaForward: {},
      deltaBackward: {},
      widgetExtras: {},
    },
    {
      index: 1,
      progress: 1,
      sceneId: 'scene-1',
      sceneIndex: 1,
      blockProgress: 0,
      state: { id: 'scene-1', scrollProgress: 0, widgets: {} },
      deltaForward: {},
      deltaBackward: {},
      widgetExtras: {},
    },
  ],
  tickStep: 1,
  subTickCount: 2,
  sceneWindows: [
    { id: 'scene-0', index: 0, start: 0, end: 0.5 },
    { id: 'scene-1', index: 1, start: 0.5, end: 1 },
  ],
});

type TestState = { value: number };

/**
 * Widget that tracks onSceneExit and onSceneEnter calls and call order.
 * Implements ISceneElement + IRenderable + ISceneLifecycle.
 */
class LifecycleWidget
  implements ISceneElement<TestState>, IRenderable<TestState>, ISceneLifecycle
{
  readonly widgetId: string;
  readonly defaultState: TestState = { value: 0 };
  readonly transitionSpec = makeNoopSpec<TestState>();
  readonly DslComponent = () => null;

  readonly exitCalls: Array<{ sceneId: string; sceneIndex: number }> = [];
  readonly enterCalls: Array<{ sceneId: string; sceneIndex: number }> = [];
  readonly callOrder: Array<'exit' | 'enter'> = [];

  constructor(id: string) {
    this.widgetId = id;
  }

  onSceneExit(sceneId: string, sceneIndex: number): void {
    this.exitCalls.push({ sceneId, sceneIndex });
    this.callOrder.push('exit');
  }

  onSceneEnter(sceneId: string, sceneIndex: number): void {
    this.enterCalls.push({ sceneId, sceneIndex });
    this.callOrder.push('enter');
  }

  initialize(_ctx: WidgetInitContext): void {}
  apply(_state: TestState, _ctx: WidgetRenderContext): void {}
  dispose(): void {}
}

/**
 * Lifecycle-only widget (does not implement IRenderable).
 * Used to verify that widgets without IRenderable still receive lifecycle hooks.
 */
class LifecycleOnlyWidget implements ISceneLifecycle {
  readonly widgetId: string;
  readonly exitCalls: Array<{ sceneId: string; sceneIndex: number }> = [];
  readonly enterCalls: Array<{ sceneId: string; sceneIndex: number }> = [];

  constructor(id: string) {
    this.widgetId = id;
  }

  onSceneExit(sceneId: string, sceneIndex: number): void {
    this.exitCalls.push({ sceneId, sceneIndex });
  }

  onSceneEnter(sceneId: string, sceneIndex: number): void {
    this.enterCalls.push({ sceneId, sceneIndex });
  }
}

/**
 * Widget whose lifecycle hooks always throw.
 * Used to verify that hook errors are caught and logged, not propagated.
 */
class FaultyLifecycleWidget implements ISceneLifecycle {
  readonly widgetId: string;
  exitCallCount = 0;
  enterCallCount = 0;

  constructor(id: string) {
    this.widgetId = id;
  }

  onSceneExit(_sceneId: string, _sceneIndex: number): void {
    this.exitCallCount++;
    throw new Error('exit error');
  }

  onSceneEnter(_sceneId: string, _sceneIndex: number): void {
    this.enterCallCount++;
    throw new Error('enter error');
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ISceneLifecycle hooks in RuntimeDriverImpl', () => {
  it('fires onSceneExit for the departing scene and onSceneEnter for the arriving scene', async () => {
    const registry = new WidgetRegistry();
    const widget = new LifecycleWidget('w');
    registry.register(widget);

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());

    // First tick: scene-0, no previous scene — no hooks should fire
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    expect(widget.exitCalls).toHaveLength(0);
    expect(widget.enterCalls).toHaveLength(0);

    // Second tick: scene-1 — triggers scene change
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });
    expect(widget.exitCalls).toHaveLength(1);
    expect(widget.exitCalls[0]).toEqual({ sceneId: 'scene-0', sceneIndex: 0 });
    expect(widget.enterCalls).toHaveLength(1);
    expect(widget.enterCalls[0]).toEqual({ sceneId: 'scene-1', sceneIndex: 1 });
  });

  it('fires onSceneExit before onSceneEnter', async () => {
    const registry = new WidgetRegistry();
    const widget = new LifecycleWidget('order-check');
    registry.register(widget);

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });

    expect(widget.callOrder).toEqual(['exit', 'enter']);
  });

  it('does not fire lifecycle hooks when the scene index does not change', async () => {
    const registry = new WidgetRegistry();
    const widget = new LifecycleWidget('no-change');
    registry.register(widget);

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());

    // Both ticks sample the same scene (sceneIndex=0, progress 0 and 0.2 both map to tick 0)
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.2, deltaProgress: 0 });

    expect(widget.exitCalls).toHaveLength(0);
    expect(widget.enterCalls).toHaveLength(0);
  });

  it('does not fire lifecycle hooks on the very first tick (no previous scene)', async () => {
    const registry = new WidgetRegistry();
    const widget = new LifecycleWidget('first-tick');
    registry.register(widget);

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });

    expect(widget.exitCalls).toHaveLength(0);
    expect(widget.enterCalls).toHaveLength(0);
  });

  it('lifecycle hooks receive the correct sceneId and sceneIndex arguments', async () => {
    const registry = new WidgetRegistry();
    const widget = new LifecycleWidget('arg-check');
    registry.register(widget);

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });

    expect(widget.exitCalls[0]?.sceneId).toBe('scene-0');
    expect(widget.exitCalls[0]?.sceneIndex).toBe(0);
    expect(widget.enterCalls[0]?.sceneId).toBe('scene-1');
    expect(widget.enterCalls[0]?.sceneIndex).toBe(1);
  });

  it('widget with throwing lifecycle hooks is not blacklisted from rendering', async () => {
    const registry = new WidgetRegistry();
    const faulty = new FaultyLifecycleWidget('faulty');
    registry.register(faulty);

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });

    // Scene change — hooks will throw but must not crash tick()
    expect(() => {
      driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });
    }).not.toThrow();

    console.warn = origWarn;

    // Both hooks were called despite throwing
    expect(faulty.exitCallCount).toBe(1);
    expect(faulty.enterCallCount).toBe(1);

    // Errors were logged as warnings, not propagated
    expect(warnings.some((w) => w.includes('[RuntimeDriver]'))).toBe(true);
  });

  it('lifecycle-only widget (no IRenderable) receives hooks correctly', async () => {
    const registry = new WidgetRegistry();
    const widget = new LifecycleOnlyWidget('lifecycle-only');
    registry.register(widget);

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });

    expect(widget.exitCalls).toHaveLength(1);
    expect(widget.exitCalls[0]).toEqual({ sceneId: 'scene-0', sceneIndex: 0 });
    expect(widget.enterCalls).toHaveLength(1);
    expect(widget.enterCalls[0]).toEqual({ sceneId: 'scene-1', sceneIndex: 1 });
  });

  it('plain IWidget without ISceneLifecycle does not cause errors during scene change', async () => {
    const registry = new WidgetRegistry();
    const lifecycleWidget = new LifecycleWidget('with-lifecycle');
    const plainWidget: { widgetId: string } = { widgetId: 'no-lifecycle' };
    registry.register(lifecycleWidget);
    registry.register(plainWidget);

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });

    expect(() => {
      driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });
    }).not.toThrow();

    // Only the lifecycle widget received hooks
    expect(lifecycleWidget.exitCalls).toHaveLength(1);
    expect(lifecycleWidget.enterCalls).toHaveLength(1);
  });

  it('multiple lifecycle widgets all receive hooks in registration order', async () => {
    const registry = new WidgetRegistry();
    const widgetA = new LifecycleWidget('a');
    const widgetB = new LifecycleWidget('b');
    registry.register(widgetA).register(widgetB);

    const callLog: string[] = [];

    const origExitA = widgetA.onSceneExit.bind(widgetA);
    const origExitB = widgetB.onSceneExit.bind(widgetB);
    widgetA.onSceneExit = (id, idx) => { callLog.push(`a:exit`); origExitA(id, idx); };
    widgetB.onSceneExit = (id, idx) => { callLog.push(`b:exit`); origExitB(id, idx); };

    const origEnterA = widgetA.onSceneEnter.bind(widgetA);
    const origEnterB = widgetB.onSceneEnter.bind(widgetB);
    widgetA.onSceneEnter = (id, idx) => { callLog.push(`a:enter`); origEnterA(id, idx); };
    widgetB.onSceneEnter = (id, idx) => { callLog.push(`b:enter`); origEnterB(id, idx); };

    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    driver.setSceneTrack(makeTwoSceneTrack());
    await driver.initialize(new THREE.Scene());
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0 });
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0 });

    // All onSceneExit calls happen before any onSceneEnter call
    expect(callLog).toEqual(['a:exit', 'b:exit', 'a:enter', 'b:enter']);
  });
});
