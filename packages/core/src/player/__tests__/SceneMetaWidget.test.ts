import { describe, it, expect } from 'vitest';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import { VariableStore } from '../../widget/VariableStore';
import { SceneMetaWidget } from '../SceneMetaWidget';

const makeTick = (
  sceneId: string,
  sceneIndex: number,
  sceneProgress: number,
  meta?: Record<string, string | number | boolean | null>,
): SceneTrackTick => ({
  index: 0,
  progress: sceneProgress,
  sceneId,
  sceneIndex,
  blockProgress: sceneProgress,
  state: {
    id: sceneId,
    scrollProgress: sceneProgress,
    widgets: {},
    meta,
  },
  deltaForward: {},
  deltaBackward: {},
  widgetExtras: {},
});

describe('SceneMetaWidget', () => {
  it('publishes scene identity to the VariableStore', () => {
    const store = new VariableStore();
    const widget = new SceneMetaWidget();

    widget.onTick({
      clock: { wallTimeSeconds: 0, deltaSeconds: 0 },
      effectiveDeltaSeconds: 0,
      scene: {} as never,
      variables: store,
      track: null,
      tick: makeTick('intro', 0, 0.25),
    });

    expect(store.get('scene', 'id')).toBe('intro');
    expect(store.get('scene', 'index')).toBe(0);
    expect(store.get('scene', 'progress')).toBe(0.25);
  });

  it('fires onSceneChange only when the scene changes', () => {
    const store = new VariableStore();
    let calls: Array<{ id: string; index: number }> = [];
    const widget = new SceneMetaWidget({
      onSceneChange: (id, index) => { calls = [...calls, { id, index }]; },
    });

    widget.onTick({
      clock: { wallTimeSeconds: 0, deltaSeconds: 0 },
      effectiveDeltaSeconds: 0,
      scene: {} as never,
      variables: store,
      track: null,
      tick: makeTick('intro', 0, 0.1),
    });

    widget.onTick({
      clock: { wallTimeSeconds: 0, deltaSeconds: 0 },
      effectiveDeltaSeconds: 0,
      scene: {} as never,
      variables: store,
      track: null,
      tick: makeTick('intro', 0, 0.2),
    });

    widget.onTick({
      clock: { wallTimeSeconds: 0, deltaSeconds: 0 },
      effectiveDeltaSeconds: 0,
      scene: {} as never,
      variables: store,
      track: null,
      tick: makeTick('model', 1, 0.1),
    });

    expect(calls).toEqual([
      { id: 'intro', index: 0 },
      { id: 'model', index: 1 },
    ]);
  });

  it('publishes scene meta keys and clears stale ones', () => {
    const store = new VariableStore();
    const widget = new SceneMetaWidget();

    widget.onTick({
      clock: { wallTimeSeconds: 0, deltaSeconds: 0 },
      effectiveDeltaSeconds: 0,
      scene: {} as never,
      variables: store,
      track: null,
      tick: makeTick('intro', 0, 0.1, { theme: 'light' }),
    });

    expect(store.get('scene', 'theme')).toBe('light');

    widget.onTick({
      clock: { wallTimeSeconds: 0, deltaSeconds: 0 },
      effectiveDeltaSeconds: 0,
      scene: {} as never,
      variables: store,
      track: null,
      tick: makeTick('intro', 0, 0.2, { theme: 'dark', background: '#000' }),
    });

    expect(store.get('scene', 'theme')).toBe('dark');
    expect(store.get('scene', 'background')).toBe('#000');

    widget.onTick({
      clock: { wallTimeSeconds: 0, deltaSeconds: 0 },
      effectiveDeltaSeconds: 0,
      scene: {} as never,
      variables: store,
      track: null,
      tick: makeTick('intro', 0, 0.3),
    });

    expect(store.get('scene', 'theme')).toBe(null);
    expect(store.get('scene', 'background')).toBe(null);
  });
});
