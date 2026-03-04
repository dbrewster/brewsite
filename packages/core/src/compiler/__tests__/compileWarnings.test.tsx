import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import type { SceneDefinition } from '../sceneTypes';
import { compileSceneTrack } from '../sceneTrackCompiler';
import { Scene } from '../sceneDslCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { ElementTransitionSpec } from '../transitions/transitionTypes';
import type { ISceneElement } from '../../widget/types';

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

const Box = (_props: { id?: string }) => null;

type BoxState = { value: number };

class BoxWidget implements ISceneElement<BoxState> {
  readonly widgetId: string;
  readonly defaultState: BoxState = { value: 0 };
  readonly transitionSpec = makeNoopSpec<BoxState>();
  readonly DslComponent = Box;

  constructor(widgetId: string) {
    this.widgetId = widgetId;
  }
}

describe('compile warnings', () => {
  it('accumulates MISSING_WIDGET warning when DSL references unregistered widget id', () => {
    const registry = new WidgetRegistry();
    registry.register(new BoxWidget('existing'));

    const scenes: SceneDefinition[] = [
      {
        id: 's1',
        getFrame: () => (
          <Scene id="s1">
            <Box id="missing" />
          </Scene>
        ),
      },
    ];

    const track = compileSceneTrack({
      scenes,
      widgetRegistry: registry,
      blockSize: 10,
    });

    expect(track.warnings?.length).toBe(1);
    expect(track.warnings?.[0]?.code).toBe('MISSING_WIDGET');
    expect(track.warnings?.[0]?.widgetId).toBe('missing');
  });

  it('throws on duplicate widget registration when strict=true', () => {
    const registry = new WidgetRegistry({ strict: true });
    const widget = new BoxWidget('dup');
    registry.register(widget);
    expect(() => registry.register(widget)).toThrow(/already registered/i);
  });

  it('warns but does not throw on duplicate widget registration when strict=false', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new WidgetRegistry();
    const widget = new BoxWidget('dup');
    registry.register(widget);
    expect(() => registry.register(widget)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
    warnSpy.mockRestore();
  });

  it('emits TRANSITION_TIMING warning when exitStart is on the last scene', () => {
    const registry = new WidgetRegistry();
    registry.register(new BoxWidget('w1'));

    const scenes: SceneDefinition[] = [
      {
        id: 'first',
        getFrame: () => (
          <Scene id="first">
            <Box id="w1" />
          </Scene>
        ),
      },
      {
        id: 'last',
        getFrame: () => (
          <Scene id="last" exitStart={0.9}>
            <Box id="w1" />
          </Scene>
        ),
      },
    ];

    const track = compileSceneTrack({
      scenes,
      widgetRegistry: registry,
      blockSize: 4,
    });

    const timingWarnings = track.warnings?.filter((w) => w.code === 'TRANSITION_TIMING') ?? [];
    expect(timingWarnings).toHaveLength(1);
    expect(timingWarnings[0]?.message).toContain('exitStart');
    expect(timingWarnings[0]?.message).toContain('last');
    expect(timingWarnings[0]?.sceneIndex).toBe(1);
  });

  it('does not emit TRANSITION_TIMING warning when exitStart is on a non-last scene', () => {
    const registry = new WidgetRegistry();
    registry.register(new BoxWidget('w1'));

    const scenes: SceneDefinition[] = [
      {
        id: 'first',
        getFrame: () => (
          <Scene id="first" exitStart={0.9}>
            <Box id="w1" />
          </Scene>
        ),
      },
      {
        id: 'last',
        getFrame: () => (
          <Scene id="last">
            <Box id="w1" />
          </Scene>
        ),
      },
    ];

    const track = compileSceneTrack({
      scenes,
      widgetRegistry: registry,
      blockSize: 4,
    });

    const timingWarnings = track.warnings?.filter((w) => w.code === 'TRANSITION_TIMING') ?? [];
    expect(timingWarnings).toHaveLength(0);
  });
});
