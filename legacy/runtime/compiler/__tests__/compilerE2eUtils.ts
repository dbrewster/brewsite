import {createBaseSceneState, mergeSceneState} from '../sceneDefaults';
import {clamp01} from '../../../robotTimelineMath';
import {compileSceneTrack} from '../sceneTrackCompiler';
import {createSceneTrackSampler} from '../sceneTrackSampler';
import type {RobotTimeline} from '../../../robotTimeline';
import type {ClipMeta} from '../../../model/robotSceneTypes';
import type {SceneDefinition, SceneFrameContext, SceneFrameOverride, SceneTransition} from '../sceneTypes';
import type {SceneFrameDelta, SceneTrack, SceneTrackTick, SceneWindow} from '../sceneTrackTypes';

type SceneFrameOverrideFactory = (context: SceneFrameContext) => SceneFrameOverride;

type TestSceneOptions = {
  id: string;
  index: number;
  entryStart?: number;
  frame?: SceneFrameOverride | SceneFrameOverrideFactory;
  transitions?: SceneTransition[];
};

export const createTestScene = (options: TestSceneOptions): SceneDefinition => ({
  id: options.id,
  index: options.index,
  entryStart: options.entryStart,
  transitions: options.transitions,
  getFrame: (context) => {
    const base = createBaseSceneState(context);
    const override =
      typeof options.frame === 'function'
        ? (options.frame as SceneFrameOverrideFactory)(context)
        : (options.frame ?? {});
    return mergeSceneState(base, {
      id: options.id,
      scrollProgress: context.sceneProgress,
      ...override,
    });
  },
});

const SCENE_ANIMATION_MULTIPLIER = 10;

export const createTestTimeline = (sceneIds: string[], subTicksPerSegment = 1): RobotTimeline => {
  const sceneCount = sceneIds.length;
  const effectiveSub = Math.max(1, subTicksPerSegment);
  const sceneAnimationMultiplier = SCENE_ANIMATION_MULTIPLIER;
  const tickStep = 1 / Math.max(1, sceneCount - 1);
  const timelineDuration = 30 * sceneCount;
  const subTickCount = Math.max(1, (sceneCount - 1) * effectiveSub * sceneAnimationMultiplier + 1);
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
    stops: sceneIds.map((id) => ({ id })),
    sceneCount,
    framesPerScene: 30,
    subTicksPerSegment: effectiveSub,
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

export const compileTestTrack = (options: {
  scenes: SceneDefinition[];
  timeline: RobotTimeline;
  availableClips?: ClipMeta[];
  prefersReducedMotion?: boolean;
  assetsReady?: boolean;
}): SceneTrack =>
  compileSceneTrack({
    scenes: options.scenes,
    timeline: options.timeline,
    assetsReady: options.assetsReady ?? true,
    availableClips: options.availableClips ?? [],
    prefersReducedMotion: options.prefersReducedMotion ?? false,
  });

export class SceneTrackInspector {
  private readonly sampler;
  constructor(private readonly track: SceneTrack) {
    this.sampler = createSceneTrackSampler(track);
  }

  getSceneWindow(id: string): SceneWindow {
    const window = this.track.sceneWindows.find((item) => item.id === id);
    if (!window) {
      throw new Error(`Missing scene window for ${id}`);
    }
    return window;
  }

  tickAtProgress(progress: number): SceneTrackTick {
    return this.sampler.sample(progress);
  }

  tickAtIndex(index: number): SceneTrackTick {
    const tick = this.track.ticks[index];
    if (!tick) {
      throw new Error(`Missing tick at index ${index}`);
    }
    return tick;
  }

  tickAtSceneProgress(sceneId: string, sceneProgress: number): SceneTrackTick {
    const window = this.getSceneWindow(sceneId);
    const progress = clamp01(window.start + (window.end - window.start) * sceneProgress);
    return this.tickAtProgress(progress);
  }

  sceneMidpoint(sceneId: string): number {
    const window = this.getSceneWindow(sceneId);
    return (window.start + window.end) / 2;
  }

  deltaForwardAtSceneProgress(sceneId: string, sceneProgress: number): SceneFrameDelta {
    return this.tickAtSceneProgress(sceneId, sceneProgress).deltaForward;
  }

  deltaBackwardAtSceneProgress(sceneId: string, sceneProgress: number): SceneFrameDelta {
    return this.tickAtSceneProgress(sceneId, sceneProgress).deltaBackward;
  }

}
