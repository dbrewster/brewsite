// sceneMembership.test.ts — Verifies scene membership side-output from compileSceneTrack.

import { describe, it, expect } from 'vitest';
import type { SceneDefinition } from '../sceneTypes';
import { compileSceneTrack } from '../sceneTrackCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { FunctionalTransitionSpec } from '../transitions/transitionTypes';

const makeScene = (id: string, widgetStates: Record<string, unknown>): SceneDefinition => ({
  id,
  getFrame: () => ({ id, scrollProgress: 0, widgets: widgetStates }),
});

const makeNoopSpec = <T,>(): FunctionalTransitionSpec<T> => ({
  exitFn: (from) => () => from,
  enterFn: (to) => () => to,
  interpolateFn: (_from, to) => () => to,
});

const makeWidget = <T,>(widgetId: string, defaultState: T) => ({
  widgetId,
  defaultState,
  transitionSpec: makeNoopSpec<T>(),
  DslComponent: () => null,
});

describe('compileSceneTrack sceneMembership', () => {
  it('produces SceneMembership with correct widget IDs per scene', () => {
    const widgetA = makeWidget('a', 0);
    const widgetB = makeWidget('b', 0);
    const registry = new WidgetRegistry().register(widgetA).register(widgetB);

    const scenes = [
      makeScene('s0', { a: 1 }),
      makeScene('s1', { a: 2, b: 3 }),
    ];

    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });

    expect(track.sceneMembership).toBeDefined();
    expect(track.sceneMembership!.get(0)!.has('a')).toBe(true);
    expect(track.sceneMembership!.get(0)!.has('b')).toBe(false);
    expect(track.sceneMembership!.get(1)!.has('a')).toBe(true);
    expect(track.sceneMembership!.get(1)!.has('b')).toBe(true);
  });

  it('excludes widgets not present in a scene', () => {
    const widgetA = makeWidget('a', 0);
    const widgetB = makeWidget('b', 0);
    const registry = new WidgetRegistry().register(widgetA).register(widgetB);

    const scenes = [
      makeScene('s0', { a: 1 }),
      makeScene('s1', { b: 2 }),
    ];

    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });

    expect(track.sceneMembership!.get(0)!.has('a')).toBe(true);
    expect(track.sceneMembership!.get(0)!.has('b')).toBe(false);
    expect(track.sceneMembership!.get(1)!.has('a')).toBe(false);
    expect(track.sceneMembership!.get(1)!.has('b')).toBe(true);
  });

  it('includes widgets present across multiple scenes in each', () => {
    const widgetA = makeWidget('a', 0);
    const registry = new WidgetRegistry().register(widgetA);

    const scenes = [
      makeScene('s0', { a: 1 }),
      makeScene('s1', { a: 2 }),
      makeScene('s2', { a: 3 }),
    ];

    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });

    expect(track.sceneMembership!.get(0)!.has('a')).toBe(true);
    expect(track.sceneMembership!.get(1)!.has('a')).toBe(true);
    expect(track.sceneMembership!.get(2)!.has('a')).toBe(true);
  });

  it('handles single-scene tracks (one scene, no transitions)', () => {
    const widgetA = makeWidget('a', 0);
    const registry = new WidgetRegistry().register(widgetA);

    const scenes = [makeScene('s0', { a: 42 })];

    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });

    expect(track.sceneMembership).toBeDefined();
    expect(track.sceneMembership!.size).toBe(1);
    expect(track.sceneMembership!.get(0)!.has('a')).toBe(true);
  });

  it('handles empty scenes (no widgets)', () => {
    const widgetA = makeWidget('a', 0);
    const registry = new WidgetRegistry().register(widgetA);

    const scenes = [
      makeScene('s0', { a: 1 }),
      makeScene('s1', {}),
    ];

    const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 4 });

    expect(track.sceneMembership!.get(0)!.has('a')).toBe(true);
    // Scene 1 has no widgets authored — only passthrough state
    // The membership is computed from raw snapshots (before mergeSnapshot/carry-forward)
    // but the InputController passthrough widget is added. Check that at minimum
    // the authored widget 'a' is NOT in scene 1's membership.
    const scene1Members = track.sceneMembership!.get(1)!;
    expect(scene1Members.has('a')).toBe(false);
  });
});
