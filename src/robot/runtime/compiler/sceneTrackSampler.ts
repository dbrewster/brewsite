import {clamp01} from '../../robotTimelineMath';
import type {SceneTrack, SceneTrackTick} from './sceneTrackTypes';

export type SceneTrackSampler = {
  track: SceneTrack;
  sample: (progress: number) => SceneTrackTick;
};

export const createSceneTrackSampler = (track: SceneTrack): SceneTrackSampler => {
  const maxIndex = track.subTickCount - 1;
  const eps = 1e-9;
  return {
    track,
    sample: (progress: number) => {
      if (track.ticks.length === 0) {
        throw new Error('Scene track is empty.');
      }
      const clamped = clamp01(progress);
      // Avoid floating-point half-step rounding artifacts by biasing very slightly upward.
      const scaled = clamped * Math.max(1, track.subTickCount - 1);
      const index = Math.min(maxIndex, Math.max(0, Math.round(scaled + eps)));
      return track.ticks[index] ?? track.ticks[track.ticks.length - 1];
    },
  };
};
