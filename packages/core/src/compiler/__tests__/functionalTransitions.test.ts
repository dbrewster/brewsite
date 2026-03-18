import { describe, it, expect } from 'vitest';
import { compileSceneTrack } from '../sceneTrackCompiler';
import type { FunctionalTransitionSpec } from '../transitions/transitionTypes';
import type { SceneDefinition } from '../sceneTypes';
import type { SceneFrame } from '../sceneTrackTypes';
import type { ISceneElement } from '../../widget/types';
import { WidgetRegistry } from '../../widget/WidgetRegistry';

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

  it('transitionBlocks is present for all functional specs', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    const scenes = [
      makeScene('s1', { value: 1, active: true }),
      makeScene('s2', { value: 2, active: true }),
    ];
    const track = compileTrack(scenes, registry);
    expect(track.transitionBlocks).toBeDefined();
    expect(track.transitionBlocks).toHaveLength(1);
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

  it('exit closure with explicit window [0,0.5]: active until window end, absent after', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    // Inject explicit transitionWindow into s1's frame to decouple test from system defaults.
    const scenes: SceneDefinition[] = [
      {
        id: 's1',
        getFrame: (): SceneFrame => ({
          id: 's1',
          scrollProgress: 0,
          widgets: { [widgetId]: { value: 10, active: true } },
          transitionWindow: { exit: [0, 0.5] },
        }),
      },
      makeScene('s2', undefined),
    ];
    const track = compileTrack(scenes, registry);
    const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId];
    expect(fn?.kind).toBe('exit');
    // Exit window [0, 0.5]. At bp=0 → t=0 → full state (value=10, active=true).
    expect(fn?.fn(0)).toEqual({ value: 10, active: true });
    // At bp=0.25 → within exit window → t=0.5 → partially faded (0 < value < 10).
    const quarter = fn?.fn(0.25) as TestState;
    expect(quarter.value).toBeGreaterThan(0);
    expect(quarter.value).toBeLessThan(10);
    expect(quarter.active).toBe(true);
    // At bp=0.5 → effectiveExitEnd=0.5 → absentDefault.
    expect(fn?.fn(0.5)).toEqual({ value: 0, active: false });
    // At bp=1 → still absentDefault.
    expect(fn?.fn(1)).toEqual({ value: 0, active: false });
  });

  it('enter closure with explicit window [0.5,1]: absent before window, active at end', () => {
    const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
    // Inject explicit transitionWindow into s2's frame to decouple test from system defaults.
    const scenes: SceneDefinition[] = [
      makeScene('s1', undefined),
      {
        id: 's2',
        getFrame: (): SceneFrame => ({
          id: 's2',
          scrollProgress: 0,
          widgets: { [widgetId]: { value: 10, active: true } },
          transitionWindow: { enter: [0.5, 1] },
        }),
      },
    ];
    const track = compileTrack(scenes, registry);
    const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId];
    expect(fn?.kind).toBe('enter');
    // Enter window [0.5, 1]. bp < effectiveEnterStart (0.5) → absentDefault.
    expect(fn?.fn(0)).toEqual({ value: 0, active: false });
    expect(fn?.fn(0.49)).toEqual({ value: 0, active: false });
    // At bp=1 → t=1 → full toState.
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

  it('two functional widgets in same track both produce closures', () => {
    const widgetBId = 'widgetB';
    const specB: FunctionalTransitionSpec<TestState> = {
      exitFn: (from) => () => from,
      enterFn: (to) => () => to,
      interpolateFn: (from, to) => (ctx) => ({
        value: from.value + (to.value - from.value) * ctx.t,
        active: true,
      }),
    };
    const widgetA = makeTestWidget(widgetId, testFunctionalSpec);
    const widgetB: ISceneElement<TestState> = {
      widgetId: widgetBId,
      defaultState: { value: 0, active: false },
      transitionSpec: specB,
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
    expect(track.transitionBlocks?.[0]?.widgetFns[widgetBId]).toBeDefined();
    // Functional specs do not pre-bake into tick state
    expect(track.ticks[0]?.state.widgets[widgetId]).toBeUndefined();
    expect(track.ticks[0]?.state.widgets[widgetBId]).toBeUndefined();
  });

  // ── defaultWindow tests ─────────────────────────────────────────────────────
  // These tests verify the compiler's closure-wrapping for functional specs
  // with a widget-level defaultWindow (the fallback when no scene-level
  // transitionWindow is set on the SceneFrame).

  describe('defaultWindow exit/enter coordination', () => {
    // Simulates the chart-style config: exit [0.9,1.0], enter [0.0,0.0].
    // Widget A is in scene 1 only → EXIT path.
    // Widget B is in scene 2 only → ENTER path.
    const widgetAId = 'exitWidget';
    const widgetBId = 'enterWidget';

    type OpState = { opacity: number };

    const specWithDefaultWindow: FunctionalTransitionSpec<OpState> = {
      defaultWindow: { exit: [0.9, 1.0], enter: [0.0, 0.0] },
      exitFn: (from) => (ctx) => ({ opacity: from.opacity * (1 - ctx.t) }),
      enterFn: (to) => (ctx) => ({ opacity: to.opacity * ctx.t }),
      interpolateFn: (from, to) => (ctx) => ({
        opacity: from.opacity + (to.opacity - from.opacity) * ctx.t,
      }),
    };

    const makeOpWidget = (id: string): ISceneElement<OpState> => ({
      widgetId: id,
      defaultState: { opacity: 0 },
      transitionSpec: specWithDefaultWindow,
      DslComponent: (() => null) as never,
      disableWhenAbsent: true,
    });

    const makeOpScene = (id: string, widgets: Record<string, OpState>): SceneDefinition => ({
      id,
      getFrame: (): SceneFrame => ({
        id,
        scrollProgress: 0,
        widgets,
      }),
    });

    it('exit closure: widget at full opacity before exit window, fades during [0.9, 1.0]', () => {
      const registry = new WidgetRegistry()
        .register(makeOpWidget(widgetAId))
        .register(makeOpWidget(widgetBId));
      const scenes = [
        makeOpScene('s1', { [widgetAId]: { opacity: 1 } }),
        makeOpScene('s2', { [widgetBId]: { opacity: 1 } }),
      ];
      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });
      const exitFn = track.transitionBlocks?.[0]?.widgetFns[widgetAId];
      expect(exitFn?.kind).toBe('exit');

      // Before exit window: exitFn runs but ctx.t=0 → opacity stays at fromState value.
      const atZero = exitFn?.fn(0) as OpState;
      expect(atZero.opacity).toBe(1);

      const atMid = exitFn?.fn(0.5) as OpState;
      expect(atMid.opacity).toBe(1); // Still before [0.9, 1.0] window

      const at85 = exitFn?.fn(0.85) as OpState;
      expect(at85.opacity).toBe(1); // Still before window start

      // Inside exit window: fading
      const at95 = exitFn?.fn(0.95) as OpState;
      expect(at95.opacity).toBeCloseTo(0.5); // Midway through [0.9, 1.0]

      // At/past exit window end: absentDefault (opacity=0)
      const atEnd = exitFn?.fn(1.0) as OpState;
      expect(atEnd.opacity).toBe(0);
    });

    it('enter closure with [0.0,0.0]: degenerate window falls through to system default', () => {
      const registry = new WidgetRegistry()
        .register(makeOpWidget(widgetAId))
        .register(makeOpWidget(widgetBId));
      const scenes = [
        makeOpScene('s1', { [widgetAId]: { opacity: 1 } }),
        makeOpScene('s2', { [widgetBId]: { opacity: 1 } }),
      ];
      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });
      const enterFn = track.transitionBlocks?.[0]?.widgetFns[widgetBId];
      expect(enterFn?.kind).toBe('enter');

      // [0,0] is degenerate → treated as unset → system default [0.9, 1.0] applies.
      // Widget is absent before bp=0.9, then fades in from 0.9→1.0.
      const atZero = enterFn?.fn(0) as OpState;
      expect(atZero.opacity).toBe(0); // absent before enter window

      const atMid = enterFn?.fn(0.5) as OpState;
      expect(atMid.opacity).toBe(0); // still absent

      const at95 = enterFn?.fn(0.95) as OpState;
      expect(at95.opacity).toBeCloseTo(0.5); // midway through [0.9, 1.0]

      const atEnd = enterFn?.fn(1.0) as OpState;
      expect(atEnd.opacity).toBe(1); // fully entered
    });

    it('degenerate enter [0,0] is treated as unset — falls through to system default', () => {
      // A degenerate window (start >= end) should be treated the same as "not specified"
      // and fall through to the system default. This prevents the "painted over" overlap
      // where the entering widget appears at bp=0 while the exiting widget hasn't faded.
      const specDegenerate: FunctionalTransitionSpec<OpState> = {
        defaultWindow: { exit: [0.9, 1.0], enter: [0.0, 0.0] },
        exitFn: specWithDefaultWindow.exitFn,
        enterFn: specWithDefaultWindow.enterFn,
        interpolateFn: specWithDefaultWindow.interpolateFn,
      };
      const makeDegWidget = (id: string): ISceneElement<OpState> => ({
        widgetId: id,
        defaultState: { opacity: 0 },
        transitionSpec: specDegenerate,
        DslComponent: (() => null) as never,
        disableWhenAbsent: true,
      });

      const registry = new WidgetRegistry()
        .register(makeDegWidget(widgetAId))
        .register(makeDegWidget(widgetBId));
      const scenes = [
        makeOpScene('s1', { [widgetAId]: { opacity: 1 } }),
        makeOpScene('s2', { [widgetBId]: { opacity: 1 } }),
      ];
      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });
      const exitFn = track.transitionBlocks?.[0]?.widgetFns[widgetAId]?.fn;
      const enterFn = track.transitionBlocks?.[0]?.widgetFns[widgetBId]?.fn;

      // enter [0,0] is degenerate → falls through to system default [0.9, 1.0].
      // exit [0.9, 1.0] is valid → cross-dissolve in the [0.9, 1.0] window.

      // At bp=0: exiting at full opacity, entering absent (before enter window).
      expect((exitFn?.(0) as OpState).opacity).toBe(1);
      expect((enterFn?.(0) as OpState).opacity).toBe(0);

      // At bp=0.5: still only exiting visible.
      expect((exitFn?.(0.5) as OpState).opacity).toBe(1);
      expect((enterFn?.(0.5) as OpState).opacity).toBe(0);

      // At bp=0.95: cross-dissolve — exiting at 50%, entering at 50%.
      expect((exitFn?.(0.95) as OpState).opacity).toBeCloseTo(0.5);
      expect((enterFn?.(0.95) as OpState).opacity).toBeCloseTo(0.5);

      // At bp=1.0: exiting gone, entering full.
      expect((exitFn?.(1.0) as OpState).opacity).toBe(0);
      expect((enterFn?.(1.0) as OpState).opacity).toBe(1);
    });

    it('degenerate exit [0,0] is treated as unset — falls through to system default', () => {
      // Same principle for exit: [0,0] on exit should not cause instant disappearance
      // at bp=0. It should fall through to the system default [0.8, 0.9].
      const specDegExit: FunctionalTransitionSpec<OpState> = {
        defaultWindow: { exit: [0.0, 0.0], enter: [0.9, 1.0] },
        exitFn: specWithDefaultWindow.exitFn,
        enterFn: specWithDefaultWindow.enterFn,
        interpolateFn: specWithDefaultWindow.interpolateFn,
      };
      const makeDegExitWidget = (id: string): ISceneElement<OpState> => ({
        widgetId: id,
        defaultState: { opacity: 0 },
        transitionSpec: specDegExit,
        DslComponent: (() => null) as never,
        disableWhenAbsent: true,
      });

      const registry = new WidgetRegistry()
        .register(makeDegExitWidget(widgetAId))
        .register(makeDegExitWidget(widgetBId));
      const scenes = [
        makeOpScene('s1', { [widgetAId]: { opacity: 1 } }),
        makeOpScene('s2', { [widgetBId]: { opacity: 1 } }),
      ];
      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });
      const exitFn = track.transitionBlocks?.[0]?.widgetFns[widgetAId]?.fn;

      // exit [0,0] is degenerate → falls through to system default [0.8, 0.9].
      // At bp=0: exiting widget at full opacity (before [0.8, 0.9] window).
      expect((exitFn?.(0) as OpState).opacity).toBe(1);

      // At bp=0.85: midway through exit fade.
      expect((exitFn?.(0.85) as OpState).opacity).toBeCloseTo(0.5);

      // At bp=0.9: exit complete → absent.
      expect((exitFn?.(0.9) as OpState).opacity).toBe(0);
    });

    it('without defaultWindow, system defaults [0.8,0.9]+[0.9,1.0] produce sequential handoff', () => {
      // Same setup but spec has NO defaultWindow → system defaults apply.
      const specNoWindow: FunctionalTransitionSpec<OpState> = {
        exitFn: specWithDefaultWindow.exitFn,
        enterFn: specWithDefaultWindow.enterFn,
        interpolateFn: specWithDefaultWindow.interpolateFn,
      };
      const makeNoWindowWidget = (id: string): ISceneElement<OpState> => ({
        widgetId: id,
        defaultState: { opacity: 0 },
        transitionSpec: specNoWindow,
        DslComponent: (() => null) as never,
        disableWhenAbsent: true,
      });

      const registry = new WidgetRegistry()
        .register(makeNoWindowWidget(widgetAId))
        .register(makeNoWindowWidget(widgetBId));
      const scenes = [
        makeOpScene('s1', { [widgetAId]: { opacity: 1 } }),
        makeOpScene('s2', { [widgetBId]: { opacity: 1 } }),
      ];
      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });
      const exitFn = track.transitionBlocks?.[0]?.widgetFns[widgetAId]?.fn;
      const enterFn = track.transitionBlocks?.[0]?.widgetFns[widgetBId]?.fn;

      // System defaults: exit [0.8, 0.9], enter [0.9, 1.0].
      // Exit: full opacity at bp=0, fades from 0.8→0.9, absent at bp>=0.9.
      // Enter: absent before bp=0.9, fades in from 0.9→1.0.

      // At bp=0: only exiting widget visible.
      expect((exitFn?.(0) as OpState).opacity).toBe(1);
      expect((enterFn?.(0) as OpState).opacity).toBe(0); // absent

      // At bp=0.5: still only exiting widget.
      expect((exitFn?.(0.5) as OpState).opacity).toBe(1);
      expect((enterFn?.(0.5) as OpState).opacity).toBe(0);

      // At bp=0.85: exiting widget fading (midway through [0.8, 0.9]).
      const exitAt85 = exitFn?.(0.85) as OpState;
      expect(exitAt85.opacity).toBeCloseTo(0.5);
      expect((enterFn?.(0.85) as OpState).opacity).toBe(0); // still absent

      // At bp=0.9: exiting widget gone, entering starts from 0.
      expect((exitFn?.(0.9) as OpState).opacity).toBe(0);
      expect((enterFn?.(0.9) as OpState).opacity).toBeCloseTo(0);

      // At bp=0.95: entering fading in.
      expect((enterFn?.(0.95) as OpState).opacity).toBeCloseTo(0.5);

      // At bp=1.0: entering at full opacity.
      expect((enterFn?.(1.0) as OpState).opacity).toBe(1);
    });

    it('defaultWindow with only exit set falls through to system enter default [0.9, 1.0]', () => {
      // When defaultWindow provides exit but NOT enter, enter should fall through
      // to the system default [0.9, 1.0], producing a cross-dissolve in [0.9, 1.0].
      const specExitOnly: FunctionalTransitionSpec<OpState> = {
        defaultWindow: { exit: [0.9, 1.0] },
        exitFn: specWithDefaultWindow.exitFn,
        enterFn: specWithDefaultWindow.enterFn,
        interpolateFn: specWithDefaultWindow.interpolateFn,
      };
      const makeExitOnlyWidget = (id: string): ISceneElement<OpState> => ({
        widgetId: id,
        defaultState: { opacity: 0 },
        transitionSpec: specExitOnly,
        DslComponent: (() => null) as never,
        disableWhenAbsent: true,
      });

      const registry = new WidgetRegistry()
        .register(makeExitOnlyWidget(widgetAId))
        .register(makeExitOnlyWidget(widgetBId));
      const scenes = [
        makeOpScene('s1', { [widgetAId]: { opacity: 1 } }),
        makeOpScene('s2', { [widgetBId]: { opacity: 1 } }),
      ];
      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });
      const exitFn = track.transitionBlocks?.[0]?.widgetFns[widgetAId]?.fn;
      const enterFn = track.transitionBlocks?.[0]?.widgetFns[widgetBId]?.fn;

      // exit: [0.9, 1.0] from spec. enter: [0.9, 1.0] from system default.
      // Cross-dissolve: both fade simultaneously in [0.9, 1.0].

      // Before transition window: only exiting visible.
      expect((exitFn?.(0) as OpState).opacity).toBe(1);
      expect((enterFn?.(0) as OpState).opacity).toBe(0);

      // At bp=0.85: still only exiting.
      expect((exitFn?.(0.85) as OpState).opacity).toBe(1);
      expect((enterFn?.(0.85) as OpState).opacity).toBe(0);

      // At bp=0.95: cross-dissolve — exiting at 50%, entering at 50%.
      expect((exitFn?.(0.95) as OpState).opacity).toBeCloseTo(0.5);
      expect((enterFn?.(0.95) as OpState).opacity).toBeCloseTo(0.5);

      // At bp=1.0: exiting gone, entering full.
      expect((exitFn?.(1.0) as OpState).opacity).toBe(0);
      expect((enterFn?.(1.0) as OpState).opacity).toBe(1);
    });
  });

  // ── Lazy widget registration (chartPlugin pattern) ──────────────────────────
  // Charts register their widgets DURING compilation (via node handlers in Step 1),
  // not before. This test verifies that widgets lazily added to the WidgetRegistry
  // during snapshot evaluation are still picked up by Step 3 (transition block filling).

  describe('lazy widget registration during compilation', () => {
    type OpState = { opacity: number; z: number };

    const lazySpec: FunctionalTransitionSpec<OpState> = {
      exitFn: (from) => (ctx) => ({ opacity: from.opacity * (1 - ctx.t), z: from.z }),
      enterFn: (to) => (ctx) => ({ opacity: to.opacity * ctx.t, z: to.z }),
      interpolateFn: (from, to) => (ctx) => ({
        opacity: from.opacity + (to.opacity - from.opacity) * ctx.t,
        z: from.z + (to.z - from.z) * ctx.t,
      }),
    };

    const makeLazyWidget = (id: string): ISceneElement<OpState> => ({
      widgetId: id,
      defaultState: { opacity: 0, z: 0 },
      transitionSpec: lazySpec,
      DslComponent: (() => null) as never,
      disableWhenAbsent: true,
    });

    it('widget registered during getFrame() is included in transition blocks', () => {
      const registry = new WidgetRegistry();
      // Widget is NOT registered upfront — it gets registered during getFrame().
      const lazyWidgetId = 'lazy-chart';

      const scenes: SceneDefinition[] = [
        {
          id: 's1',
          getFrame: (): SceneFrame => {
            // Mimic chartPlugin: register widget on first encounter during compilation.
            if (!registry.get(lazyWidgetId)) {
              registry.register(makeLazyWidget(lazyWidgetId));
            }
            return {
              id: 's1',
              scrollProgress: 0,
              widgets: { [lazyWidgetId]: { opacity: 1, z: 0 } },
            };
          },
        },
        {
          id: 's2',
          getFrame: (): SceneFrame => ({
            id: 's2',
            scrollProgress: 0,
            widgets: { [lazyWidgetId]: { opacity: 0.15, z: -15 } },
          }),
        },
      ];

      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });

      // The lazily-registered widget should have a functional transition closure.
      const fn = track.transitionBlocks?.[0]?.widgetFns[lazyWidgetId];
      expect(fn).toBeDefined();
      expect(fn?.kind).toBe('interpolate');

      // At bp=0: fully in scene 1 state.
      const at0 = fn?.fn(0) as OpState;
      expect(at0.opacity).toBe(1);
      expect(at0.z).toBe(0);

      // At bp=0.5: intermediate — NOT stuck on scene 1.
      const atMid = fn?.fn(0.5) as OpState;
      expect(atMid.opacity).toBeCloseTo(0.575);
      expect(atMid.z).toBeCloseTo(-7.5);

      // At bp=1: fully in scene 2 state.
      const at1 = fn?.fn(1) as OpState;
      expect(at1.opacity).toBeCloseTo(0.15);
      expect(at1.z).toBe(-15);
    });
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
