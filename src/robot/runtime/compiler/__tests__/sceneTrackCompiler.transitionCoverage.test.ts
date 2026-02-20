import {describe, expect, it} from 'vitest';
import type {SceneFrameOverride} from '../sceneTypes';
import {createAutoTransitionTransition} from '../sceneTransitions';
import {createTestScene, createTestTimeline, SceneTrackInspector} from './compilerE2eUtils';
import {compileSceneTrack} from '../sceneTrackCompiler';
import type {CustomAnimation, RobotMotionCommand, RobotMotionScene} from '../../../model/robotSceneTypes';
import type {AnnotationDefinition} from '../../../annotations/annotationTypes';
import {expectNumberClose, expectVec3Close} from './transitionTestUtils';

const modelId = 'model-a';

const buildTransition = () => {
  const timeline = createTestTimeline(['intro', 'robot']);
  const context = {
    progress: 0,
    sceneProgress: 0,
    globalProgress: 0,
    sceneStart: 0,
    sceneEnd: 1,
    assetsReady: true,
    timeline,
  };
  return createAutoTransitionTransition({ exitStart: 0.2, exitEnd: 0.6, enterStart: 0.6, enterEnd: 1 }, context);
};

const buildTrack = (fromFrame: SceneFrameOverride, toFrame: SceneFrameOverride) => {
  const timeline = createTestTimeline(['intro', 'robot'], 10);
  const track = compileSceneTrack({
    scenes: [
      createTestScene({ id: 'intro', index: 0, frame: fromFrame, transitions: [buildTransition()] }),
      createTestScene({ id: 'robot', index: 1, frame: toFrame }),
    ],
    timeline,
    assetsReady: true,
    availableClips: [],
    prefersReducedMotion: false,
  });
  return new SceneTrackInspector(track);
};

const sampleCommand = (groupId: string): RobotMotionCommand => ({
  groupId,
  rotate: { yawPct: 0 },
  translate: { xPct: 0 },
  weight: 1,
  space: 'local',
});

const sampleScene = (id: string): RobotMotionScene => ({
  id,
  start: 0,
  end: 1,
  commands: [sampleCommand(id)],
  holdAtEnd: false,
});

const sampleAnimation = (id: string): CustomAnimation => ({
  id,
  enabled: true,
  weight: 1,
  apply: () => [],
});

const baseAnnotation = (overrides: Partial<AnnotationDefinition> = {}): AnnotationDefinition => ({
  id: 'anno',
  label: 'anno',
  labelAnchor: { reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } },
  style: { labelOpacity: 1, lineOpacity: 1, backgroundOpacity: 1, css: { opacity: 1 }, containerCss: { opacity: 1 } },
  ...overrides,
});

describe('sceneTrackCompiler transition coverage', () => {
  it('blends all major domains within the intro transition window', () => {
    const fromFrame: SceneFrameOverride = {
      lighting: {
        ambient: { intensity: 0, color: '#000000' },
        directional: { intensity: 0, color: '#000000', position: [0, 0, 0] },
        points: [{ intensity: 0, color: '#000000', position: [0, 0, 0] }],
        spots: [{ intensity: 0, color: '#000000', position: [0, 0, 0], target: [0, 0, 0], angle: 0, penumbra: 0, distance: 0, decay: 0 }],
        panels: [{ id: 'panel-a', origin: [0, 0, 0], rows: 1, cols: 1, spacing: [0, 0, 0], intensity: 0, distance: 0, decay: 0, color: '#000000', matrix: [1, 0, 0, 1] }],
        intensityScale: 0,
        color: '#000000',
      },
      environment: { enabled: true, intensity: 0, url: 'env-a' },
      floor: { enabled: true, textureUrl: 'floor-a' },
      background: { imageUrl: 'bg-a', opacity: 1 },
      models: {
        [modelId]: {
          model: {
            scale: 1,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            metalness: 0,
            roughness: 0,
            bodyPartOverrides: {
              head: { opacity: 1, color: '#000000', metalness: 0, roughness: 0, pose: { rotate: { yawPct: 0 }, translate: { xPct: 0 } } },
            },
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                enabled: true,
                modelId: 'brain',
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: 1,
                opacity: 1,
                subparts: {
                  left: { id: 'left', enabled: true, opacity: 0, color: '#000000', metalness: 0, roughness: 0 },
                },
              },
            },
          },
          playback: {
            motion: {
              commands: [sampleCommand('from')],
              scenes: [sampleScene('from')],
              customAnimations: [sampleAnimation('from')],
              pose: { mode: 'override', groups: { arm: { rotate: { yawPct: 0 }, translate: { xPct: 0 }, space: 'local' } } },
            },
            animation: { enabled: true, weight: 0 },
          },
        },
      },
      ribbon: {
        enabled: true,
        config: {
          strandCount: 1,
          spacing: 1,
          radius: 1,
          radiusTaper: 0,
          segments: 4,
          twistFrequency: 0,
          twistPhase: 0,
          opacity: 0,
          glowLightsEnabled: true,
          glowLightCount: 0,
          glowLightIntensity: 0,
          glowLightColor: '#000000',
          glowLightDistance: 0,
          glowLightDecay: 0,
          curve: {
            width: 0,
            yOffset: 0,
            z: 0,
            waveAmplitude: 0,
            waveFrequency: 0,
            depthAmplitude: 0,
            depthFrequency: 0,
            depthPhase: 0,
          },
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      },
      annotations: [baseAnnotation()],
    };

    const toFrame: SceneFrameOverride = {
      lighting: {
        ambient: { intensity: 10, color: '#ffffff' },
        directional: { intensity: 10, color: '#ffffff', position: [10, 10, 10] },
        points: [{ intensity: 10, color: '#ffffff', position: [10, 10, 10] }],
        spots: [{ intensity: 10, color: '#ffffff', position: [10, 10, 10], target: [10, 10, 10], angle: 1, penumbra: 1, distance: 10, decay: 1 }],
        panels: [{ id: 'panel-a', origin: [0, 0, 0], rows: 1, cols: 1, spacing: [0, 0, 0], intensity: 10, distance: 10, decay: 1, color: '#ffffff', matrix: [1, 0, 0, 1] }],
        intensityScale: 10,
        color: '#ffffff',
      },
      environment: { enabled: true, intensity: 10, url: 'env-b' },
      floor: { enabled: true, textureUrl: 'floor-b' },
      background: { imageUrl: 'bg-b', opacity: 1 },
      models: {
        [modelId]: {
          model: {
            scale: 3,
            position: [10, 10, 10],
            rotation: [10, 10, 10],
            metalness: 1,
            roughness: 1,
            bodyPartOverrides: {
              head: { opacity: 0, color: '#ffffff', metalness: 1, roughness: 1, pose: { rotate: { yawPct: 1 }, translate: { xPct: 1 } } },
            },
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                enabled: true,
                modelId: 'brain',
                position: [10, 10, 10],
                rotation: [10, 10, 10],
                scale: 2,
                opacity: 0,
                subparts: {
                  left: { id: 'left', enabled: true, opacity: 1, color: '#ffffff', metalness: 1, roughness: 1 },
                },
              },
            },
          },
          playback: {
            motion: {
              commands: [sampleCommand('to')],
              scenes: [sampleScene('to')],
              customAnimations: [sampleAnimation('to')],
              pose: { mode: 'override', groups: { arm: { rotate: { yawPct: 1 }, translate: { xPct: 1 }, space: 'local' } } },
            },
            animation: { enabled: true, weight: 1 },
          },
        },
      },
      ribbon: {
        enabled: true,
        config: {
          strandCount: 3,
          spacing: 3,
          radius: 3,
          radiusTaper: 1,
          segments: 8,
          twistFrequency: 2,
          twistPhase: 1,
          opacity: 1,
          glowLightsEnabled: true,
          glowLightCount: 4,
          glowLightIntensity: 2,
          glowLightColor: '#ffffff',
          glowLightDistance: 2,
          glowLightDecay: 2,
          curve: {
            width: 2,
            yOffset: 2,
            z: 2,
            waveAmplitude: 2,
            waveFrequency: 2,
            depthAmplitude: 2,
            depthFrequency: 2,
            depthPhase: 2,
          },
          position: [10, 10, 10],
          rotation: [10, 10, 10],
          scale: [2, 2, 2],
        },
      },
      annotations: [baseAnnotation({ style: { labelOpacity: 0, lineOpacity: 0, backgroundOpacity: 0, css: { opacity: 0 }, containerCss: { opacity: 0 } } })],
    };

    const inspector = buildTrack(fromFrame, toFrame);
    const tick = inspector.tickAtSceneProgress('intro', 0.4);

    expectNumberClose(tick.state.lighting.ambient.intensity, 2.5);
    expectVec3Close(tick.state.lighting.directional.position, [2.5, 2.5, 2.5]);
    expectNumberClose(tick.state.environment.intensity, 2.5);
    expect(tick.state.environment.url).toBe('env-a');
    expect(tick.state.floor.textureUrl).toBe('floor-a');
    expectNumberClose(tick.state.background.opacity, 0.5);

    const model = tick.state.models?.[modelId]?.model;
    expectVec3Close(model?.position, [2.5, 2.5, 2.5]);
    expectNumberClose(model?.scale, 1.5);
    expectNumberClose(model?.bodyPartOverrides?.head?.pose?.rotate?.yawPct, 0.25);
    expectNumberClose(model?.parts?.brain.opacity, 0.75);
    expectNumberClose(model?.parts?.brain.subparts?.left?.opacity, 0.25);

    expectNumberClose(tick.state.ribbon.config?.radius, 1.5);
    expectVec3Close(tick.state.ribbon.config?.position, [2.5, 2.5, 2.5]);
    expectNumberClose(tick.state.ribbon.config?.opacity, 0.25);

    const playback = tick.state.models?.[modelId]?.playback;
    expectNumberClose(playback?.animation.weight, 0.25);
    expectNumberClose(playback?.motion.pose?.groups.arm?.rotate?.yawPct, 0.25);

    const anno = tick.state.annotations?.[0];
    expectNumberClose(anno?.style?.labelOpacity, 0.75);
  });

  it('treats differing annotation ids as out/in when compiling', () => {
    const fromFrame: SceneFrameOverride = {
      annotations: [baseAnnotation({ id: 'old', style: { labelOpacity: 1 } })],
    };
    const toFrame: SceneFrameOverride = {
      annotations: [baseAnnotation({ id: 'new', style: { labelOpacity: 1 } })],
    };
    const inspector = buildTrack(fromFrame, toFrame);
    const tick = inspector.tickAtSceneProgress('intro', 0.4);
    const ids = tick.state.annotations?.map((item) => item.id) ?? [];
    expect(ids).toContain('old');
    expect(ids).toContain('new');
  });
});
