import { describe, it, expect } from 'vitest';
import { compileSceneTrack } from '../sceneTrackCompiler';
import type { FunctionalTransitionSpec, ElementTransitionSpec } from '../transitions/transitionTypes';
import type { SceneDefinition } from '../sceneTypes';
import type { ISceneElement } from '../../widget/types';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { makeSimpleContext } from '../transitions/transitionResolver';

type TestState = { value: number; active: boolean };

const widgetId = 'widgetA';

const testFunctionalSpec: FunctionalTransitionSpec<TestState> = {
  exitFn: (from) => (ctx) => ({ value: from.value * (1 - ctx.t), active: ctx.t < 1 }),
  enterFn: (to) => (ctx) => ({ value: to.value * ctx.t, active: ctx.t > 0 }),
  interpolateFn: (from, to) => (ctx) => ({
    value: from.value + (to.value - from.value) * ctx.t,
    active: true,
  }),
};

const makeTestWidget = (id: string, spec: FunctionalTransitionSpec<TestState>, extras?: {
  compileExtra?: ISceneElement<TestState>['compileExtra'];
}): ISceneElement<TestState> => ({
  widgetId: id,
  defaultState: { value: 0, active: false },
  transitionSpec: spec,
  DslComponent: (() => null) as any,
  compileExtra: extras?.compileExtra,
});

const makeScene = (id: string, widgetState?: TestState): SceneDefinition => ({
  id,
  getFrame: () => ({
    id,
    scrollProgress: 0,
    widgets: widgetState ? { [widgetId]: widgetState } : {},
  }),
});

const compileTrack = (scenes: SceneDefinition[], registry: WidgetRegistry) =>
  compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 3 });

describe('functional transitions', () => {
  it('transitionBlocks is present when functional spec is used', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', { value: 10, active: true }),
      makeScene('s2', { value: 20, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    expect(track.transitionBlocks).toBeDefined();
    expect(track.transitionBlocks).toHaveLength(1);
    expect(track.transitionBlocks?.[0]?.widgetFns[widgetId]).toMatchObject({ kind: 'interpolate' });
  });

  it('transitionBlocks is absent when only discrete specs are used', () => {
    const spec: ElementTransitionSpec<TestState> = {
      exit: () => {},
      enter: () => {},
      interpolate: () => {},
    };
    const widget: ISceneElement<TestState> = {
      widgetId,
      defaultState: { value: 0, active: false },
      transitionSpec: spec,
      DslComponent: (() => null) as any,
    };
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { value: 1, active: true }),
      makeScene('s2', { value: 2, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    expect(track.transitionBlocks).toBeUndefined();
  });

  it('functional closure evaluates correctly at t=0 (interpolate)', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', { value: 10, active: true }),
      makeScene('s2', { value: 20, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    // Note: fn here is FunctionalWidgetTransition.fn which takes blockProgress: number.
    // makeResolver is called internally inside the closure — callers pass a raw number.
    const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId].fn;
    expect(fn?.(0)).toEqual({ value: 10, active: true });
  });

  it('functional closure evaluates correctly at t=1 (interpolate)', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', { value: 10, active: true }),
      makeScene('s2', { value: 20, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId].fn;
    expect(fn?.(1)).toEqual({ value: 20, active: true });
  });

  it('functional closure evaluates correctly at midpoint (interpolate)', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', { value: 10, active: true }),
      makeScene('s2', { value: 20, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId].fn;
    expect(fn?.(0.5)).toEqual({ value: 15, active: true });
  });

  it('exit closure: active in first half, absent state in second half', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', { value: 10, active: true }),
      makeScene('s2', undefined),
    ];
    const track = compileTrack(scenes, registry);
    const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId];
    expect(fn?.kind).toBe('exit');
    // Exit window default: [0, 0.5]. At bp=0 → t=0 → full state.
    expect(fn?.fn(0)).toEqual({ value: 10, active: true });
    // At bp=0.25 → within exit window → partially faded
    const quarter = fn?.fn(0.25) as TestState;
    expect(quarter.value).toBeGreaterThan(0);
    expect(quarter.value).toBeLessThan(10);
    expect(quarter.active).toBe(true);
    // At bp=0.5 → effectiveExitEnd → absentDefault
    expect(fn?.fn(0.5)).toEqual({ value: 0, active: false });
    expect(fn?.fn(1)).toEqual({ value: 0, active: false });
  });

  it('enter closure: absent state in first half, active in second half', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', undefined),
      makeScene('s2', { value: 10, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId];
    expect(fn?.kind).toBe('enter');
    // Enter window default: [0.5, 1]. bp < effectiveEnterStart (0.5) → absentDefault.
    expect(fn?.fn(0)).toEqual({ value: 0, active: false });
    expect(fn?.fn(0.49)).toEqual({ value: 0, active: false });
    // At bp=0.5 → effectiveEnterStart boundary → absentDefault (bp < 0.5 is false, so active)
    // Actually bp >= effectiveEnterStart (0.5), so the enter closure fires
    expect(fn?.fn(1)).toEqual({ value: 10, active: true });
  });

  it('absent from both scenes — no closure, frame state is defaultState', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', undefined),
      makeScene('s2', undefined),
    ];
    const track = compileTrack(scenes, registry);
    expect(track.transitionBlocks?.[0]?.widgetFns[widgetId]).toBeUndefined();
    expect(track.ticks[0]?.state.widgets[widgetId]).toEqual({ value: 0, active: false });
  });

  it('compileExtra fires correctly for functional widgets', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec, {
      compileExtra: (state) => ({ summary: state.value }),
    }));
    const scenes = [
      makeScene('s1', { value: 10, active: true }),
      makeScene('s2', { value: 20, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    const midTick = track.ticks[1];
    expect(midTick?.blockProgress).toBeCloseTo(0.5);
    expect(midTick?.widgetExtras?.[widgetId]).toEqual({ summary: 15 });
  });

  it('mixed mode: one functional widget + one discrete widget in same track', () => {
    const widgetBId = 'widgetB';
    const discreteSpec: ElementTransitionSpec<TestState> = {
      exit: (frames, wid, fromState) => {
        for (const frame of frames) frame.state.widgets[wid] = fromState;
      },
      enter: (frames, wid, toState) => {
        for (const frame of frames) frame.state.widgets[wid] = toState;
      },
      interpolate: (frames, wid, fromState, toState) => {
        for (const frame of frames) frame.state.widgets[wid] = {
          value: fromState.value + (toState.value - fromState.value),
          active: true,
        };
      },
    };
    const widgetA = makeTestWidget(widgetId, testFunctionalSpec);
    const widgetB: ISceneElement<TestState> = {
      widgetId: widgetBId,
      defaultState: { value: 0, active: false },
      transitionSpec: discreteSpec,
      DslComponent: (() => null) as any,
    };
    const registry = new WidgetRegistry().register(widgetA).register(widgetB);
    const scenes: SceneDefinition[] = [
      {
        id: 's1',
        getFrame: () => ({
          id: 's1',
          scrollProgress: 0,
          widgets: {
            [widgetId]: { value: 10, active: true },
            [widgetBId]: { value: 1, active: true },
          },
        }),
      },
      {
        id: 's2',
        getFrame: () => ({
          id: 's2',
          scrollProgress: 0,
          widgets: {
            [widgetId]: { value: 20, active: true },
            [widgetBId]: { value: 2, active: true },
          },
        }),
      },
    ];
    const track = compileTrack(scenes, registry);
    expect(track.transitionBlocks?.[0]?.widgetFns[widgetId]).toBeDefined();
    expect(track.ticks[0]?.state.widgets[widgetBId]).toBeDefined();
    expect(track.ticks[0]?.state.widgets[widgetId]).toBeUndefined();
  });

  it('blockProgress boundary: terminal tick has no functional override', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', { value: 10, active: true }),
      makeScene('s2', { value: 20, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    const terminalTick = track.ticks[track.ticks.length - 1];
    expect(terminalTick?.sceneIndex).toBe(1);
    expect(track.transitionBlocks?.[terminalTick.sceneIndex]).toBeUndefined();
  });
});
