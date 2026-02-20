import {describe, expect, it} from 'vitest';
import {ModelRenderer} from '../../elements/model/ModelRenderer';
import {MockNode, MockWorld} from '../mocks/MockWorld';
import {MockModel} from '../mocks/MockModel';
import {MockAnimationPlayer} from '../mocks/MockAnimationPlayer';
import {MockMotionSystem} from '../mocks/MockMotionSystem';
import {buildMockMotionRig} from '../mocks/MockMotionRig';
import {ROBOT_GROUP_LIMITS} from '../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import type {SceneFrameContext} from '../../model/sceneState';
import {createBaseSceneState, createDefaultModelState, createDefaultPlayback} from '../../model/sceneState';
import {testSceneGroup} from './fixtures/testSceneFixtures';
import {resolveClipRangeSeconds} from '../../elements/model/compile';
import type {SceneTrackTick} from '../../runtime/compiler/sceneTrackTypes';

const modelId = 'model-a';

const buildContext = (overrides?: Partial<SceneFrameContext>): SceneFrameContext => ({
  progress: 0,
  sceneProgress: 0,
  globalProgress: 0,
  sceneStart: 0,
  sceneEnd: 1,
  assetsReady: true,
  timeline: testSceneGroup.timeline,
  baseState: undefined,
  ...overrides,
});

describe('ModelRenderer mapping', () => {
  it('maps percent-based clip ranges with repeat', () => {
    const world = new MockWorld('WorldRoot');
    const root = new MockNode('RobotRoot');
    world.addNode(root);
    world.addNode(new MockNode('robot'), root.name);

    const model = new MockModel('RobotRoot', world);
    const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
    const animationPlayer = new MockAnimationPlayer();
    animationPlayer.load([
      {
        targetName: 'robot',
        property: 'position',
        keyframes: [
          { t: 0, value: [0, 0, 0] },
          { t: 10, value: [10, 0, 0] },
        ],
      },
    ]);

    const runtime = new ModelRenderer({ world, model, motionSystem, animationPlayer, modelId });
    runtime.setDeterministicTime(true);

    const base = createBaseSceneState(buildContext({ sceneProgress: 0.9 }));
    const scenePlayback = {
      ...createDefaultPlayback(),
      animation: {
        enabled: true,
        clipName: 'loop',
        clipStart: 10,
        clipEnd: 60,
        clipRangeUnit: 'percent' as const,
        clipRepeat: true,
      },
    };
    const primaryScene = {
      ...base,
      id: 'loop-test',
      scrollProgress: 0.9,
      models: {
        [modelId]: { model: createDefaultModelState(), playback: scenePlayback },
      },
    };

    const resolvedPlayback = primaryScene.models?.[modelId]?.playback;
    if (!resolvedPlayback) throw new Error('Missing playback');
    const range = resolveClipRangeSeconds(resolvedPlayback.animation, 10);
    const compiledAnimation = {
      enabled: true,
      clipName: 'loop',
      clipDuration: 10,
      range,
    };

    const tick: SceneTrackTick = {
      index: 0,
      progress: 0,
      sceneId: primaryScene.id ?? 'scene',
      sceneIndex: 0,
      sceneProgress: primaryScene.scrollProgress,
      state: primaryScene,
      deltaForward: {
        models: { [modelId]: { model: primaryScene.models?.[modelId]?.model } },
      },
      deltaBackward: {
        models: { [modelId]: { model: primaryScene.models?.[modelId]?.model } },
      },
    };

    runtime.apply(tick, { deltaSeconds: 0.016, globalProgress: 0.2, compiledAnimation });

    const node = world.getNode('robot');
    expect(node?.localPosition[0]).toBeGreaterThan(0);
    expect(node?.localPosition[0]).toBeLessThan(10);
  });

  it('updates root position even when no model delta is provided', () => {
    const world = new MockWorld('WorldRoot');
    const root = new MockNode('RobotRoot');
    world.addNode(root);
    world.addNode(new MockNode('robot'), root.name);

    const model = new MockModel('RobotRoot', world);
    const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
    const animationPlayer = new MockAnimationPlayer();
    const runtime = new ModelRenderer({ world, model, motionSystem, animationPlayer });

    const modelState = createDefaultModelState();
    modelState.position = [6, -22, 3];
    modelState.rotation = [0, -0.7, 0];
    modelState.scale = 0.2;

    runtime.applyModelState(modelState, undefined, {
      mode: 'forward',
      sceneId: 'robot',
      tickIndex: 1,
      progress: 0.12,
    });

    const rootNode = world.getNode('RobotRoot');
    expect(rootNode?.localPosition).toEqual([6, -22, 3]);
    expect(rootNode?.localRotation).toEqual([0, -0.7, 0]);
    expect(rootNode?.localScale).toEqual([0.2, 0.2, 0.2]);
  });
});
