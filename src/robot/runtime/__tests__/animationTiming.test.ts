import {describe, expect, it} from 'vitest';
import type {SceneAnimation} from '../../model/robotSceneTypes';
import {resolveClipRangeSeconds} from '../../elements/model/compile';
import {toAnimationTimeSeconds} from '../animationTiming';

describe('animationTiming', () => {
  it('resolves percent-based clip ranges', () => {
    const animation: SceneAnimation = {
      enabled: true,
      gltfUrl: '/assets/test.glb',
      gltfClipName: 'test',
      clipStart: 10,
      clipEnd: 60,
      clipRangeUnit: 'percent',
    };
    const range = resolveClipRangeSeconds(animation, 8);
    expect(range.startSeconds).toBeCloseTo(0.8, 4);
    expect(range.endSeconds).toBeCloseTo(4.8, 4);
  });

  it('clamps non-repeating time to clip range', () => {
    const animation: SceneAnimation = {
      enabled: true,
      gltfUrl: '/assets/test.glb',
      gltfClipName: 'test',
      clipStart: 0,
      clipEnd: 2,
      clipRepeat: false,
    };
    const time = toAnimationTimeSeconds(2, animation, 4);
    expect(time).toBeCloseTo(2, 4);
  });

  it('wraps repeating time within the clip range', () => {
    const animation: SceneAnimation = {
      enabled: true,
      gltfUrl: '/assets/test.glb',
      gltfClipName: 'test',
      clipStart: 1,
      clipEnd: 3,
      clipRepeat: true,
    };
    const time = toAnimationTimeSeconds(2, animation, 4);
    expect(time).toBeCloseTo(1, 4);
  });
});
