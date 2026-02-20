import { describe, it, expect } from 'vitest';
import {
  resolveClipRangeSeconds,
  compileAnimation,
  createDefaultModelInstanceState,
  modelTransitionSpec,
  playbackTransitionSpec,
  instanceTransitionSpec,
} from '../compile';
import type {
  SceneAnimation,
  SceneModel,
  ScenePlayback,
  SceneModelInstanceState,
} from '../types';
import { makeTransitionContext } from '../../__tests__/elementTestMocks';

describe('model compile helpers', () => {
  it('resolveClipRangeSeconds supports percent ranges', () => {
    const result = resolveClipRangeSeconds(
      { enabled: true, clipStart: 25, clipEnd: 75, clipRangeUnit: 'percent' },
      10,
    );
    expect(result.startSeconds).toBeCloseTo(2.5);
    expect(result.endSeconds).toBeCloseTo(7.5);
    expect(result.span).toBeCloseTo(5);
  });

  it('compileAnimation disables when prefersReducedMotion is true', () => {
    const anim: SceneAnimation = { enabled: true, clipName: 'idle' };
    const result = compileAnimation(anim, [{ name: 'idle', duration: 2 }], true);
    expect(result.enabled).toBe(false);
  });

  it('compileAnimation resolves clip and range when clip exists', () => {
    const anim: SceneAnimation = { enabled: true, clipName: 'idle', clipStart: 0, clipEnd: 1 };
    const result = compileAnimation(anim, [{ name: 'idle', duration: 2 }], false);
    expect(result.enabled).toBe(true);
    expect(result.clipName).toBe('idle');
    expect(result.clipDuration).toBe(2);
    expect(result.range?.span).toBeCloseTo(1);
  });

  it('compileAnimation returns disabled with clipName when clip is missing', () => {
    const anim: SceneAnimation = { enabled: true, clipName: 'missing' };
    const result = compileAnimation(anim, [], false);
    expect(result.enabled).toBe(false);
    expect(result.clipName).toBe('missing');
  });

  it('createDefaultModelInstanceState seeds model + playback defaults', () => {
    const state = createDefaultModelInstanceState('bot');
    expect(state.model.enabled).toBe(true);
    expect(state.model.scale).toBeCloseTo(0.1);
    expect(state.playback.motion.commands).toHaveLength(0);
    expect(state.playback.animation.enabled).toBe(false);
  });
});

describe('model transition specs', () => {
  it('modelTransitionSpec.exit hides model at end of exit', () => {
    const model: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
    };
    const ctx = makeTransitionContext({ progress: 1, exitStart: 0, exitEnd: 1 });
    const result = modelTransitionSpec.exit(model, ctx);
    expect(result.enabled).toBe(false);
    expect(result.scale).toBeLessThan(0.01);
  });

  it('modelTransitionSpec.interpolate uses early exit when target is hidden', () => {
    const from: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
    };
    const to: SceneModel = {
      scale: 0.001,
      position: [10, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
    };
    const ctx = makeTransitionContext({ progress: 0.25, tFull: 0, exitStart: 0, exitEnd: 1 });
    const result = modelTransitionSpec.interpolate(from, to, ctx);
    expect(result.scale).toBeLessThan(1);
    expect(result.scale).toBeGreaterThan(0.001);
  });

  it('playbackTransitionSpec.interpolate blends animation weight', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: { enabled: true, weight: 1 },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: { enabled: true, weight: 0 },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.5 }));
    expect(result.animation.weight).toBeCloseTo(0.5);
  });

  it('instanceTransitionSpec disables when progress reaches exitEnd', () => {
    const from: SceneModelInstanceState = {
      model: { scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true },
      playback: { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      enabled: true,
    };
    const ctx = makeTransitionContext({ progress: 1, exitEnd: 1 });
    const result = instanceTransitionSpec.exit(from, ctx);
    expect(result.enabled).toBe(false);
  });
});
