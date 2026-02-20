import { describe, it, expect } from 'vitest';
import React from 'react';
import { compileSceneTrack } from '../sceneTrackCompiler';
import { createSceneTimeline } from '../../timeline';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneDefinition } from '../sceneTypes';
import type { SceneFrame } from '../sceneTrackTypes';
import type { ISceneElement } from '../../widget/types';
import type { ElementTransitionSpec } from '../transitions/transitionTypes';
import { registerNode } from '../registry';
import { Scene } from '../sceneDslCompiler';

const noopSpec: ElementTransitionSpec<{ value: number }> = {
  exit: (s) => s,
  enter: (s) => s,
  interpolate: (_a, b) => b,
};

class TestWidget implements ISceneElement<{ value: number }, { note: string }> {
  readonly widgetId = 'w1';
  readonly defaultState = { value: 0 };
  readonly transitionSpec = noopSpec;
  readonly DslComponent = () => null;
  compileExtra(state: { value: number }) {
    return { note: `v:${state.value}` };
  }
}

describe('compileSceneTrack (extra coverage)', () => {
  it('supports SceneFrame return and compiles widget extras', () => {
    const registry = new WidgetRegistry().register(new TestWidget());
    const scenes: SceneDefinition[] = [
      {
        id: 's1',
        index: 0,
        getFrame: () => ({ id: 's1', scrollProgress: 0, widgets: { w1: { value: 1 } } }),
      },
      {
        id: 's2',
        index: 1,
        getFrame: () => ({ id: 's2', scrollProgress: 1, widgets: { w1: { value: 2 } } }),
      },
    ];
    const timeline = createSceneTimeline(scenes);

    const track = compileSceneTrack({
      scenes,
      timeline,
      assetsReady: false,
      widgetRegistry: registry,
      clipMeta: [],
    });

    expect(track.ticks.length).toBeGreaterThan(0);
    const first = track.ticks[0];
    expect(first.widgetExtras?.w1).toEqual({ note: 'v:1' });
  });

  it('supports JSX scene DSL path', () => {
    const registry = new WidgetRegistry().register(new TestWidget());

    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
      const props = node.props as { id?: string };
      if (props.id) api.setSceneMeta({ id: props.id });
    });

    const DSLWidget = (_props: { value: number }) => null;
    registerNode(DSLWidget, (node, api) => {
      const props = node.props as { value: number };
      api.setWidgetState('w1', { value: props.value });
    });

    const scenes: SceneDefinition[] = [
      {
        id: 's1',
        index: 0,
        getFrame: () => (
          <Scene id="s1">
            <DSLWidget value={3} />
          </Scene>
        ),
      },
      {
        id: 's2',
        index: 1,
        getFrame: () => ({ id: 's2', scrollProgress: 1, widgets: { w1: { value: 4 } } }),
      },
    ];

    const timeline = createSceneTimeline(scenes);
    const track = compileSceneTrack({
      scenes,
      timeline,
      assetsReady: false,
      widgetRegistry: registry,
      clipMeta: [],
    });

    expect(track.ticks[0].state.widgets['w1']).toEqual({ value: 3 });
  });

  it('throws when getFrame returns invalid data', () => {
    const registry = new WidgetRegistry();
    const scenes: SceneDefinition[] = [
      {
        id: 'bad',
        index: 0,
        getFrame: () => 123 as unknown as SceneFrame,
      },
    ];
    const timeline = createSceneTimeline(scenes);
    expect(() => {
      compileSceneTrack({
        scenes,
        timeline,
        assetsReady: false,
        widgetRegistry: registry,
        clipMeta: [],
      });
    }).toThrow('getFrame must return');
  });

  it('auto-adjusts entryStart when transitions start before 0', () => {
    const scenes: SceneDefinition[] = [
      {
        id: 's1',
        index: 0,
        transitions: [
          {
            id: 't',
            start: -0.2,
            end: 0.2,
            apply: (state) => state,
          },
        ],
        getFrame: () => ({ id: 's1', scrollProgress: 0, widgets: {} }),
      },
      {
        id: 's2',
        index: 1,
        getFrame: () => ({ id: 's2', scrollProgress: 1, widgets: {} }),
      },
    ];
    const timeline = createSceneTimeline(scenes);
    const track = compileSceneTrack({
      scenes,
      timeline,
      assetsReady: false,
      widgetRegistry: new WidgetRegistry(),
      clipMeta: [],
    });

    const window = track.sceneWindows[0];
    expect(window.entryStart).toBeLessThan(window.start);
  });
});
