import {describe, expect, it} from 'vitest';
import type {SceneFrame} from '../../model/robotSceneTypes';
import {ModelRenderer} from '../../elements/model/ModelRenderer';
import {MockNode, MockWorld} from '../mocks/MockWorld';
import {MockModel} from '../mocks/MockModel';
import {MockAnimationPlayer} from '../mocks/MockAnimationPlayer';
import {MockMotionSystem} from '../mocks/MockMotionSystem';
import {buildMockMotionRig} from '../mocks/MockMotionRig';
import {ROBOT_GROUP_LIMITS} from '../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import {createSceneTimeline} from '../../robotTimeline';
import {clamp01, rangeProgress} from '../../robotTimelineMath';
import {testDetailScene, testRobotScene, testSceneGroup} from './fixtures/testSceneFixtures';
import type {SceneFrameContext} from '../../runtime/compiler/sceneTypes';
import type {CompiledAnimation, SceneTrackTick} from '../../runtime/compiler/sceneTrackTypes';
const {timeline} = testSceneGroup;

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

const buildRobotFrame = (progress: number): SceneFrame => {
  const start = timeline.tick(1);
  const end = timeline.tick(2);
  const context = buildContext(progress, start, end);
  return testRobotScene.getFrame(context);
};

const buildDetailFrame = (progress: number): SceneFrame => {
  const start = timeline.tick(2);
  const end = timeline.tick(3);
  const context = buildContext(progress, start, end);
  return testDetailScene.getFrame(context);
};

const buildRuntime = () => {
  const world = new MockWorld('WorldRoot');
  world.addNode(new MockNode('robot'));
  const model = new MockModel('robot', world);
  const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
  const animationPlayer = new MockAnimationPlayer();
  animationPlayer.load([
    {
      targetName: 'robot',
      property: 'rotation',
      keyframes: [
        { t: 0, value: [0, 0, 0] },
        { t: 2, value: [0, -1, 0] },
      ],
    },
  ]);
  const runtime = new ModelRenderer({
    world,
    model,
    motionSystem,
    animationPlayer,
  });
  runtime.setPrefersReducedMotion(false);
  runtime.setDeterministicTime(true);
  return { runtime, world };
};

/**
 * Applies a scene as a fresh full-update tick. Calls resetAnimationState() first
 * so each invocation runs Phase A (model state) regardless of tick index continuity.
 */
const runSceneTick = (
  runtime: ModelRenderer,
  world: MockWorld,
  scene: SceneFrame,
  deltaSeconds: number,
  globalProgress: number,
  compiledAnimation?: CompiledAnimation,
) => {
  const modelId = scene.models ? Object.keys(scene.models)[0] : undefined;
  const tick: SceneTrackTick = {
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
  if (modelId) runtime.modelId = modelId;
  // Reset so the next apply() runs in mode='full', applying model state for the new scene.
  runtime.resetAnimationState();
  runtime.apply(tick, { deltaSeconds, globalProgress, compiledAnimation });
};

const getRotationY = (world: MockWorld, name = 'robot') => {
  const node = world.getNode(name);
  if (!node) throw new Error(`Missing node: ${name}`);
  return node.localRotation[1];
};

describe('scene playback transitions (motion ↔ animation)', () => {
  it('switches back to motion without blending when animation is disabled', () => {
    const { runtime, world } = buildRuntime();

    const motionScene = buildRobotFrame(timeline.tick(2) - 1e-4);
    const animationScene = buildDetailFrame(timeline.tick(2) + 1e-4);

    runSceneTick(runtime, world, motionScene, 0.016, timeline.tick(2) - 1e-4);
    const motionPoseY = getRotationY(world);

    runSceneTick(
      runtime,
      world,
      animationScene,
      0.5,
      timeline.tick(2) + 1e-4,
      {
        enabled: true,
        clipName: 'clip',
        clipDuration: 2,
        range: { startSeconds: 0, endSeconds: 2, span: 2 },
      },
    );
    const animationPoseY = getRotationY(world);
    expect(animationPoseY).not.toBe(motionPoseY);

    // Transition back to motion: should snap to the motion pose (no blending).
    runSceneTick(runtime, world, motionScene, 0.2, timeline.tick(2) - 1e-4);
    const transitionY = getRotationY(world);
    expect(transitionY).toBeCloseTo(motionPoseY, 4);
  });
});
