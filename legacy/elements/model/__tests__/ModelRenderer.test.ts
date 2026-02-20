import { describe, expect, it, vi } from 'vitest';
import { ModelRenderer } from '../ModelRenderer';
import { MockNode, MockWorld } from '../../../runtime/mocks/MockWorld';
import { MockModel } from '../../../runtime/mocks/MockModel';
import { MockAnimationPlayer } from '../../../runtime/mocks/MockAnimationPlayer';
import { MockMotionSystem } from '../../../runtime/mocks/MockMotionSystem';
import { buildMockMotionRig } from '../../../runtime/mocks/MockMotionRig';
import { ROBOT_GROUP_LIMITS } from '../../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import { MODEL_BONE_NAME_MAP } from '../../../../components/logoParticleOptimizedViewer/robotStructureTypes';
import { createBaseSceneState, mergeSceneState } from '../../../model/sceneState';
import { testSceneGroup } from '../../../runtime/__tests__/fixtures/testSceneFixtures';
import type { SceneTrackTick } from '../../../runtime/compiler/sceneTrackTypes';
import type { SceneFrame, SceneFrameOverride } from '../../../model/robotSceneTypes';
import type { AssetManifest } from '../metadata';
import { ASSET_MANIFEST_VERSION } from '../metadata';

const modelId = 'model-a';

const HEAD_BONE = MODEL_BONE_NAME_MAP.Head; // 'mixamorig:Head'
const CHEST_BONE = MODEL_BONE_NAME_MAP.Spine1; // 'mixamorig:Spine1'

const buildManifest = (head = HEAD_BONE, chest = CHEST_BONE): AssetManifest => ({
  version: ASSET_MANIFEST_VERSION,
  robot: {
    glb: '/robot.glb',
    bones: [head, chest],
    meshes: ['Body_Mesh'],
    anchorTargets: { head, chest },
  },
  brain: { glb: '/brain.glb', subparts: ['CortexLeft'] },
  animations: [],
});

const buildTick = (scene: SceneFrame, index = 0): SceneTrackTick => ({
  index,
  progress: scene.scrollProgress,
  sceneId: scene.id,
  sceneIndex: 0,
  sceneProgress: scene.scrollProgress,
  state: scene,
  deltaForward: {
    models: scene.models?.[modelId]
      ? { [modelId]: { model: scene.models[modelId]!.model } }
      : undefined,
  },
  deltaBackward: {
    models: scene.models?.[modelId]
      ? { [modelId]: { model: scene.models[modelId]!.model } }
      : undefined,
  },
});

// ─── Build helpers ────────────────────────────────────────────────────────────

const buildWorld = (options?: { includeHeadAlias?: boolean }) => {
  const world = new MockWorld('WorldRoot');
  const root = new MockNode('RobotRoot');
  world.addNode(root);

  const head = new MockNode(HEAD_BONE, { position: [5, 2, -1] });
  world.addNode(head, root.name);

  const chest = new MockNode(CHEST_BONE);
  world.addNode(chest, root.name);

  if (options?.includeHeadAlias) {
    world.addNode(new MockNode('HEAD'), root.name);
  }

  return { world, head, chest };
};

const buildRenderer = (options?: {
  manifest?: AssetManifest;
  includeHeadAlias?: boolean;
}) => {
  const { world, head, chest } = buildWorld(options);
  const model = new MockModel('RobotRoot', world);
  const brainWorld = new MockWorld('BrainWorld');
  const brainModel = new MockModel('BrainRoot', brainWorld);
  model.setContainedModel?.('brain', brainModel);
  const attachmentWorld = new MockWorld('AttachmentWorld');
  const attachmentModel = new MockModel('AttachmentRoot', attachmentWorld);
  model.setContainedModel?.('attachment', attachmentModel);

  const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
  const animationPlayer = new MockAnimationPlayer();

  const renderer = new ModelRenderer({
    world,
    model,
    motionSystem,
    animationPlayer,
    manifest: options?.manifest,
    modelId,
  });

  return { renderer, world, model, brainModel, attachmentModel, head, chest };
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
  return mergeSceneState(base, overrides);
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ModelRenderer', () => {
  describe('prepare() — bone resolution', () => {
    it('resolves head bone from manifest anchorTargets (O(1) lookup)', () => {
      const manifest = buildManifest();
      const { renderer, head, brainModel } = buildRenderer({ manifest });

      renderer.prepare();

      const scene = buildScene({
        id: 'test',
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
                  rotation: [0, 0, 0],
                  scale: 1,
                },
              },
            },
          },
        },
      });

      renderer.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

      expect(brainModel.getRoot().parent).toBe(head);
      expect(brainModel.getRoot().parent?.name).toBe(HEAD_BONE);
    });

    it('resolves chest bone from manifest anchorTargets', () => {
      const manifest = buildManifest();
      const { renderer, chest, attachmentModel } = buildRenderer({ manifest });

      renderer.prepare();

      const scene = buildScene({
        id: 'test-particles',
        models: {
          [modelId]: {
            model: {
              parts: {
                attachment: {
                  id: 'attachment',
                  anchor: 'chest',
                  modelId: 'attachment',
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

      renderer.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

      const attachmentRoot = attachmentModel.getRoot();
      expect(attachmentRoot.parent).toBe(chest);
      expect(attachmentRoot.parent?.name).toBe(CHEST_BONE);
    });

    it('falls back to regex resolution when manifest is absent', () => {
      const { renderer, head, brainModel } = buildRenderer(); // no manifest

      renderer.prepare();

      const scene = buildScene({
        id: 'no-manifest',
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

      renderer.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

      expect(brainModel.getRoot().parent).toBe(head);
    });

    it('prepare() with manifest skips regex scan — uses exact bone name', () => {
      // Both HEAD_BONE and 'HEAD' alias exist; manifest specifies HEAD_BONE
      const manifest = buildManifest(HEAD_BONE, CHEST_BONE);
      const { renderer, head, brainModel } = buildRenderer({ manifest, includeHeadAlias: true });

      renderer.prepare();

      const scene = buildScene({
        id: 'alias-test',
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

      renderer.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

      // Should use manifest bone, not the alias
      expect(brainModel.getRoot().parent?.name).toBe(HEAD_BONE);
    });
  });

  it('applies contained model transforms for model parts', () => {
    const manifest = buildManifest();
    const { renderer, brainModel } = buildRenderer({ manifest });

    renderer.prepare();

    const scene = buildScene({
      id: 'transform-test',
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
                position: [2.5, -1.5, 3],
                rotation: [0.1, -0.2, 0.3],
                scale: 0.75,
              },
            },
          },
        },
      },
    });

    renderer.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

    const root = brainModel.getRoot();
    expect(root.localPosition).toEqual([2.5, -1.5, 3]);
    expect(root.localRotation).toEqual([0.1, -0.2, 0.3]);
    expect(root.localScale).toEqual([0.75, 0.75, 0.75]);
  });

  it('updates particle systems every frame even when tick index is unchanged', () => {
    const { renderer } = buildRenderer();
    const modelWithParticles = (renderer as unknown as { model: MockModel & { updateParticleSystems?: (context?: Record<string, unknown>) => void } }).model;
    const updateParticleSystems = vi.fn();
    modelWithParticles.updateParticleSystems = updateParticleSystems;
    const context = { timeSeconds: 1 };
    renderer.setParticleContext(context);

    const scene = buildScene({
      id: 'particles-tick',
      models: {
        [modelId]: {
          model: {
            enabled: true,
          },
        },
      },
    });

    const tick = buildTick(scene, 0);
    renderer.apply(tick, { deltaSeconds: 0, globalProgress: 0.5 });
    renderer.apply(tick, { deltaSeconds: 0.016, globalProgress: 0.5 });

    expect(updateParticleSystems).toHaveBeenCalledTimes(2);
    expect(updateParticleSystems).toHaveBeenCalledWith(context);
  });

  describe('prepare() — bone caching', () => {
    it('calling prepare() sets prepared flag', () => {
      const { renderer } = buildRenderer({ manifest: buildManifest() });
      expect((renderer as unknown as { prepared: boolean }).prepared).toBe(false);
      renderer.prepare();
      expect((renderer as unknown as { prepared: boolean }).prepared).toBe(true);
    });

    it('without prepare(), runtime resolution still works (backward compat)', () => {
      const { renderer } = buildRenderer();
      // Not calling prepare() — should still resolve bones at runtime

      const scene = buildScene({
        id: 'no-prepare',
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

      // Should not throw — falls back to runtime resolution
      expect(() => renderer.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 })).not.toThrow();
    });
  });

  describe('brain attachment', () => {
    it('attaches brain to head anchor with local position', () => {
      const manifest = buildManifest();
      const { renderer, head, brainModel } = buildRenderer({ manifest });
      renderer.prepare();

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

      renderer.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

      const brainRoot = brainModel.getRoot();
      expect(brainRoot.parent).toBe(head);
      expect(brainRoot.localPosition).toEqual([1, 2, 3]);
      expect(brainRoot.localRotation).toEqual([0.1, 0.2, 0.3]);
      expect(brainRoot.localScale).toEqual([1.4, 1.4, 1.4]);
    });

    it('converts world-space brain position to local anchor space', () => {
      const manifest = buildManifest();
      const { renderer, world, head, brainModel } = buildRenderer({ manifest });
      renderer.prepare();

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

      renderer.apply(buildTick(scene), { deltaSeconds: 0, globalProgress: 0.5 });

      world.updateWorldMatrix();
      const brainRoot = brainModel.getRoot();
      const headWorld = head.worldPosition;
      const expectedLocal: [number, number, number] = [10 - headWorld[0], 0 - headWorld[1], 0 - headWorld[2]];
      expect(brainRoot.parent).toBe(head);
      expect(brainRoot.localPosition).toEqual(expectedLocal);
      expect(brainRoot.localRotation).toEqual([0.2, -0.1, 0.05]);
      expect(brainRoot.localScale).toEqual([0.9, 0.9, 0.9]);
    });
  });

  describe('apply() — unified per-frame API', () => {
    it('apply() reads model state from tick when no override provided', () => {
      const manifest = buildManifest();
      const { renderer } = buildRenderer({ manifest });
      renderer.prepare();

      const scene = buildScene({ id: 'apply-test' });

      expect(() =>
        renderer.apply(buildTick(scene), { deltaSeconds: 0.016, globalProgress: 0.5 }),
      ).not.toThrow();
    });

    it('apply() hides model when enabled = false', () => {
      const manifest = buildManifest();
      const { renderer, model } = buildRenderer({ manifest });
      renderer.prepare();

      const scene = buildScene({
        id: 'apply-disabled',
        models: {
          [modelId]: { model: { enabled: false } },
        },
      });

      renderer.apply(buildTick(scene), { deltaSeconds: 0.016, globalProgress: 0.5 });

      const root = model.getRoot();
      expect(root.localScale).toEqual([0, 0, 0]);
    });

    it('apply() uses resolvedModel override when provided', () => {
      const manifest = buildManifest();
      const { renderer, model } = buildRenderer({ manifest });
      renderer.prepare();

      const scene = buildScene({ id: 'apply-override' });

      // Provide a disabled override even though tick state has enabled model
      const disabledModel = { enabled: false, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: 1, metalness: 0.5, roughness: 0.5 };
      renderer.apply(buildTick(scene), {
        deltaSeconds: 0.016,
        globalProgress: 0.5,
        resolvedModel: disabledModel,
      });

      const root = model.getRoot();
      expect(root.localScale).toEqual([0, 0, 0]);
    });

    it('apply() mode=none still advances wall-time animation', () => {
      const manifest = buildManifest();
      const { renderer } = buildRenderer({ manifest });
      renderer.prepare();

      const scene = buildScene({
        id: 'apply-none-wall-time',
        models: {
          [modelId]: {
            model: {
              scale: 1,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              enabled: true,
            },
            playback: {
              motion: { commands: [], scenes: [] },
              animation: { enabled: false },
            },
            enabled: true,
          },
        },
      });
      const tick = buildTick(scene);

      const timingSpy = vi.spyOn(renderer as unknown as { _applyTiming: (options: unknown) => unknown }, '_applyTiming');

      renderer.apply(tick, { deltaSeconds: 0.016, globalProgress: 0.5, wallTimeSeconds: 1 });
      renderer.apply(tick, { deltaSeconds: 0.016, globalProgress: 0.5, wallTimeSeconds: 2 });

      const wallTimeSeconds = (renderer as unknown as { wallTimeSeconds: number }).wallTimeSeconds;
      expect(timingSpy).toHaveBeenCalledTimes(2);
      expect(wallTimeSeconds).toBe(2);
    });

    it('apply() does not call applyModelState on repeated tick index', () => {
      const manifest = buildManifest();
      const { renderer } = buildRenderer({ manifest });
      renderer.prepare();

      const scene = buildScene({
        id: 'apply-none-model-state',
        models: {
          [modelId]: {
            model: {
              scale: 1,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              enabled: true,
            },
            playback: {
              motion: { commands: [], scenes: [] },
              animation: { enabled: false },
            },
            enabled: true,
          },
        },
      });
      const tick = buildTick(scene);

      const applySpy = vi.spyOn(renderer, 'applyModelState');

      renderer.apply(tick, { deltaSeconds: 0.016, globalProgress: 0.5 });
      renderer.apply(tick, { deltaSeconds: 0.016, globalProgress: 0.5 });

      expect(applySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration & control', () => {
    it('setPrefersReducedMotion(true) suppresses motion', () => {
      const { renderer } = buildRenderer({ manifest: buildManifest() });
      renderer.prepare();
      renderer.setPrefersReducedMotion(true);

      const scene = buildScene({
        id: 'reduced-motion',
        models: { [modelId]: {} },
      });

      expect(() =>
        renderer.apply(buildTick(scene), { deltaSeconds: 0.016, globalProgress: 0.5 }),
      ).not.toThrow();
    });

    it('resetAnimationState() clears active clip without resetting delta tracking', () => {
      const { renderer } = buildRenderer({ manifest: buildManifest() });
      renderer.prepare();

      const scene = buildScene({
        id: 'reset-test',
        models: { [modelId]: {} },
      });
      const tick = buildTick(scene);

      renderer.apply(tick, { deltaSeconds: 0.016, globalProgress: 0.5 });

      // After one apply, _lastApplyTickIndex is set
      expect((renderer as unknown as { _lastApplyTickIndex: number | null })._lastApplyTickIndex).toBe(0);

      renderer.resetAnimationState();

      // Reset should keep the index; delta tracking is independent.
      expect((renderer as unknown as { _lastApplyTickIndex: number | null })._lastApplyTickIndex).toBe(0);
    });
  });

  describe('constructor modelId', () => {
    it('uses constructor modelId for apply()', () => {
      const manifest = buildManifest();
      const { renderer } = buildRenderer({ manifest });
      renderer.prepare();

      const internals = renderer as unknown as { _modelId: string };
      expect(internals._modelId).toBe(modelId);
    });
  });
});
