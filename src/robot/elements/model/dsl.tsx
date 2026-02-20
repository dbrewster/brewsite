import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { registerNode } from '../../runtime/compiler/registry';
import type { CompileApi, CompileHelpers } from '../../runtime/compiler/sceneDslTypes';
import type {
  BodyPartOverride,
  BodyPartOverrideMap,
  RobotAxisRotation,
  RobotAxisTranslation,
  RobotPose,
  RobotPoseGroup,
  SceneModel,
  ScenePlayback,
} from './types';
import { createDefaultModelState, createDefaultPlayback } from '../../model/sceneState';
import type { ResourceRegistry } from '../../../resources/sceneResources.generated';
import { resourceRegistry as defaultResourceRegistry } from '../../../resources/sceneResources.generated';

export type ModelProps = {
  scale?: number | ((context: unknown) => number);
  position?: [number, number, number] | ((context: unknown) => [number, number, number]);
  rotation?: [number, number, number] | ((context: unknown) => [number, number, number]);
  metalness?: number | ((context: unknown) => number);
  roughness?: number | ((context: unknown) => number);
  enabled?: boolean | ((context: unknown) => boolean);
  id?: string;
  children?: ReactNode;
};

export type BodyPartProps = {
  opacity?: number | ((context: unknown) => number);
  color?: string | ((context: unknown) => string);
  metalness?: number | ((context: unknown) => number);
  roughness?: number | ((context: unknown) => number);
  children?: ReactNode;
};

export type BodyPartByIdProps = BodyPartProps & {
  id: string;
};

export type PoseProps = {
  rotate?: RobotAxisRotation | ((context: unknown) => RobotAxisRotation);
  translate?: RobotAxisTranslation | ((context: unknown) => RobotAxisTranslation);
  space?: 'local' | 'world' | ((context: unknown) => 'local' | 'world');
};

export type ModelPartProps = {
  id: string;
  anchor?: string;
  enabled?: boolean | ((context: unknown) => boolean);
  opacity?: number | ((context: unknown) => number);
  scale?: number | ((context: unknown) => number);
  position?: [number, number, number] | ((context: unknown) => [number, number, number]);
  rotation?: [number, number, number] | ((context: unknown) => [number, number, number]);
  children?: ReactNode;
};

export type ContainedModelProps = {
  modelId: string;
  position?: [number, number, number] | ((context: unknown) => [number, number, number]);
  rotation?: [number, number, number] | ((context: unknown) => [number, number, number]);
  scale?: number | ((context: unknown) => number);
  children?: ReactNode;
};

export type SubpartProps = {
  id: string;
  enabled?: boolean | ((context: unknown) => boolean);
  opacity?: number | ((context: unknown) => number);
  color?: string | ((context: unknown) => string);
  metalness?: number | ((context: unknown) => number);
  roughness?: number | ((context: unknown) => number);
};

export type PlaybackProps = {
  children?: ReactNode;
};

export type MotionProps = {
  commands?: unknown;
  scenes?: unknown;
  customAnimations?: unknown;
};

export type AnimationProps = {
  enabled?: boolean;
  clipName?: string;
  gltfUrl?: string;
  gltfClipName?: string;
  fbxUrl?: string;
  fbxClipName?: string;
  fbxRetarget?: boolean;
  fadeInSeconds?: number;
  weight?: number;
  clipStart?: number;
  clipEnd?: number;
  clipRangeUnit?: 'seconds' | 'percent';
  clipRepeat?: boolean;
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
};

export const Model = (_props: ModelProps) => null;
export const BodyParts = (_props: { children?: ReactNode }) => null;
export const BodyPart = (_props: BodyPartByIdProps) => null;
export const Pose = (_props: PoseProps) => null;
export const ModelPart = (_props: ModelPartProps) => null;
export const ContainedModel = (_props: ContainedModelProps) => null;
export const Subpart = (_props: SubpartProps) => null;

export const Playback = (_props: PlaybackProps) => null;
export const Motion = (_props: MotionProps) => null;
export const Animation = (_props: AnimationProps) => null;

const warnOnce = new Set<string>();
const warn = (key: string, message: string, detail?: Record<string, unknown>) => {
  if (warnOnce.has(key)) return;
  warnOnce.add(key);
  console.warn('[SceneDsl]', message, detail ?? {});
};

const resolveRegistryModel = (registry: ResourceRegistry | undefined, modelId: string) => {
  if (!registry) return undefined;
  const models = registry.models as Record<string, ResourceRegistry['models'][keyof ResourceRegistry['models']]>;
  return models[modelId];
};

registerNode(Model, (node: ReactElement, api: CompileApi, helper: CompileHelpers) => {
  const props = node.props as ModelProps;
  const modelId = typeof props.id === 'string' && props.id.trim().length > 0 ? props.id.trim() : '';
  if (!modelId) {
    throw new Error('<Model> requires a non-empty id.');
  }
  const registry = api.context.resourceRegistry ?? defaultResourceRegistry;
  const registryModel = resolveRegistryModel(registry, modelId);
  const existingModel = api.state.models?.[modelId]?.model;
  const baseModel = existingModel ?? createDefaultModelState();
  const basePlayback = createDefaultPlayback();
  const existingPlayback = (api.state.models?.[modelId]?.playback ?? basePlayback) as ScenePlayback;
  const cloneModelParts = (parts: SceneModel['parts']) => {
    if (!parts) return undefined;
    const entries = Object.entries(parts).map(([key, value]) => [
      key,
      value
        ? {
            ...value,
            position: value.position ? [value.position[0], value.position[1], value.position[2]] : value.position,
            rotation: value.rotation ? [value.rotation[0], value.rotation[1], value.rotation[2]] : value.rotation,
            subparts: value.subparts ? { ...value.subparts } : value.subparts,
          }
        : value,
    ]);
    return Object.fromEntries(entries) as SceneModel['parts'];
  };
  const model: SceneModel = {
    ...baseModel,
    position: [baseModel.position[0], baseModel.position[1], baseModel.position[2]],
    rotation: [baseModel.rotation[0], baseModel.rotation[1], baseModel.rotation[2]],
    bodyPartOverrides: { ...(baseModel.bodyPartOverrides ?? {}) },
    parts: cloneModelParts(baseModel.parts),
  };
  if (props.scale !== undefined) model.scale = helper.resolveValue(props.scale, api.context);
  if (props.position !== undefined) model.position = helper.resolveValue(props.position, api.context);
  if (props.rotation !== undefined) model.rotation = helper.resolveValue(props.rotation, api.context);
  if (props.metalness !== undefined) model.metalness = helper.resolveValue(props.metalness, api.context);
  if (props.roughness !== undefined) model.roughness = helper.resolveValue(props.roughness, api.context);
  if (props.enabled !== undefined) model.enabled = helper.resolveValue(props.enabled, api.context);
  if (props.enabled === undefined) {
    model.enabled = baseModel.enabled ?? true;
  }
  const parts = { ...(model.parts ?? {}) } as NonNullable<SceneModel['parts']>;
  const children = helper.collectChildren(node) as ReactElement[];
  const overrides: BodyPartOverrideMap = { ...(model.bodyPartOverrides ?? {}) };
  const poseGroups: RobotPose['groups'] = {};
  let playbackOverride: Partial<ScenePlayback> | null = null;

  const readPose = (partChildren: ReactElement[]): RobotPoseGroup | null => {
    for (const nested of partChildren) {
      if (!isValidElement(nested)) continue;
      if ((nested as ReactElement).type !== Pose) continue;
      const poseProps = (nested as ReactElement).props as PoseProps;
      const rotate = poseProps.rotate ? helper.resolveValue(poseProps.rotate, api.context) : undefined;
      const translate = poseProps.translate ? helper.resolveValue(poseProps.translate, api.context) : undefined;
      const space = poseProps.space ? helper.resolveValue(poseProps.space, api.context) : undefined;
      if (!rotate && !translate) return null;
      return {
        rotate,
        translate,
        space,
      };
    }
    return null;
  };

  const applyBodyPart = (id: string, partProps: BodyPartProps, partChildren: ReactElement[]) => {
    const override: BodyPartOverride = {};
    if (partProps.opacity !== undefined) override.opacity = helper.resolveValue(partProps.opacity, api.context);
    if (partProps.color !== undefined) override.color = helper.resolveValue(partProps.color, api.context);
    if (partProps.metalness !== undefined) override.metalness = helper.resolveValue(partProps.metalness, api.context);
    if (partProps.roughness !== undefined) override.roughness = helper.resolveValue(partProps.roughness, api.context);
    if (Object.keys(override).length > 0) {
      overrides[id] = override;
    }
    const pose = readPose(partChildren);
    if (pose) {
      poseGroups[id] = pose;
    }
  };

  const bodyPartChildren: ReactElement[] = [];
  const playbackChildren: ReactElement[] = [];
  const modelPartChildren: ReactElement[] = [];

  for (const child of children) {
    if (!isValidElement(child)) continue;
    if (child.type === BodyParts) {
      const nested = helper.collectChildren(child);
      for (const nestedChild of nested) {
        if (isValidElement(nestedChild) && (nestedChild as ReactElement).type === BodyPart) {
          bodyPartChildren.push(nestedChild as ReactElement);
        }
      }
      continue;
    }
    if (child.type === Playback || child.type === Motion || child.type === Animation) {
      playbackChildren.push(child);
      continue;
    }
    if (child.type === ModelPart) {
      modelPartChildren.push(child);
    }
  }

  const resolveMotion = (props: MotionProps): ScenePlayback['motion'] => ({
    commands: (props.commands ?? []) as ScenePlayback['motion']['commands'],
    scenes: (props.scenes ?? []) as ScenePlayback['motion']['scenes'],
    customAnimations: (props.customAnimations ?? []) as ScenePlayback['motion']['customAnimations'],
  });

  const resolveAnimation = (props: AnimationProps): ScenePlayback['animation'] => ({
    enabled: props.enabled ?? false,
    ...props,
  });

  const applyPlaybackChild = (element: ReactElement) => {
    if (element.type === Playback) {
      const nested = helper.collectChildren(element);
      for (const nestedChild of nested) {
        if (!isValidElement(nestedChild)) continue;
        applyPlaybackChild(nestedChild);
      }
      return;
    }
    if (element.type === Motion) {
      const motion = resolveMotion(element.props as MotionProps);
      playbackOverride = {
        ...(playbackOverride ?? {}),
        motion,
      };
    }
    if (element.type === Animation) {
      const animation = resolveAnimation(element.props as AnimationProps);
      playbackOverride = {
        ...(playbackOverride ?? {}),
        animation,
      };
    }
  };

  for (const playbackChild of playbackChildren) {
    applyPlaybackChild(playbackChild);
  }

  for (const bodyPart of bodyPartChildren) {
    const partProps = bodyPart.props as BodyPartByIdProps;
    const partId = typeof partProps.id === 'string' ? partProps.id : '';
    if (!partId) continue;
    const known = registryModel?.bodyParts ?? registryModel?.meshes;
    const hasOverride =
      partProps.opacity !== undefined ||
      partProps.color !== undefined ||
      partProps.metalness !== undefined ||
      partProps.roughness !== undefined;
    if (known && hasOverride) {
      const lowerKnown = known.map((value: string) => value.toLowerCase());
      if (!lowerKnown.includes(partId.toLowerCase())) {
        warn(`bodyPart:${modelId}:${partId}`, 'unknown.bodyPart', { modelId, partId, known });
      }
    }
    applyBodyPart(partId, partProps, helper.collectChildren(bodyPart) as ReactElement[]);
  }

  for (const modelPart of modelPartChildren) {
    const partProps = modelPart.props as ModelPartProps;
    const partId = typeof partProps.id === 'string' ? partProps.id.trim() : '';
    if (!partId) continue;

    const registryPart = registryModel?.parts?.[partId];
    if (!registryPart) {
      warn(`modelPart:${modelId}:${partId}`, 'unknown.modelPart', { modelId, partId });
    }
    const anchor = partProps.anchor ?? registryPart?.anchor ?? '';
    if (!anchor) {
      warn(`modelPart.anchor:${modelId}:${partId}`, 'missing.modelPart.anchor', { modelId, partId });
    }

    const basePosition = registryPart?.position ?? [0, 0, 0];
    const baseRotation = registryPart?.rotation ?? [0, 0, 0];
    const baseScale = registryPart?.scale ?? 1;

    type SceneModelPart = NonNullable<SceneModel['parts']>[keyof NonNullable<SceneModel['parts']>];

    const nextPart = {
      id: partId,
      anchor,
      enabled: helper.resolveValue(partProps.enabled ?? true, api.context),
      position: partProps.position ? helper.resolveValue(partProps.position, api.context) : basePosition,
      rotation: partProps.rotation ? helper.resolveValue(partProps.rotation, api.context) : baseRotation,
      scale: partProps.scale ? helper.resolveValue(partProps.scale, api.context) : baseScale,
      opacity: partProps.opacity !== undefined ? helper.resolveValue(partProps.opacity, api.context) : undefined,
      metalness: undefined,
      roughness: undefined,
      modelId: registryPart?.modelId,
      subparts: undefined as SceneModelPart['subparts'] | undefined,
    } as SceneModelPart;

    const partChildren = helper.collectChildren(modelPart) as ReactElement[];
    for (const partChild of partChildren) {
      if (!isValidElement(partChild)) continue;
      if (partChild.type !== ContainedModel) continue;
      const containedProps = partChild.props as ContainedModelProps;
      const modelId = typeof containedProps.modelId === 'string' ? containedProps.modelId.trim() : '';
      if (!modelId) continue;
      if (!registry?.models?.[modelId as keyof ResourceRegistry['models']]) {
        warn(`containedModel:${modelId}`, 'unknown.containedModel', { modelId, partId, containerModelId: modelId });
      }
      nextPart.modelId = modelId;
      if (containedProps.position) nextPart.position = helper.resolveValue(containedProps.position, api.context);
      if (containedProps.rotation) nextPart.rotation = helper.resolveValue(containedProps.rotation, api.context);
      if (containedProps.scale) nextPart.scale = helper.resolveValue(containedProps.scale, api.context);

      const subparts: NonNullable<typeof nextPart.subparts> = { ...(nextPart.subparts ?? {}) };
      const subpartChildren = helper.collectChildren(partChild);
      for (const subpartChild of subpartChildren) {
        if (!isValidElement(subpartChild) || subpartChild.type !== Subpart) continue;
        const subProps = subpartChild.props as SubpartProps;
        const subId = typeof subProps.id === 'string' ? subProps.id.trim() : '';
        if (!subId) continue;
        const knownSubparts = registry?.models?.[modelId as keyof ResourceRegistry['models']]?.subparts;
        if (knownSubparts && !knownSubparts.includes(subId)) {
          warn(`subpart:${modelId}:${subId}`, 'unknown.subpart', { modelId, subId, known: knownSubparts });
        }
        subparts[subId] = {
          id: subId,
          enabled: helper.resolveValue(subProps.enabled ?? true, api.context),
          opacity: helper.resolveValue(subProps.opacity ?? 1, api.context),
          color: subProps.color ? helper.resolveValue(subProps.color, api.context) : undefined,
          metalness: subProps.metalness !== undefined ? helper.resolveValue(subProps.metalness, api.context) : undefined,
          roughness: subProps.roughness !== undefined ? helper.resolveValue(subProps.roughness, api.context) : undefined,
        };
      }
      if (Object.keys(subparts).length > 0) {
        nextPart.subparts = subparts;
      }
    }

    parts[partId] = nextPart;
  }

  if (Object.keys(parts).length > 0) model.parts = parts;
  if (Object.keys(overrides).length > 0) model.bodyPartOverrides = overrides;
  if (Object.keys(poseGroups).length > 0) {
    const existingPose = existingPlayback.motion.pose;
    const currentOverride = (playbackOverride ?? {}) as Partial<ScenePlayback>;
    const baseMotion = (currentOverride.motion ?? existingPlayback.motion) as ScenePlayback['motion'];
    const nextPose: RobotPose = {
      mode: existingPose?.mode ?? 'override',
      groups: poseGroups,
    };
    playbackOverride = {
      ...(playbackOverride ?? {}),
      motion: {
        ...baseMotion,
        pose: nextPose,
      },
    };
  } else if (existingPlayback.motion.pose) {
    const currentOverride = (playbackOverride ?? {}) as Partial<ScenePlayback>;
    const baseMotion = (currentOverride.motion ?? existingPlayback.motion) as ScenePlayback['motion'];
    playbackOverride = {
      ...(playbackOverride ?? {}),
      motion: {
        ...baseMotion,
        pose: undefined,
      },
    };
  }
  const resolvedPlayback = playbackOverride
    ? {
        motion: { ...existingPlayback.motion, ...(playbackOverride.motion ?? {}) },
        animation: { ...existingPlayback.animation, ...(playbackOverride.animation ?? {}) },
      }
    : existingPlayback;
  api.setModelInstance(modelId, {
    enabled: model.enabled,
    model: {
      ...model,
      enabled: model.enabled,
    },
    playback: resolvedPlayback,
  });
  if (typeof window !== 'undefined') {
    const debug = (window as unknown as { __robotRuntimeDebug?: boolean }).__robotRuntimeDebug;
    if (debug) {
      console.info('[RobotScene]', 'model.instance.registered', {
        id: modelId,
        enabled: model.enabled !== false,
      });
    }
  }
});

const noopHandler = () => {};
registerNode(BodyPart, noopHandler);
registerNode(BodyParts, noopHandler);
registerNode(Pose, noopHandler);
registerNode(ModelPart, noopHandler);
registerNode(ContainedModel, noopHandler);
registerNode(Subpart, noopHandler);

registerNode(Playback, (_node: ReactElement) => {
  throw new Error('<Playback> must be nested inside <Model>.');
});

registerNode(Motion, (_node: ReactElement) => {
  throw new Error('<Motion> must be nested inside <Model>.');
});

registerNode(Animation, (_node: ReactElement) => {
  throw new Error('<Animation> must be nested inside <Model>.');
});
