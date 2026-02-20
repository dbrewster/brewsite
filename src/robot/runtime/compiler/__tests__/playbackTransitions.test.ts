import {describe, expect, it} from 'vitest';
import {playbackTransitionSpec} from '../transitions/playbackTransitions';
import type {CustomAnimation, RobotMotionCommand, RobotMotionScene, RobotPoseGroup, ScenePlayback} from '../../../model/robotSceneTypes';
import {buildContext, expectNumberClose} from './transitionTestUtils';

const sampleCommand = (id: string): RobotMotionCommand => ({
  groupId: id,
  rotate: { yawPct: 1, pitchPct: 2, rollPct: 3 },
  translate: { xPct: 1, yPct: 2, zPct: 3 },
  weight: 1,
  space: 'local',
});

const sampleScene = (id: string): RobotMotionScene => ({
  id,
  start: 0,
  end: 1,
  commands: [sampleCommand(id)],
  holdAtEnd: false,
});

const sampleAnimation = (id: string): CustomAnimation => ({
  id,
  enabled: true,
  layer: 'base',
  weight: 1,
  apply: () => [],
});

const samplePoseGroup = (x: number): RobotPoseGroup => ({
  rotate: { yawPct: x },
  translate: { xPct: x },
  space: 'local',
});

const playback = (weight: number, overrides: Partial<ScenePlayback> = {}): ScenePlayback => ({
  motion: {
    commands: [],
    scenes: [],
    customAnimations: [],
    pose: { mode: 'override', groups: {} },
  },
  animation: { enabled: true, weight },
  ...overrides,
});

describe('playback transitions', () => {
  it('blends animation weight across', () => {
    const context = buildContext({ tFull: 0.5 });
    const from = playback(0);
    const to = playback(1);
    const result = playbackTransitionSpec.interpolate(from, to, context);
    expectNumberClose(result.animation.weight, 0.5);
  });

  it('transitions out animation weight and disables at exit end', () => {
    const resultMid = playbackTransitionSpec.exit(playback(1), buildContext({ tExit: 0.5 }));
    const resultEnd = playbackTransitionSpec.exit(playback(1), buildContext({ tExit: 1 }));
    expectNumberClose(resultMid.animation.weight, 0.5);
    expect(resultMid.animation.enabled).toBe(true);
    expectNumberClose(resultEnd.animation.weight, 0);
    expect(resultEnd.animation.enabled).toBe(false);
  });

  it('transitions in animation weight and enables after enter start', () => {
    const resultStart = playbackTransitionSpec.enter(playback(1), buildContext({ tEnter: 0 }));
    const resultMid = playbackTransitionSpec.enter(playback(1), buildContext({ tEnter: 0.5 }));
    expectNumberClose(resultStart.animation.weight, 0);
    expect(resultStart.animation.enabled).toBe(false);
    expectNumberClose(resultMid.animation.weight, 0.5);
    expect(resultMid.animation.enabled).toBe(true);
  });

  it('blends pose groups across', () => {
    const from = playback(1, { motion: { commands: [], scenes: [], pose: { mode: 'override', groups: { arm: samplePoseGroup(0) } } } });
    const to = playback(1, { motion: { commands: [], scenes: [], pose: { mode: 'override', groups: { arm: samplePoseGroup(1) } } } });
    const result = playbackTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    const arm = result.motion.pose?.groups.arm;
    expectNumberClose(arm?.rotate?.yawPct, 0.5);
    expectNumberClose(arm?.translate?.xPct, 0.5);
  });

  it('does not introduce pose groups before enterStart when only the next scene defines them', () => {
    const from = playback(1, { motion: { commands: [], scenes: [], pose: undefined } });
    const to = playback(1, { motion: { commands: [], scenes: [], pose: { mode: 'override', groups: { arm: samplePoseGroup(1) } } } });
    const result = playbackTransitionSpec.interpolate(from, to, buildContext({ tEnter: 0, tFull: 0.25 }));
    expect(Object.keys(result.motion.pose?.groups ?? {})).toHaveLength(0);
  });

  it('introduces pose groups during enter range when only the next scene defines them', () => {
    const from = playback(1, { motion: { commands: [], scenes: [], pose: undefined } });
    const to = playback(1, { motion: { commands: [], scenes: [], pose: { mode: 'override', groups: { arm: samplePoseGroup(1) } } } });
    const result = playbackTransitionSpec.interpolate(from, to, buildContext({ tEnter: 0.5, tFull: 0.75 }));
    const arm = result.motion.pose?.groups.arm;
    expectNumberClose(arm?.rotate?.yawPct, 0.5);
  });

  it('treats differing motion scene ids as out/in (no blend)', () => {
    const from = playback(1, { motion: { commands: [], scenes: [sampleScene('old')], pose: { mode: 'override', groups: {} } } });
    const to = playback(1, { motion: { commands: [], scenes: [sampleScene('new')], pose: { mode: 'override', groups: {} } } });
    const result = playbackTransitionSpec.interpolate(from, to, buildContext({ tExit: 0.5, tEnter: 0.5, tFull: 0.5 }));
    expect(result.motion.scenes).toHaveLength(2);
  });

  it('treats differing custom animation ids as out/in (no blend)', () => {
    const from = playback(1, { motion: { commands: [], scenes: [], customAnimations: [sampleAnimation('old')], pose: { mode: 'override', groups: {} } } });
    const to = playback(1, { motion: { commands: [], scenes: [], customAnimations: [sampleAnimation('new')], pose: { mode: 'override', groups: {} } } });
    const result = playbackTransitionSpec.interpolate(from, to, buildContext({ tExit: 0.5, tEnter: 0.5, tFull: 0.5 }));
    expect(result.motion.customAnimations).toHaveLength(2);
  });

  it('blends motion command transforms and weight across', () => {
    const from = playback(1, { motion: { commands: [sampleCommand('arm')], scenes: [], pose: { mode: 'override', groups: {} } } });
    const to = playback(1, { motion: { commands: [{ ...sampleCommand('arm'), rotate: { yawPct: 0 }, translate: { xPct: 0 }, weight: 0 }], scenes: [], pose: { mode: 'override', groups: {} } } });
    const result = playbackTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    const cmd = result.motion.commands[0];
    expectNumberClose(cmd.rotate?.yawPct, 0.5);
    expectNumberClose(cmd.translate?.xPct, 0.5);
    expectNumberClose(cmd.weight, 0.5);
  });

  it('blends motion scene ranges across', () => {
    const fromScene = { ...sampleScene('range'), start: 0, end: 1 };
    const toScene = { ...sampleScene('range'), start: 1, end: 3 };
    const from = playback(1, { motion: { commands: [], scenes: [fromScene], pose: { mode: 'override', groups: {} } } });
    const to = playback(1, { motion: { commands: [], scenes: [toScene], pose: { mode: 'override', groups: {} } } });
    const result = playbackTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    const scene = result.motion.scenes[0];
    expectNumberClose(scene.start, 0.5);
    expectNumberClose(scene.end, 2);
  });

  it('blends custom animation weights across', () => {
    const from = playback(1, { motion: { commands: [], scenes: [], customAnimations: [{ ...sampleAnimation('custom'), weight: 0 }], pose: { mode: 'override', groups: {} } } });
    const to = playback(1, { motion: { commands: [], scenes: [], customAnimations: [{ ...sampleAnimation('custom'), weight: 1 }], pose: { mode: 'override', groups: {} } } });
    const result = playbackTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectNumberClose(result.motion.customAnimations?.[0]?.weight, 0.5);
  });
});
