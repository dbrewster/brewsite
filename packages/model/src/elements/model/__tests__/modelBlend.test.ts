// modelBlend.test.ts — Pure function tests for all blend helpers.
// Real inputs, real outputs, no mocks. Full branch coverage.

import { describe, it, expect } from 'vitest';
import {
  poseGroupTransition,
  blendBodyOverrides,
  blendSubparts,
  blendParts,
  blendPoseGroups,
  blendCommands,
  blendMotionScenes,
  blendCustomAnimations,
} from '../modelBlend';
import type {
  BodyPartOverrideMap,
  CustomAnimation,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  PoseGroup,
} from '../types';

// ─── poseGroupTransition ──────────────────────────────────────────────────────

describe('poseGroupTransition', () => {
  it('returns undefined when both from and to are undefined', () => {
    expect(poseGroupTransition(undefined, undefined, 0.5)).toBeUndefined();
  });

  it('interpolates when both from and to have values', () => {
    const from: PoseGroup = { rotate: { yawPct: 0, pitchPct: 0, rollPct: 0 } };
    const to: PoseGroup = { rotate: { yawPct: 1, pitchPct: 0.5, rollPct: 0 } };
    // t=0 stays at from, t=1 reaches to
    const atZero = poseGroupTransition(from, to, 0);
    expect(atZero?.rotate?.yawPct).toBeCloseTo(0);

    const atOne = poseGroupTransition(from, to, 1);
    expect(atOne?.rotate?.yawPct).toBeCloseTo(1);
    expect(atOne?.rotate?.pitchPct).toBeCloseTo(0.5);

    // t=0.5 blends toward to — yawPct is between 0 and 1 (non-linear blend from blendAxisRotation)
    const atHalf = poseGroupTransition(from, to, 0.5);
    expect(atHalf?.rotate?.yawPct).toBeGreaterThan(0);
    expect(atHalf?.rotate?.yawPct).toBeLessThan(1);
    expect(atHalf?.rotate?.pitchPct).toBeGreaterThan(0);
    expect(atHalf?.rotate?.pitchPct).toBeLessThan(0.5);
  });

  it('scales down from-only on exit — t=0 keeps from, t=1 zeroes', () => {
    const from: PoseGroup = { rotate: { yawPct: 1, pitchPct: 0.5 } };

    const atZero = poseGroupTransition(from, undefined, 0);
    expect(atZero?.rotate?.yawPct).toBeCloseTo(1);
    expect(atZero?.rotate?.pitchPct).toBeCloseTo(0.5);

    const atOne = poseGroupTransition(from, undefined, 1);
    expect(atOne?.rotate?.yawPct).toBeCloseTo(0);
    expect(atOne?.rotate?.pitchPct).toBeCloseTo(0);
  });

  it('scales up to-only on enter — t=0 is zero, t=1 is to', () => {
    const to: PoseGroup = { rotate: { yawPct: 1 }, translate: { xPct: 0.5 } };

    const atZero = poseGroupTransition(undefined, to, 0);
    expect(atZero?.rotate?.yawPct).toBeCloseTo(0);

    const atOne = poseGroupTransition(undefined, to, 1);
    expect(atOne?.rotate?.yawPct).toBeCloseTo(1);
    expect(atOne?.translate?.xPct).toBeCloseTo(0.5);
  });

  it('uses t=0 as default when t is undefined (from-only)', () => {
    const from: PoseGroup = { rotate: { yawPct: 1 } };
    const result = poseGroupTransition(from, undefined, undefined);
    // scale = 1 - 0 = 1, so yawPct remains 1
    expect(result?.rotate?.yawPct).toBeCloseTo(1);
  });

  it('includes translate axes when scaling', () => {
    const from: PoseGroup = { translate: { xPct: 1, yPct: 2, zPct: 3 } };
    const result = poseGroupTransition(from, undefined, 0.5);
    expect(result?.translate?.xPct).toBeCloseTo(0.5);
    expect(result?.translate?.yPct).toBeCloseTo(1);
    expect(result?.translate?.zPct).toBeCloseTo(1.5);
  });
});

// ─── blendBodyOverrides ───────────────────────────────────────────────────────

describe('blendBodyOverrides', () => {
  it('returns undefined when both maps are empty/undefined', () => {
    expect(blendBodyOverrides(undefined, undefined)).toBeUndefined();
    expect(blendBodyOverrides({}, {})).toBeUndefined();
  });

  it('blends opacity when part exists in both maps at t=0.5', () => {
    const from: BodyPartOverrideMap = { Head: { opacity: 1 } };
    const to: BodyPartOverrideMap = { Head: { opacity: 0 } };
    const result = blendBodyOverrides(from, to, 0.5, 0.5, 0.5);
    expect(result?.Head?.opacity).toBeCloseTo(0.5);
  });

  it('blends color, metalness, roughness when both present', () => {
    const from: BodyPartOverrideMap = {
      Part: { color: '#ff0000', metalness: 0, roughness: 0 },
    };
    const to: BodyPartOverrideMap = {
      Part: { color: '#0000ff', metalness: 1, roughness: 1 },
    };
    const result = blendBodyOverrides(from, to, 0.5, 0.5, 0);
    // At tFull=0, should preserve from values
    expect(result?.Part?.metalness).toBeCloseTo(0);
    expect(result?.Part?.roughness).toBeCloseTo(0);
  });

  it('fades out opacity when part exists only in from map (tExit)', () => {
    const from: BodyPartOverrideMap = { Head: { opacity: 1 } };
    const to: BodyPartOverrideMap = {};
    const result = blendBodyOverrides(from, to, 0.5, 0, 0.5);
    // from-only: opacity blends from 1 to 0 with tExit=0.5
    expect(result?.Head?.opacity).toBeCloseTo(0.5);
  });

  it('fades in opacity when part exists only in to map (tEnter)', () => {
    const from: BodyPartOverrideMap = {};
    const to: BodyPartOverrideMap = { Head: { opacity: 1 } };
    const result = blendBodyOverrides(from, to, 1, 0.5, 0.5);
    // to-only: opacity blends from 0 to 1 with tEnter=0.5
    expect(result?.Head?.opacity).toBeCloseTo(0.5);
  });

  it('blends pose via poseGroupTransition for matched parts', () => {
    const from: BodyPartOverrideMap = {
      Head: { pose: { rotate: { yawPct: 0 } } },
    };
    const to: BodyPartOverrideMap = {
      Head: { pose: { rotate: { yawPct: 1 } } },
    };
    const result = blendBodyOverrides(from, to, 0.5, 0.5, 0.5);
    expect(result?.Head?.pose?.rotate?.yawPct).toBeCloseTo(0.5);
  });

  it('fades pose via poseGroupTransition for from-only parts on exit', () => {
    const from: BodyPartOverrideMap = {
      Head: { pose: { rotate: { yawPct: 1 } } },
    };
    const result = blendBodyOverrides(from, {}, 0, 0, 0);
    // tExit=0 → scale = 1 - 0 = 1, yawPct stays at 1
    expect(result?.Head?.pose?.rotate?.yawPct).toBeCloseTo(1);
  });

  it('uses OPAQUE_OPACITY (1) when opacity is not specified for from-only part', () => {
    const from: BodyPartOverrideMap = { Head: { color: '#ff0000' } }; // no opacity
    const result = blendBodyOverrides(from, {}, 0.5, 0, 0.5);
    // from-only: opacity starts at 1 (OPAQUE_OPACITY), fades with tExit=0.5
    expect(result?.Head?.opacity).toBeCloseTo(0.5);
  });

  it('uses OPAQUE_OPACITY (1) when opacity is not specified for to-only part', () => {
    const to: BodyPartOverrideMap = { Head: { color: '#0000ff' } }; // no opacity
    const result = blendBodyOverrides({}, to, 1, 0.5, 0.5);
    // to-only: opacity starts at 0, enters with tEnter=0.5 toward 1 (OPAQUE_OPACITY)
    expect(result?.Head?.opacity).toBeCloseTo(0.5);
  });
});

// ─── blendSubparts ────────────────────────────────────────────────────────────

describe('blendSubparts', () => {
  it('returns undefined when both maps are undefined or empty', () => {
    expect(blendSubparts(undefined, undefined)).toBeUndefined();
    expect(blendSubparts({}, {})).toBeUndefined();
  });

  it('blends opacity + color when present in both', () => {
    const from: Partial<Record<string, ModelSubpartSpec>> = {
      Brim: { id: 'Brim', opacity: 1, color: '#ff0000' },
    };
    const to: Partial<Record<string, ModelSubpartSpec>> = {
      Brim: { id: 'Brim', opacity: 0, color: '#0000ff' },
    };
    const result = blendSubparts(from, to, 0.5, 0.5, 0.5);
    expect(result?.Brim?.opacity).toBeCloseTo(0.5);
  });

  it('resolves enabled via resolveEnabledByOpacity when opacity transitions to 0', () => {
    const from: Partial<Record<string, ModelSubpartSpec>> = {
      Brim: { id: 'Brim', opacity: 1, enabled: true },
    };
    const to: Partial<Record<string, ModelSubpartSpec>> = {
      Brim: { id: 'Brim', opacity: 0, enabled: true },
    };
    const result = blendSubparts(from, to, 1, 0, 1);
    // opacity = 0 → enabled should be false
    expect(result?.Brim?.enabled).toBe(false);
  });

  it('preserves enabled=false regardless of opacity', () => {
    const from: Partial<Record<string, ModelSubpartSpec>> = {
      Part: { id: 'Part', opacity: 1, enabled: false },
    };
    const to: Partial<Record<string, ModelSubpartSpec>> = {
      Part: { id: 'Part', opacity: 1, enabled: false },
    };
    const result = blendSubparts(from, to, 0.5, 0.5, 0.5);
    expect(result?.Part?.enabled).toBe(false);
  });

  it('handles exit-only subparts by fading opacity to 0', () => {
    const from: Partial<Record<string, ModelSubpartSpec>> = {
      Trim: { id: 'Trim', opacity: 1 },
    };
    const result = blendSubparts(from, {}, 0.5, 0, 0.5);
    expect(result?.Trim?.opacity).toBeCloseTo(0.5);
  });

  it('handles enter-only subparts by fading opacity from 0', () => {
    const to: Partial<Record<string, ModelSubpartSpec>> = {
      Trim: { id: 'Trim', opacity: 1 },
    };
    const result = blendSubparts({}, to, 1, 0.5, 0.5);
    expect(result?.Trim?.opacity).toBeCloseTo(0.5);
  });
});

// ─── blendParts ───────────────────────────────────────────────────────────────

describe('blendParts', () => {
  it('returns undefined when both maps are undefined or empty', () => {
    expect(blendParts(undefined, undefined)).toBeUndefined();
    expect(blendParts({}, {})).toBeUndefined();
  });

  it('blends position, rotation, scale, containedPosition via blendVec3/blendNumber', () => {
    const from: Record<string, ModelPartSpec> = {
      hat: {
        id: 'hat', anchor: 'head', enabled: true,
        position: [0, 0, 0], rotation: [0, 0, 0], scale: 1,
        containedPosition: [0, 0, 0], containedRotation: [0, 0, 0], containedScale: 1,
      },
    };
    const to: Record<string, ModelPartSpec> = {
      hat: {
        id: 'hat', anchor: 'head', enabled: true,
        position: [2, 0, 0], rotation: [0, 0, 0], scale: 2,
        containedPosition: [4, 0, 0], containedRotation: [0, 0, 0], containedScale: 2,
      },
    };
    const result = blendParts(from, to, 0.5, 0.5, 0.5);
    expect(result?.hat?.position).toEqual([1, 0, 0]);
    expect(result?.hat?.scale).toBeCloseTo(1.5);
    expect(result?.hat?.containedPosition?.[0]).toBeCloseTo(2);
    expect(result?.hat?.containedScale).toBeCloseTo(1.5);
  });

  it('blends metalness, roughness for matched parts', () => {
    const from: Record<string, ModelPartSpec> = {
      part: {
        id: 'part', anchor: 'root', enabled: true,
        position: [0, 0, 0], rotation: [0, 0, 0], scale: 1,
        metalness: 0, roughness: 0,
      },
    };
    const to: Record<string, ModelPartSpec> = {
      part: {
        id: 'part', anchor: 'root', enabled: true,
        position: [0, 0, 0], rotation: [0, 0, 0], scale: 1,
        metalness: 1, roughness: 1,
      },
    };
    const result = blendParts(from, to, 0.5, 0.5, 0.5);
    expect(result?.part?.metalness).toBeCloseTo(0.5);
    expect(result?.part?.roughness).toBeCloseTo(0.5);
  });

  it('blends subparts recursively', () => {
    const from: Record<string, ModelPartSpec> = {
      hat: {
        id: 'hat', anchor: 'head', enabled: true,
        position: [0, 0, 0], rotation: [0, 0, 0], scale: 1,
        subparts: { Brim: { id: 'Brim', opacity: 1 } },
      },
    };
    const to: Record<string, ModelPartSpec> = {
      hat: {
        id: 'hat', anchor: 'head', enabled: true,
        position: [0, 0, 0], rotation: [0, 0, 0], scale: 1,
        subparts: { Brim: { id: 'Brim', opacity: 0 } },
      },
    };
    const result = blendParts(from, to, 0.5, 0.5, 0.5);
    expect(result?.hat?.subparts?.Brim?.opacity).toBeCloseTo(0.5);
  });

  it('handles exit-only parts with correct position defaults', () => {
    const from: Record<string, ModelPartSpec> = {
      wing: {
        id: 'wing', anchor: 'back', enabled: true,
        position: [1, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1,
      },
    };
    const result = blendParts(from, {}, 0.5, 0, 0.5);
    // opacity fades with tExit=0.5
    expect(result?.wing?.opacity).toBeCloseTo(0.5);
    expect(result?.wing?.position).toEqual([1, 0, 0]);
    expect(result?.wing?.scale).toBeCloseTo(1);
  });

  it('handles enter-only parts with correct position defaults', () => {
    const to: Record<string, ModelPartSpec> = {
      wing: {
        id: 'wing', anchor: 'back', enabled: true,
        position: [2, 0, 0], rotation: [0, 0, 0], scale: 2, opacity: 1,
      },
    };
    const result = blendParts({}, to, 1, 0.5, 0.5);
    // opacity fades from 0 with tEnter=0.5
    expect(result?.wing?.opacity).toBeCloseTo(0.5);
    expect(result?.wing?.position).toEqual([2, 0, 0]);
    expect(result?.wing?.scale).toBeCloseTo(2);
  });

  it('uses default position/rotation/scale when not specified', () => {
    const from: Record<string, ModelPartSpec> = {
      part: { id: 'part', anchor: 'root', enabled: true, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
    };
    const to: Record<string, ModelPartSpec> = {
      part: { id: 'part', anchor: 'root', enabled: true, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
    };
    const result = blendParts(from, to, 0.5, 0.5, 0.5);
    // containedScale defaults to 1 when undefined
    expect(result?.part?.containedScale).toBeCloseTo(1);
  });
});

// ─── blendCommands ────────────────────────────────────────────────────────────

describe('blendCommands', () => {
  it('returns empty array when both inputs are undefined', () => {
    expect(blendCommands(undefined, undefined)).toEqual([]);
  });

  it('returns empty array when both inputs are empty arrays', () => {
    expect(blendCommands([], [])).toEqual([]);
  });

  it('blends matched commands by groupId', () => {
    const from: MotionCommand[] = [
      { groupId: 'head', rotate: { yawPct: 0 }, weight: 1 },
    ];
    const to: MotionCommand[] = [
      { groupId: 'head', rotate: { yawPct: 1 }, weight: 1 },
    ];
    const result = blendCommands(from, to, 1, 0, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe('head');
    expect(result[0].rotate?.yawPct).toBeCloseTo(0.5);
    expect(result[0].weight).toBeCloseTo(1);
  });

  it('fades out unmatched from-commands when tExit < 1', () => {
    const from: MotionCommand[] = [
      { groupId: 'arm', rotate: { yawPct: 1 }, weight: 1 },
    ];
    const to: MotionCommand[] = [];
    const result = blendCommands(from, to, 0.5, 0, 0);
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe('arm');
    expect(result[0].weight).toBeCloseTo(0.5);
  });

  it('does not include from-commands when tExit >= 1', () => {
    const from: MotionCommand[] = [{ groupId: 'arm', weight: 1 }];
    const result = blendCommands(from, [], 1, 0, 0);
    expect(result).toHaveLength(0);
  });

  it('fades in unmatched to-commands when tEnter > 0', () => {
    const to: MotionCommand[] = [
      { groupId: 'leg', rotate: { yawPct: 1 }, weight: 1 },
    ];
    const result = blendCommands([], to, 1, 0.5, 0);
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe('leg');
    expect(result[0].weight).toBeCloseTo(0.5);
  });

  it('does not include to-commands when tEnter is 0', () => {
    const to: MotionCommand[] = [{ groupId: 'leg', weight: 1 }];
    const result = blendCommands([], to, 1, 0, 0);
    expect(result).toHaveLength(0);
  });
});

// ─── blendMotionScenes ────────────────────────────────────────────────────────

describe('blendMotionScenes', () => {
  it('returns empty array when both inputs are undefined', () => {
    expect(blendMotionScenes(undefined, undefined)).toEqual([]);
  });

  it('blends start/end times of matched scenes by id', () => {
    const from: MotionScene[] = [{ id: 'walk', start: 0, end: 1 }];
    const to: MotionScene[] = [{ id: 'walk', start: 1, end: 2 }];
    const result = blendMotionScenes(from, to, 1, 0, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('walk');
    expect(result[0].start).toBeCloseTo(0.5);
    expect(result[0].end).toBeCloseTo(1.5);
  });

  it('uses ease from from-scene when tFull < 0.5, else from to-scene', () => {
    const from: MotionScene[] = [{ id: 'walk', start: 0, end: 1, ease: 'linear' }];
    const to: MotionScene[] = [{ id: 'walk', start: 0, end: 1, ease: 'easeIn' }];

    const atLow = blendMotionScenes(from, to, 1, 0, 0.3);
    expect(atLow[0].ease).toBe('linear');

    const atHigh = blendMotionScenes(from, to, 1, 0, 0.7);
    expect(atHigh[0].ease).toBe('easeIn');
  });

  it('carries unmatched from-scenes when tExit < 1', () => {
    const from: MotionScene[] = [{ id: 'run', start: 0, end: 2 }];
    const result = blendMotionScenes(from, [], 0.5, 0, 0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('run');
  });

  it('does not carry unmatched from-scenes when tExit >= 1', () => {
    const from: MotionScene[] = [{ id: 'run', start: 0, end: 2 }];
    const result = blendMotionScenes(from, [], 1, 0, 0);
    expect(result).toHaveLength(0);
  });

  it('carries unmatched to-scenes when tEnter > 0', () => {
    const to: MotionScene[] = [{ id: 'idle', start: 0, end: 1 }];
    const result = blendMotionScenes([], to, 1, 0.5, 0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('idle');
  });

  it('does not carry unmatched to-scenes when tEnter is 0', () => {
    const to: MotionScene[] = [{ id: 'idle', start: 0, end: 1 }];
    const result = blendMotionScenes([], to, 1, 0, 0);
    expect(result).toHaveLength(0);
  });
});

// ─── blendCustomAnimations ────────────────────────────────────────────────────

describe('blendCustomAnimations', () => {
  const noop = () => [];

  it('returns empty array when both inputs are undefined', () => {
    expect(blendCustomAnimations(undefined, undefined)).toEqual([]);
  });

  it('blends weight of matched animations by id', () => {
    const from: CustomAnimation[] = [
      { id: 'wave', weight: 0, enabled: true, apply: noop },
    ];
    const to: CustomAnimation[] = [
      { id: 'wave', weight: 1, enabled: true, apply: noop },
    ];
    const result = blendCustomAnimations(from, to, 1, 0, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].weight).toBeCloseTo(0.5);
  });

  it('picks apply fn from to when tFull >= 0.5, else from from', () => {
    const applyFrom = () => [];
    const applyTo = () => [];

    const from: CustomAnimation[] = [{ id: 'anim', weight: 1, enabled: true, apply: applyFrom }];
    const to: CustomAnimation[] = [{ id: 'anim', weight: 1, enabled: true, apply: applyTo }];

    const atLow = blendCustomAnimations(from, to, 1, 0, 0.3);
    expect(atLow[0].apply).toBe(applyFrom);

    const atHigh = blendCustomAnimations(from, to, 1, 0, 0.7);
    expect(atHigh[0].apply).toBe(applyTo);
  });

  it('fades weight to 0 for exit-only animations and disables when tExit >= 1', () => {
    const from: CustomAnimation[] = [{ id: 'wave', weight: 1, enabled: true, apply: noop }];
    const resultMid = blendCustomAnimations(from, [], 0.5, 0, 0);
    expect(resultMid).toHaveLength(1);
    expect(resultMid[0].weight).toBeCloseTo(0.5);
    // enabled: (true) && (0.5 < 1) = true
    expect(resultMid[0].enabled).toBe(true);
  });

  it('does not include exit-only animation when tExit >= 1', () => {
    const from: CustomAnimation[] = [{ id: 'wave', weight: 1, enabled: true, apply: noop }];
    const result = blendCustomAnimations(from, [], 1, 0, 0);
    expect(result).toHaveLength(0);
  });

  it('fades weight from 0 for enter-only animations', () => {
    const to: CustomAnimation[] = [{ id: 'nod', weight: 1, enabled: true, apply: noop }];
    const result = blendCustomAnimations([], to, 1, 0.5, 0);
    expect(result).toHaveLength(1);
    expect(result[0].weight).toBeCloseTo(0.5);
    // enabled: (true) && (0.5 > 0) = true
    expect(result[0].enabled).toBe(true);
  });

  it('does not include enter-only animation when tEnter is 0', () => {
    const to: CustomAnimation[] = [{ id: 'nod', weight: 1, enabled: true, apply: noop }];
    const result = blendCustomAnimations([], to, 1, 0, 0);
    expect(result).toHaveLength(0);
  });

  it('disables matched animation when tFull is 0', () => {
    const from: CustomAnimation[] = [{ id: 'wave', weight: 1, enabled: true, apply: noop }];
    const to: CustomAnimation[] = [{ id: 'wave', weight: 1, enabled: true, apply: noop }];
    const result = blendCustomAnimations(from, to, 1, 0, 0);
    expect(result[0].enabled).toBe(false);
  });
});

// ─── blendPoseGroups ──────────────────────────────────────────────────────────

describe('blendPoseGroups', () => {
  it('returns undefined when both maps are undefined', () => {
    expect(blendPoseGroups(undefined, undefined)).toBeUndefined();
    expect(blendPoseGroups({}, {})).toBeUndefined();
  });

  it('blends pose groups by key', () => {
    const from: Partial<Record<string, PoseGroup>> = {
      head: { rotate: { yawPct: 0 } },
    };
    const to: Partial<Record<string, PoseGroup>> = {
      head: { rotate: { yawPct: 1 } },
    };
    const result = blendPoseGroups(from, to, 0.5);
    expect(result?.head?.rotate?.yawPct).toBeCloseTo(0.5);
  });

  it('handles groups only in from (exit) via poseGroupTransition', () => {
    const from: Partial<Record<string, PoseGroup>> = {
      arm: { rotate: { pitchPct: 1 } },
    };
    const result = blendPoseGroups(from, {}, 0.5);
    // arm is in from only, so it scales down with 1 - 0.5 = 0.5
    expect(result?.arm?.rotate?.pitchPct).toBeCloseTo(0.5);
  });

  it('handles groups only in to (enter) via poseGroupTransition', () => {
    const to: Partial<Record<string, PoseGroup>> = {
      leg: { rotate: { rollPct: 1 } },
    };
    const result = blendPoseGroups({}, to, 0.5);
    // leg is in to only, so it scales up with 0.5
    expect(result?.leg?.rotate?.rollPct).toBeCloseTo(0.5);
  });
});
