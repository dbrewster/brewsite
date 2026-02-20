/**
 * Model element compilation - transition specs and animation compiler.
 */

import type {
  BodyPartOverrideMap,
  CustomAnimation,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  PoseGroup,
  SceneAnimation,
  SceneModel,
  ScenePlayback,
  ClipMeta,
  SceneModelInstanceState,
} from './types';
import type {
  ElementTransitionSpec,
  TransitionContext,
} from '../../compiler/transitions/transitionTypes';
import {
  blendAxisRotation,
  blendAxisTranslation,
  blendColor,
  blendNumber,
  blendOpacity,
  blendVec3,
  clamp01,
  resolveEnabledByOpacity,
} from '../../compiler/transitions/transitionTypes';

const OPAQUE_OPACITY = 1;

/**
 * resolveClipRangeSeconds resolves animation clip start/end times.
 * Converts from percent (if specified) to absolute seconds.
 */
export const resolveClipRangeSeconds = (animation: SceneAnimation, clipDuration: number) => {
  const clipStart = animation.clipStart ?? 0;
  const rawClipEnd = animation.clipEnd ?? clipDuration;
  const clipRangeUnit = animation.clipRangeUnit ?? 'seconds';
  let startSeconds = clipStart;
  let endSeconds = rawClipEnd;
  if (clipRangeUnit === 'percent') {
    const startPct = clipStart > 1 ? clipStart / 100 : clipStart;
    const endPct = rawClipEnd > 1 ? rawClipEnd / 100 : rawClipEnd;
    startSeconds = startPct * clipDuration;
    endSeconds = endPct * clipDuration;
  }
  const span = Math.max(1e-4, endSeconds - startSeconds);
  return { startSeconds, endSeconds, span };
};

// ─── Transition helpers ──────────────────────────────────────────────────────

const MODEL_EXIT_END = 0.5;
const HIDDEN_MODEL_SCALE = 0.001;

const isModelHidden = (model?: SceneModel) =>
  typeof model?.scale === 'number' && model.scale <= HIDDEN_MODEL_SCALE;

const resolveExitT = (context: TransitionContext, overrideEnd: number) => {
  const end = overrideEnd <= context.exitStart ? context.exitEnd : Math.min(context.exitEnd, overrideEnd);
  const span = end - context.exitStart;
  if (span <= 0) {
    return context.progress >= end ? 1 : 0;
  }
  return clamp01((context.progress - context.exitStart) / span);
};

const scaleAxisRotation = (
  value?: { yawPct?: number; pitchPct?: number; rollPct?: number },
  scale = 1,
) => {
  if (!value) return undefined;
  return {
    yawPct: typeof value.yawPct === 'number' ? value.yawPct * scale : undefined,
    pitchPct: typeof value.pitchPct === 'number' ? value.pitchPct * scale : undefined,
    rollPct: typeof value.rollPct === 'number' ? value.rollPct * scale : undefined,
  };
};

const scaleAxisTranslation = (
  value?: { xPct?: number; yPct?: number; zPct?: number },
  scale = 1,
) => {
  if (!value) return undefined;
  return {
    xPct: typeof value.xPct === 'number' ? value.xPct * scale : undefined,
    yPct: typeof value.yPct === 'number' ? value.yPct * scale : undefined,
    zPct: typeof value.zPct === 'number' ? value.zPct * scale : undefined,
  };
};

export const poseGroupTransition = (from?: PoseGroup, to?: PoseGroup, t?: number) => {
  if (!from && !to) return undefined;
  if (from && to) {
    return {
      rotate: blendAxisRotation(from.rotate, to.rotate, t),
      translate: blendAxisTranslation(from.translate, to.translate, t),
      space: to.space ?? from.space,
    };
  }
  if (from) {
    const scale = 1 - (t ?? 0);
    return {
      rotate: scaleAxisRotation(from.rotate, scale),
      translate: scaleAxisTranslation(from.translate, scale),
      space: from.space,
    };
  }
  const scale = t ?? 0;
  return {
    rotate: scaleAxisRotation(to?.rotate, scale),
    translate: scaleAxisTranslation(to?.translate, scale),
    space: to?.space,
  };
};

const blendBodyOverrides = (
  from?: BodyPartOverrideMap,
  to?: BodyPartOverrideMap,
  tExit?: number,
  tEnter?: number,
  tFull?: number,
) => {
  if (!from && !to) return undefined;
  const result: NonNullable<BodyPartOverrideMap> = {};
  const keys = new Set<string>([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  for (const key of keys) {
    const prev = from?.[key];
    const next = to?.[key];
    if (!prev && !next) continue;
    if (prev && next) {
      result[key] = {
        ...(prev ?? next),
        ...(next ?? {}),
        opacity: blendOpacity(
          typeof prev.opacity === 'number' ? prev.opacity : OPAQUE_OPACITY,
          typeof next.opacity === 'number' ? next.opacity : OPAQUE_OPACITY,
          tFull,
        ),
        color: blendColor(prev.color, next.color, tFull) ?? next.color ?? prev.color,
        metalness: blendNumber(prev.metalness, next.metalness, tFull) ?? next.metalness ?? prev.metalness,
        roughness: blendNumber(prev.roughness, next.roughness, tFull) ?? next.roughness ?? prev.roughness,
        pose: poseGroupTransition(prev.pose, next.pose, tFull) ?? next.pose ?? prev.pose,
      };
      continue;
    }
    if (prev) {
      result[key] = {
        ...prev,
        opacity: blendOpacity(
          typeof prev.opacity === 'number' ? prev.opacity : OPAQUE_OPACITY,
          0,
          tExit,
        ),
        pose: poseGroupTransition(prev.pose, undefined, tExit) ?? prev.pose,
      };
      continue;
    }
    if (next) {
      result[key] = {
        ...next,
        opacity: blendOpacity(0, typeof next.opacity === 'number' ? next.opacity : OPAQUE_OPACITY, tEnter),
        pose: poseGroupTransition(undefined, next.pose, tEnter) ?? next.pose,
      };
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const blendSubparts = (
  from?: Partial<Record<string, ModelSubpartSpec>>,
  to?: Partial<Record<string, ModelSubpartSpec>>,
  tExit?: number,
  tEnter?: number,
  tFull?: number,
) => {
  if (!from && !to) return undefined;
  const keys = new Set<string>([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  const result: Partial<Record<string, ModelSubpartSpec>> = {};
  for (const key of keys) {
    const prev = from?.[key];
    const next = to?.[key];
    if (!prev && !next) continue;
    if (prev && next) {
      const baseEnabled = next.enabled ?? prev.enabled ?? true;
      const opacity = blendOpacity(prev.opacity, next.opacity, tFull);
      result[key] = {
        ...prev,
        ...next,
        opacity,
        color: blendColor(prev.color, next.color, tFull) ?? next.color ?? prev.color,
        metalness: blendNumber(prev.metalness, next.metalness, tFull) ?? next.metalness ?? prev.metalness,
        roughness: blendNumber(prev.roughness, next.roughness, tFull) ?? next.roughness ?? prev.roughness,
        enabled: baseEnabled === false ? false : resolveEnabledByOpacity(opacity, baseEnabled),
      };
      continue;
    }
    if (prev) {
      const opacity = blendOpacity(prev.opacity, 0, tExit);
      const baseEnabled = prev.enabled ?? true;
      result[key] = {
        ...prev,
        opacity,
        enabled: baseEnabled === false ? false : resolveEnabledByOpacity(opacity, baseEnabled),
      };
      continue;
    }
    if (next) {
      const opacity = blendOpacity(0, next.opacity, tEnter);
      const baseEnabled = next.enabled ?? true;
      result[key] = {
        ...next,
        opacity,
        enabled: baseEnabled === false ? false : resolveEnabledByOpacity(opacity, baseEnabled),
      };
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const blendParts = (
  from?: Record<string, ModelPartSpec>,
  to?: Record<string, ModelPartSpec>,
  tExit?: number,
  tEnter?: number,
  tFull?: number,
) => {
  if (!from && !to) return undefined;
  const result: Record<string, ModelPartSpec> = {};
  const keys = new Set<string>([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  for (const key of keys) {
    const prev = from?.[key as keyof typeof from] as ModelPartSpec | undefined;
    const next = to?.[key as keyof typeof to] as ModelPartSpec | undefined;
    if (!prev && !next) continue;
    if (prev && next) {
      const prevPosition = prev.position ?? next.position ?? [0, 0, 0];
      const nextPosition = next.position ?? prev.position ?? [0, 0, 0];
      const prevRotation = prev.rotation ?? next.rotation ?? [0, 0, 0];
      const nextRotation = next.rotation ?? prev.rotation ?? [0, 0, 0];
      const prevScale = typeof prev.scale === 'number' ? prev.scale : typeof next.scale === 'number' ? next.scale : 1;
      const nextScale = typeof next.scale === 'number' ? next.scale : typeof prev.scale === 'number' ? prev.scale : 1;
      const baseEnabled = next.enabled ?? prev.enabled ?? true;
      const opacity = blendOpacity(prev.opacity, next.opacity, tFull);
      result[key] = {
        ...prev,
        ...next,
        enabled: baseEnabled === false ? false : resolveEnabledByOpacity(opacity, baseEnabled),
        opacity,
        position: blendVec3(prevPosition, nextPosition, tFull) ?? nextPosition,
        rotation: blendVec3(prevRotation, nextRotation, tFull) ?? nextRotation,
        scale: blendNumber(prevScale, nextScale, tFull) ?? nextScale,
        metalness: blendNumber(prev.metalness, next.metalness, tFull) ?? next.metalness ?? prev.metalness,
        roughness: blendNumber(prev.roughness, next.roughness, tFull) ?? next.roughness ?? prev.roughness,
        modelId: next.modelId ?? prev.modelId,
        subparts: blendSubparts(prev.subparts, next.subparts, tExit, tEnter, tFull),
      };
      continue;
    }
    if (prev) {
      const prevPosition = prev.position ?? [0, 0, 0];
      const prevRotation = prev.rotation ?? [0, 0, 0];
      const prevScale = typeof prev.scale === 'number' ? prev.scale : 1;
      const opacity = blendOpacity(prev.opacity, 0, tExit);
      const baseEnabled = prev.enabled ?? true;
      result[key] = {
        ...prev,
        enabled: baseEnabled === false ? false : resolveEnabledByOpacity(opacity, baseEnabled),
        opacity,
        position: prevPosition,
        rotation: prevRotation,
        scale: prevScale,
      };
      continue;
    }
    if (next) {
      const nextPosition = next.position ?? [0, 0, 0];
      const nextRotation = next.rotation ?? [0, 0, 0];
      const nextScale = typeof next.scale === 'number' ? next.scale : 1;
      const opacity = blendOpacity(0, next.opacity, tEnter);
      const baseEnabled = next.enabled ?? true;
      result[key] = {
        ...next,
        enabled: baseEnabled === false ? false : resolveEnabledByOpacity(opacity, baseEnabled),
        opacity,
        position: nextPosition,
        rotation: nextRotation,
        scale: nextScale,
      };
    }
  }
  return Object.keys(result).length > 0 ? (result as Record<string, ModelPartSpec>) : undefined;
};

// ─── Model transition spec ───────────────────────────────────────────────────

export const modelTransitionSpec: ElementTransitionSpec<SceneModel> = {
  exit: (from: SceneModel, context: TransitionContext): SceneModel => {
    const tExit = resolveExitT(context, MODEL_EXIT_END);
    return {
      ...from,
      position: from.position,
      rotation: from.rotation,
      scale: blendNumber(from.scale, HIDDEN_MODEL_SCALE, tExit) ?? from.scale,
      enabled: tExit >= 1 ? false : from.enabled,
      bodyPartOverrides: blendBodyOverrides(from.bodyPartOverrides, undefined, tExit, context.tEnter, tExit),
      parts: blendParts(from.parts, undefined, tExit, context.tEnter, tExit),
    };
  },
  enter: (to: SceneModel, context: TransitionContext): SceneModel => ({
    ...to,
    scale: blendNumber(HIDDEN_MODEL_SCALE, to.scale, context.tEnter) ?? to.scale,
    enabled: context.tEnter > 0 ? (to.enabled ?? true) : to.enabled,
    bodyPartOverrides: blendBodyOverrides(undefined, to.bodyPartOverrides, context.tExit, context.tEnter, context.tFull),
    parts: blendParts(undefined, to.parts, context.tExit, context.tEnter, context.tFull),
  }),
  interpolate: (from: SceneModel, to: SceneModel, context: TransitionContext): SceneModel => {
    const exitEarly = isModelHidden(to);
    const tExit = exitEarly ? resolveExitT(context, MODEL_EXIT_END) : context.tExit;
    const tFull = exitEarly ? tExit : context.tFull;
    return {
      ...from,
      ...to,
      position: blendVec3(from.position, to.position, tFull) ?? to.position,
      rotation: blendVec3(from.rotation, to.rotation, tFull) ?? to.rotation,
      scale: blendNumber(from.scale, to.scale, tFull) ?? to.scale,
      metalness: blendNumber(from.metalness, to.metalness, tFull) ?? to.metalness ?? from.metalness,
      roughness: blendNumber(from.roughness, to.roughness, tFull) ?? to.roughness ?? from.roughness,
      bodyPartOverrides: blendBodyOverrides(from.bodyPartOverrides, to.bodyPartOverrides, tExit, context.tEnter, tFull),
      parts: blendParts(from.parts, to.parts, tExit, context.tEnter, tFull),
    };
  },
};

// ─── Playback (motion + animation) transition helpers ────────────────────────

const blendPoseGroups = (
  from?: Partial<Record<string, PoseGroup>>,
  to?: Partial<Record<string, PoseGroup>>,
  t?: number,
) => {
  if (!from && !to) return undefined;
  const result: Partial<Record<string, PoseGroup>> = {};
  const keys = new Set<string>([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  for (const key of keys) {
    const prev = from?.[key];
    const next = to?.[key];
    if (!prev && !next) continue;
    result[key] = (poseGroupTransition(prev, next, t) ?? prev ?? next) as PoseGroup;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const blendCommands = (
  from?: MotionCommand[],
  to?: MotionCommand[],
  tExit?: number,
  tEnter?: number,
  tFull?: number,
) => {
  if (!from && !to) return [];
  const result: MotionCommand[] = [];
  const byId = new Map<string, MotionCommand>();
  for (const command of to ?? []) {
    byId.set(command.groupId, command);
  }
  for (const prev of from ?? []) {
    const next = byId.get(prev.groupId);
    if (next) {
      result.push({
        ...prev,
        ...next,
        rotate: blendAxisRotation(prev.rotate, next.rotate, tFull),
        translate: blendAxisTranslation(prev.translate, next.translate, tFull),
        weight: blendNumber(prev.weight ?? 1, next.weight ?? 1, tFull),
        space: next.space ?? prev.space,
      });
      byId.delete(prev.groupId);
      continue;
    }
    if ((tExit ?? 1) < 1) {
      result.push({
        ...prev,
        rotate: blendAxisRotation(prev.rotate, undefined, tExit),
        translate: blendAxisTranslation(prev.translate, undefined, tExit),
        weight: blendNumber(prev.weight ?? 1, 0, tExit) ?? 0,
      });
    }
  }
  for (const next of byId.values()) {
    if ((tEnter ?? 0) > 0) {
      result.push({
        ...next,
        rotate: blendAxisRotation(undefined, next.rotate, tEnter),
        translate: blendAxisTranslation(undefined, next.translate, tEnter),
        weight: blendNumber(0, next.weight ?? 1, tEnter) ?? next.weight,
      });
    }
  }
  return result;
};

const blendMotionScenes = (
  from?: MotionScene[],
  to?: MotionScene[],
  tExit?: number,
  tEnter?: number,
  tFull?: number,
) => {
  if (!from && !to) return [];
  const result: MotionScene[] = [];
  const byId = new Map<string, MotionScene>();
  for (const scene of to ?? []) {
    byId.set(scene.id, scene);
  }
  for (const prev of from ?? []) {
    const next = byId.get(prev.id);
    if (next) {
      result.push({
        ...prev,
        ...next,
        start: blendNumber(prev.start, next.start, tFull) ?? next.start,
        end: blendNumber(prev.end, next.end, tFull) ?? next.end,
        ease: (tFull ?? 0) < 0.5 ? prev.ease : next.ease,
        commands: next.commands ?? prev.commands,
        holdAtEnd: (tFull ?? 0) < 0.5 ? prev.holdAtEnd : next.holdAtEnd,
      });
      byId.delete(prev.id);
      continue;
    }
    if ((tExit ?? 1) < 1) {
      result.push(prev);
    }
  }
  for (const next of byId.values()) {
    if ((tEnter ?? 0) > 0) {
      result.push(next);
    }
  }
  return result;
};

const blendCustomAnimations = (
  from?: CustomAnimation[],
  to?: CustomAnimation[],
  tExit?: number,
  tEnter?: number,
  tFull?: number,
) => {
  if (!from && !to) return [];
  const result: CustomAnimation[] = [];
  const byId = new Map<string, CustomAnimation>();
  for (const anim of to ?? []) {
    byId.set(anim.id, anim);
  }
  for (const prev of from ?? []) {
    const next = byId.get(prev.id);
    if (next) {
      result.push({
        ...prev,
        ...next,
        weight: blendNumber(prev.weight ?? 1, next.weight ?? 1, tFull),
        enabled: (next.enabled ?? prev.enabled) && (tFull ?? 0) > 0,
        layer: next.layer ?? prev.layer,
        apply: (tFull ?? 0) < 0.5 ? prev.apply : next.apply,
      });
      byId.delete(prev.id);
      continue;
    }
    if ((tExit ?? 1) < 1) {
      result.push({
        ...prev,
        weight: blendNumber(prev.weight ?? 1, 0, tExit) ?? 0,
        enabled: (prev.enabled ?? false) && (tExit ?? 0) < 1,
      });
    }
  }
  for (const next of byId.values()) {
    if ((tEnter ?? 0) > 0) {
      result.push({
        ...next,
        weight: blendNumber(0, next.weight ?? 1, tEnter) ?? next.weight,
        enabled: (next.enabled ?? false) && (tEnter ?? 0) > 0,
      });
    }
  }
  return result;
};

// ─── Playback transition spec ────────────────────────────────────────────────

export const playbackTransitionSpec: ElementTransitionSpec<ScenePlayback> = {
  exit: (from: ScenePlayback, context: TransitionContext): ScenePlayback => ({
    ...from,
    animation: {
      ...from.animation,
      weight: blendNumber(from.animation.weight ?? 1, 0, context.tExit) ?? 0,
      enabled: (from.animation.enabled ?? false) && context.tExit < 1,
    },
    motion: from.motion,
  }),
  enter: (to: ScenePlayback, context: TransitionContext): ScenePlayback => ({
    ...to,
    animation: {
      ...to.animation,
      weight: blendNumber(0, to.animation.weight ?? 1, context.tEnter) ?? to.animation.weight,
      enabled: (to.animation.enabled ?? false) && context.tEnter > 0,
    },
    motion: to.motion,
  }),
  interpolate: (from: ScenePlayback, to: ScenePlayback, context: TransitionContext): ScenePlayback => ({
    ...from,
    ...to,
    animation: {
      ...from.animation,
      ...to.animation,
      weight: blendNumber(from.animation.weight ?? 1, to.animation.weight ?? 1, context.tFull),
      enabled: (to.animation.enabled ?? from.animation.enabled ?? false) && context.tFull > 0,
    },
    motion: {
      ...from.motion,
      ...to.motion,
      commands: blendCommands(from.motion.commands, to.motion.commands, context.tExit, context.tEnter, context.tFull),
      scenes: blendMotionScenes(from.motion.scenes, to.motion.scenes, context.tExit, context.tEnter, context.tFull),
      customAnimations: blendCustomAnimations(from.motion.customAnimations, to.motion.customAnimations, context.tExit, context.tEnter, context.tFull),
      pose: (() => {
        const fromPose = from.motion.pose;
        const toPose = to.motion.pose;
        const toHasGroups = Object.keys(toPose?.groups ?? {}).length > 0;
        const resolvedToPose = toHasGroups ? toPose : undefined;
        if (fromPose && resolvedToPose) {
          const blendedGroups = blendPoseGroups(fromPose.groups, resolvedToPose.groups, context.tFull);
          return {
            ...resolvedToPose,
            groups: blendedGroups ?? resolvedToPose.groups ?? fromPose.groups ?? {},
          };
        }
        if (fromPose) {
          return {
            ...fromPose,
            groups: blendPoseGroups(fromPose.groups, undefined, context.tExit) ?? fromPose.groups ?? {},
          };
        }
        if (resolvedToPose && context.tEnter > 0) {
          return {
            ...resolvedToPose,
            groups: blendPoseGroups(undefined, resolvedToPose.groups, context.tEnter) ?? resolvedToPose.groups ?? {},
          };
        }
        return undefined;
      })(),
    },
  }),
};

// ─── Animation compilation ──────────────────────────────────────────────────

export type CompiledAnimation = {
  enabled: boolean;
  clipName?: string;
  clipDuration?: number;
  range?: { startSeconds: number; endSeconds: number; span: number };
};

/**
 * Compiles animation configuration to a runtime format.
 * When prefersReducedMotion is true, disables animations.
 * When clipMeta is empty, cannot resolve built-in clips.
 */
export const compileAnimation = (
  animation: SceneAnimation | undefined,
  clipMeta: ClipMeta[],
  prefersReducedMotion: boolean,
): CompiledAnimation => {
  if (!animation?.enabled || prefersReducedMotion) {
    return { enabled: false };
  }

  const requestedClip = animation.clipName ?? animation.gltfClipName ?? animation.fbxClipName;
  const hasAnimationRequest = !!animation && animation.enabled &&
    (!!requestedClip || !!animation.gltfUrl || !!animation.fbxUrl);

  if (!hasAnimationRequest) {
    return { enabled: false };
  }

  const clip = requestedClip ? clipMeta.find((c) => c.name === requestedClip) : undefined;
  const expectsLoadedClip = !animation.gltfUrl && !animation.fbxUrl;

  if (requestedClip && !clip && clipMeta.length > 0 && expectsLoadedClip) {
    console.warn('[ModelWidget] missing.animation.clip', {
      requestedClip,
      available: clipMeta.map((c) => c.name),
    });
  }

  if (!clip) {
    return { enabled: false, clipName: requestedClip };
  }

  const range = resolveClipRangeSeconds(animation, clip.duration);
  return {
    enabled: true,
    clipName: requestedClip,
    clipDuration: clip.duration,
    range,
  };
};

// ─── Default state factory ──────────────────────────────────────────────────

const DEFAULT_MODEL_SCALE = 0.1;
const MODEL_BASE_POSITION: [number, number, number] = [0, 0, 0];

export function createDefaultModelInstanceState(modelId: string) {
  return {
    model: {
      scale: DEFAULT_MODEL_SCALE,
      position: [...MODEL_BASE_POSITION] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      enabled: true,
    },
    playback: {
      motion: {
        commands: [],
        scenes: [],
        customAnimations: [],
      },
      animation: {
        enabled: false,
      },
    },
  };
}

// ─── Instance state transition spec (wraps model and playback) ─────────────

export const instanceTransitionSpec: ElementTransitionSpec<SceneModelInstanceState> = {
  exit: (from: SceneModelInstanceState, context: TransitionContext): SceneModelInstanceState => ({
    ...from,
    model: modelTransitionSpec.exit(from.model, context),
    playback: playbackTransitionSpec.exit(from.playback, context),
    enabled: context.progress >= context.exitEnd ? false : from.enabled,
  }),
  enter: (to: SceneModelInstanceState, context: TransitionContext): SceneModelInstanceState => ({
    ...to,
    model: modelTransitionSpec.enter(to.model, context),
    playback: playbackTransitionSpec.enter(to.playback, context),
    enabled: context.tEnter > 0 ? (to.enabled ?? true) : to.enabled,
  }),
  interpolate: (from: SceneModelInstanceState, to: SceneModelInstanceState, context: TransitionContext): SceneModelInstanceState => ({
    ...from,
    ...to,
    model: modelTransitionSpec.interpolate(from.model, to.model, context),
    playback: playbackTransitionSpec.interpolate(from.playback, to.playback, context),
    enabled: (to.enabled ?? from.enabled ?? true) && context.progress < context.exitEnd,
  }),
};
