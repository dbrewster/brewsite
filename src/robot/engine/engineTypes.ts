import type { SceneTrackTick } from '../runtime/compiler/sceneTrackTypes';

/** Pixel-to-frame scroll configuration. */
export type EngineScrollRegionConfig = {
  /** Pixels of scroll travel per scene. Stable across quality-tier recompiles. */
  pixelsPerScene: number;
};

/** Emitted by EngineFrameDriver when scroll crosses a compiled frame boundary. */
export type EngineFrameState = {
  /** Integer index into SceneTrack.ticks[]. */
  frameIndex: number;
  /** Global progress [0, 1]. */
  globalProgress: number;
  /** Wall-clock time in seconds. */
  wallTimeSeconds: number;
  /**
   * The sampled tick — carries state, annotations, animations.
   * Null until the scene track is compiled and the first frame is sampled.
   */
  tick: SceneTrackTick | null;
};

/** Default pixels of scroll travel per scene. Stable across quality-tier recompiles. */
export const DEFAULT_PIXELS_PER_SCENE = 400;
