// sceneTrackHelpers.test.ts — Tests for getSceneProgressFromTrack pure function.

import { describe, it, expect } from 'vitest';
import { getSceneProgressFromTrack } from '../sceneTrackHelpers';
import type { SceneTrack, SceneWindow } from '../sceneTrackTypes';

/** Build a minimal SceneTrack with the given scene windows. */
function buildTrack(windows: SceneWindow[]): SceneTrack {
  return {
    ticks: [],
    tickStep: 0.01,
    subTickCount: 100,
    sceneWindows: windows,
  };
}

describe('getSceneProgressFromTrack', () => {
  it('returns 0 for the first scene', () => {
    const track = buildTrack([
      { id: 'intro', index: 0, start: 0, end: 0.5 },
      { id: 'outro', index: 1, start: 0.5, end: 1 },
    ]);
    expect(getSceneProgressFromTrack(track, 'intro')).toBe(0);
  });

  it('returns correct start value for middle scenes', () => {
    const track = buildTrack([
      { id: 'scene-a', index: 0, start: 0, end: 0.33 },
      { id: 'scene-b', index: 1, start: 0.33, end: 0.66 },
      { id: 'scene-c', index: 2, start: 0.66, end: 1 },
    ]);
    expect(getSceneProgressFromTrack(track, 'scene-b')).toBe(0.33);
    expect(getSceneProgressFromTrack(track, 'scene-c')).toBe(0.66);
  });

  it('throws descriptive error for unknown scene ID', () => {
    const track = buildTrack([
      { id: 'hero', index: 0, start: 0, end: 0.5 },
      { id: 'features', index: 1, start: 0.5, end: 1 },
    ]);
    expect(() => getSceneProgressFromTrack(track, 'nonexistent')).toThrowError(
      /Scene "nonexistent" not found/,
    );
    expect(() => getSceneProgressFromTrack(track, 'nonexistent')).toThrowError(
      /Available scenes: hero, features/,
    );
  });

  it('works with single-scene tracks', () => {
    const track = buildTrack([
      { id: 'only', index: 0, start: 0, end: 1 },
    ]);
    expect(getSceneProgressFromTrack(track, 'only')).toBe(0);
  });
});
