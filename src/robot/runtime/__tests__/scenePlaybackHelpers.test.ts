import {describe, expect, it} from 'vitest';
import {computeAnimationTimeSeconds, computeTickTiming, isAnimationAtEnd} from '../scenePlaybackHelpers';
import type {SceneAnimation} from '../../model/robotSceneTypes';

const buildAnimationSettings = (overrides?: Partial<SceneAnimation>): SceneAnimation => ({
  enabled: true,
  clipName: 'clip',
  gltfUrl: undefined,
  gltfClipName: undefined,
  fbxUrl: undefined,
  fbxClipName: undefined,
  fbxRetarget: undefined,
  fadeInSeconds: 0.5,
  weight: 1,
  clipStart: 0,
  clipEnd: undefined,
  clipRangeUnit: 'seconds',
  clipRepeat: false,
  ...overrides,
});

describe('scenePlaybackHelpers', () => {
  it('computeTickTiming respects wall time override', () => {
    const timing = computeTickTiming({
      deltaSeconds: 0.016,
      globalProgress: 0.2,
      lastGlobalProgress: 0.1,
      deterministicTime: false,
      wallTimeSeconds: 1,
      wallTimeOverride: 42,
    });
    expect(timing.wallTimeSecondsNext).toBe(42);
    expect(timing.tickTimeSeconds).toBeCloseTo(2);
  });

  it('computeTickTiming uses deterministic time when enabled', () => {
    const timing = computeTickTiming({
      deltaSeconds: 0.5,
      globalProgress: 0.3,
      lastGlobalProgress: 0.2,
      deterministicTime: true,
      wallTimeSeconds: 5,
    });
    expect(timing.wallTimeSecondsNext).toBeCloseTo(3);
    expect(timing.useScrubTime).toBe(false);
  });

  it('computeAnimationTimeSeconds holds at start during blend', () => {
    const animationSettings = buildAnimationSettings();
    const time = computeAnimationTimeSeconds({
      holdStartPose: false,
      blendingIn: true,
      deterministicTime: false,
      useScrubTimeAnimation: false,
      sceneProgress: 0.5,
      animationSettings,
      clipDuration: 10,
      clipRange: { startSeconds: 1, endSeconds: 5, span: 4 },
      animationTimeSeconds: 2,
      deltaSeconds: 0.5,
    });
    expect(time).toBeCloseTo(1);
  });

  it('computeAnimationTimeSeconds advances with delta time when not deterministic', () => {
    const animationSettings = buildAnimationSettings();
    const time = computeAnimationTimeSeconds({
      holdStartPose: false,
      blendingIn: false,
      deterministicTime: false,
      useScrubTimeAnimation: false,
      sceneProgress: 0.5,
      animationSettings,
      clipDuration: 10,
      clipRange: { startSeconds: 1, endSeconds: 5, span: 4 },
      animationTimeSeconds: 2,
      deltaSeconds: 0.5,
    });
    expect(time).toBeCloseTo(2.5);
  });

  it('computeAnimationTimeSeconds wraps when repeat enabled', () => {
    const animationSettings = buildAnimationSettings({ clipRepeat: true });
    const time = computeAnimationTimeSeconds({
      holdStartPose: false,
      blendingIn: false,
      deterministicTime: false,
      useScrubTimeAnimation: false,
      sceneProgress: 0.5,
      animationSettings,
      clipDuration: 10,
      clipRange: { startSeconds: 1, endSeconds: 3, span: 2 },
      animationTimeSeconds: 2.9,
      deltaSeconds: 0.5,
    });
    expect(time).toBeCloseTo(1.4, 5);
  });

  it('isAnimationAtEnd detects non-repeating end', () => {
    const atEnd = isAnimationAtEnd({
      clipRepeat: false,
      timeSeconds: 5,
      clipRange: { startSeconds: 1, endSeconds: 5, span: 4 },
      blendingIn: false,
      holdStartPose: false,
    });
    expect(atEnd).toBe(true);
  });
});
