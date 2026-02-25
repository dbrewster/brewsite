import { describe, it, expect } from 'vitest';
import type { ElementTransitionSpec } from '../transitions/transitionTypes';
import { transitionT, blendNumber } from '../transitions/transitionTypes';
import type { SceneDefinition } from '../sceneTypes';
import { compileSceneTrack } from '../sceneTrackCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';

const makeScene = (id: string, index: number, widgetStates: Record<string, unknown>): SceneDefinition => ({
  id,
  index,
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
      makeScene('s1', 0, { w: 1 }),
      makeScene('s2', 1, { w: 2 }),
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
      makeScene('s1', 0, { w: 1 }),
      makeScene('s2', 1, { w: 2 }),
      makeScene('s3', 2, { w: 3 }),
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
      makeScene('s1', 0, { w: 0 }),
      makeScene('s2', 1, { w: 10 }),
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
      makeScene('s1', 0, { w: 10 }),
      makeScene('s2', 1, {}),
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
      makeScene('s1', 0, {}),
      makeScene('s2', 1, { w: 20 }),
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
      makeScene('s1', 0, {}),
      makeScene('s2', 1, {}),
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
      makeScene('s1', 0, { w: 1 }),
      makeScene('s2', 1, { w: 9 }),
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
      makeScene('s1', 0, { w: 1 }),
      makeScene('s2', 1, { w: 2 }),
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
      makeScene('s1', 0, { w: 2 }),
      makeScene('s2', 1, { w: 2 }),
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
      scenes: [makeScene('s1', 0, {}), makeScene('s2', 1, {})],
      widgetRegistry: registry,
      blockSize: 2,
    });
    expect(sameTrack.ticks[1]!.deltaForward.widgets).toBeUndefined();

    const changedTrack = compileSceneTrack({
      scenes: [makeScene('s1', 0, { w: 0 }), makeScene('s2', 1, { w: 1 })],
      widgetRegistry: registry,
      blockSize: 2,
    });
    expect(changedTrack.ticks[1]!.deltaForward.widgets).toBeDefined();
  });
});
