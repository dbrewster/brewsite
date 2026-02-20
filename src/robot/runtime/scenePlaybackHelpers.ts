import type {SceneAnimation} from '../elements/model/index';
import {toAnimationTimeSeconds} from './animationTiming';

export type TickTiming = {
  tickTimeSeconds: number;
  wallTimeSecondsNext: number;
  progressDelta: number;
  isReverse: boolean;
  isScrubbing: boolean;
  useScrubTime: boolean;
};

export const computeTickTiming = (options: {
  deltaSeconds: number;
  globalProgress: number;
  lastGlobalProgress: number;
  deterministicTime: boolean;
  wallTimeSeconds: number;
  wallTimeOverride?: number;
  scrubThreshold?: number;
}): TickTiming => {
  const progressDelta = Math.abs(options.globalProgress - options.lastGlobalProgress);
  const isReverse = options.globalProgress < options.lastGlobalProgress - 1e-4;
  const scrubThreshold = typeof options.scrubThreshold === 'number' ? options.scrubThreshold : 1e-3;
  const isScrubbing = progressDelta > scrubThreshold;
  const useScrubTime = !options.deterministicTime && isScrubbing;
  const tickTimeSeconds = options.globalProgress * 10;
  let wallTimeSecondsNext = options.wallTimeSeconds;
  if (typeof options.wallTimeOverride === 'number') {
    wallTimeSecondsNext = options.wallTimeOverride;
  } else if (options.deterministicTime || useScrubTime) {
    wallTimeSecondsNext = tickTimeSeconds;
  } else {
    wallTimeSecondsNext = Math.max(0, wallTimeSecondsNext + options.deltaSeconds);
  }
  return {
    tickTimeSeconds,
    wallTimeSecondsNext,
    progressDelta,
    isReverse,
    isScrubbing,
    useScrubTime,
  };
};

export const computeAnimationTimeSeconds = (options: {
  holdStartPose: boolean;
  blendingIn: boolean;
  deterministicTime: boolean;
  useScrubTimeAnimation: boolean;
  sceneProgress: number;
  animationSettings: SceneAnimation;
  clipDuration: number;
  clipRange: { startSeconds: number; endSeconds: number; span: number };
  animationTimeSeconds: number;
  deltaSeconds: number;
}): number => {
  if (options.holdStartPose || options.blendingIn) {
    return options.clipRange.startSeconds;
  }
  if (options.deterministicTime || options.useScrubTimeAnimation) {
    return toAnimationTimeSeconds(options.sceneProgress, options.animationSettings, options.clipDuration);
  }
  const baseTime = Number.isFinite(options.animationTimeSeconds)
    ? options.animationTimeSeconds
    : options.clipRange.startSeconds;
  const nextTime = baseTime + options.deltaSeconds;
  const repeat = options.animationSettings.clipRepeat !== false;
  if (repeat) {
    const wrapped =
      ((nextTime - options.clipRange.startSeconds) % options.clipRange.span + options.clipRange.span) %
      options.clipRange.span;
    return options.clipRange.startSeconds + wrapped;
  }
  return Math.min(options.clipRange.endSeconds, Math.max(options.clipRange.startSeconds, nextTime));
};

export const isAnimationAtEnd = (options: {
  clipRepeat: boolean;
  timeSeconds: number;
  clipRange: { startSeconds: number; endSeconds: number; span: number };
  blendingIn: boolean;
  holdStartPose: boolean;
}): boolean =>
  !options.clipRepeat &&
  options.timeSeconds >= options.clipRange.endSeconds - 1e-4 &&
  !options.blendingIn &&
  !options.holdStartPose;
