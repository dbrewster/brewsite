import { describe, it, expect, beforeEach } from 'vitest';
import { buildSceneTrackKey, clearCache, getCachedTrack, setCachedTrack } from '../sceneTrackCache';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { createSceneTimeline } from '../../timeline';
import type { SceneTrack } from '../sceneTrackTypes';

const makeTrack = (): SceneTrack => ({
  ticks: [],
  tickStep: 1,
  subTickCount: 1,
  sceneWindows: [],
});

describe('sceneTrackCache', () => {
  beforeEach(() => {
    clearCache();
  });

  it('buildSceneTrackKey includes scenes, timeline, registry, and options', () => {
    const registry = new WidgetRegistry();
    const timeline = createSceneTimeline([{ id: 'a' }, { id: 'b' }]);
    const key = buildSceneTrackKey({
      scenes: [{ id: 'a', index: 0, getFrame: () => ({ id: 'a', scrollProgress: 0, widgets: {} }) }],
      timeline,
      widgetRegistry: registry,
      prefersReducedMotion: true,
      assetsReady: false,
    });
    expect(key).toContain('a');
    expect(key).toContain(`t:${timeline.sceneCount}`);
    expect(key).toContain('rm:1');
    expect(key).toContain('ar:0');
  });

  it('getCachedTrack returns undefined when cache is empty', () => {
    expect(getCachedTrack('missing')).toBeUndefined();
  });

  it('setCachedTrack stores and retrieves tracks', () => {
    const track = makeTrack();
    setCachedTrack('key', track);
    expect(getCachedTrack('key')).toBe(track);
  });

  it('clearCache removes entries', () => {
    const track = makeTrack();
    setCachedTrack('key', track);
    clearCache();
    expect(getCachedTrack('key')).toBeUndefined();
  });
});
