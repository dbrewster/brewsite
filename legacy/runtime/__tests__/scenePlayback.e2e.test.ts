import {describe, expect, it, vi} from 'vitest';
import {RuntimeDriverImpl} from '../RuntimeDriver';
import {MockNode, MockWorld} from '../mocks/MockWorld';
import {MockModel} from '../mocks/MockModel';
import {MockAnimationPlayer} from '../mocks/MockAnimationPlayer';
import {MockMotionSystem} from '../mocks/MockMotionSystem';
import {buildMockMotionRig} from '../mocks/MockMotionRig';
import {ROBOT_GROUP_LIMITS} from '../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import {ROBOT_REST_RIG_TARGETS, ROBOT_SKELETON} from '../../../components/logoParticleOptimizedViewer/robotRig';
import {MODEL_BONE_NAME_MAP} from '../../../components/logoParticleOptimizedViewer/robotStructureTypes';
import {createSceneTimeline} from '../../robotTimeline';
import {clamp01, rangeProgress} from '../../robotTimelineMath';
import {testDetailScene, testRobotScene, testSceneGroup} from './fixtures/testSceneFixtures';
import type {SceneFrameContext} from '../compiler/sceneTypes';
import {resolveClipRangeSeconds} from '../../elements/model/index';
import type {CompiledAnimation, SceneTrack, SceneTrackTick} from '../compiler/sceneTrackTypes';
import type {SceneBackground, SceneEnvironment, SceneFrame, SceneLighting, SceneRibbon} from '../../model/robotSceneTypes';
import {compileSceneTrack} from '../compiler/sceneTrackCompiler';
import {Model, Scene} from '../../runtime/compiler/primitives';
import {createTestTimeline} from '../compiler/__tests__/compilerE2eUtils';
import {createElement} from 'react';
const {scenes, timeline} = testSceneGroup;

const buildWorldWithRobot = () => {
  const world = new MockWorld('WorldRoot');
  const root = new MockNode('RobotRoot');
  world.addNode(root);

  const groupIds = [
    'robot',
    'hips',
    'torso',
    'chest_anchor',
    'head',
    'neck',
    'left_arm',
    'shoulder__left',
    'right_arm',
    'shoulder__right',
    'left_forearm',
    'right_forearm',
    'left_leg',
    'right_leg',
    'left_foot',
    'right_foot',
    'hands',
    'left_thumb',
    'right_thumb',
    'left_fingers',
    'right_fingers',
    'eyes',
  ];

  groupIds.forEach((id) => world.addNode(new MockNode(id), root.name));

  const boneNames = new Set<string>([
    MODEL_BONE_NAME_MAP.Spine,
    MODEL_BONE_NAME_MAP.Spine1,
    MODEL_BONE_NAME_MAP.Spine2,
    MODEL_BONE_NAME_MAP.Head,
    ROBOT_SKELETON.objects.eyes,
    ...Object.values(ROBOT_REST_RIG_TARGETS).map((spec) => (spec as { name: string }).name),
  ]);

  boneNames.forEach((name) => world.addNode(new MockNode(name), root.name));

  return world;
};

const buildRuntime = () => {
  const world = buildWorldWithRobot();
  const model = new MockModel('RobotRoot', world);
  const brainWorld = new MockWorld('BrainWorld');
  const brainModel = new MockModel('BrainRoot', brainWorld);
  brainWorld.addNode(new MockNode('Brain_red'), brainModel.rootName);
  model.setContainedModel?.('brain', brainModel);

  const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
  const animationPlayer = new MockAnimationPlayer();
  animationPlayer.load([
    {
      targetName: 'robot',
      property: 'position',
      keyframes: [
        { t: 1.4, value: [1.4, 0, 0] },
        { t: 4, value: [4, 0, 0] },
      ],
    },
  ]);

  const driver = new RuntimeDriverImpl({
    world,
    model,
    motionSystem,
    animationPlayer,
    scenes,
    timeline,
  });
  driver.setAssetsReady(true);
  driver.setPrefersReducedMotion(false);
  driver.setAvailableClips([
    { name: 'retargeted_action', duration: 4 },
    { name: 'breathing-m', duration: 3 },
  ]);
  driver.setParticleContext({});

  return { driver, world, brainModel };
};

const resolveModelId = (scene: SceneFrame): string | undefined =>
  scene.models ? Object.keys(scene.models)[0] : undefined;

const findNode = (world: MockWorld, name: string) => {
  const node = world.getNode(name);
  if (!node) throw new Error(`Missing node: ${name}`);
  return node;
};

const captureRotation = (world: MockWorld, name: string) => {
  const node = findNode(world, name);
  return [...node.localRotation];
};

const expectRotationMatch = (a: number[], b: number[]) => {
  expect(a[0]).toBeCloseTo(b[0], 4);
  expect(a[1]).toBeCloseTo(b[1], 4);
  expect(a[2]).toBeCloseTo(b[2], 4);
};

const capturePoseMap = (world: MockWorld, names: string[]) =>
  names.map((name) => {
    const node = findNode(world, name);
    return { name, rotation: [...node.localRotation], position: [...node.localPosition] };
  });

const expectPoseMapMatch = (
  expected: Array<{ name: string; rotation: number[]; position: number[] }>,
  actual: Array<{ name: string; rotation: number[]; position: number[] }>,
) => {
  expected.forEach((item, index) => {
    const next = actual[index];
    if (!next) throw new Error(`Missing pose entry for ${item.name}`);
    expect(next.name).toBe(item.name);
    expectRotationMatch(item.rotation, next.rotation);
    expect(next.position[0]).toBeCloseTo(item.position[0], 4);
    expect(next.position[1]).toBeCloseTo(item.position[1], 4);
    expect(next.position[2]).toBeCloseTo(item.position[2], 4);
  });
};

describe('scene playback runtime', () => {
  it('applies primary model position from scene state', () => {
    const world = buildWorldWithRobot();
    const model = new MockModel('RobotRoot', world);
    const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
    const animationPlayer = new MockAnimationPlayer();
    const timeline = createTestTimeline(['scene']);
    const scene = {
      id: 'scene',
      index: 0,
      render: () =>
        createElement(
          Scene,
          { id: 'scene', index: 0 },
          createElement(Model, { id: 'model-a', position: [3, 4, 5] }),
        ),
    };
    const driver = new RuntimeDriverImpl({
      world,
      model,
      motionSystem,
      animationPlayer,
      scenes: [scene],
      timeline,
    });
    driver.setAssetsReady(true);
    driver.setPrefersReducedMotion(true);
    driver.setAvailableClips([]);
    driver.setParticleContext({});

    driver.tick({ deltaSeconds: 0.016, globalProgress: 0 });

    const root = findNode(world, 'RobotRoot');
    expect(root.localPosition).toEqual([3, 4, 5]);
  });

  it('keeps deterministic motion pose when scrubbing across scenes', () => {
    const { driver, world } = buildRuntime();
    driver.setDeterministicTime(true);

    const track = compileSceneTrack({
      scenes: scenes,
      timeline: timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    const progressAt = (sceneId: string, sceneProgress: number) => {
      const window = track.sceneWindows.find((item) => item.id === sceneId);
      if (!window) {
        throw new Error(`Missing scene window for ${sceneId}`);
      }
      return clamp01(window.start + (window.end - window.start) * sceneProgress);
    };
    const motionProgress = progressAt('robot', 0.08);
    const midProgress = progressAt('memory', 0.5);
    const lateProgress = progressAt('memory', 0.72);

    // Step 1: motion scene snapshot
    driver.tick({ deltaSeconds: 0.016, globalProgress: motionProgress });
    const motionRotationA = captureRotation(world, 'robot');
    if (process.env.DEBUG_DETERMINISM) {
      console.info('motionRotationA', motionRotationA);
    }

    // Step 2: later progress
    driver.tick({ deltaSeconds: 1.2, globalProgress: midProgress });
    const midRotation = captureRotation(world, 'robot');
    if (process.env.DEBUG_DETERMINISM) {
      console.info('midRotation', midRotation);
    }

    // Step 3: back to motion (deterministic time should match pose)
    driver.tick({ deltaSeconds: 0.016, globalProgress: motionProgress });
    const motionRotationB = captureRotation(world, 'robot');
    if (process.env.DEBUG_DETERMINISM) {
      console.info('motionRotationB', motionRotationB);
    }
    expectRotationMatch(motionRotationA, motionRotationB);

    // Step 4: forward again into later progress
    driver.tick({ deltaSeconds: 1.2, globalProgress: midProgress });
    const midRotationB = captureRotation(world, 'robot');
    if (process.env.DEBUG_DETERMINISM) {
      console.info('midRotationB', midRotationB);
    }
    expectRotationMatch(midRotation, midRotationB);

    // Step 5: scrub deeper in later progress and snapshot
    driver.tick({ deltaSeconds: 1.2, globalProgress: lateProgress });
    const lateRotationA = captureRotation(world, 'robot');

    // Step 6: back to motion again
    driver.tick({ deltaSeconds: 0.016, globalProgress: motionProgress });
    const motionRotationC = captureRotation(world, 'robot');
    expectRotationMatch(motionRotationA, motionRotationC);

    // Step 7: return to the later progress (should match snapshot)
    driver.tick({ deltaSeconds: 1.2, globalProgress: lateProgress });
    const lateRotationB = captureRotation(world, 'robot');
    expectRotationMatch(lateRotationA, lateRotationB);
  });

  it('keeps motion pose when animation clips swap mid-run', () => {
    const { driver, world } = buildRuntime();
    driver.setDeterministicTime(true);

    const track = compileSceneTrack({
      scenes: scenes,
      timeline: timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    const progressAt = (sceneId: string, sceneProgress: number) => {
      const window = track.sceneWindows.find((item) => item.id === sceneId);
      if (!window) {
        throw new Error(`Missing scene window for ${sceneId}`);
      }
      return clamp01(window.start + (window.end - window.start) * sceneProgress);
    };
    const motionProgress = progressAt('robot', 0.2);
    const animationProgress = progressAt('detail', 0.2);

    driver.tick({ deltaSeconds: 0.016, globalProgress: motionProgress });
    const motionPose = captureRotation(world, 'robot');

    driver.tick({ deltaSeconds: 0.5, globalProgress: animationProgress });
    const animPoseA = captureRotation(world, 'robot');

    driver.setAvailableClips([
      { name: 'alt_clip', duration: 2 },
      { name: 'retargeted_action', duration: 4 },
    ]);
    driver.tick({ deltaSeconds: 0.1, globalProgress: animationProgress });

    driver.tick({ deltaSeconds: 0.016, globalProgress: motionProgress });
    const motionPoseAfter = captureRotation(world, 'robot');
    expectRotationMatch(motionPose, motionPoseAfter);

    // Ensure animation pose can still be applied after swap.
    driver.tick({ deltaSeconds: 0.5, globalProgress: animationProgress });
    const animPoseB = captureRotation(world, 'robot');
    expectRotationMatch(animPoseA, animPoseB);
  });

  it('calls element renderers with lighting, environment, background, and ribbon state', () => {
    const { driver } = buildRuntime();

    let capturedLighting: SceneLighting | undefined;
    let capturedEnvironment: SceneEnvironment | undefined;
    let capturedBackground: SceneBackground | undefined;
    let capturedRibbon: SceneRibbon | undefined;

    driver.lightingRenderer = (state) => { capturedLighting = state; };
    driver.environmentRenderer = (state) => { capturedEnvironment = state; };
    driver.backgroundRenderer = (state) => { capturedBackground = state; };
    driver.ribbonRenderer = (state) => { capturedRibbon = state; };

    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.3 });

    expect(capturedLighting).toBeDefined();
    expect(capturedEnvironment).toBeDefined();
    expect(capturedBackground).toBeDefined();
    expect(capturedRibbon).toBeDefined();
  });

  it('updates anchors for contained models deterministically', () => {
    const { driver, world, brainModel } = buildRuntime();

    driver.tick({ deltaSeconds: 0.016, globalProgress: 0.3 });
    const brainRoot = brainModel.getRoot();
    expect(brainRoot.parent).not.toBeUndefined();
    expect(brainRoot.parent?.name).toMatch(/head/i);
  });

  it('restores end-of-motion pose when scrubbing back from animation', () => {
    const { driver, world } = buildRuntime();

    driver.setDeterministicTime(false);

    const robotStart = timeline.tick(1);
    const robotEnd = timeline.tick(2);
    const detailStart = robotEnd;
    const detailEnd = timeline.tick(3);
    const endOfRobotScene = Math.max(0, robotEnd - 1e-4);
    const animationScene = Math.min(1, detailStart + 1e-4);

    const buildContext = (progress: number, start: number, end: number): SceneFrameContext => {
      const sceneTimeline = createSceneTimeline(timeline, start, end);
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

    const robotContext = buildContext(endOfRobotScene, robotStart, robotEnd);
    const detailContext = buildContext(animationScene, detailStart, detailEnd);
    const robotFrame = testRobotScene.getFrame(robotContext);
    const detailFrame = testDetailScene.getFrame(detailContext);
    const detailModelId = resolveModelId(detailFrame);
    const detailPlayback = detailModelId ? detailFrame.models?.[detailModelId]?.playback : undefined;
    if (!detailPlayback) throw new Error('Missing playback');
    const detailClipName =
      detailPlayback.animation.clipName ??
      detailPlayback.animation.gltfClipName ??
      detailPlayback.animation.fbxClipName ??
      'retargeted_action';
    const detailRange = resolveClipRangeSeconds(detailPlayback.animation, 4);
    const detailCompiledAnimation: CompiledAnimation = {
      enabled: true,
      clipName: detailClipName,
      clipDuration: 4,
      range: detailRange,
    };
    const buildTick = (scene: SceneFrame): SceneTrackTick => {
      const modelId = resolveModelId(scene);
      return {
        index: 0,
        progress: 0,
        sceneId: scene.id ?? 'scene',
        sceneIndex: 0,
        sceneProgress: scene.scrollProgress,
        state: scene,
        deltaForward: {
          models: modelId ? { [modelId]: { model: scene.models?.[modelId]?.model } } : undefined,
        },
        deltaBackward: {
          models: modelId ? { [modelId]: { model: scene.models?.[modelId]?.model } } : undefined,
        },
      };
    };

    // Capture baseline pose at end of motion scene using scene getFrame.
    const robotModelId = resolveModelId(robotFrame);
    if (robotModelId) driver.sceneRuntime.modelId = robotModelId;
    driver.sceneRuntime.resetAnimationState();
    driver.sceneRuntime.apply(buildTick(robotFrame), { deltaSeconds: 0.016, globalProgress: endOfRobotScene });
    const baseline = capturePoseMap(world, [
      'torso',
      'shoulder__left',
      'shoulder__right',
      'robot',
      'left_fingers',
      'right_fingers',
    ]);

    // Run animation on wall-clock time (fixed global progress).
    // First apply: mode='full' (just reset _lastApplyTickIndex). Second apply:
    // mode='none' (same tick index) — Phase A skipped, Phase B advances the clock.
    if (detailModelId) driver.sceneRuntime.modelId = detailModelId;
    driver.sceneRuntime.resetAnimationState();
    driver.sceneRuntime.apply(buildTick(detailFrame), {
      deltaSeconds: 0.25,
      globalProgress: animationScene,
      compiledAnimation: detailCompiledAnimation,
    });
    driver.sceneRuntime.apply(buildTick(detailFrame), {
      deltaSeconds: 0.25,
      globalProgress: animationScene,
      compiledAnimation: detailCompiledAnimation,
    });

    // Scrub back to end of motion scene.
    if (robotModelId) driver.sceneRuntime.modelId = robotModelId;
    driver.sceneRuntime.resetAnimationState();
    driver.sceneRuntime.apply(buildTick(robotFrame), { deltaSeconds: 0.016, globalProgress: endOfRobotScene });
    const afterScrub = capturePoseMap(world, [
      'torso',
      'shoulder__left',
      'shoulder__right',
      'robot',
      'left_fingers',
      'right_fingers',
    ]);

    expectPoseMapMatch(baseline, afterScrub);
  });

  it('steps through intermediate ticks when scrubbing across multiple sub-ticks', () => {
    const { driver } = buildRuntime();
    const driverState = driver as unknown as { sceneTrack: SceneTrack | null };
    const track = driverState.sceneTrack;
    if (!track) {
      throw new Error('Expected scene track to be available for stepping test.');
    }

    driver.tick({ deltaSeconds: 0, globalProgress: 0 });

    const modelApplySpy = vi.spyOn(driver.sceneRuntime, 'applyModelState');
    const applySpy = vi.spyOn(driver.sceneRuntime, 'apply');

    const targetProgress = timeline.tick(1);
    const startIndex = Math.round(0 / track.tickStep);
    const targetIndex = Math.round(targetProgress / track.tickStep);
    const expectedSteps = Math.abs(targetIndex - startIndex);

    driver.tick({ deltaSeconds: 0.016, globalProgress: targetProgress });

    expect(modelApplySpy).toHaveBeenCalledTimes(expectedSteps);
    expect(applySpy).toHaveBeenCalledTimes(expectedSteps);
    const lastCall = applySpy.mock.calls[applySpy.mock.calls.length - 1];
    expect(lastCall?.[1]?.globalProgress).toBeCloseTo(targetProgress, 5);
  });
});
