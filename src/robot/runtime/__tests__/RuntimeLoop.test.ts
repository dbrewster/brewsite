import {describe, expect, it, vi} from 'vitest';
import {RuntimeLoop, type RuntimeLoopClock, type RuntimeLoopFrameHandle} from '../RuntimeLoop';
import {RuntimeDriverImpl} from '../RuntimeDriver';
import {MockNode, MockWorld} from '../mocks/MockWorld';
import {MockModel} from '../mocks/MockModel';
import {MockAnimationPlayer} from '../mocks/MockAnimationPlayer';
import {MockMotionSystem} from '../mocks/MockMotionSystem';
import {buildMockMotionRig} from '../mocks/MockMotionRig';
import {ROBOT_GROUP_LIMITS} from '../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import {ROBOT_REST_RIG_TARGETS, ROBOT_SKELETON} from '../../../components/logoParticleOptimizedViewer/robotRig';
import {MODEL_BONE_NAME_MAP} from '../../../components/logoParticleOptimizedViewer/robotStructureTypes';
import {testSceneGroup} from './fixtures/testSceneFixtures';

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

const buildRuntimeDriver = () => {
  const world = buildWorldWithRobot();
  const model = new MockModel('RobotRoot', world);
  const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
  const animationPlayer = new MockAnimationPlayer();
  const driver = new RuntimeDriverImpl({
    world,
    model,
    motionSystem,
    animationPlayer,
    scenes: testSceneGroup.scenes,
    timeline: testSceneGroup.timeline,
  });
  driver.setAssetsReady(true);
  driver.setPrefersReducedMotion(false);
  driver.setParticleContext({});
  driver.setAvailableClips([
    { name: 'retargeted_action', duration: 4 },
    { name: 'breathing-m', duration: 3 },
  ]);
  return driver;
};

describe('RuntimeLoop', () => {
  it('ticks the driver with computed delta seconds', () => {
    const driver = buildRuntimeDriver();
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0.25,
    });
    const spy = vi.spyOn(driver, 'tick');
    loop.step(1000);
    loop.step(2000);

    expect(spy).toHaveBeenCalledTimes(2);
    const secondCall = spy.mock.calls[1]?.[0];
    expect(secondCall?.deltaSeconds).toBeCloseTo(1, 6);
    expect(secondCall?.globalProgress).toBe(0.25);
  });

  it('respects fpsCap by skipping frames', () => {
    const driver = buildRuntimeDriver();
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0,
      fpsCap: 10,
    });
    const spy = vi.spyOn(driver, 'tick');
    loop.step(0);
    loop.step(50);
    loop.step(100);
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0]?.[0];
    expect(call?.deltaSeconds).toBeCloseTo(0.1, 6);
  });

  it('stepImmediate forces a tick on sub-ticks', () => {
    const driver = buildRuntimeDriver();
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0,
      fpsCap: 1,
    });
    const spy = vi.spyOn(driver, 'tick');
    loop.step(0);
    loop.step(500);
    loop.stepImmediate(600);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('uses wallTimeOverride when set', () => {
    const driver = buildRuntimeDriver();
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0,
    });
    const spy = vi.spyOn(driver, 'tick');
    loop.setWallTimeOverride(5);
    loop.step(1000);
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[0]?.[0];
    expect(call?.wallTimeSeconds).toBe(5);
  });

  it('uses fixedDeltaSeconds when provided', () => {
    const driver = buildRuntimeDriver();
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0,
      fixedDeltaSeconds: 0.5,
    });
    const spy = vi.spyOn(driver, 'tick');
    loop.step(0);
    loop.step(1000);
    const call = spy.mock.calls[1]?.[0];
    expect(call?.deltaSeconds).toBeCloseTo(0.5, 6);
  });

  it('schedules frames with the provided clock and cancels on stop', () => {
    const driver = buildRuntimeDriver();
    const callbacks: Array<(nowMs: number) => void> = [];
    let cancelled: RuntimeLoopFrameHandle | null = null;
    const clock: RuntimeLoopClock = {
      now: () => 0,
      requestFrame: (cb) => {
        callbacks.push(cb);
        return callbacks.length;
      },
      cancelFrame: (id) => {
        cancelled = id;
      },
    };
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0,
      clock,
    });
    const spy = vi.spyOn(driver, 'tick');
    loop.start();
    expect(callbacks.length).toBe(1);
    callbacks[0]?.(1000);
    expect(spy).toHaveBeenCalled();
    expect(callbacks.length).toBe(2);
    loop.stop();
    expect(cancelled).not.toBeNull();
  });
});
