import { describe, it, expect, vi } from 'vitest';
import {
  resolveClipRangeSeconds,
  compileAnimation,
  createDefaultModelInstanceState,
  applyModelEnter,
  applyModelExit,
  applyModelInterpolate,
  modelTransitionSpec,
  playbackTransitionSpec,
  poseGroupTransition,
} from '../compile';
import type {
  CustomAnimation,
  MotionCommand,
  MotionScene,
  PoseGroup,
  SceneAnimation,
  SceneModel,
  ScenePlayback,
  SceneModelInstanceState,
} from '../types';

const makeT = (overrides: { tFull?: number; tEnter?: number; tExit?: number } = {}): number =>
  overrides.tFull ?? overrides.tEnter ?? overrides.tExit ?? 0;

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

  it('resolveClipRangeSeconds clamps minimal span', () => {
    const result = resolveClipRangeSeconds(
      { enabled: true, clipStart: 1, clipEnd: 1, clipRangeUnit: 'seconds' },
      2,
    );
    expect(result.span).toBeGreaterThan(0);
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

  it('compileAnimation falls back to manifest defaults for clipStart/clipEnd', () => {
    const anim: SceneAnimation = { enabled: true, clipName: 'idle' };
    const result = compileAnimation(anim, [{ name: 'idle', duration: 2, clipStart: 0.2, clipEnd: 1.2 }], false);
    expect(result.enabled).toBe(true);
    expect(result.clipName).toBe('idle');
    expect(result.range?.startSeconds).toBeCloseTo(0.2);
    expect(result.range?.endSeconds).toBeCloseTo(1.2);
  });

  it('resolveClipRangeSeconds treats negative clipEnd as seconds from the end', () => {
    const anim: SceneAnimation = { enabled: true, clipName: 'idle', clipStart: 0.1, clipEnd: -0.8 };
    const result = compileAnimation(anim, [{ name: 'idle', duration: 2 }], false);
    expect(result.enabled).toBe(true);
    expect(result.range?.startSeconds).toBeCloseTo(0.1);
    expect(result.range?.endSeconds).toBeCloseTo(1.2);
  });

  it('compileAnimation returns disabled with clipName when clip is missing', () => {
    const anim: SceneAnimation = { enabled: true, clipName: 'missing' };
    const result = compileAnimation(anim, [], false);
    expect(result.enabled).toBe(false);
    expect(result.clipName).toBe('missing');
  });

  it('compileAnimation returns disabled when no clip request provided', () => {
    const anim: SceneAnimation = { enabled: true };
    const result = compileAnimation(anim, [{ name: 'idle', duration: 2 }], false);
    expect(result.enabled).toBe(false);
  });

  it('compileAnimation includes clipName even when using external gltf', () => {
    const anim: SceneAnimation = { enabled: true, gltfUrl: '/anim.glb', gltfClipName: 'walk' };
    const result = compileAnimation(anim, [], false);
    expect(result.enabled).toBe(false);
    expect(result.clipName).toBe('walk');
  });

  it('compileAnimation returns disabled with no clipName when only gltfUrl provided', () => {
    const anim: SceneAnimation = { enabled: true, gltfUrl: '/anim.glb' };
    const result = compileAnimation(anim, [], false);
    expect(result.enabled).toBe(false);
    expect(result.clipName).toBeUndefined();
  });

  it('compileAnimation warns when requested clip is missing but clips are available', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const anim: SceneAnimation = { enabled: true, clipName: 'missing' };
    compileAnimation(anim, [{ name: 'idle', duration: 2 }], false);
    expect(spy).toHaveBeenCalledWith(
      '[ModelWidget] missing.animation.clip',
      expect.objectContaining({ requestedClip: 'missing' }),
    );
    spy.mockRestore();
  });

  it('createDefaultModelInstanceState seeds model + playback defaults', () => {
    const identity: SceneModelInstanceState = {
      model: {
        scale: 0.1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        enabled: true,
        bodyPartOverrides: {},
      },
      playback: {
        motion: { commands: [], scenes: [], customAnimations: [] },
        animation: { enabled: false },
      },
    };
    const state = createDefaultModelInstanceState('bot', identity);
    expect(state.model.enabled).toBe(true);
    expect(state.model.scale).toBeCloseTo(0.1);
    expect(state.playback.motion.commands).toHaveLength(0);
    expect(state.playback.animation.enabled).toBe(false);
  });

  it('poseGroupTransition blends and scales when entering/exiting', () => {
    const from = { rotate: { yawPct: 1 }, translate: { xPct: 1 } };
    const to = { rotate: { yawPct: 0 }, translate: { xPct: 0 } };
    const blended = poseGroupTransition(from, to, 0.5);
    expect(blended?.rotate?.yawPct).toBeCloseTo(0.5);
    expect(blended?.translate?.xPct).toBeCloseTo(0.5);

    const exitOnly = poseGroupTransition(from, undefined, 0.5);
    expect(exitOnly?.rotate?.yawPct).toBeCloseTo(0.5);

    const enterOnly = poseGroupTransition(undefined, to, 0.5);
    expect(enterOnly?.rotate?.yawPct).toBeCloseTo(0);
  });

  it('poseGroupTransition scales translate axes when only from is present', () => {
    const from = { translate: { xPct: 1, yPct: 2, zPct: 3 } };
    const result = poseGroupTransition(from, undefined, 0.5);
    expect(result?.translate?.xPct).toBeCloseTo(0.5);
    expect(result?.translate?.yPct).toBeCloseTo(1);
    expect(result?.translate?.zPct).toBeCloseTo(1.5);
  });

  it('poseGroupTransition returns undefined when both sides missing', () => {
    expect(poseGroupTransition(undefined, undefined, 0.5)).toBeUndefined();
  });
});

describe('blendBodyOverrides preserves boneId/meshId routing metadata', () => {
  it('interpolate preserves boneId and meshId on matched keys', () => {
    // blendBodyOverrides is exercised through modelTransitionSpec.interpolate
    const from: SceneModel = {
      scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true,
      bodyPartOverrides: {
        RightForeArm: {
          color: '#ff0000',
          opacity: 1,
          boneId: 'mixamorigRightForeArm',
          meshId: 'FOREARM_RIGHT',
        },
      },
    };
    const to: SceneModel = {
      scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true,
      bodyPartOverrides: {
        RightForeArm: {
          color: '#0000ff',
          opacity: 0.5,
          boneId: 'mixamorigRightForeArm',
          meshId: 'FOREARM_RIGHT',
        },
      },
    };
    const result = modelTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    const part = result.bodyPartOverrides?.RightForeArm;
    expect(part?.boneId).toBe('mixamorigRightForeArm');
    expect(part?.meshId).toBe('FOREARM_RIGHT');
    // opacity blends from 1 → 0.5
    expect(part?.opacity).toBeCloseTo(0.75);
  });

  it('enter (prev-only) preserves boneId and meshId during exit', () => {
    const from: SceneModel = {
      scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true,
      bodyPartOverrides: {
        RightForeArm: {
          opacity: 1,
          boneId: 'mixamorigRightForeArm',
          meshId: 'FOREARM_RIGHT',
        },
      },
    };
    const to: SceneModel = {
      scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true,
      bodyPartOverrides: {},
    };
    const result = modelTransitionSpec.interpolate(from, to, makeT({ tExit: 0.5 }));
    const part = result.bodyPartOverrides?.RightForeArm;
    expect(part?.boneId).toBe('mixamorigRightForeArm');
    expect(part?.meshId).toBe('FOREARM_RIGHT');
    expect((part?.opacity ?? 0)).toBeGreaterThan(0);
  });

  it('enter (next-only) preserves boneId and meshId on enter', () => {
    const from: SceneModel = {
      scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true,
      bodyPartOverrides: {},
    };
    const to: SceneModel = {
      scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true,
      bodyPartOverrides: {
        RightForeArm: {
          opacity: 1,
          boneId: 'mixamorigRightForeArm',
          meshId: 'FOREARM_RIGHT',
        },
      },
    };
    const result = modelTransitionSpec.enter(to, makeT({ tEnter: 0.5 }));
    const part = result.bodyPartOverrides?.RightForeArm;
    expect(part?.boneId).toBe('mixamorigRightForeArm');
    expect(part?.meshId).toBe('FOREARM_RIGHT');
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
    const result = modelTransitionSpec.exit(model, 1);
    expect(result.enabled).toBe(false);
    expect(result.opacity ?? 1).toBeLessThan(0.01);
    expect(result.scale).toBeCloseTo(1);
  });

  it('modelTransitionSpec.interpolate blends parts and subparts', () => {
    const from: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        hat: {
          id: 'hat',
          anchor: 'head',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          opacity: 1,
          subparts: { Brim: { id: 'Brim', opacity: 1, color: '#ff0000' } },
        },
      },
    };
    const to: SceneModel = {
      scale: 1,
      position: [1, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        hat: {
          id: 'hat',
          anchor: 'head',
          enabled: true,
          position: [2, 0, 0],
          rotation: [0, 0, 0],
          scale: 2,
          opacity: 0,
          subparts: { Brim: { id: 'Brim', opacity: 0, color: '#00ff00' } },
        },
      },
    };
    const result = modelTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5, tExit: 0.5, tEnter: 0.5 }));
    const hat = result.parts?.hat;
    expect(hat?.position).toEqual([1, 0, 0]);
    expect(hat?.scale).toBeCloseTo(1.5);
    expect(hat?.subparts?.Brim?.opacity).toBeCloseTo(0.5);
    expect(hat?.subparts?.Brim?.color).toBe('#808000');
  });

  it('modelTransitionSpec.exit handles bodyPartOverrides and parts removal', () => {
    const from: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      bodyPartOverrides: { Head: { opacity: 1, color: '#ffffff' } },
      parts: {
        hat: {
          id: 'hat',
          anchor: 'head',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          opacity: 1,
        },
      },
    };
    const result = modelTransitionSpec.exit(from, 1);
    expect(result.bodyPartOverrides?.Head?.opacity).toBeCloseTo(0);
    expect(result.parts?.hat?.opacity).toBeCloseTo(0);
  });

  it('modelTransitionSpec.interpolate returns undefined parts/body overrides when none provided', () => {
    const from: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
    };
    const to: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
    };
    const result = modelTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    expect(result.bodyPartOverrides).toBeUndefined();
    expect(result.parts).toBeUndefined();
  });

  it('modelTransitionSpec.enter applies next-only parts and subparts', () => {
    const to: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        cape: {
          id: 'cape',
          anchor: 'back',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          opacity: 1,
          subparts: { Trim: { id: 'Trim', opacity: 1, enabled: true } },
        },
      },
    };
    const result = modelTransitionSpec.enter(to, makeT({ tEnter: 0.5 }));
    expect(result.parts?.cape?.opacity).toBeGreaterThan(0);
    expect(result.parts?.cape?.subparts?.Trim?.enabled).toBe(true);
  });

  it('modelTransitionSpec.enter applies next-only bodyPartOverrides', () => {
    const to: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      bodyPartOverrides: {
        Head: { opacity: 1, color: '#ffffff', pose: { rotate: { yawPct: 1 } } },
      },
    };
    const result = modelTransitionSpec.enter(to, makeT({ tEnter: 0.5 }));
    expect(result.bodyPartOverrides?.Head?.opacity).toBeGreaterThan(0);
    expect(result.bodyPartOverrides?.Head?.pose?.rotate?.yawPct).toBeCloseTo(0.5);
  });

  it('modelTransitionSpec.interpolate fades prev-only subparts', () => {
    const from: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        hat: {
          id: 'hat',
          anchor: 'head',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          opacity: 1,
          subparts: {
            Brim: { id: 'Brim', opacity: 1, enabled: true },
          },
        },
      },
    };
    const to: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        hat: {
          id: 'hat',
          anchor: 'head',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          opacity: 1,
          subparts: {},
        },
      },
    };
    const result = modelTransitionSpec.interpolate(from, to, makeT({ tExit: 0.5, tFull: 0.5 }));
    expect(result.parts?.hat?.subparts?.Brim?.opacity).toBeLessThan(1);
    expect(result.parts?.hat?.subparts?.Brim?.enabled).toBe(true);
  });

  it('modelTransitionSpec.interpolate fades next-only subparts in', () => {
    const from: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        hat: {
          id: 'hat',
          anchor: 'head',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          opacity: 1,
          subparts: {},
        },
      },
    };
    const to: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        hat: {
          id: 'hat',
          anchor: 'head',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          opacity: 1,
          subparts: {
            Brim: { id: 'Brim', opacity: 1, enabled: true },
          },
        },
      },
    };
    const result = modelTransitionSpec.interpolate(from, to, makeT({ tEnter: 0.5, tFull: 0.5 }));
    expect(result.parts?.hat?.subparts?.Brim?.opacity).toBeGreaterThan(0);
  });

  it('modelTransitionSpec.enter handles next-only subparts with disabled base', () => {
    const to: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        badge: {
          id: 'badge',
          anchor: 'chest',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          subparts: {
            Emblem: { id: 'Emblem', opacity: 1, enabled: false },
          },
        },
      },
    };
    const result = modelTransitionSpec.enter(to, makeT({ tEnter: 0.5 }));
    expect(result.parts?.badge?.subparts?.Emblem?.enabled).toBe(false);
  });

  it('modelTransitionSpec.interpolate keeps disabled overrides disabled', () => {
    const from: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      bodyPartOverrides: { Hand: { opacity: 1, color: '#ffffff' } },
      parts: {
        glove: {
          id: 'glove',
          anchor: 'hand',
          enabled: false,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
          opacity: 1,
        },
      },
    };
    const to: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      bodyPartOverrides: { Hand: { opacity: 1, color: '#000000' } },
      parts: {
        glove: {
          id: 'glove',
          anchor: 'hand',
          enabled: false,
          position: [1, 0, 0],
          rotation: [0, 0, 0],
          scale: 2,
          opacity: 1,
        },
      },
    };
    const result = modelTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    expect(result.parts?.glove?.enabled).toBe(false);
  });

  it('modelTransitionSpec.interpolate uses defaults for missing part transforms', () => {
    const from: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        badge: {
          id: 'badge',
          anchor: 'chest',
          enabled: true,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
        },
      },
    };
    const to: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      parts: {
        badge: {
          id: 'badge',
          anchor: 'chest',
          enabled: true,
          position: undefined as unknown as [number, number, number],
          rotation: undefined as unknown as [number, number, number],
          scale: undefined as unknown as number,
        },
      },
    };
    const result = modelTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    expect(result.parts?.badge?.position).toEqual([0, 0, 0]);
    expect(result.parts?.badge?.rotation).toEqual([0, 0, 0]);
    expect(result.parts?.badge?.scale).toBeCloseTo(1);
  });

  it('modelTransitionSpec.enter respects target enabled state', () => {
    const model: SceneModel = {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: false,
    };
    const result = modelTransitionSpec.enter(model, makeT({ tEnter: 0.1 }));
    expect(result.enabled).toBe(false);
  });

  it('playbackTransitionSpec.interpolate keeps animation weight from previous scene', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: { enabled: true, weight: 1 },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: { enabled: true, weight: 0 },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    expect(result.animation.weight).toBeCloseTo(1);
  });

  it('playbackTransitionSpec.interpolate keeps animation enabled from previous scene', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: { enabled: true, weight: 1 },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: { enabled: true, weight: 1 },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0 }));
    expect(result.animation.enabled).toBe(true);
  });

  it('playbackTransitionSpec.interpolate defaults animation enabled to false', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: { weight: 1 },
    } as unknown as ScenePlayback;
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: { weight: 1 },
    } as unknown as ScenePlayback;
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    expect(result.animation.enabled).toBe(false);
  });

  it('playbackTransitionSpec.interpolate blends motion commands, scenes, custom animations, and pose', () => {
    const prevApply = () => [];
    const nextApply = () => [];
    const from: ScenePlayback = {
      motion: {
        commands: [{ groupId: 'a', rotate: { yawPct: 1 }, weight: 1 }],
        scenes: [{ id: 's1', start: 0, end: 1, commands: [], holdAtEnd: true }],
        customAnimations: [{ id: 'c1', enabled: true, apply: prevApply }],
        pose: { groups: { head: { rotate: { yawPct: 1 } } } },
      },
      animation: { enabled: true, weight: 1 },
    };
    const to: ScenePlayback = {
      motion: {
        commands: [{ groupId: 'b', rotate: { yawPct: 0.5 }, weight: 0.5 }],
        scenes: [
          { id: 's1', start: 1, end: 2, commands: [], holdAtEnd: false },
          { id: 's2', start: 0, end: 1, commands: [] },
        ],
        customAnimations: [
          { id: 'c1', enabled: true, apply: nextApply },
          { id: 'c2', enabled: true, apply: () => [] },
        ],
        pose: { groups: {} },
      },
      animation: { enabled: true, weight: 0 },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.25, tExit: 0.5, tEnter: 0.5 }));
    expect(result.motion.commands.length).toBe(2);
    const sceneS1 = result.motion.scenes.find((s) => s.id === 's1');
    expect(sceneS1?.holdAtEnd).toBe(true);
    const animC1 = result.motion.customAnimations?.find((a) => a.id === 'c1');
    expect(animC1?.apply).toBe(prevApply);
    const head = result.motion.pose?.groups?.head;
    expect(head?.rotate?.yawPct).toBeCloseTo(0.75);
    expect(head?.rotate?.pitchPct).toBeUndefined();
    expect(head?.rotate?.rollPct).toBeUndefined();
    expect(head?.translate).toBeUndefined();
  });

  it('playbackTransitionSpec.interpolate applies entering pose groups', () => {
    const to: ScenePlayback = {
      motion: {
        commands: [],
        scenes: [],
        customAnimations: [],
        pose: { groups: { spine: { translate: { yPct: 1 } } } },
      },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      to,
      makeT({ tFull: 0.5, tEnter: 0.5 }),
    );
    expect(result.motion.pose?.groups.spine?.translate?.yPct).toBeCloseTo(0.5);
  });

  it('playbackTransitionSpec.interpolate falls back to resolvedToPose groups', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [], pose: { groups: { spine: undefined as unknown as PoseGroup } } },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [], pose: { groups: { spine: undefined as unknown as PoseGroup } } },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    expect(Object.prototype.hasOwnProperty.call(result.motion.pose?.groups ?? {}, 'spine')).toBe(true);
    expect(result.motion.pose?.groups).toBe(to.motion.pose?.groups);
  });

  it('playbackTransitionSpec.interpolate falls back to fromPose groups on exit', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [], pose: { groups: undefined as unknown as Record<string, PoseGroup> } },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      makeT({ tExit: 0.5 }),
    );
    expect(result.motion.pose?.groups).toEqual({});
  });

  it('playbackTransitionSpec.interpolate falls back to resolvedToPose groups on enter', () => {
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [], pose: { groups: { spine: undefined as unknown as PoseGroup } } },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      to,
      makeT({ tEnter: 0.5 }),
    );
    expect(Object.prototype.hasOwnProperty.call(result.motion.pose?.groups ?? {}, 'spine')).toBe(true);
    expect(result.motion.pose?.groups).toBe(to.motion.pose?.groups);
  });

  it('playbackTransitionSpec.interpolate handles from-only pose on exit', () => {
    const from: ScenePlayback = {
      motion: {
        commands: [],
        scenes: [],
        customAnimations: [],
        pose: { groups: { spine: { translate: { yPct: 1 } } } },
      },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      makeT({ tExit: 0.5 }),
    );
    expect(result.motion.pose?.groups.spine?.translate?.yPct).toBeCloseTo(0.5);
  });

  it('playbackTransitionSpec.exit fades animation and retains motion', () => {
    const from: ScenePlayback = {
      motion: { commands: [{ groupId: 'g1' }], scenes: [{ id: 's1', start: 0, end: 1, commands: [] }] },
      animation: { enabled: true, weight: 1 },
    };
    const result = playbackTransitionSpec.exit(from, makeT({ tExit: 1 }));
    expect(result.animation.weight).toBeCloseTo(0);
    expect(result.animation.enabled).toBe(false);
    expect(result.motion.commands).toHaveLength(1);
  });

  it('playbackTransitionSpec.exit keeps animation enabled while exiting', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [] },
      animation: { enabled: true, weight: 1 },
    };
    const result = playbackTransitionSpec.exit(from, makeT({ tExit: 0.5 }));
    expect(result.animation.enabled).toBe(true);
    expect(result.animation.weight).toBeGreaterThan(0);
  });

  it('playbackTransitionSpec.exit defaults animation weight when missing', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [] },
      animation: { enabled: true },
    };
    const result = playbackTransitionSpec.exit(from, makeT({ tExit: 0.5 }));
    expect(result.animation.weight).toBeCloseTo(0.5);
  });

  it('playbackTransitionSpec.exit disables animation when enabled missing', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [] },
      animation: {},
    } as unknown as ScenePlayback;
    const result = playbackTransitionSpec.exit(from, makeT({ tExit: 0.5 }));
    expect(result.animation.enabled).toBe(false);
  });

  it('playbackTransitionSpec.enter enables animation after tEnter', () => {
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [] },
      animation: { enabled: true, weight: 1 },
    };
    const result = playbackTransitionSpec.enter(to, makeT({ tEnter: 0.2 }));
    expect(result.animation.enabled).toBe(true);
    expect(result.animation.weight).toBeGreaterThan(0);
  });

  it('playbackTransitionSpec.enter defaults weight/enable flags when missing', () => {
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [] },
      animation: {},
    } as unknown as ScenePlayback;
    const result = playbackTransitionSpec.enter(to, makeT({ tEnter: 0.5 }));
    expect(result.animation.weight).toBeCloseTo(0.5);
    expect(result.animation.enabled).toBe(false);
  });

  it('playbackTransitionSpec.interpolate handles command/scene/custom enter-exit branches', () => {
    const from: ScenePlayback = {
      motion: {
        commands: [{ groupId: 'a', rotate: { yawPct: 1 }, weight: 1 }],
        scenes: [{ id: 's1', start: 0, end: 1, commands: [] }],
        customAnimations: [{ id: 'c1', enabled: true, weight: 1, apply: () => [] }],
      },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: {
        commands: [{ groupId: 'b', translate: { xPct: 1 }, weight: 1 }],
        scenes: [{ id: 's2', start: 1, end: 2, commands: [] }],
        customAnimations: [{ id: 'c2', enabled: true, weight: 1, apply: () => [] }],
      },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      to,
      makeT({ tExit: 0.5, tEnter: 0.5, tFull: 0.5 }),
    );
    expect(result.motion.commands.some((c) => c.groupId === 'a')).toBe(true);
    expect(result.motion.commands.some((c) => c.groupId === 'b')).toBe(true);
    expect(result.motion.scenes.some((s) => s.id === 's1')).toBe(true);
    expect(result.motion.scenes.some((s) => s.id === 's2')).toBe(true);
    expect(result.motion.customAnimations?.some((a) => a.id === 'c1')).toBe(true);
    expect(result.motion.customAnimations?.some((a) => a.id === 'c2')).toBe(true);
  });

  it('playbackTransitionSpec.interpolate blends commands with same group id', () => {
    const from: ScenePlayback = {
      motion: {
        commands: [{ groupId: 'g1', rotate: { yawPct: 1 }, translate: { xPct: 1 }, weight: 1, space: 'local' }],
        scenes: [],
        customAnimations: [],
      },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: {
        commands: [{ groupId: 'g1', rotate: { yawPct: 0 }, translate: { xPct: 0 }, weight: 0, space: 'world' }],
        scenes: [],
        customAnimations: [],
      },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    const cmd = result.motion.commands.find((c) => c.groupId === 'g1');
    expect(cmd?.rotate?.yawPct).toBeCloseTo(0.5);
    expect(cmd?.translate?.xPct).toBeCloseTo(0.5);
    expect(cmd?.weight).toBeCloseTo(0.5);
    expect(cmd?.space).toBe('world');
  });

  it('playbackTransitionSpec.interpolate uses prev space when next space is missing', () => {
    const from: ScenePlayback = {
      motion: {
        commands: [{ groupId: 'g1', rotate: { yawPct: 1 }, weight: 1, space: 'local' }],
        scenes: [],
        customAnimations: [],
      },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: {
        commands: [{ groupId: 'g1', rotate: { yawPct: 0 }, weight: 0 }],
        scenes: [],
        customAnimations: [],
      },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    const cmd = result.motion.commands.find((c) => c.groupId === 'g1');
    expect(cmd?.space).toBe('local');
  });

  it('playbackTransitionSpec.interpolate blends pose groups when both sides provided', () => {
    const from: ScenePlayback = {
      motion: {
        commands: [],
        scenes: [],
        customAnimations: [],
        pose: { groups: { spine: { translate: { yPct: 1 } } } },
      },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: {
        commands: [],
        scenes: [],
        customAnimations: [],
        pose: { groups: { spine: { translate: { yPct: 0 } } } },
      },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    expect(result.motion.pose?.groups.spine?.translate?.yPct).toBeCloseTo(0.5);
  });

  it('playbackTransitionSpec.interpolate drops prev commands when tExit >= 1', () => {
    const from: ScenePlayback = {
      motion: { commands: [{ groupId: 'a' }], scenes: [], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      makeT({ tExit: 1 }),
    );
    expect(result.motion.commands).toHaveLength(0);
  });

  it('playbackTransitionSpec.interpolate returns empty commands when both are missing', () => {
    const from: ScenePlayback = {
      motion: { commands: undefined as unknown as MotionCommand[], scenes: [] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: undefined as unknown as MotionCommand[], scenes: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT());
    expect(result.motion.commands).toEqual([]);
  });

  it('playbackTransitionSpec.interpolate handles missing to commands', () => {
    const from: ScenePlayback = {
      motion: { commands: [{ groupId: 'a' }], scenes: [] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: undefined as unknown as MotionCommand[], scenes: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tExit: 0.5 }));
    expect(result.motion.commands).toHaveLength(1);
  });

  it('playbackTransitionSpec.interpolate handles missing from commands', () => {
    const from: ScenePlayback = {
      motion: { commands: undefined as unknown as MotionCommand[], scenes: [] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [{ groupId: 'b' }], scenes: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tEnter: 0.5 }));
    expect(result.motion.commands).toHaveLength(1);
  });

  it('playbackTransitionSpec.interpolate defaults exiting command weight', () => {
    const from: ScenePlayback = {
      motion: { commands: [{ groupId: 'a' }], scenes: [], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      makeT({ tExit: 0.5 }),
    );
    expect(result.motion.commands[0]?.weight).toBeCloseTo(0.5);
  });

  it('playbackTransitionSpec.interpolate defaults matched command weights', () => {
    const from: ScenePlayback = {
      motion: { commands: [{ groupId: 'g' }], scenes: [] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [{ groupId: 'g' }], scenes: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    expect(result.motion.commands[0]?.weight).toBeCloseTo(1);
  });

  it('playbackTransitionSpec.interpolate skips next commands when tEnter <= 0', () => {
    const to: ScenePlayback = {
      motion: { commands: [{ groupId: 'b' }], scenes: [], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      to,
      makeT({ tEnter: 0 }),
    );
    expect(result.motion.commands).toHaveLength(0);
  });

  it('playbackTransitionSpec.interpolate defaults entering command weight', () => {
    const to: ScenePlayback = {
      motion: { commands: [{ groupId: 'b' }], scenes: [], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      to,
      makeT({ tEnter: 0.5 }),
    );
    expect(result.motion.commands[0]?.weight).toBeCloseTo(0.5);
  });

  it('playbackTransitionSpec.interpolate picks next scene and ease after midpoint', () => {
    const easeA = (t: number) => t;
    const easeB = (t: number) => t * t;
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's', start: 0, end: 1, commands: [], ease: easeA, holdAtEnd: true }], customAnimations: [] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's', start: 1, end: 2, commands: [], ease: easeB, holdAtEnd: false }], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.75 }));
    const scene = result.motion.scenes.find((s) => s.id === 's');
    expect(scene?.ease).toBe(easeB);
    expect(scene?.holdAtEnd).toBe(false);
  });

  it('playbackTransitionSpec.interpolate keeps prev ease before midpoint', () => {
    const easeA = (t: number) => t;
    const easeB = (t: number) => t * t;
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's', start: 0, end: 1, commands: [], ease: easeA, holdAtEnd: true }], customAnimations: [] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's', start: 1, end: 2, commands: [], ease: easeB, holdAtEnd: false }], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.25 }));
    const scene = result.motion.scenes.find((s) => s.id === 's');
    expect(scene?.ease).toBe(easeA);
    expect(scene?.holdAtEnd).toBe(true);
  });

  it('playbackTransitionSpec.interpolate switches custom animation apply after midpoint', () => {
    const prevApply = () => [];
    const nextApply = () => [];
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c1', enabled: true, weight: 1, apply: prevApply }] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c1', enabled: true, weight: 1, apply: nextApply }] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.75 }));
    const anim = result.motion.customAnimations?.find((a) => a.id === 'c1');
    expect(anim?.apply).toBe(nextApply);
  });

  it('playbackTransitionSpec.interpolate drops prev custom animation when tExit >= 1', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c1', enabled: true, weight: 1, apply: () => [] }] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [], customAnimations: [] }, animation: { enabled: false } },
      makeT({ tExit: 1 }),
    );
    expect(result.motion.customAnimations).toHaveLength(0);
  });

  it('playbackTransitionSpec.interpolate omits prev scenes when tExit >= 1', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's1', start: 0, end: 1, commands: [] }], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      makeT({ tExit: 1 }),
    );
    expect(result.motion.scenes).toHaveLength(0);
  });

  it('playbackTransitionSpec.interpolate keeps prev scenes when tExit < 1', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's1', start: 0, end: 1, commands: [] }], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      makeT({ tExit: 0.5 }),
    );
    expect(result.motion.scenes).toHaveLength(1);
  });

  it('playbackTransitionSpec.interpolate skips next scenes when tEnter <= 0', () => {
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's2', start: 0, end: 1, commands: [] }], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      to,
      makeT({ tEnter: 0 }),
    );
    expect(result.motion.scenes).toHaveLength(0);
  });

  it('playbackTransitionSpec.interpolate includes next scenes when tEnter > 0', () => {
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's2', start: 0, end: 1, commands: [] }], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      to,
      makeT({ tEnter: 0.5 }),
    );
    expect(result.motion.scenes).toHaveLength(1);
  });

  it('playbackTransitionSpec.interpolate returns empty scenes when both are missing', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: undefined as unknown as MotionScene[] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: undefined as unknown as MotionScene[] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT());
    expect(result.motion.scenes).toEqual([]);
  });

  it('playbackTransitionSpec.interpolate handles missing to scenes', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's1', start: 0, end: 1, commands: [] }], customAnimations: [] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: undefined as unknown as MotionScene[] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tExit: 0.5 }));
    expect(result.motion.scenes).toHaveLength(1);
  });

  it('playbackTransitionSpec.interpolate handles missing from scenes', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: undefined as unknown as MotionScene[] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [{ id: 's2', start: 0, end: 1, commands: [] }], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tEnter: 0.5 }));
    expect(result.motion.scenes).toHaveLength(1);
  });

  it('playbackTransitionSpec.interpolate falls back to prev scene commands when missing', () => {
    const prevScene: MotionScene = { id: 's1', start: 0, end: 1, commands: [{ groupId: 'g1' }] };
    const nextScene: MotionScene = {
      id: 's1',
      start: 0,
      end: 1,
      commands: undefined as unknown as MotionScene['commands'],
    };
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [prevScene], customAnimations: [] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [nextScene], customAnimations: [] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(from, to, makeT({ tFull: 0.5 }));
    const blended = result.motion.scenes.find((scene) => scene.id === 's1');
    expect(blended?.commands).toBe(prevScene.commands);
  });

  it('playbackTransitionSpec.interpolate handles custom animation enter/exit branches', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c1', enabled: true, weight: 1, apply: () => [] }] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c2', enabled: true, weight: 1, apply: () => [] }] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      to,
      makeT({ tExit: 0.5, tEnter: 0.5, tFull: 0.5 }),
    );
    expect(result.motion.customAnimations?.some((a) => a.id === 'c1')).toBe(true);
    expect(result.motion.customAnimations?.some((a) => a.id === 'c2')).toBe(true);
  });

  it('playbackTransitionSpec.interpolate defaults exiting custom animation enabled', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c1', weight: 1, apply: () => [] } as unknown as CustomAnimation] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [], customAnimations: [] }, animation: { enabled: false } },
      makeT({ tExit: 0.5, tFull: 0.5 }),
    );
    expect(result.motion.customAnimations).toHaveLength(1);
    expect(result.motion.customAnimations?.[0]?.enabled).toBe(false);
  });

  it('playbackTransitionSpec.interpolate defaults entering custom animation values', () => {
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c2', apply: () => [] } as unknown as CustomAnimation] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      to,
      makeT({ tEnter: 0.5, tFull: 0.5 }),
    );
    expect(result.motion.customAnimations).toHaveLength(1);
    expect(result.motion.customAnimations?.[0]?.weight).toBeCloseTo(0.5);
    expect(result.motion.customAnimations?.[0]?.enabled).toBe(false);
  });

  it('playbackTransitionSpec.interpolate falls back to prev enabled for matching custom animation', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c1', enabled: true, apply: () => [] }] },
      animation: { enabled: false },
    };
    const to: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c1', apply: () => [] } as unknown as CustomAnimation] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      to,
      makeT({ tFull: 0.5 }),
    );
    const blended = result.motion.customAnimations?.find((anim) => anim.id === 'c1');
    expect(blended?.enabled).toBe(true);
  });

  it('playbackTransitionSpec.interpolate defaults exiting custom animation weight', () => {
    const from: ScenePlayback = {
      motion: { commands: [], scenes: [], customAnimations: [{ id: 'c1', enabled: true, apply: () => [] }] },
      animation: { enabled: false },
    };
    const result = playbackTransitionSpec.interpolate(
      from,
      { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      makeT({ tExit: 0.5 }),
    );
    const exiting = result.motion.customAnimations?.find((anim) => anim.id === 'c1');
    expect(exiting?.weight).toBeCloseTo(0.5);
  });

  it('applyModelExit disables at t=1', () => {
    const from: SceneModelInstanceState = {
      model: { scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true },
      playback: { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      enabled: true,
    };
    const result = applyModelExit(from, 1);
    expect(result.enabled).toBe(false);
  });

  it('applyModelEnter enables when t>0', () => {
    const to: SceneModelInstanceState = {
      model: { scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true },
      playback: { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      enabled: undefined,
    };
    const result = applyModelEnter(to, 0.5);
    expect(result.enabled).toBe(true);
  });

  it('applyModelInterpolate respects explicit disabled', () => {
    const from: SceneModelInstanceState = {
      model: { scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true },
      playback: { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      enabled: true,
    };
    const to: SceneModelInstanceState = {
      model: { scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true },
      playback: { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
      enabled: false,
    };
    const result = applyModelInterpolate(from, to, 0.5);
    expect(result.enabled).toBe(false);
  });
});
