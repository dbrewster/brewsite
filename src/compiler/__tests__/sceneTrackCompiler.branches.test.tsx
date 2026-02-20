// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compileSceneTrack } from '../sceneTrackCompiler';
import type { SceneDefinition } from '../sceneTypes';
import type { SceneTimeline } from '../../timeline';
import { WidgetRegistry } from '../../widget/WidgetRegistry';

const makeScene = (id: string, index: number): SceneDefinition => ({
  id,
  index,
  getFrame: () => ({ id, scrollProgress: 0, widgets: {} }),
});

describe('sceneTrackCompiler branch coverage', () => {
  const originalPerf = globalThis.performance;

  beforeEach(() => {
    // @ts-expect-error perf flag
    window.__robotRuntimeDebug = { perf: true };
    globalThis.performance = {
      mark: () => {},
      measure: () => {},
    } as unknown as Performance;
  });

  afterEach(() => {
    // @ts-expect-error cleanup
    delete window.__robotRuntimeDebug;
    globalThis.performance = originalPerf;
  });

  it('logs invalid transition windows when timeline tick decreases', () => {
    const scenes = [makeScene('a', 0), makeScene('b', 1)];
    const timeline: SceneTimeline = {
      stops: scenes,
      sceneCount: scenes.length,
      framesPerScene: 1,
      subTicksPerSegment: 1,
      oversamplingRate: 1,
      tickStep: 1,
      subTickCount: 2,
      tick: (index) => (index === 0 ? 1 : 0),
      mapToSceneProgress: (p) => p,
      snapToTick: (p) => p,
    };

    const track = compileSceneTrack({
      scenes,
      timeline,
      assetsReady: false,
      widgetRegistry: new WidgetRegistry(),
      clipMeta: [],
    });
    expect(track.sceneWindows[0].start).toBeGreaterThan(track.sceneWindows[0].end);
  });

  it('handles serialize failures gracefully', () => {
    const a = makeScene('a', 0);
    const b = makeScene('b', 1);
    // create a circular widget state to trigger serialize catch
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    a.getFrame = () => ({ id: 'a', scrollProgress: 0, widgets: { w: circular } });

    const timeline: SceneTimeline = {
      stops: [a, b],
      sceneCount: 2,
      framesPerScene: 1,
      subTicksPerSegment: 1,
      oversamplingRate: 1,
      tickStep: 1,
      subTickCount: 2,
      tick: (index) => index,
      mapToSceneProgress: (p) => p,
      snapToTick: (p) => p,
    };

    const track = compileSceneTrack({
      scenes: [a, b],
      timeline,
      assetsReady: false,
      widgetRegistry: new WidgetRegistry(),
      clipMeta: [],
    });

    expect(track.ticks.length).toBeGreaterThan(0);
  });
});
