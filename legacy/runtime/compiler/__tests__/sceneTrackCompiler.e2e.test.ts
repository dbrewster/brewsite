import {describe, expect, it} from 'vitest';
import type {RibbonConfig, RobotMotionCommand, RobotMotionScene, SceneLighting} from '../../../model/robotSceneTypes';
import type {SceneFrameOverride} from '../sceneTypes';
import {compileTestTrack, createTestScene, createTestTimeline, SceneTrackInspector,} from './compilerE2eUtils';

const modelId = 'model-a';

const buildInspector = (scenes: ReturnType<typeof createTestScene>[], options?: {
  subTicksPerSegment?: number;
  availableClips?: Array<{ name: string; duration: number }>;
}) => {
  const timeline = createTestTimeline(
    scenes.map((scene) => scene.id),
    options?.subTicksPerSegment ?? 4,
  );
  const track = compileTestTrack({
    scenes,
    timeline,
    availableClips: options?.availableClips ?? [],
  });
  return new SceneTrackInspector(track);
};

describe('sceneTrackCompiler e2e', () => {
  describe('lighting', () => {
    const lightingA: SceneLighting = {
      ambient: { intensity: 0.2, color: '#110000' },
      directional: { intensity: 0.6, color: '#ffffff', position: [1, 2, 3] },
      points: [{ intensity: 0.1, color: '#ffffff', position: [0, 1, 2] }],
      spots: [],
      intensityScale: 1,
      color: '',
    };
    const lightingB: SceneLighting = {
      ambient: { intensity: 0.4, color: '#222222' },
      directional: { intensity: 1.2, color: '#ffeeee', position: [-2, 8, 4] },
      points: [{ intensity: 0.2, color: '#ff00ff', position: [-1, 0, 2] }],
      spots: [
        {
          intensity: 0.5,
          color: '#00ff00',
          position: [0, 5, 1],
          target: [0, 0, 0],
          angle: 0.5,
          penumbra: 0.2,
          distance: 10,
          decay: 2,
        },
      ],
      intensityScale: 0.8,
      color: '',
    };

    it('emits lighting deltas at the scene boundary', () => {
      const scenes = [
        createTestScene({ id: 'alpha', index: 0, frame: { lighting: lightingA } }),
        createTestScene({ id: 'beta', index: 1, frame: { lighting: lightingB } }),
        createTestScene({ id: 'gamma', index: 2, frame: { lighting: lightingB } }),
      ];
      const inspector = buildInspector(scenes);
      const delta = inspector.deltaForwardAtSceneProgress('beta', 0);
      expect(delta.lighting?.ambient.intensity).toBe(0.4);
      expect(delta.lighting?.directional.position).toEqual([-2, 8, 4]);
      expect(delta.lighting?.intensityScale).toBe(0.8);
    });

  });

  describe('ribbon', () => {
    const ribbonConfig: RibbonConfig = {
      strandCount: 12,
      spacing: 0.45,
      radius: 2.1,
      radiusTaper: 0.8,
      segments: 18,
      twistFrequency: 1.3,
      twistPhase: 0.2,
      opacity: 0.6,
      glowLightsEnabled: true,
      glowLightCount: 8,
      glowLightIntensity: 0.7,
      glowLightColor: '#88ddff',
      glowLightDistance: 4,
      glowLightDecay: 1.4,
      curve: {
        width: 1.2,
        yOffset: 0.2,
        z: 0.1,
        waveAmplitude: 0.5,
        waveFrequency: 1.1,
        depthAmplitude: 0.4,
        depthFrequency: 0.9,
        depthPhase: 0.25,
      },
      position: [0.2, 0.4, -0.1],
      rotation: [0, 0.3, 0],
      scale: [1, 1, 1],
    };

    it('emits ribbon enablement + config deltas', () => {
      const scenes = [
        createTestScene({ id: 'alpha', index: 0, frame: { ribbon: { enabled: false } } }),
        createTestScene({ id: 'beta', index: 1, frame: { ribbon: { enabled: true, config: ribbonConfig } } }),
        createTestScene({ id: 'gamma', index: 2, frame: { ribbon: { enabled: true, config: ribbonConfig } } }),
      ];
      const inspector = buildInspector(scenes);
      const delta = inspector.deltaForwardAtSceneProgress('beta', 0);
      expect(delta.ribbon?.enabled).toBe(true);
      expect(delta.ribbon?.config?.curve.waveAmplitude).toBe(0.5);
      expect(delta.ribbon?.config?.glowLightIntensity).toBe(0.7);
    });

  });

  describe('model parts', () => {
    it('captures part enablement and transforms', () => {
      const scenes = [
        createTestScene({
          id: 'alpha',
          index: 0,
          frame: {
            models: {
              [modelId]: {
                model: {
                  parts: {
                    attachment: {
                      id: 'attachment',
                      anchor: 'chest',
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
        createTestScene({
          id: 'beta',
          index: 1,
          frame: {
            models: {
              [modelId]: {
                model: {
                  parts: {
                    attachment: {
                      enabled: false,
                      position: [12, 24, -1],
                      rotation: [0, 1.2, 0],
                    },
                  },
                },
              },
            },
          },
        }),
        createTestScene({ id: 'gamma', index: 2, frame: { models: { [modelId]: {} } } }),
      ];
      const inspector = buildInspector(scenes);
      const delta = inspector.deltaForwardAtSceneProgress('beta', 0);
      const deltaModel = delta.models?.[modelId]?.model;
      expect(deltaModel?.parts?.attachment?.enabled).toBe(false);
      expect(deltaModel?.parts?.attachment?.rotation).toEqual([0, 1.2, 0]);
    });

    it('re-enables parts when scrubbing backward', () => {
      const scenes = [
        createTestScene({
          id: 'alpha',
          index: 0,
          frame: {
            models: {
              [modelId]: {
                model: {
                  parts: {
                    attachment: {
                      id: 'attachment',
                      anchor: 'chest',
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
        createTestScene({
          id: 'beta',
          index: 1,
          frame: {
            models: {
              [modelId]: {
                model: { parts: { attachment: { enabled: false } } },
              },
            },
          },
        }),
        createTestScene({ id: 'gamma', index: 2, frame: { models: { [modelId]: {} } } }),
      ];
      const inspector = buildInspector(scenes);
      const base = inspector.tickAtSceneProgress('alpha', 0);
      expect(base.state.models?.[modelId]?.model.parts?.attachment?.enabled).toBe(true);
      const forwardDelta = inspector.deltaForwardAtSceneProgress('beta', 0);
      expect(forwardDelta.models?.[modelId]?.model?.parts?.attachment?.enabled).toBe(false);
      // 0.975 is the scene progress of the last alpha tick before the alpha→beta boundary
      // (3 scenes, subTicksPerSegment=4, multiplier=10 → 81 ticks, tickStep=1/80; last alpha tick at global 0.4875 = alpha scene 0.975)
      const delta = inspector.deltaBackwardAtSceneProgress('alpha', 0.975);
      expect(delta.models?.[modelId]?.model?.parts?.attachment?.enabled).toBe(true);
    });

    it('keeps parts disabled across transitions', () => {
      const scenes = [
        createTestScene({
          id: 'alpha',
          index: 0,
          frame: {
            models: {
              [modelId]: {
                model: { parts: { attachment: { enabled: false } } },
              },
            },
          },
        }),
        createTestScene({
          id: 'beta',
          index: 1,
          frame: {
            models: {
              [modelId]: {
                model: { parts: { attachment: { enabled: false } } },
              },
            },
          },
        }),
        createTestScene({
          id: 'gamma',
          index: 2,
          frame: {
            models: {
              [modelId]: {
                model: { parts: { attachment: { enabled: false } } },
              },
            },
          },
        }),
      ];
      const timeline = createTestTimeline(
        scenes.map((scene) => scene.id),
        4,
      );
      const track = compileTestTrack({
        scenes,
        timeline,
        availableClips: [],
      });
      for (const tick of track.ticks) {
        expect(tick.state.models?.[modelId]?.model.parts?.attachment?.enabled).toBe(false);
      }
    });
  });

  describe('motion', () => {
    const motionCommands: RobotMotionCommand[] = [
      { groupId: 'torso', rotate: { yawPct: 0.4 }, weight: 0.8, space: 'local' },
      { groupId: 'head', translate: { xPct: 0.2, yPct: -0.1 }, space: 'world' },
    ];
    const motionScenes: RobotMotionScene[] = [
      {
        id: 'orbit',
        start: 0,
        end: 1,
        commands: motionCommands,
        holdAtEnd: true,
      },
    ];

    it('emits motion command deltas', () => {
      const scenes = [
        createTestScene({ id: 'alpha', index: 0, frame: { models: { [modelId]: {} } } }),
        createTestScene({
          id: 'beta',
          index: 1,
          frame: { models: { [modelId]: { playback: { motion: { commands: motionCommands, scenes: motionScenes } } } } },
        }),
        createTestScene({ id: 'gamma', index: 2, frame: { models: { [modelId]: {} } } }),
      ];
      const inspector = buildInspector(scenes);
      const delta = inspector.deltaForwardAtSceneProgress('beta', 0);
      expect(delta.models?.[modelId]?.playback?.motion?.commands?.length).toBe(2);
      expect(delta.models?.[modelId]?.playback?.motion?.commands?.[0]?.rotate?.yawPct).toBe(0.4);
      expect(delta.models?.[modelId]?.playback?.motion?.scenes?.[0]?.id).toBe('orbit');
    });
  });

  describe('background + app animation', () => {
    it('tracks background image + opacity changes', () => {
      const scenes = [
        createTestScene({ id: 'alpha', index: 0, frame: { background: { opacity: 0 } } }),
        createTestScene({
          id: 'beta',
          index: 1,
          frame: { background: { imageUrl: '/assets/bg.png', opacity: 0.6 } },
        }),
        createTestScene({ id: 'gamma', index: 2, frame: { background: { opacity: 0 } } }),
      ];
      const inspector = buildInspector(scenes);
      const delta = inspector.deltaForwardAtSceneProgress('beta', 0);
      expect(delta.background?.imageUrl).toBe('/assets/bg.png');
      expect(delta.background?.opacity).toBe(0.6);
    });

    it('includes custom animation hooks in playback deltas', () => {
      const scenes = [
        createTestScene({ id: 'alpha', index: 0, frame: { models: { [modelId]: {} } } }),
        createTestScene({
          id: 'beta',
          index: 1,
          frame: {
            models: {
              [modelId]: {
                playback: {
                  motion: {
                    customAnimations: [
                      { id: 'app-pulse', enabled: true, apply: () => [] },
                    ],
                  },
                },
              },
            },
          },
        }),
        createTestScene({ id: 'gamma', index: 2, frame: { models: { [modelId]: {} } } }),
      ];
      const inspector = buildInspector(scenes);
      const delta = inspector.deltaForwardAtSceneProgress('beta', 0);
      expect(delta.models?.[modelId]?.playback?.motion?.customAnimations?.[0]?.id).toBe('app-pulse');
      expect(delta.models?.[modelId]?.playback?.motion?.customAnimations?.[0]?.enabled).toBe(true);
    });
  });

  describe('animation', () => {
    it('emits compiled animation metadata when enabled', () => {
      const scenes = [
        createTestScene({ id: 'alpha', index: 0, frame: { models: { [modelId]: {} } } }),
        createTestScene({
          id: 'beta',
          index: 1,
          frame: {
            models: {
              [modelId]: {
                playback: { animation: { enabled: true, clipName: 'demo', clipRangeUnit: 'seconds' } },
              },
            },
          },
        }),
        createTestScene({ id: 'gamma', index: 2, frame: { models: { [modelId]: {} } } }),
      ];
      const inspector = buildInspector(scenes, {
        availableClips: [{ name: 'demo', duration: 2.5 }],
      });
      const tick = inspector.tickAtSceneProgress('beta', 0.5);
      const animation = tick.modelAnimations?.[modelId];
      expect(animation?.enabled).toBe(true);
      expect(animation?.clipName).toBe('demo');
      expect(animation?.clipDuration).toBe(2.5);
      expect(animation?.range?.span).toBeGreaterThan(0);
    });

    it('keeps compiled animation disabled by default', () => {
      const scenes = [
        createTestScene({ id: 'alpha', index: 0, frame: { models: { [modelId]: {} } } }),
        createTestScene({ id: 'beta', index: 1, frame: { models: { [modelId]: {} } } }),
        createTestScene({ id: 'gamma', index: 2, frame: { models: { [modelId]: {} } } }),
      ];
      const inspector = buildInspector(scenes);
      const tick = inspector.tickAtSceneProgress('beta', 0.5);
      const animation = tick.modelAnimations?.[modelId];
      expect(animation?.enabled ?? false).toBe(false);
    });
  });

  describe('environment + floor', () => {
    const frame: SceneFrameOverride = {
      environment: { enabled: true, url: '/assets/env.hdr', intensity: 1.2 },
      floor: { enabled: true, textureUrl: '/assets/floor.png' },
    };

    it('emits environment and floor deltas', () => {
      const scenes = [
        createTestScene({ id: 'alpha', index: 0 }),
        createTestScene({ id: 'beta', index: 1, frame }),
        createTestScene({ id: 'gamma', index: 2 }),
      ];
      const inspector = buildInspector(scenes);
      const delta = inspector.deltaForwardAtSceneProgress('beta', 0);
      expect(delta.environment?.enabled).toBe(true);
      expect(delta.environment?.intensity).toBe(1.2);
      expect(delta.floor?.enabled).toBe(true);
      expect(delta.floor?.textureUrl).toBe('/assets/floor.png');
    });

  });
});
