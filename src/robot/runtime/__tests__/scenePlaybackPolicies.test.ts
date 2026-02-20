import {describe, expect, it} from 'vitest';
import {computeMotionFlags} from '../scenePlaybackPolicies';
import type {SceneMotion} from '../../model/robotSceneTypes';

const buildMotion = (overrides?: Partial<SceneMotion>): SceneMotion => ({
  commands: [],
  scenes: [],
  customAnimations: [],
  ...overrides,
});

describe('scenePlaybackPolicies', () => {
  it('detects empty motion', () => {
    const flags = computeMotionFlags(buildMotion());
    expect(flags.hasMotion).toBe(false);
  });

  it('detects command motion', () => {
    const flags = computeMotionFlags(buildMotion({
      commands: [{ groupId: 'robot', translate: { xPct: 0.1, yPct: 0, zPct: 0 } }],
    }));
    expect(flags.hasMotion).toBe(true);
  });

  it('detects scene motion', () => {
    const flags = computeMotionFlags(buildMotion({
      scenes: [{ id: 'scene', start: 0, end: 1, commands: [] }],
    }));
    expect(flags.hasMotion).toBe(true);
  });

  it('detects custom animations', () => {
    const flags = computeMotionFlags(buildMotion({ customAnimations: [{ id: 'custom', enabled: true, apply: () => [] }] }));
    expect(flags.hasMotion).toBe(true);
  });
});
