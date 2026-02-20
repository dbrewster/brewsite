import {describe, expect, it} from 'vitest';
import {compileTestTrack, createTestScene, createTestTimeline, SceneTrackInspector} from '../../runtime/compiler/__tests__/compilerE2eUtils';
import {RuntimeDriverImpl} from '../RuntimeDriver';
import {MockAnimationPlayer} from '../mocks/MockAnimationPlayer';
import {MockModel} from '../mocks/MockModel';
import {MockMotionSystem} from '../mocks/MockMotionSystem';
import {MockNode, MockWorld} from '../mocks/MockWorld';

const modelId = 'model-a';

const buildTestScenes = () => [
  createTestScene({ id: 'intro', index: 0, frame: { models: { [modelId]: {} } } }),
  createTestScene({
    id: 'robot',
    index: 1,
    frame: {
      models: {
        [modelId]: {
          model: {
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                enabled: true,
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: 1,
                modelId: 'brain',
              },
            },
          },
        },
      },
    },
  }),
];

const buildTestTimeline = () => createTestTimeline(['intro', 'robot']);

const isBrainAttached = (brainModel: MockModel, anchorName: string): boolean =>
  brainModel.getRoot().parent?.name === anchorName;

describe('RuntimeDriver backward scrubbing', () => {
  it('detaches contained models when scrubbing from robot back to intro', () => {
    const world = new MockWorld('ROOT');
    world.addNode(new MockNode('spine1'));
    world.addNode(new MockNode('head'));
    const model = new MockModel('RobotRoot', world);
    const brainModel = new MockModel('BrainRoot', new MockWorld('BrainWorld'));
    model.setContainedModel?.('brain', brainModel);
    const motionSystem = new MockMotionSystem({ groupTargets: new Map(), groupLimits: {} });
    const animationPlayer = new MockAnimationPlayer();
    const runtime = new RuntimeDriverImpl({
      world,
      model,
      motionSystem,
      animationPlayer,
      scenes: buildTestScenes(),
      timeline: buildTestTimeline(),
    });

    runtime.setAssetsReady(true);
    runtime.setAvailableClips([]);

    const track = compileTestTrack({ scenes: buildTestScenes(), timeline: buildTestTimeline() });
    const inspector = new SceneTrackInspector(track);
    const robotTick = inspector.tickAtSceneProgress('robot', 0.5);
    const introTick = inspector.tickAtSceneProgress('intro', 0.5);

    runtime.tick({ deltaSeconds: 0, globalProgress: robotTick.progress });
    expect(isBrainAttached(brainModel, 'head')).toBe(true);

    runtime.tick({ deltaSeconds: 0, globalProgress: introTick.progress });
    expect(isBrainAttached(brainModel, 'head')).toBe(false);
  });

  it('toggles contained models when moving intro -> robot -> intro', () => {
    const world = new MockWorld('ROOT');
    world.addNode(new MockNode('spine1'));
    world.addNode(new MockNode('head'));
    const model = new MockModel('RobotRoot', world);
    const brainModel = new MockModel('BrainRoot', new MockWorld('BrainWorld'));
    model.setContainedModel?.('brain', brainModel);
    const motionSystem = new MockMotionSystem({ groupTargets: new Map(), groupLimits: {} });
    const animationPlayer = new MockAnimationPlayer();
    const runtime = new RuntimeDriverImpl({
      world,
      model,
      motionSystem,
      animationPlayer,
      scenes: buildTestScenes(),
      timeline: buildTestTimeline(),
    });

    runtime.setAssetsReady(true);
    runtime.setAvailableClips([]);

    const track = compileTestTrack({ scenes: buildTestScenes(), timeline: buildTestTimeline() });
    const inspector = new SceneTrackInspector(track);
    const introProgress = inspector.tickAtSceneProgress('intro', 0.5).progress;
    const robotProgress = inspector.tickAtSceneProgress('robot', 0.5).progress;

    runtime.tick({ deltaSeconds: 0, globalProgress: introProgress });
    expect(isBrainAttached(brainModel, 'head')).toBe(false);

    runtime.tick({ deltaSeconds: 0, globalProgress: robotProgress });
    expect(isBrainAttached(brainModel, 'head')).toBe(true);

    runtime.tick({ deltaSeconds: 0, globalProgress: introProgress });
    expect(isBrainAttached(brainModel, 'head')).toBe(false);
  });
});
