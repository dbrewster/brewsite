import {describe, expect, it} from 'vitest';
import {ModelRenderer} from '../../elements/model/ModelRenderer';
import {MockNode, MockWorld} from '../mocks/MockWorld';
import {MockModel} from '../mocks/MockModel';
import {MockAnimationPlayer} from '../mocks/MockAnimationPlayer';
import {MockMotionSystem} from '../mocks/MockMotionSystem';
import {buildMockMotionRig} from '../mocks/MockMotionRig';
import {ROBOT_GROUP_LIMITS} from '../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import {MODEL_BONE_NAME_MAP} from '../../../components/logoParticleOptimizedViewer/robotStructureTypes';
import {createBaseSceneState, mergeSceneState} from '../../model/sceneState';
import {testSceneGroup} from './fixtures/testSceneFixtures';
import type {SceneTrackTick} from '../../runtime/compiler/sceneTrackTypes';
import type {SceneFrame, SceneFrameOverride} from '../../model/robotSceneTypes';

const modelId = 'model-a';

const buildTick = (scene: SceneFrame): SceneTrackTick => {
  return {
    index: 0,
    progress: scene.scrollProgress,
    sceneId: scene.id,
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

const buildRuntime = (options?: { includeHeadAlias?: boolean }) => {
  const world = new MockWorld('WorldRoot');
  const root = new MockNode('RobotRoot');
  world.addNode(root);

  const head = new MockNode(MODEL_BONE_NAME_MAP.Head, { position: [5, 2, -1] });
  world.addNode(head, root.name);
  if (options?.includeHeadAlias) {
    const alias = new MockNode('HEAD');
    world.addNode(alias, root.name);
  }

  const model = new MockModel('RobotRoot', world);
  const brainWorld = new MockWorld('BrainWorld');
  const brainModel = new MockModel('BrainRoot', brainWorld);
  model.setContainedModel?.('brain', brainModel);

  const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
  const animationPlayer = new MockAnimationPlayer();
  const runtime = new ModelRenderer({
    world,
    model,
    motionSystem,
    animationPlayer,
    modelId,
  });

  return { runtime, world, model, brainModel, head };
};

const buildScene = (overrides: SceneFrameOverride): SceneFrame => {
  const base = createBaseSceneState({
    progress: 0.5,
    sceneProgress: 0.5,
    globalProgress: 0.5,
    sceneStart: 0,
    sceneEnd: 1,
    assetsReady: true,
    timeline: testSceneGroup.timeline,
  });
  const scene = mergeSceneState(base, overrides);
  return scene;
};

describe('ModelRenderer brain attachment', () => {
  it('uses local part transforms when space is local', () => {
    const { runtime, world, brainModel, head } = buildRuntime();

    const scene = buildScene({
      id: 'brain-local',
      models: {
        [modelId]: {
          model: {
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                modelId: 'brain',
                enabled: true,
                space: 'local',
                position: [1, 2, 3],
                rotation: [0.1, 0.2, 0.3],
                scale: 1.4,
              },
            },
          },
        },
      },
    });

    runtime.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

    const brainRoot = brainModel.getRoot();
    expect(brainRoot.parent).toBe(head);
    expect(brainRoot.localPosition).toEqual([1, 2, 3]);
    expect(brainRoot.localRotation).toEqual([0.1, 0.2, 0.3]);
    expect(brainRoot.localScale).toEqual([1.4, 1.4, 1.4]);
  });

  it('converts world-space part transforms into local anchor space', () => {
    const { runtime, world, brainModel, head } = buildRuntime();

    const scene = buildScene({
      id: 'brain-world',
      models: {
        [modelId]: {
          model: {
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                modelId: 'brain',
                enabled: true,
                space: 'world',
                position: [10, 0, 0],
                rotation: [0.2, -0.1, 0.05],
                scale: 0.9,
              },
            },
          },
        },
      },
    });

    runtime.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

    world.updateWorldMatrix();
    const brainRoot = brainModel.getRoot();
    const headWorld = head.worldPosition;
    const expectedLocal = [10 - headWorld[0], 0 - headWorld[1], 0 - headWorld[2]] as [number, number, number];
    expect(brainRoot.parent).toBe(head);
    expect(brainRoot.localPosition).toEqual(expectedLocal);
    expect(brainRoot.localRotation).toEqual([0.2, -0.1, 0.05]);
    expect(brainRoot.localScale).toEqual([0.9, 0.9, 0.9]);
  });

  it('prefers bone head anchors over generic head nodes', () => {
    const { runtime, world, brainModel, head } = buildRuntime({ includeHeadAlias: true });

    const scene = buildScene({
      id: 'brain-anchor-preference',
      models: {
        [modelId]: {
          model: {
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                modelId: 'brain',
                enabled: true,
                space: 'local',
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: 1,
              },
            },
          },
        },
      },
    });

    runtime.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

    const brainRoot = brainModel.getRoot();
    expect(brainRoot.parent).toBe(head);
    expect(brainRoot.parent?.name).toBe(MODEL_BONE_NAME_MAP.Head);
  });

  it('inherits head rotation after anchoring', () => {
    const { runtime, world, brainModel, head } = buildRuntime();

    const scene = buildScene({
      id: 'brain-inherit-rotation',
      models: {
        [modelId]: {
          model: {
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                modelId: 'brain',
                enabled: true,
                space: 'local',
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: 1,
              },
            },
          },
        },
      },
    });

    runtime.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

    head.localRotation = [0, 1.1, 0];
    world.updateWorldMatrix();

    const brainRoot = brainModel.getRoot();
    expect(Math.abs(brainRoot.worldRotation[1])).toBeCloseTo(1.1, 4);
  });
});
