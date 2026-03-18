// sceneTrackHelpers.ts — Pure utility functions for SceneTrack queries.

import type { SceneTrack } from './sceneTrackTypes';

/**
 * Returns the engine progress value [0..1] corresponding to the start of the named scene.
 *
 * Pure function — no side effects, no DOM, no React. Usable in:
 * - Widget implementations
 * - Non-React code (Node.js tooling, SSR, build scripts)
 * - Test code that computes expected progress values
 *
 * @param track - The compiled SceneTrack.
 * @param sceneId - The Scene's `id` prop value.
 * @returns Engine progress [0..1] at the start of the named scene.
 * @throws Error if sceneId is not found in the compiled track (fail-fast).
 */
export function getSceneProgressFromTrack(track: SceneTrack, sceneId: string): number {
  const window = track.sceneWindows.find(w => w.id === sceneId);
  if (!window) {
    throw new Error(
      `[getSceneProgressFromTrack] Scene "${sceneId}" not found in compiled track. ` +
      `Available scenes: ${track.sceneWindows.map(w => w.id).join(', ')}`,
    );
  }
  return window.start;
}
