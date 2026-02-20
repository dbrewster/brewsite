import {describe, expect, it} from 'vitest';
import {createSceneTrackSampler} from '../sceneTrackSampler';
import type {SceneTrack} from '../sceneTrackTypes';

const emptyWorld = { nodes: [] };
const emptyDelta = {};

const makeTrack = (): SceneTrack => ({
  ticks: [
    {
      index: 0,
      progress: 0,
      sceneId: 'a',
      sceneIndex: 0,
      sceneProgress: 0,
      state: {} as never,
      deltaForward: emptyDelta,
      deltaBackward: emptyDelta,
      modelAnimations: {},
    },
    {
      index: 1,
      progress: 0.5,
      sceneId: 'b',
      sceneIndex: 1,
      sceneProgress: 0.5,
      state: {} as never,
      deltaForward: emptyDelta,
      deltaBackward: emptyDelta,
      modelAnimations: {},
    },
    {
      index: 2,
      progress: 1,
      sceneId: 'c',
      sceneIndex: 2,
      sceneProgress: 1,
      state: {} as never,
      deltaForward: emptyDelta,
      deltaBackward: emptyDelta,
      modelAnimations: {},
    },
  ],
  tickStep: 0.5,
  subTickCount: 3,
  sceneWindows: [],
});

describe('sceneTrackSampler', () => {
  it('snaps to nearest tick', () => {
    const sampler = createSceneTrackSampler(makeTrack());
    const tick = sampler.sample(0.49);
    expect(tick.index).toBe(1);
    expect(tick.sceneId).toBe('b');
  });

  it('clamps to bounds', () => {
    const sampler = createSceneTrackSampler(makeTrack());
    expect(sampler.sample(-1).index).toBe(0);
    expect(sampler.sample(2).index).toBe(2);
  });
});
