import { describe, it, expect } from 'vitest';
import { nextSceneTrackCacheToken } from '../sceneTrackCacheToken';

describe('nextSceneTrackCacheToken', () => {
  it('increments cache token deterministically', () => {
    expect(nextSceneTrackCacheToken(0)).toBe(1);
    expect(nextSceneTrackCacheToken(41)).toBe(42);
  });
});
