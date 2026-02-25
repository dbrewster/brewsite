import { describe, it, expect } from 'vitest';
import { createSceneTrackSampler } from '../sceneTrackSampler';
import type { SceneTrack } from '../sceneTrackTypes';

const makeTrack = (count: number): SceneTrack => {
  const ticks = Array.from({ length: count }).map((_, i) => ({
    index: i,
    progress: count === 1 ? 0 : i / (count - 1),
    sceneId: 'scene',
    sceneIndex: 0,
    blockProgress: 0,
    state: { id: 'scene', scrollProgress: 0, widgets: {} },
    deltaForward: {},
    deltaBackward: {},
  }));
  return {
    ticks,
    tickStep: count === 1 ? 1 : 1 / (count - 1),
    subTickCount: count,
    sceneWindows: [{ id: 'scene', index: 0, start: 0, end: 1 }],
  };
};

describe('createSceneTrackSampler', () => {
  it('throws for empty track', () => {
    const track = makeTrack(0);
    const sampler = createSceneTrackSampler(track);
    expect(() => sampler.sample(0)).toThrow('Scene track is empty');
  });

  it('clamps progress and returns nearest tick', () => {
    const track = makeTrack(3);
    const sampler = createSceneTrackSampler(track);
    expect(sampler.sample(-1).index).toBe(0);
    expect(sampler.sample(2).index).toBe(2);
    expect(sampler.sample(0.5).index).toBe(1);
  });

  it('returns last tick when index is out of bounds', () => {
    const track = makeTrack(2);
    const sampler = createSceneTrackSampler(track);
    const tick = sampler.sample(1);
    expect(tick.index).toBe(1);
  });
});
