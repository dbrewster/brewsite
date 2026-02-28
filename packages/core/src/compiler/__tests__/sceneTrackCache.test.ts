import { describe, it, expect, beforeEach } from 'vitest';
import { buildSceneTrackKey, clearCache, getCachedTrack, setCachedTrack } from '../sceneTrackCache';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
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

  it('buildSceneTrackKey includes scenes, blockSize, registry, and options', () => {
    const registry = new WidgetRegistry();
    const key = buildSceneTrackKey({
      scenes: [{ contentKey: 'scene-a' }],
      widgetRegistry: registry,
      blockSize: 4,
      prefersReducedMotion: true,
    });
    expect(key).toContain('scene-a');
    expect(key).toContain('b:4');
    expect(key).toContain('rm:1');
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
