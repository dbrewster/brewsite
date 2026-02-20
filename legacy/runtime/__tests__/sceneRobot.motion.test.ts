import {describe, expect, it} from 'vitest';
import {createSceneTimeline} from '../../robotTimeline';
import {clamp01, rangeProgress} from '../../robotTimelineMath';
import type {SceneFrameContext} from '../../model/sceneState';
import type {SceneFrame} from '../../model/robotSceneTypes';
import {ModelRenderer} from '../../elements/model/ModelRenderer';
import {MockNode, MockWorld} from '../mocks/MockWorld';
import {MockModel} from '../mocks/MockModel';
import {MockMotionSystem} from '../mocks/MockMotionSystem';
import {MockAnimationPlayer} from '../mocks/MockAnimationPlayer';
import {buildMockMotionRig} from '../mocks/MockMotionRig';
import {createBaseSceneState, mergeSceneState} from '../../runtime/compiler/sceneDefaults';
import {TEST_BASE_MOTION_COMMANDS, testSceneGroup} from './fixtures/testSceneFixtures';
import type {RobotMotionScene} from '../../model/robotMotionTypes';
import type {SceneDefinition} from '../../runtime/compiler/sceneTypes';
import {resolveMotionCommands} from '../../model/motionState';
import {ROBOT_GROUP_LIMITS} from '../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import {resolveClipRangeSeconds} from '../../elements/model/compile';
import type {CompiledAnimation, SceneTrackTick} from '../../runtime/compiler/sceneTrackTypes';

const modelId = 'model-a';

const buildWorldWithRobotGroups = () => {
  const world = new MockWorld('WorldRoot');
  const root = new MockNode('RobotRoot');
  world.addNode(root);
  const groupIds = [
    'robot',
    'torso',
    'shoulder__left',
    'shoulder__right',
    'left_arm',
    'right_arm',
    'left_fingers',
    'right_fingers',
  ];
  groupIds.forEach((id) => world.addNode(new MockNode(id), root.name));
  return world;
};

const ROBOT_SCROLL_SCENES: RobotMotionScene[] = [];

const buildContext = (progress: number, start: number, end: number): SceneFrameContext => {
  const sceneTimeline = createSceneTimeline(testSceneGroup.timeline, start, end);
  const sceneProgress = clamp01(rangeProgress(progress, start, end));
  return {
    progress: sceneProgress,
    sceneProgress,
    globalProgress: progress,
    sceneStart: start,
    sceneEnd: end,
    assetsReady: true,
    timeline: sceneTimeline,
    baseState: undefined,
  };
};

const buildRuntime = () => {
  const world = buildWorldWithRobotGroups();
  const model = new MockModel('RobotRoot', world);
  const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
  const animationPlayer = new MockAnimationPlayer();
  animationPlayer.load([
    {
      targetName: 'robot',
      property: 'rotation',
      keyframes: [
        { t: 0, value: [0, 0.3, 0] },
        { t: 4, value: [0, 1, 0] },
      ],
    },
    {
      targetName: 'left_fingers',
      property: 'rotation',
      keyframes: [
        { t: 0, value: [0, -0.2, 0] },
        { t: 4, value: [0, 0.5, 0] },
      ],
    },
  ]);
  const runtime = new ModelRenderer({
    world,
    model,
    motionSystem,
    animationPlayer,
    modelId,
  });
  runtime.setPrefersReducedMotion(false);
  runtime.setDeterministicTime(true);
  return { runtime, world };
};

const getRotation = (world: MockWorld, name: string) => {
  const node = world.getNode(name);
  if (!node) throw new Error(`Missing node: ${name}`);
  return [...node.localRotation] as [number, number, number];
};

const buildTick = (scene: SceneFrame): SceneTrackTick => {
  return {
    index: 0,
    progress: 0,
    sceneId: scene.id ?? 'scene',
    sceneIndex: 0,
    sceneProgress: scene.scrollProgress,
    state: scene,
    deltaForward: {
      models: scene.models?.[modelId] ? { [modelId]: { model: scene.models?.[modelId]?.model } } : undefined,
    },
    deltaBackward: {
      models: scene.models?.[modelId] ? { [modelId]: { model: scene.models?.[modelId]?.model } } : undefined,
    },
  };
};

/**
 * Applies a scene as an explicit full-update tick, then runs the wall-time phase.
 * Uses resetAnimationState() to force mode='full' regardless of previous tick index.
 */
const applyScene = (
  runtime: ModelRenderer,
  scene: SceneFrame,
  deltaSeconds: number,
  globalProgress: number,
  compiledAnimation?: CompiledAnimation,
) => {
  runtime.resetAnimationState();
  runtime.apply(buildTick(scene), { deltaSeconds, globalProgress, compiledAnimation });
};

const expectWithin = (value: number, expected: number, epsilon: number) => {
  expect(Math.abs(value - expected)).toBeLessThan(epsilon);
};

const DEG_TO_RAD = Math.PI / 180;

const computeExpectedYaw = (commands: { groupId: string; rotate?: { yawPct?: number }; weight?: number }[], groupId: string) => {
  const limits = ROBOT_GROUP_LIMITS[groupId];
  if (!limits) return 0;
  let yaw = 0;
  for (const command of commands) {
    if (command.groupId !== groupId) continue;
    const weight = command.weight ?? 1;
    const yawPct = command.rotate?.yawPct ?? 0;
    yaw += yawPct * limits.yaw * weight * DEG_TO_RAD;
  }
  return yaw;
};

const buildMotionCommands = (sceneProgress: number, timeSeconds: number) => {
  const shoulderTurn = rangeProgress(sceneProgress, 0, 1);
  const motionCommands = shoulderTurn
    ? [
        ...TEST_BASE_MOTION_COMMANDS,
        { groupId: 'shoulder__left', rotate: { yawPct: 0.2 * shoulderTurn } },
        { groupId: 'shoulder__right', rotate: { yawPct: -0.2 * shoulderTurn } },
        { groupId: 'torso', rotate: { yawPct: -0.4 * shoulderTurn } },
      ]
    : TEST_BASE_MOTION_COMMANDS;

  const scrollCommands = resolveMotionCommands({
    scrollScenes: [
      ...ROBOT_SCROLL_SCENES,
      {
        id: 'time-wobble',
        start: 0,
        end: 1,
        holdAtEnd: true,
        commands: (t, seconds) => [
          { groupId: 'left_fingers', rotate: { yawPct: 0.1 * Math.sin(seconds) }, weight: t },
        ],
      },
      {
        id: 'arm-sway',
        start: 0,
        end: 1,
        holdAtEnd: true,
        commands: (t, seconds) => [
          { groupId: 'left_arm', rotate: { yawPct: 0.12 * Math.cos(seconds) }, weight: t },
          { groupId: 'right_arm', rotate: { yawPct: -0.12 * Math.cos(seconds) }, weight: t },
        ],
      },
    ],
    scrollProgress: sceneProgress,
    timeSeconds,
  });

  return scrollCommands.length ? [...scrollCommands, ...motionCommands] : motionCommands;
};

const sceneRobotInline: SceneDefinition = {
  id: 'robot',
  index: 1,
  getFrame: (context) => {
    const { progress, timeline } = context;
    const base = createBaseSceneState(context);
    const shoulderTurn = rangeProgress(progress, timeline.tick(0), timeline.tick(10));
    const motionCommands = shoulderTurn
      ? [
        ...TEST_BASE_MOTION_COMMANDS,
          { groupId: 'shoulder__left', rotate: { yawPct: 0.2 * shoulderTurn } },
          { groupId: 'shoulder__right', rotate: { yawPct: -0.2 * shoulderTurn } },
          { groupId: 'torso', rotate: { yawPct: -0.4 * shoulderTurn } },
        ]
    : TEST_BASE_MOTION_COMMANDS;

    return mergeSceneState(base, {
      id: 'robot',
      isLightScene: true,
      models: {
        [modelId]: {
          model: {
            bodyPartOverrides: {
              head: { opacity: 0.6 },
              eyes: { color: '#999', metalness: 0, roughness: 0.9, opacity: 1 },
            },
            parts: {
              attachment: {
                enabled: false,
              },
              brain: {
                enabled: true,
                opacity: 0.55,
              },
            },
          },
          playback: {
            motion: {
              commands: motionCommands,
              scenes: [
                ...ROBOT_SCROLL_SCENES,
                {
                  id: 'time-wobble',
                  start: 0,
                  end: 1,
                  holdAtEnd: true,
                  commands: (t, seconds) => [
                    { groupId: 'left_fingers', rotate: { yawPct: 0.1 * Math.sin(seconds) }, weight: t },
                  ],
                },
                {
                  id: 'arm-sway',
                  start: 0,
                  end: 1,
                  holdAtEnd: true,
                  commands: (t, seconds) => [
                    { groupId: 'left_arm', rotate: { yawPct: 0.12 * Math.cos(seconds) }, weight: t },
                    { groupId: 'right_arm', rotate: { yawPct: -0.12 * Math.cos(seconds) }, weight: t },
                  ],
                },
              ],
              customAnimations: [],
            },
            animation: {
              enabled: false,
            },
          },
        },
      },
    });
  },
};

const sceneDetailInline: SceneDefinition = {
  id: 'detail',
  index: 2,
  getFrame: (context) => {
    const base = createBaseSceneState(context);
    return mergeSceneState(base, {
      id: 'detail',
      isLightScene: true,
      models: {
        [modelId]: {
          playback: {
            motion: {
              commands: [],
              scenes: [],
              customAnimations: [],
            },
            animation: {
              enabled: true,
              gltfUrl: '/assets/Waving/elevator_greeting_m.anim.retarget.glb',
              gltfClipName: 'retargeted_action',
              fadeInSeconds: 1,
              clipStart: 0,
              clipEnd: 4,
              clipRepeat: false,
            },
          },
        },
      },
    });
  },
};

describe('sceneRobot motion frame', () => {
  it('applies shoulder/torso turn based on scene progress', () => {
    const { runtime, world } = buildRuntime();
    const start = testSceneGroup.timeline.tick(1);
    const end = testSceneGroup.timeline.tick(2);

    const startFrame = sceneRobotInline.getFrame(buildContext(start, start, end));
    applyScene(runtime, startFrame, 0.016, start);
    const torsoStart = getRotation(world, 'torso');
    const leftStart = getRotation(world, 'shoulder__left');
    const rightStart = getRotation(world, 'shoulder__right');
    const robotStart = getRotation(world, 'robot');
    const fingersStart = getRotation(world, 'left_fingers');
    const leftArmStart = getRotation(world, 'left_arm');
    const rightArmStart = getRotation(world, 'right_arm');

    const startSceneProgress = clamp01(rangeProgress(start, start, end));
    const startCommands = buildMotionCommands(startSceneProgress, start * 10);

    expect(torsoStart[1]).toBeCloseTo(computeExpectedYaw(startCommands, 'torso'), 4);
    expect(leftStart[1]).toBeCloseTo(computeExpectedYaw(startCommands, 'shoulder__left'), 4);
    expect(rightStart[1]).toBeCloseTo(computeExpectedYaw(startCommands, 'shoulder__right'), 4);
    expect(robotStart[1]).toBeCloseTo(computeExpectedYaw(startCommands, 'robot'), 4);
    expect(fingersStart[1]).toBeCloseTo(computeExpectedYaw(startCommands, 'left_fingers'), 4);
    expect(leftArmStart[1]).toBeCloseTo(computeExpectedYaw(startCommands, 'left_arm'), 4);
    expect(rightArmStart[1]).toBeCloseTo(computeExpectedYaw(startCommands, 'right_arm'), 4);

    const midProgress = start + (end - start) * 0.6;
    const midFrame = sceneRobotInline.getFrame(buildContext(midProgress, start, end));
    applyScene(runtime, midFrame, 0.016, midProgress);
    const torsoMid = getRotation(world, 'torso');
    const leftMid = getRotation(world, 'shoulder__left');
    const rightMid = getRotation(world, 'shoulder__right');
    const fingersMid = getRotation(world, 'left_fingers');
    const leftArmMid = getRotation(world, 'left_arm');
    const rightArmMid = getRotation(world, 'right_arm');

    const midSceneProgress = clamp01(rangeProgress(midProgress, start, end));
    const midCommands = buildMotionCommands(midSceneProgress, midProgress * 10);
    expect(leftMid[1]).toBeCloseTo(computeExpectedYaw(midCommands, 'shoulder__left'), 4);
    expect(rightMid[1]).toBeCloseTo(computeExpectedYaw(midCommands, 'shoulder__right'), 4);
    expect(torsoMid[1]).toBeCloseTo(computeExpectedYaw(midCommands, 'torso'), 4);
    expect(fingersMid[1]).toBeCloseTo(computeExpectedYaw(midCommands, 'left_fingers'), 4);
    expect(leftArmMid[1]).toBeCloseTo(computeExpectedYaw(midCommands, 'left_arm'), 4);
    expect(rightArmMid[1]).toBeCloseTo(computeExpectedYaw(midCommands, 'right_arm'), 4);

    const endFrame = sceneRobotInline.getFrame(buildContext(end, start, end));
    const motionTimeSeconds = 0;
    applyScene(runtime, endFrame, 0.016, 0);
    const torsoEnd = getRotation(world, 'torso');
    const leftEnd = getRotation(world, 'shoulder__left');
    const rightEnd = getRotation(world, 'shoulder__right');
    const fingersEnd = getRotation(world, 'left_fingers');
    const leftArmEnd = getRotation(world, 'left_arm');
    const rightArmEnd = getRotation(world, 'right_arm');

    const endSceneProgress = clamp01(rangeProgress(end, start, end));
    const endCommands = buildMotionCommands(endSceneProgress, motionTimeSeconds);
    expect(leftEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'shoulder__left'), 4);
    expect(rightEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'shoulder__right'), 4);
    expect(torsoEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'torso'), 4);
    expect(fingersEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'left_fingers'), 4);
    expect(leftArmEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'left_arm'), 4);
    expect(rightArmEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'right_arm'), 4);
  });

  it('applies animation pose immediately without blending', () => {
    const { runtime, world } = buildRuntime();
    const start = testSceneGroup.timeline.tick(1);
    const end = testSceneGroup.timeline.tick(2);
    runtime.setDeterministicTime(false);

    const endFrame = sceneRobotInline.getFrame(buildContext(end, start, end));
    const motionTimeSeconds = 0;
    applyScene(runtime, endFrame, 0.016, 0);
    const torsoEnd = getRotation(world, 'torso');
    const leftEnd = getRotation(world, 'shoulder__left');
    const rightEnd = getRotation(world, 'shoulder__right');
    const endSceneProgress = clamp01(rangeProgress(end, start, end));
    const endCommands = buildMotionCommands(endSceneProgress, motionTimeSeconds);
    expect(leftEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'shoulder__left'), 4);
    expect(rightEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'shoulder__right'), 4);
    expect(torsoEnd[1]).toBeCloseTo(computeExpectedYaw(endCommands, 'torso'), 4);

    const detailStart = end;
    const detailEnd = testSceneGroup.timeline.tick(3);
    const detailProgress = detailStart;
    const detailFrame = sceneDetailInline.getFrame(buildContext(detailProgress, detailStart, detailEnd));
    const detailPlayback = detailFrame.models?.[modelId]?.playback;
    if (!detailPlayback) throw new Error('Missing playback');
    const detailRange = resolveClipRangeSeconds(detailPlayback.animation, 4);
    const compiledAnimation: CompiledAnimation = {
      enabled: true,
      clipName: 'retargeted_action',
      clipDuration: 4,
      range: detailRange,
    };

    // First apply: full update, animation at t=0
    applyScene(runtime, detailFrame, 0, detailProgress, compiledAnimation);

    const robotAnim = getRotation(world, 'robot');
    const fingersAnim = getRotation(world, 'left_fingers');
    expectWithin(robotAnim[1], 0.3, 1e-3);
    expectWithin(fingersAnim[1], -0.2, 1e-3);

    // Second apply: same tick index, mode='none' — only wall-time advances
    runtime.apply(buildTick(detailFrame), { deltaSeconds: 4, globalProgress: detailProgress, compiledAnimation });
    const endAnimRobot = getRotation(world, 'robot');
    const endAnimFingers = getRotation(world, 'left_fingers');
    expect(endAnimRobot[1]).toBeCloseTo(1, 4);
    expect(endAnimFingers[1]).toBeCloseTo(0.5, 4);
  });
});
