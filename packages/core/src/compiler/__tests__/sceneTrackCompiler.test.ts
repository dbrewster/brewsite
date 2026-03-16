import { describe, it, expect, vi } from 'vitest';
import type { ElementTransitionSpec } from '../transitions/transitionTypes';
import { transitionT, blendNumber } from '../transitions/transitionTypes';
import type { SceneDefinition } from '../sceneTypes';
import { compileSceneTrack } from '../sceneTrackCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { FunctionalTransitionSpec } from '../transitions/transitionTypes';
import type { SceneTrackTick } from '../sceneTrackTypes';
import type { SceneInputControllerSpec } from '../../input/types';
import { createDefaultInputSpec } from '../../input/defaultInputSpec';

const makeScene = (id: string, widgetStates: Record<string, unknown>): SceneDefinition => ({
  id,
  getFrame: () => ({ id, scrollProgress: 0, widgets: widgetStates }),
});

const makeWidget = <T,>(options: {
  widgetId: string;
  defaultState: T;
  transitionSpec: ElementTransitionSpec<T>;
  compileExtra?: (state: T) => unknown;
}) => ({
  widgetId: options.widgetId,
  defaultState: options.defaultState,
  transitionSpec: options.transitionSpec,
  DslComponent: () => null,
  compileExtra: options.compileExtra,
});

describe('compileSceneTrack', () => {
  it('allocates totalFrames for 2 scenes with blockSize=4', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: {
        exit: () => {},
        enter: () => {},
        interpolate: () => {},
      },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    expect(track.subTickCount).toBe(5);
    expect(track.ticks).toHaveLength(5);
  });

  it('allocates totalFrames for 3 scenes with blockSize=4', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: {
        exit: () => {},
        enter: () => {},
        interpolate: () => {},
      },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
      makeScene('s3', { w: 3 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    expect(track.subTickCount).toBe(9);
    expect(track.ticks).toHaveLength(9);
  });

  it('interpolates when widget is present in both scenes', () => {
    let interpolateLen = 0;
    const spec: ElementTransitionSpec<number> = {
      exit: () => {},
      enter: () => {},
      interpolate: (frames, widgetId, fromState, toState) => {
        interpolateLen = frames.length;
        for (let i = 0; i < frames.length; i++) {
          const t = transitionT(i, frames.length);
          frames[i]!.state.widgets[widgetId] = blendNumber(fromState, toState, t);
        }
      },
    };
    const widget = makeWidget({ widgetId: 'w', defaultState: 0, transitionSpec: spec });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 0 }),
      makeScene('s2', { w: 10 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    expect(interpolateLen).toBe(4);
    const first = track.ticks[0]!.state.widgets['w'] as number;
    const last = track.ticks[3]!.state.widgets['w'] as number;
    expect(first).toBeCloseTo(0);
    expect(last).toBeCloseTo(10);
  });

  it('uses exit for first half and defaultState for second half when leaving', () => {
    const spec: ElementTransitionSpec<number> = {
      exit: (frames, widgetId, fromState) => {
        for (const frame of frames) {
          frame.state.widgets[widgetId] = fromState;
        }
      },
      enter: () => {},
      interpolate: () => {},
    };
    const widget = makeWidget({ widgetId: 'w', defaultState: 0, transitionSpec: spec });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 10 }),
      makeScene('s2', {}),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    const block = track.ticks.slice(0, 4).map((tick) => tick.state.widgets['w'] as number);
    expect(block.slice(0, 2)).toEqual([10, 10]);
    expect(block.slice(2)).toEqual([0, 0]);
  });

  it('uses toState for first half and enter for second half when arriving', () => {
    const spec: ElementTransitionSpec<number> = {
      exit: () => {},
      enter: (frames, widgetId, toState) => {
        for (const frame of frames) {
          frame.state.widgets[widgetId] = toState;
        }
      },
      interpolate: () => {},
    };
    const widget = makeWidget({ widgetId: 'w', defaultState: 0, transitionSpec: spec });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', {}),
      makeScene('s2', { w: 20 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    const block = track.ticks.slice(0, 4).map((tick) => tick.state.widgets['w'] as number);
    expect(block.slice(0, 2)).toEqual([20, 20]);
    expect(block.slice(2)).toEqual([20, 20]);
  });

  it('fills defaultState when widget is absent in both scenes', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: {
        exit: () => {},
        enter: () => {},
        interpolate: () => {},
      },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', {}),
      makeScene('s2', {}),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    const block = track.ticks.slice(0, 4).map((tick) => tick.state.widgets['w'] as number);
    expect(block).toEqual([0, 0, 0, 0]);
  });

  it('writes terminal frame using last scene snapshot', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: {
        exit: () => {},
        enter: () => {},
        interpolate: () => {},
      },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 9 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    const terminal = track.ticks[track.ticks.length - 1]!.state.widgets['w'] as number;
    expect(terminal).toBe(9);
  });

  it('sets blockProgress at block endpoints', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: {
        exit: () => {},
        enter: () => {},
        interpolate: () => {},
      },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    expect(track.ticks[0]!.blockProgress).toBe(0);
    expect(track.ticks[3]!.blockProgress).toBe(1);
  });

  it('compileExtra populates widgetExtras', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 1,
      transitionSpec: {
        exit: (frames, widgetId, fromState) => {
          for (const frame of frames) frame.state.widgets[widgetId] = fromState;
        },
        enter: (frames, widgetId, toState) => {
          for (const frame of frames) frame.state.widgets[widgetId] = toState;
        },
        interpolate: (frames, widgetId, _fromState, toState) => {
          for (const frame of frames) frame.state.widgets[widgetId] = toState;
        },
      },
      compileExtra: (state: number) => ({ double: state * 2 }),
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 2 }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    expect(track.ticks[0]!.widgetExtras?.['w']).toEqual({ double: 4 });
  });

  it('computes deltas between frames', () => {
    const spec: ElementTransitionSpec<number> = {
      exit: (frames, widgetId, fromState) => {
        for (let i = 0; i < frames.length; i++) {
          const t = transitionT(i, frames.length);
          frames[i]!.state.widgets[widgetId] = blendNumber(fromState, 0, t);
        }
      },
      enter: (frames, widgetId, toState) => {
        for (let i = 0; i < frames.length; i++) {
          const t = transitionT(i, frames.length);
          frames[i]!.state.widgets[widgetId] = blendNumber(0, toState, t);
        }
      },
      interpolate: (frames, widgetId, fromState, toState) => {
        for (let i = 0; i < frames.length; i++) {
          const t = transitionT(i, frames.length);
          frames[i]!.state.widgets[widgetId] = blendNumber(fromState, toState, t);
        }
      },
    };
    const widget = makeWidget({ widgetId: 'w', defaultState: 0, transitionSpec: spec });
    const registry = new WidgetRegistry().register(widget);

    const sameTrack = compileSceneTrack({
      scenes: [makeScene('s1', {}), makeScene('s2', {})],
      widgetRegistry: registry,
      blockSize: 2,
    });
    expect(sameTrack.ticks[1]!.deltaForward.widgets).toBeUndefined();

    const changedTrack = compileSceneTrack({
      scenes: [makeScene('s1', { w: 0 }), makeScene('s2', { w: 1 })],
      widgetRegistry: registry,
      blockSize: 2,
    });
    expect(changedTrack.ticks[1]!.deltaForward.widgets).toBeDefined();
  });

  it('uses disabled default when disableWhenAbsent is true', () => {
    const widget = {
      ...makeWidget({
        widgetId: 'w',
        defaultState: { enabled: true },
        transitionSpec: {
          exit: () => {},
          enter: () => {},
          interpolate: () => {},
        },
      }),
      disableWhenAbsent: true,
    };
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', {}),
      makeScene('s2', {}),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    const state = track.ticks[0]!.state.widgets['w'] as { enabled?: boolean };
    expect(state.enabled).toBe(false);
  });

  it('captures functional transition spec in transitionBlocks', () => {
    const spec: FunctionalTransitionSpec<number> = {
      exitFn: (from) => (ctx) => from + ctx.t,
      enterFn: (to) => (ctx) => to + ctx.t,
      interpolateFn: (from, to) => (ctx) => from + (to - from) * ctx.t,
    };
    const widget = {
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: spec,
      DslComponent: () => null,
    };
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 3 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    expect(track.transitionBlocks?.[0]?.widgetFns['w']).toBeDefined();
    expect(track.ticks[0]!.state.widgets['w']).toBeUndefined();
  });

  it('fills defaults for functional spec when absent in both scenes', () => {
    const spec: FunctionalTransitionSpec<number> = {
      exitFn: (from) => (ctx) => from + ctx.t,
      enterFn: (to) => (ctx) => to + ctx.t,
      interpolateFn: (from, to) => (ctx) => from + (to - from) * ctx.t,
    };
    const widget = {
      widgetId: 'w',
      defaultState: 5,
      transitionSpec: spec,
      DslComponent: () => null,
    };
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', {}),
      makeScene('s2', {}),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    expect(track.ticks[0]!.state.widgets['w']).toBe(5);
  });

  it('compileExtra uses functional closure when state is undefined', () => {
    const spec: FunctionalTransitionSpec<number> = {
      exitFn: (from) => (ctx) => from + ctx.t,
      enterFn: (to) => (ctx) => to + ctx.t,
      interpolateFn: (from, to) => (ctx) => from + (to - from) * ctx.t,
    };
    const widget = {
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: spec,
      DslComponent: () => null,
      compileExtra: (state: number) => ({ value: state }),
    };
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 3 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    expect(track.ticks[0]!.widgetExtras?.['w']).toEqual({ value: 1 });
  });

  it('removes widget snapshot when mergeSnapshot returns undefined', () => {
    const widget = {
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: {
        exit: () => {},
        enter: () => {},
        interpolate: () => {},
      },
      DslComponent: () => null,
      mergeSnapshot: () => undefined,
    };
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    expect(track.ticks[0]!.state.widgets['w']).toBe(0);
  });

  it('makeDisabledDefault disables nested model.enabled when absent', () => {
    const widget = {
      ...makeWidget({
        widgetId: 'w',
        defaultState: { enabled: true, model: { enabled: true } },
        transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
      }),
      disableWhenAbsent: true,
    };
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', {}),
      makeScene('s2', {}),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    const state = track.ticks[0]!.state.widgets['w'] as { enabled?: boolean; model?: { enabled?: boolean } };
    expect(state.enabled).toBe(false);
    expect(state.model?.enabled).toBe(false);
  });

  it('makeDisabledDefault zeroes opacity when disableWhenAbsent is true', () => {
    const widget = {
      ...makeWidget({
        widgetId: 'w',
        defaultState: { opacity: 1, visible: true },
        transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
      }),
      disableWhenAbsent: true,
    };
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', {}),
      makeScene('s2', {}),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    const state = track.ticks[0]!.state.widgets['w'] as { opacity?: number; visible?: boolean };
    expect(state.opacity).toBe(0);
    expect(state.visible).toBe(true);
  });

  it('handles serialize for content and react-like objects', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: { content: 'ignored', value: 1 }, a: { $$typeof: 'react' } }),
      makeScene('s2', { w: { content: 'ignored', value: 1 }, a: { $$typeof: 'react' } }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    expect(track.ticks[1]!.deltaForward.widgets).toBeUndefined();
  });

  it('warns when serialize fails on circular data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: circular }),
      makeScene('s2', { w: circular }),
    ];
    compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    expect(warn).toHaveBeenCalledWith('[SceneTrack]', 'serialize.failed', expect.anything());
    warn.mockRestore();
  });

  it('handles blockSize=1', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 1,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 1 });
    expect(track.ticks[0]!.blockProgress).toBe(0);
    expect(track.ticks.length).toBe(2);
  });

  it('sets sceneProgress on every tick within [0, 1]', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
      makeScene('s3', { w: 3 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    for (const tick of track.ticks) {
      expect(tick.sceneProgress).toBeDefined();
      expect(tick.sceneProgress).toBeGreaterThanOrEqual(0);
      expect(tick.sceneProgress).toBeLessThanOrEqual(1);
    }
  });

  it('terminal tick has sceneProgress=1 while blockProgress remains 0', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    const terminal = track.ticks[track.ticks.length - 1]!;
    expect(terminal.sceneProgress).toBe(1);
    expect(terminal.blockProgress).toBe(0);
  });

  // ─── S4.1.A — disableWhenAbsent (S4 regression) ─────────────────────────

  it('disableWhenAbsent=true produces disabled default when widget absent in a scene', () => {
    const widget = {
      ...makeWidget({
        widgetId: 'w',
        defaultState: { enabled: true },
        transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
      }),
      disableWhenAbsent: true,
    };
    const registry = new WidgetRegistry().register(widget);
    const track = compileSceneTrack({
      scenes: [makeScene('s1', {}), makeScene('s2', {})],
      widgetRegistry: registry,
      blockSize: 2,
    });
    const state = track.ticks[0]!.state.widgets['w'] as { enabled?: boolean };
    expect(state.enabled).toBe(false);
  });

  // ─── S4.1.B — stateEquals() used in delta detection ─────────────────────

  it('stateEquals() is called when serialize fails and suppresses spurious deltas', () => {
    const equalsCalls: unknown[][] = [];
    const widget = {
      ...makeWidget({
        widgetId: 'w',
        defaultState: { a: 0, b: 0 },
        transitionSpec: {
          exit: (frames: SceneTrackTick[], id: string, s: unknown) => {
            for (const f of frames) f.state.widgets[id] = s;
          },
          enter: (frames: SceneTrackTick[], id: string, s: unknown) => {
            for (const f of frames) f.state.widgets[id] = s;
          },
          // Produce different key orderings between adjacent frames so serialize() fails,
          // but the values are semantically identical — stateEquals() must suppress the delta.
          interpolate: (frames: SceneTrackTick[], id: string) => {
            if (frames[0]) frames[0].state.widgets[id] = { a: 1, b: 2 };
            if (frames[1]) frames[1].state.widgets[id] = Object.fromEntries([['b', 2], ['a', 1]]);
          },
        },
      }),
      stateEquals(
        a: { a: number; b: number },
        b: { a: number; b: number },
      ): boolean {
        equalsCalls.push([a, b]);
        return a.a === b.a && a.b === b.b;
      },
    };
    const registry = new WidgetRegistry().register(widget);
    const track = compileSceneTrack({
      scenes: [makeScene('s1', { w: { a: 1, b: 2 } }), makeScene('s2', { w: { a: 1, b: 2 } })],
      widgetRegistry: registry,
      blockSize: 2,
    });
    // stateEquals must have been called (full-serialize check failed due to key-order difference)
    expect(equalsCalls.length).toBeGreaterThan(0);
    // Despite different serialization, stateEquals returns true → no delta expected
    expect(track.ticks[1]!.deltaForward.widgets).toBeUndefined();
  });

  // ─── S4.1.C — blockProgress in compileExtra (verify correct field name) ──

  it('compileExtra receives blockProgress (not sceneProgress)', () => {
    const blockProgressValues: number[] = [];
    const widget = {
      ...makeWidget({
        widgetId: 'w',
        defaultState: 0,
        transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
      }),
      compileExtra(state: number, ctx: { blockProgress: number }): { bp: number } {
        blockProgressValues.push(ctx.blockProgress);
        return { bp: ctx.blockProgress };
      },
    };
    const registry = new WidgetRegistry().register(widget);
    compileSceneTrack({
      scenes: [makeScene('s1', { w: 1 }), makeScene('s2', { w: 2 })],
      widgetRegistry: registry,
      blockSize: 2,
    });
    // blockProgress should be in [0, 1]
    expect(blockProgressValues.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(blockProgressValues.length).toBeGreaterThan(0);
  });

  it('carries input controller snapshot forward when a later scene omits it', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const inputSpec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        {
          id: 'scene-next',
          type: 'scene.next',
          maps: [{ kind: 'wheel', axis: 'y' }],
        },
      ],
    };

    const scenes = [
      makeScene('s1', { w: 1, __input_controller: inputSpec }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });
    const terminal = track.ticks[track.ticks.length - 1]!;
    // After merge logic, the carried-forward spec is merged with defaults.
    const spec = terminal.state.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(spec.actions.some(a => a.id === 'scene-next')).toBe(true);
    // Defaults should also be present via merge
    const defaultActions = createDefaultInputSpec().actions;
    for (const da of defaultActions) {
      expect(spec.actions.some(a => a.id === da.id)).toBe(true);
    }
  });

  it('keeps source-scene passthrough state across the block', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const fromInputSpec: SceneInputControllerSpec = { id: 'from', scope: 'canvas', actions: [] };
    const toInputSpec: SceneInputControllerSpec = { id: 'to', scope: 'window', actions: [] };

    const scenes = [
      makeScene('s1', { w: 1, __input_controller: fromInputSpec }),
      makeScene('s2', { w: 2, __input_controller: toInputSpec }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });
    const block = track.ticks.slice(0, 4).map((tick) => tick.state.widgets['__input_controller']);
    // After merge, the from spec is merged with defaults. All block ticks use the from scene's spec.
    const defaultActions = createDefaultInputSpec().actions;
    const mergedFromSpec = block[0] as SceneInputControllerSpec;
    expect(mergedFromSpec.id).toBe('from');
    expect(mergedFromSpec.scope).toBe('canvas');
    // With empty scene actions, all defaults are preserved
    expect(mergedFromSpec.actions).toHaveLength(defaultActions.length);
    // All 4 ticks in the block should be structurally identical (same merged spec)
    expect(block[0]).toEqual(block[1]);
    expect(block[1]).toEqual(block[2]);
    expect(block[2]).toEqual(block[3]);
  });

  // ─── Stream D: default input spec injection ──────────────────────────────────

  it('injects createDefaultInputSpec when no scene declares an <InputController>', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [makeScene('s1', { w: 1 }), makeScene('s2', { w: 2 })];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    const spec = track.ticks[0]!.state.widgets['__input_controller'] as Record<string, unknown>;
    expect(spec).toBeDefined();
    // Default spec uses 'canvas' scope (not 'window').
    expect(spec.scope).toBe('canvas');
    // Default spec includes arrow navigation and carousel sentinel actions.
    const actions = spec.actions as Array<{ type: string; layoutId?: string }>;
    expect(actions.some((a) => a.type === 'scene.next')).toBe(true);
    expect(actions.some((a) => a.type === 'scene.prev')).toBe(true);
    expect(actions.some((a) => a.type === 'carousel.next')).toBe(true);
    // Carousel actions use the sentinel layoutId.
    const carouselNext = actions.find((a) => a.type === 'carousel.next');
    expect(carouselNext?.layoutId).toBe('__primary_carousel__');
  });

  it('merges scene spec with defaults when a scene declares __input_controller', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const customSpec: SceneInputControllerSpec = { id: 'custom', scope: 'window', actions: [] };
    const scenes = [
      makeScene('s1', { w: 1, __input_controller: customSpec }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    // Scene id and scope are preserved from the custom spec.
    const spec = track.ticks[0]!.state.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(spec.id).toBe('custom');
    expect(spec.scope).toBe('window');
    // With empty scene actions and merge mode, all defaults are included.
    const defaultActions = createDefaultInputSpec().actions;
    expect(spec.actions).toHaveLength(defaultActions.length);
  });

  // ─── Stream D: primaryCarouselId propagation ─────────────────────────────────

  it('propagates primaryCarouselId from SceneFrame to each tick state', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      {
        id: 's1',
        getFrame: () => ({ id: 's1', scrollProgress: 0, widgets: { w: 1 }, primaryCarouselId: 'carousel-layout' }),
      },
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    // All ticks in scene s1's window should carry primaryCarouselId.
    const tick0 = track.ticks[0]!.state;
    expect((tick0 as { primaryCarouselId?: string }).primaryCarouselId).toBe('carousel-layout');
  });

  it('does not carry primaryCarouselId to ticks from a scene without it', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    const tick0 = track.ticks[0]!.state;
    expect((tick0 as { primaryCarouselId?: string }).primaryCarouselId).toBeUndefined();
  });

  // ─── Input spec merge logic ─────────────────────────────────────────────────

  it('merges scene InputController with defaults when mode is merge', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const customSpec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        { id: 'custom-action', type: 'scene.next', maps: [{ kind: 'key', key: 'Space' }] },
      ],
      mergeMode: 'merge',
    };
    const scenes = [
      makeScene('s1', { w: 1, __input_controller: customSpec }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    const spec = track.ticks[0]!.state.widgets['__input_controller'] as SceneInputControllerSpec;
    // Should have defaults + custom action
    const defaultActions = createDefaultInputSpec().actions;
    expect(spec.actions.length).toBe(defaultActions.length + 1);
    expect(spec.actions.some(a => a.id === 'custom-action')).toBe(true);
    // All default actions should still be present
    for (const da of defaultActions) {
      expect(spec.actions.some(a => a.id === da.id)).toBe(true);
    }
  });

  it('replaces defaults entirely when mode is replace', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const customSpec: SceneInputControllerSpec = {
      id: 'custom',
      scope: 'window',
      actions: [
        { id: 'only-action', type: 'camera.orbit', maps: [{ kind: 'key', key: 'o' }] },
      ],
      mergeMode: 'replace',
    };
    const scenes = [
      makeScene('s1', { w: 1, __input_controller: customSpec }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    const spec = track.ticks[0]!.state.widgets['__input_controller'] as SceneInputControllerSpec;
    // Replace mode: only the scene's actions, no defaults
    expect(spec.actions).toHaveLength(1);
    expect(spec.actions[0]!.id).toBe('only-action');
    expect(spec.scope).toBe('window');
  });

  it('injects full defaults when no scene declares InputController', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('s1', { w: 1 }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    const spec = track.ticks[0]!.state.widgets['__input_controller'] as SceneInputControllerSpec;
    const defaultActions = createDefaultInputSpec().actions;
    expect(spec.actions).toHaveLength(defaultActions.length);
    expect(spec.scope).toBe('canvas');
  });

  it('carry-forward: scene 1 declares InputController, scene 2 inherits and merges with defaults', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const customSpec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        { id: 'my-action', type: 'camera.orbit', maps: [{ kind: 'key', key: 'x' }] },
      ],
    };
    const scenes = [
      makeScene('s1', { w: 1, __input_controller: customSpec }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    // Scene 2 (terminal tick) should also have the carried-forward spec merged with defaults
    const terminal = track.ticks[track.ticks.length - 1]!;
    const spec = terminal.state.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(spec.actions.some(a => a.id === 'my-action')).toBe(true);
    // Defaults should also be present
    const defaultActions = createDefaultInputSpec().actions;
    for (const da of defaultActions) {
      expect(spec.actions.some(a => a.id === da.id)).toBe(true);
    }
  });

  it('action id override: scene action with same id as default replaces the default', () => {
    const widget = makeWidget({
      widgetId: 'w',
      defaultState: 0,
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
    });
    const registry = new WidgetRegistry().register(widget);
    const customSpec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        {
          id: 'default-camera-orbit',
          type: 'camera.orbit',
          cameraId: 'custom-cam',
          maps: [{ kind: 'pointer', event: 'drag', button: 'right', axis: 'xy' }],
        },
      ],
    };
    const scenes = [
      makeScene('s1', { w: 1, __input_controller: customSpec }),
      makeScene('s2', { w: 2 }),
    ];
    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    const spec = track.ticks[0]!.state.widgets['__input_controller'] as SceneInputControllerSpec;
    // Should have same total count as defaults (override, not add)
    const defaultActions = createDefaultInputSpec().actions;
    expect(spec.actions).toHaveLength(defaultActions.length);
    // The orbit action should be the scene's version, not the default
    const orbitAction = spec.actions.find(a => a.id === 'default-camera-orbit');
    expect(orbitAction).toBeDefined();
    expect(orbitAction!.cameraId).toBe('custom-cam');
  });
});
