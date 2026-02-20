import {describe, expect, it} from 'vitest';
import {RuntimeDriverImpl} from '../RuntimeDriver';
import {MockNode, MockWorld} from '../mocks/MockWorld';
import {MockModel} from '../mocks/MockModel';
import {MockMotionSystem} from '../mocks/MockMotionSystem';
import {MockAnimationPlayer} from '../mocks/MockAnimationPlayer';
import {buildMockMotionRig} from '../mocks/MockMotionRig';
import {ROBOT_GROUP_LIMITS} from '../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import {compileSceneTrack} from '../compiler/sceneTrackCompiler';
import {createSceneTrackSampler} from '../compiler/sceneTrackSampler';
import {testSceneGroup} from './fixtures/testSceneFixtures';

describe('RuntimeDriver scene model position transitions', () => {
  it('applies blended model positions across intro -> robot transition', () => {
    const world = new MockWorld('WorldRoot');
    const root = new MockNode('RobotRoot');
    world.addNode(root);
    world.addNode(new MockNode('robot'), root.name);

    const model = new MockModel('RobotRoot', world);
    const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
    const animationPlayer = new MockAnimationPlayer();
    const runtime = new RuntimeDriverImpl({
      world,
      model,
      motionSystem,
      animationPlayer,
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
    });

    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [],
      prefersReducedMotion: false,
      ui: { ar: 16 / 9 },
    });
    const sampler = createSceneTrackSampler(track);
    runtime.setSceneTrack(track, sampler);
    runtime.setAvailableClips([]);

    const introTick = sampler.sample(0.02);
    const blendTick = sampler.sample(0.08);
    const introPos = introTick.state.models?.primary?.model.position;
    const blendPos = blendTick.state.models?.primary?.model.position;
    if (!introPos || !blendPos) throw new Error('Missing model positions');

    runtime.tick({ deltaSeconds: 0.016, globalProgress: 0.08 });

    const rootNode = world.getNode('RobotRoot');
    const applied = rootNode?.localPosition;
    if (!applied) throw new Error('Missing applied position');

    const minY = Math.min(introPos[1], blendPos[1]);
    const maxY = Math.max(introPos[1], blendPos[1]);
    expect(applied[1]).toBeGreaterThanOrEqual(minY);
    expect(applied[1]).toBeLessThanOrEqual(maxY);
  });
});
