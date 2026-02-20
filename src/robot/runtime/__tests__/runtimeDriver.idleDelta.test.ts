/**
 * RuntimeDriver idle-delta regression tests.
 *
 * These tests verify that idle ticks (same tick.index as the previous frame)
 * do not trigger redundant full model applies. They also verify that calling
 * setSceneTrack with the same track reference is a no-op.
 *
 * Test 3 fails today because setSceneTrack always resets lastTickIndex = null
 * and needsSeed = true, even when the same track reference is passed in.
 * Tests 1 and 2 serve as regression guards after removing the hash map.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RuntimeDriverImpl } from '../RuntimeDriver';
import { MockWorld, MockNode } from '../mocks/MockWorld';
import { MockModel } from '../mocks/MockModel';
import { MockMotionSystem } from '../mocks/MockMotionSystem';
import { MockAnimationPlayer } from '../mocks/MockAnimationPlayer';
import { buildMockMotionRig } from '../mocks/MockMotionRig';
import { ROBOT_GROUP_LIMITS } from '../../../components/logoParticleOptimizedViewer/robotBodyGroups';
import type { SceneFrame } from '../../model/robotSceneTypes';
import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
import { createSceneTrackSampler } from '../compiler/sceneTrackSampler';

// ─── Minimal test fixtures ────────────────────────────────────────────────────

const MODEL_ID = 'model-a';

const buildMinimalFrame = (index: number): SceneFrame => ({
  id: 'test-scene',
  scrollProgress: index / 10,
  isLightScene: false,
  lighting: {
    ambient: { color: '#ffffff', intensity: 0 },
    directional: { color: '#ffffff', intensity: 0, position: [0, 1, 0] },
    intensityScale: 1,
    color: '#ffffff',
  },
  environment: {
    enabled: false,
    intensity: 0,
  },
  floor: {
    enabled: false,
  },
  background: {
    opacity: 0,
  },
  ribbon: {
    enabled: false,
  },
  models: {
    [MODEL_ID]: {
      model: {
        scale: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        enabled: true,
      },
      playback: {
        motion: { commands: [], scenes: [] },
        animation: {
          enabled: false,
        },
      },
      enabled: true,
    },
  },
});

const buildTick = (index: number): SceneTrackTick => {
  const frame = buildMinimalFrame(index);
  const modelState = frame.models?.[MODEL_ID];
  return {
    index,
    progress: index / 10,
    sceneId: 'test-scene',
    sceneIndex: 0,
    sceneProgress: index / 10,
    state: frame,
    deltaForward: {
      models: modelState ? { [MODEL_ID]: { model: modelState.model } } : undefined,
    },
    deltaBackward: {
      models: modelState ? { [MODEL_ID]: { model: modelState.model } } : undefined,
    },
  };
};

const buildTrack = (tickCount = 3): SceneTrack => {
  const ticks = Array.from({ length: tickCount }, (_, i) => buildTick(i));
  return {
    ticks,
    tickStep: 1 / (tickCount - 1),
    subTickCount: tickCount,
    sceneWindows: [{ id: 'test-scene', index: 0, start: 0, end: 1, entryStart: 0 }],
  };
};

const buildDriver = () => {
  const world = new MockWorld('WorldRoot');
  world.addNode(new MockNode('RobotRoot'));
  const model = new MockModel('RobotRoot', world);
  const motionSystem = new MockMotionSystem(buildMockMotionRig(world, ROBOT_GROUP_LIMITS));
  const animationPlayer = new MockAnimationPlayer();

  const driver = new RuntimeDriverImpl({
    world,
    model,
    motionSystem,
    animationPlayer,
  });
  return { driver, world, model };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RuntimeDriver idle-delta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Test 1: idle ticks after setSceneTrack do not re-apply full state', () => {
    it('applyModelState is called only once for repeated ticks at the same index', () => {
      const { driver } = buildDriver();
      const track = buildTrack(3);
      const sampler = createSceneTrackSampler(track);

      driver.setSceneTrack(track, sampler);

      const spy = vi.spyOn(driver.sceneRuntime, 'applyModelState');

      // First tick — needsSeed → full apply expected
      driver.tick({ deltaSeconds: 1 / 60, globalProgress: 0, wallTimeSeconds: 0 });
      const firstCallCount = spy.mock.calls.length;
      expect(firstCallCount).toBeGreaterThan(0);

      // Clear spy to isolate subsequent ticks
      spy.mockClear();

      // Second tick at same progress (same tick.index = 0)
      driver.tick({ deltaSeconds: 1 / 60, globalProgress: 0, wallTimeSeconds: 1 / 60 });
      expect(spy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ mode: 'full' }),
      );

      // Third tick at same progress — still no full apply
      driver.tick({ deltaSeconds: 1 / 60, globalProgress: 0, wallTimeSeconds: 2 / 60 });
      expect(spy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ mode: 'full' }),
      );
    });
  });

  describe('Test 2: idle ticks after setModelOverrides do not re-apply full state', () => {
    it('after the overrides-triggered full apply, subsequent idle ticks are skipped', () => {
      const { driver } = buildDriver();
      const track = buildTrack(3);
      const sampler = createSceneTrackSampler(track);

      driver.setSceneTrack(track, sampler);

      // Warm up — first tick
      driver.tick({ deltaSeconds: 1 / 60, globalProgress: 0, wallTimeSeconds: 0 });

      // Apply overrides — this sets needsSeed = true
      driver.setModelOverrides({});

      const spy = vi.spyOn(driver.sceneRuntime, 'applyModelState');

      // Tick with needsSeed active — full apply is expected ONCE
      driver.tick({ deltaSeconds: 1 / 60, globalProgress: 0, wallTimeSeconds: 1 / 60 });
      const callCountAfterSeed = spy.mock.calls.length;
      expect(callCountAfterSeed).toBeGreaterThan(0);
      spy.mockClear();

      // Subsequent idle tick — NO apply expected
      driver.tick({ deltaSeconds: 1 / 60, globalProgress: 0, wallTimeSeconds: 2 / 60 });
      expect(spy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ mode: 'full' }),
      );
    });
  });

  describe('Test 3: setSceneTrack with same reference is a no-op', () => {
    it('does not reset delta state when the same track reference is passed again', () => {
      const { driver } = buildDriver();
      const track = buildTrack(3);
      const sampler = createSceneTrackSampler(track);

      // Initial setup
      driver.setSceneTrack(track, sampler);
      driver.tick({ deltaSeconds: 1 / 60, globalProgress: 0, wallTimeSeconds: 0 });

      // Set the SAME track reference again (should be a no-op after the fix)
      driver.setSceneTrack(track, sampler);

      const spy = vi.spyOn(driver.sceneRuntime, 'applyModelState');

      // Tick at same progress — if setSceneTrack reset lastTickIndex, this will be a full apply
      driver.tick({ deltaSeconds: 1 / 60, globalProgress: 0, wallTimeSeconds: 1 / 60 });

      // Should NOT have triggered a full apply (no delta reset)
      expect(spy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ mode: 'full' }),
      );
    });
  });
});
