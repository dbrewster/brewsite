import { clamp01 } from './math';

export type SceneTimeline = {
  stops: ReadonlyArray<{ id: string }>;
  sceneCount: number;
  framesPerScene: number;
  subTicksPerSegment: number;
  oversamplingRate: number;
  tickStep: number;
  subTickCount: number;
  tick: (index: number) => number;
  mapToSceneProgress: (progress: number) => number;
  snapToTick: (progress: number) => number;
};

const FRAMES_PER_SCENE = 30;
const OVERSAMPLING_RATE = 10;

export const createSceneTimeline = (
  scenes: ReadonlyArray<{ id: string }>,
  options?: { framesPerScene?: number; subTicksPerSegment?: number; oversamplingRate?: number },
): SceneTimeline => {
  const stops = scenes as ReadonlyArray<{ id: string }>;
  const framesPerScene = options?.framesPerScene ?? FRAMES_PER_SCENE;
  const subTicksPerSegment = Math.max(1, options?.subTicksPerSegment ?? 1);
  const oversamplingRate = Math.max(1, options?.oversamplingRate ?? OVERSAMPLING_RATE);
  const sceneCount = stops.length;
  const tickStep = 1 / Math.max(1, sceneCount - 1);
  const subTickCount = Math.max(1, (sceneCount - 1) * subTicksPerSegment * oversamplingRate + 1);

  const tick = (index: number) => tickStep * index;
  const mapToSceneProgress = (progress: number) => clamp01(progress);
  const snapToTick = (progress: number) => {
    if (sceneCount <= 1) return clamp01(progress);
    return clamp01(Math.round(progress / tickStep) * tickStep);
  };

  return {
    stops,
    sceneCount,
    framesPerScene,
    subTicksPerSegment,
    oversamplingRate,
    tickStep,
    subTickCount,
    tick,
    mapToSceneProgress,
    snapToTick,
  };
};

/**
 * Creates a timeline variant with a different quality level (subTicksPerSegment).
 * Used by the quality tier system to produce low/high resolution compilations
 * from the same base timeline configuration.
 */
export const createQualityTimeline = (base: SceneTimeline, subTicksPerSegment: number): SceneTimeline => {
  const effectiveSub = Math.max(1, subTicksPerSegment);
  const subTickCount = Math.max(
    1,
    (base.sceneCount - 1) * effectiveSub * base.oversamplingRate + 1,
  );
  return { ...base, subTicksPerSegment: effectiveSub, subTickCount };
};
