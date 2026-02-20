import type {RobotMotionCommand, RibbonConfig, SceneAnimation, SceneMotion} from '../../../model/robotSceneTypes';
import {createDefaultModelState, createDefaultPlayback} from '../../../model/sceneState';
import {clamp01} from '../../../robotTimelineMath';
import type {SceneDefinition, SceneGroup} from '../../compiler/sceneTypes';
import {createTestScene, createTestTimeline} from '../../compiler/__tests__/compilerE2eUtils';

type ModelOverrides = {
  position?: [number, number, number];
  attachmentEnabled?: boolean;
  brainEnabled?: boolean;
  motion?: Partial<SceneMotion>;
  animation?: Partial<SceneAnimation>;
};

export const TEST_SCENE_IDS = ['intro', 'robot', 'memory', 'detail', 'ec'] as const;

export const TEST_RIBBON_CONFIG: RibbonConfig = {
  strandCount: 8,
  spacing: 1,
  radius: 0.1,
  radiusTaper: 0.9,
  segments: 40,
  twistFrequency: 0,
  twistPhase: 0,
  opacity: 0,
  glowLightsEnabled: false,
  glowLightCount: 2,
  glowLightIntensity: 0.2,
  glowLightColor: '#ffffff',
  glowLightDistance: 10,
  glowLightDecay: 1,
  curve: {
    width: 40,
    yOffset: 0,
    z: 0,
    waveAmplitude: 0,
    waveFrequency: 1,
    depthAmplitude: 0,
    depthFrequency: 1,
    depthPhase: 0,
  },
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

export const TEST_BASE_MOTION_COMMANDS: RobotMotionCommand[] = [
  { groupId: 'robot', rotate: { yawPct: -10 / 30 } },
  { groupId: 'left_fingers', rotate: { pitchPct: 0.2 } },
  { groupId: 'right_fingers', rotate: { pitchPct: 0.2 } },
];

const buildModelInstance = (overrides: ModelOverrides = {}) => {
  const baseModel = createDefaultModelState();
  const basePlayback = createDefaultPlayback();
  const brainEnabled = overrides.brainEnabled ?? true;
  const attachmentEnabled = overrides.attachmentEnabled ?? true;

  return {
    enabled: true,
    model: {
      ...baseModel,
      position: overrides.position ?? baseModel.position,
      parts: {
        brain: {
          id: 'brain',
          anchor: 'head',
          enabled: brainEnabled,
          position: [0, 0, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: 1,
          modelId: 'brain',
        },
        attachment: {
          id: 'attachment',
          anchor: 'chest',
          enabled: attachmentEnabled,
          position: [0, 0, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: 1,
          modelId: 'attachment',
        },
      },
    },
    playback: {
      ...basePlayback,
      motion: {
        ...basePlayback.motion,
        ...(overrides.motion ?? {}),
      },
      animation: {
        ...basePlayback.animation,
        ...(overrides.animation ?? {}),
      },
    },
  };
};

const introScene: SceneDefinition = createTestScene({
  id: 'intro',
  index: 0,
  frame: (context) => {
    const blend = clamp01((context.sceneProgress - 0.7) / 0.3);
    const baseOpacity = clamp01(1 - (context.sceneProgress - 0.2) / 0.4);
    const robotOpacity = clamp01((context.sceneProgress - 0.6) / 0.3);
    return {
      id: 'intro',
      ribbon: {
        enabled: context.sceneProgress > 0.6,
        config: { ...TEST_RIBBON_CONFIG, opacity: 0 },
      },
      models: {
        primary: buildModelInstance({
          position: [0, 5 * blend, 0],
          attachmentEnabled: true,
          brainEnabled: true,
        }),
      },
      annotations: [
        {
          id: 'base-message',
          label: 'Base',
          mode: 'screen',
          target: { targetPoint: [0, 0, 0] },
          labelAnchor: { reference: { x: 'center', y: 'center' }, offset: { xPct: 0, yPct: 0 } },
          style: { labelOpacity: baseOpacity, lineOpacity: 0, lineThickness: 0 },
        },
        {
          id: 'robot-message',
          label: 'Robot',
          mode: 'screen',
          target: { targetPoint: [0, 0, 0] },
          labelAnchor: { reference: { x: 'center', y: 'center' }, offset: { xPct: 0, yPct: 0 } },
          style: { labelOpacity: robotOpacity, lineOpacity: 0, lineThickness: 0 },
        },
      ],
    };
  },
});

const robotScene: SceneDefinition = createTestScene({
  id: 'robot',
  index: 1,
  frame: {
    id: 'robot',
    ribbon: {
      enabled: true,
      config: { ...TEST_RIBBON_CONFIG, opacity: 0 },
    },
    models: {
      primary: buildModelInstance({
        position: [0, 5, 0],
        attachmentEnabled: false,
        brainEnabled: true,
        motion: {
          commands: TEST_BASE_MOTION_COMMANDS,
          scenes: [],
        },
        animation: {
          enabled: false,
        },
      }),
    },
  },
});

const memoryScene: SceneDefinition = createTestScene({
  id: 'memory',
  index: 2,
  frame: {
    id: 'memory',
    models: {
      primary: buildModelInstance({
        position: [0, 5, 0],
        attachmentEnabled: false,
        brainEnabled: true,
      }),
    },
  },
});

const detailScene: SceneDefinition = createTestScene({
  id: 'detail',
  index: 3,
  frame: {
    id: 'detail',
    models: {
      primary: buildModelInstance({
        position: [0, 5, 0],
        attachmentEnabled: false,
        brainEnabled: true,
        animation: {
          enabled: true,
          clipName: 'retargeted_action',
          clipStart: 0,
          clipEnd: 4,
          clipRepeat: false,
        },
      }),
    },
  },
});

const ecScene: SceneDefinition = createTestScene({
  id: 'ec',
  index: 4,
  frame: {
    id: 'ec',
    models: {
      primary: buildModelInstance({
        position: [0, 5, 0],
        attachmentEnabled: false,
        brainEnabled: true,
        animation: {
          enabled: false,
        },
      }),
    },
  },
});

export const TEST_SCENES: SceneDefinition[] = [
  introScene,
  robotScene,
  memoryScene,
  detailScene,
  ecScene,
];

export const TEST_TIMELINE = createTestTimeline([...TEST_SCENE_IDS], 1);

export const testSceneGroup: SceneGroup = {
  id: 'test-scenes',
  scenes: TEST_SCENES,
  timeline: TEST_TIMELINE,
};

export const testRobotScene = robotScene;
export const testDetailScene = detailScene;
