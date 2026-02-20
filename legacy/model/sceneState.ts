import {DEFAULT_ANNOTATION_DEFAULTS} from '../annotations/annotationDefaults';
import type {
  BodyPartOverrideMap,
  ModelPartOverrides,
  SceneAnimation,
  SceneFrame,
  SceneFrameOverride,
  SceneLighting,
  SceneModel,
  SceneModelInstanceState,
  SceneMotion,
  ScenePlayback,
  SceneRibbon,
} from './robotSceneTypes';
import type {RobotTimeline} from '../robotTimeline';
import type {ResourceRegistry} from '../../resources/sceneResources.generated';

export type SceneFrameContext = {
  progress: number;
  sceneProgress: number;
  globalProgress: number;
  sceneStart: number;
  sceneEnd: number;
  assetsReady: boolean;
  timeline: RobotTimeline;
  baseState?: SceneFrame;
  nextState?: SceneFrame;
  resourceRegistry?: ResourceRegistry;
};

const cloneVec3 = (value: [number, number, number]) => [value[0], value[1], value[2]] as [number, number, number];

const cloneBodyPartOverrides = (overrides: BodyPartOverrideMap | undefined) => {
  if (!overrides) return undefined;
  const entries = Object.entries(overrides).map(([key, value]) => [
    key,
    value
      ? {
        ...value,
        pose: value.pose
          ? {
            rotate: value.pose.rotate ? {...value.pose.rotate} : undefined,
            translate: value.pose.translate ? {...value.pose.translate} : undefined,
            space: value.pose.space,
          }
          : undefined,
      }
      : value,
  ] as const);
  return Object.fromEntries(entries) as BodyPartOverrideMap;
};

const cloneRibbonConfig = (config: SceneRibbon['config']) => {
  if (!config) return undefined;
  return {
    ...config,
    curve: {...config.curve},
    position: cloneVec3(config.position),
    rotation: cloneVec3(config.rotation),
    scale: cloneVec3(config.scale),
  };
};

const cloneMotionCommands = (commands: SceneMotion['commands']) =>
  commands.map((command) => ({
    ...command,
    rotate: command.rotate ? {...command.rotate} : undefined,
    translate: command.translate ? {...command.translate} : undefined,
  }));

const cloneMotionPose = (pose: SceneMotion['pose'] | undefined): SceneMotion['pose'] => {
  if (!pose) return undefined;
  const groups = Object.entries(pose.groups ?? {}).map(([key, value]) => [
    key,
    value
      ? {
        rotate: value.rotate ? {...value.rotate} : undefined,
        translate: value.translate ? {...value.translate} : undefined,
        space: value.space,
      }
      : value,
  ] as const);
  return {
    mode: pose.mode,
    groups: Object.fromEntries(groups),
  };
};

const cloneMotionScenes = (scenes: SceneMotion['scenes']) =>
  scenes.map((scene) => ({
    ...scene,
    commands:
      typeof scene.commands === 'function'
        ? scene.commands
        : scene.commands.map((command) => ({
          ...command,
          rotate: command.rotate ? {...command.rotate} : undefined,
          translate: command.translate ? {...command.translate} : undefined,
        })),
  }));

const cloneModelParts = (parts: SceneModel['parts']) => {
  if (!parts) return undefined;
  const entries = Object.entries(parts).map(([key, value]) => [
    key,
    {
      ...value,
      position: cloneVec3(value.position),
      rotation: cloneVec3(value.rotation),
      subparts: value.subparts
        ? (Object.fromEntries(
          Object.entries(value.subparts).map(([id, spec]) => [id, spec ? {...spec} : spec]),
        ) as NonNullable<typeof value.subparts>)
        : undefined,
    },
  ]);
  return Object.fromEntries(entries) as SceneModel['parts'];
};

const clonePlayback = (playback: ScenePlayback): ScenePlayback => ({
  motion: {
    ...playback.motion,
    commands: cloneMotionCommands(playback.motion.commands),
    scenes: cloneMotionScenes(playback.motion.scenes),
    customAnimations: playback.motion.customAnimations,
    pose: cloneMotionPose(playback.motion.pose),
  },
  animation: {...playback.animation},
});

const cloneSceneModel = (model: SceneModel): SceneModel => ({
  ...model,
  position: cloneVec3(model.position),
  rotation: cloneVec3(model.rotation),
  bodyPartOverrides: cloneBodyPartOverrides(model.bodyPartOverrides),
  parts: cloneModelParts(model.parts),
});

const cloneModelInstance = (instance: SceneModelInstanceState): SceneModelInstanceState => ({
  enabled: instance.enabled,
  model: cloneSceneModel(instance.model),
  playback: clonePlayback(instance.playback),
});

const mergeModelInstance = (
  base: SceneModelInstanceState,
  next: NonNullable<SceneFrameOverride['models']>[string],
): SceneModelInstanceState => {
  const baseModel = base.model;
  const nextModel = next.model ?? {};
  const model = {
    ...baseModel,
    ...nextModel,
    bodyPartOverrides: {
      ...(baseModel.bodyPartOverrides ?? {}),
      ...((nextModel as { bodyPartOverrides?: BodyPartOverrideMap }).bodyPartOverrides ?? {}),
    },
    parts: mergeModelParts(baseModel.parts, (nextModel as { parts?: ModelPartOverrides }).parts),
  };
  const resolvedEnabled = next.enabled ?? base.enabled;
  if (resolvedEnabled !== undefined && model.enabled === undefined) {
    model.enabled = resolvedEnabled;
  }
  const playback = (() => {
    if (!next.playback) return base.playback;
    const baseMotion = base.playback.motion ?? createDefaultMotion();
    const baseAnimation = base.playback.animation ?? createDefaultAnimation();
    return {
      motion: {
        ...baseMotion,
        ...next.playback.motion,
        commands: next.playback.motion?.commands
          ? cloneMotionCommands(next.playback.motion.commands)
          : baseMotion.commands,
        scenes: next.playback.motion?.scenes
          ? cloneMotionScenes(next.playback.motion.scenes)
          : baseMotion.scenes,
        customAnimations: next.playback.motion?.customAnimations ?? baseMotion.customAnimations,
        pose: next.playback.motion?.pose ? cloneMotionPose(next.playback.motion.pose) : baseMotion.pose,
      },
      animation: {...baseAnimation, ...next.playback.animation},
    };
  })();
  return {
    enabled: next.enabled ?? base.enabled,
    model,
    playback,
  };
};

const mergeModelParts = (
  baseParts: SceneModel['parts'],
  nextParts: ModelPartOverrides | undefined,
) => {
  if (!nextParts) return baseParts;
  const merged = {...(baseParts ?? {})} as NonNullable<SceneModel['parts']>;
  for (const [key, value] of Object.entries(nextParts)) {
    if (!value) continue;
    const id = key as keyof typeof merged;
    const base = merged[id];
    if (base) {
      merged[id] = {
        ...base,
        ...value,
        position: (value as { position?: [number, number, number] }).position ?? base.position,
        rotation: (value as { rotation?: [number, number, number] }).rotation ?? base.rotation,
        scale: (value as { scale?: number }).scale ?? base.scale,
        subparts: {
          ...(base.subparts ?? {}),
          ...((value as { subparts?: NonNullable<typeof base.subparts> }).subparts ?? {}),
        },
      };
    } else {
      const fallbackPosition = (value as { position?: [number, number, number] }).position ?? [0, 0, 0];
      const fallbackRotation = (value as { rotation?: [number, number, number] }).rotation ?? [0, 0, 0];
      const fallbackScale = (value as { scale?: number }).scale ?? 1;
      merged[id] = {
        id: (value as { id?: string }).id ?? (id as string),
        anchor: (value as { anchor?: string }).anchor ?? '',
        enabled: (value as { enabled?: boolean }).enabled ?? true,
        position: fallbackPosition,
        rotation: fallbackRotation,
        scale: fallbackScale,
        opacity: (value as { opacity?: number }).opacity,
        metalness: (value as { metalness?: number }).metalness,
        roughness: (value as { roughness?: number }).roughness,
        modelId: (value as { modelId?: string }).modelId,
        subparts: (value as { subparts?: NonNullable<ModelPartOverrides[string]>['subparts'] }).subparts,
        space: (value as { space?: 'local' | 'world' }).space,
      } as NonNullable<SceneModel['parts']>[typeof id];
    }
  }
  return merged;
};

const cloneLighting = (lighting: SceneLighting): SceneLighting => ({
  ambient: {...lighting.ambient},
  directional: {...lighting.directional, position: cloneVec3(lighting.directional.position)},
  points: lighting.points?.map((light) => ({...light, position: cloneVec3(light.position)})),
  spots: lighting.spots?.map((spot) => ({
    ...spot,
    position: cloneVec3(spot.position),
    target: cloneVec3(spot.target),
  })),
  panels: lighting.panels?.map((panel) => ({
    ...panel,
    origin: cloneVec3(panel.origin),
    spacing: cloneVec3(panel.spacing),
    matrix: panel.matrix ? [...panel.matrix] : undefined,
  })),
  intensityScale: lighting.intensityScale,
  color: lighting.color,
});

const cloneSceneState = (state: SceneFrame): SceneFrame => ({
  ...state,
  annotations: state.annotations ? [...state.annotations] : undefined,
  annotationDefaults: state.annotationDefaults
    ? {
      style: state.annotationDefaults.style ? {...state.annotationDefaults.style} : undefined,
      visibility: state.annotationDefaults.visibility ? {...state.annotationDefaults.visibility} : undefined,
    }
    : undefined,
  lighting: cloneLighting(state.lighting),
  environment: {...state.environment},
  floor: {...state.floor},
  background: {...state.background},
  ribbon: {
    ...state.ribbon,
    config: cloneRibbonConfig(state.ribbon.config),
  },
  models: state.models
    ? Object.fromEntries(Object.entries(state.models).map(([id, instance]) => [id, cloneModelInstance(instance)]))
    : undefined,
});

// Default model position used by createDefaultModelState. Scenes override this via SceneModel.position.
export const MODEL_BASE_POSITION: [number, number, number] = [0, 0, 0];
const DEFAULT_MODEL_SCALE = 0.1;

export const createDefaultModelState = (): SceneModel => ({
  scale: DEFAULT_MODEL_SCALE,
  position: cloneVec3(MODEL_BASE_POSITION),
  rotation: cloneVec3([0, 0, 0]),
  metalness: undefined,
  roughness: undefined,
  bodyPartOverrides: {},
  parts: {},
});

export const createDefaultMotion = (): SceneMotion => ({
  commands: [],
  scenes: [],
  customAnimations: [],
  pose: undefined,
});

export const createDefaultAnimation = (): SceneAnimation => ({
  enabled: false,
  clipName: undefined,
  gltfUrl: undefined,
  gltfClipName: undefined,
  fbxUrl: undefined,
  fbxClipName: undefined,
  fbxRetarget: undefined,
  fadeInSeconds: undefined,
  weight: undefined,
  clipStart: undefined,
  clipEnd: undefined,
  clipRangeUnit: undefined,
  clipRepeat: undefined,
  holdStartPose: undefined,
});

export const createDefaultPlayback = (): ScenePlayback => ({
  motion: createDefaultMotion(),
  animation: createDefaultAnimation(),
});

export const mergeSceneState = (base: SceneFrame, next: SceneFrameOverride): SceneFrame => {
  const merged = cloneSceneState({
    ...base,
    ...next,
    annotations: next.annotations ?? base.annotations,
    annotationDefaults: next.annotationDefaults
      ? {
        style: {
          ...DEFAULT_ANNOTATION_DEFAULTS.style,
          ...(base.annotationDefaults?.style ?? {}),
          ...(next.annotationDefaults.style ?? {}),
        },
        visibility: {
          ...DEFAULT_ANNOTATION_DEFAULTS.visibility,
          ...(base.annotationDefaults?.visibility ?? {}),
          ...(next.annotationDefaults.visibility ?? {}),
        },
      }
      : base.annotationDefaults,
    lighting: {...base.lighting, ...next.lighting},
    environment: {...base.environment, ...next.environment},
    floor: {...base.floor, ...next.floor},
    background: {...base.background, ...next.background},
    ribbon: {
      ...base.ribbon,
      ...next.ribbon,
      config: next.ribbon?.config ?? base.ribbon.config,
    },
    models: (() => {
      if (!next.models) return base.models;
      const baseModels = base.models ?? {};
      const mergedEntries = new Map<string, SceneModelInstanceState>();
      for (const [id, instance] of Object.entries(baseModels)) {
        mergedEntries.set(id, cloneModelInstance(instance));
      }
      for (const [id, override] of Object.entries(next.models)) {
        const baseInstance = mergedEntries.get(id);
        if (baseInstance) {
          mergedEntries.set(id, mergeModelInstance(baseInstance, override));
        } else {
          const seeded: SceneModelInstanceState = {
            enabled: override.enabled,
            model: cloneSceneModel({
              ...createDefaultModelState(),
              enabled: override.enabled,
            }),
            playback: clonePlayback(createDefaultPlayback()),
          };
          mergedEntries.set(id, mergeModelInstance(seeded, override));
        }
      }
      return Object.fromEntries(mergedEntries.entries());
    })(),
  });
  return merged;
};

export const createBaseSceneState = (context: SceneFrameContext): SceneFrame => {
  const scrollProgress = context.sceneProgress;
  const defaultState: SceneFrame = {
    id: 'base',
    scrollProgress,
    lighting: {
      ambient: {intensity: 0, color: '#ffffff'},
      directional: {intensity: 0, color: '#ffffff', position: [0, 12, 30]},
      points: [],
      intensityScale: 1,
      color: '',
    },
    environment: {
      enabled: false,
      intensity: 1,
      preset: undefined,
    },
    floor: {
      enabled: false,
    },
    background: {
      opacity: 0,
    },
    ribbon: {
      enabled: false,
      config: {
        strandCount: 25,
        spacing: 2,
        radius: 0.05,
        radiusTaper: 0.75,
        segments: 120,
        twistFrequency: 0,
        twistPhase: 0,
        opacity: 0.25,
        glowLightsEnabled: true,
        glowLightCount: 26,
        glowLightIntensity: .3,
        glowLightColor: '#b344ef',
        glowLightDistance: 190,
        glowLightDecay: .6,
        curve: {
          width: 320,
          yOffset: -10,
          z: 2,
          waveAmplitude: -10.6,
          waveFrequency: 1,
          depthAmplitude: 5.4,
          depthFrequency: 0.6,
          depthPhase: Math.PI * 0.5,
        },
        position: [-5, -2, 25],
        rotation: [0, 2.2, .2],
        scale: [1, 1, 1],
      }
    },
    isLightScene: false,
  };

  if (!context.baseState) {
    return defaultState;
  }

  return mergeSceneState(defaultState, context.baseState);
};
