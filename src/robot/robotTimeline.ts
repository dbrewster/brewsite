import {clamp01} from './robotTimelineMath';
import type {SceneSource} from './runtime/compiler/sceneTypes';

export type RobotTimeline = {
  stops: Array<{ id: string }>;
  sceneCount: number;
  framesPerScene: number;
  subTicksPerSegment: number;
  sceneAnimationMultiplier: number;
  tickStep: number;
  timelineDuration: number;
  subTickCount: number;
  activeSceneStart: number;
  activeSceneEnd: number;
  tick: (index: number) => number;
  mapToSceneProgress: (progress: number) => number;
  snapToTick: (progress: number) => number;
};

const FRAMES_PER_SCENE = 30;
const SCENE_ANIMATION_MULTIPLIER = 10;

export const createRobotTimeline = (
  scenes: SceneSource[],
  options?: { framesPerScene?: number; subTicksPerSegment?: number; sceneAnimationMultiplier?: number },
): RobotTimeline => {
  const stops = scenes.map((scene) => ({ id: scene.id }));
  const framesPerScene = options?.framesPerScene ?? FRAMES_PER_SCENE;
  const subTicksPerSegment = Math.max(1, options?.subTicksPerSegment ?? 1);
  const sceneAnimationMultiplier = Math.max(1, options?.sceneAnimationMultiplier ?? SCENE_ANIMATION_MULTIPLIER);
  const sceneCount = stops.length;
  const tickStep = 1 / Math.max(1, sceneCount - 1);
  const timelineDuration = framesPerScene * Math.max(1, sceneCount);
  const subTickCount = Math.max(1, (sceneCount - 1) * subTicksPerSegment * sceneAnimationMultiplier + 1);
  const activeSceneStart = 0;
  const activeSceneEnd = tickStep;

  const tick = (index: number) => tickStep * index;
  const mapToSceneProgress = (progress: number) =>
    clamp01((progress - activeSceneStart) / Math.max(1e-6, activeSceneEnd - activeSceneStart));
  const snapToTick = (progress: number) => {
    if (sceneCount <= 1) return clamp01(progress);
    return clamp01(Math.round(progress / tickStep) * tickStep);
  };

  return {
    stops,
    sceneCount,
    framesPerScene,
    subTicksPerSegment,
    sceneAnimationMultiplier,
    tickStep,
    timelineDuration,
    subTickCount,
    activeSceneStart,
    activeSceneEnd,
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
export const createQualityTimeline = (base: RobotTimeline, subTicksPerSegment: number): RobotTimeline => {
  const effectiveSub = Math.max(1, subTicksPerSegment);
  const subTickCount = Math.max(
    1,
    (base.sceneCount - 1) * effectiveSub * base.sceneAnimationMultiplier + 1,
  );
  return { ...base, subTicksPerSegment: effectiveSub, subTickCount };
};

export const createSceneTimeline = (
  base: RobotTimeline,
  _activeSceneStart: number,
  _activeSceneEnd: number,
): RobotTimeline => {
  const perSceneTicks = Math.max(1, base.subTicksPerSegment * base.sceneAnimationMultiplier);
  const tickStep = 1 / perSceneTicks;
  const subTickCount = perSceneTicks + 1;

  const tick = (index: number) => clamp01(tickStep * index);
  const mapToSceneProgress = (progress: number) => clamp01(progress);
  const snapToTick = (progress: number) => {
    if (perSceneTicks <= 1) return clamp01(progress);
    return clamp01(Math.round(progress / tickStep) * tickStep);
  };

  return {
    stops: base.stops,
    sceneCount: base.sceneCount,
    framesPerScene: base.framesPerScene,
    subTicksPerSegment: base.subTicksPerSegment,
    sceneAnimationMultiplier: base.sceneAnimationMultiplier,
    tickStep,
    timelineDuration: base.timelineDuration,
    subTickCount,
    activeSceneStart: 0,
    activeSceneEnd: 1,
    tick,
    mapToSceneProgress,
    snapToTick,
  };
};
