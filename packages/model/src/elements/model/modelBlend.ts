// modelBlend.ts — Pure blend helpers for model state transitions.

import type {
  BodyPartOverrideMap,
  CustomAnimation,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  PoseGroup,
} from './types';
import {
  blendAxisRotation,
  blendAxisTranslation,
  blendColor,
  blendNumber,
  blendOpacity,
  blendVec3,
  resolveEnabledByOpacity,
} from '@brewsite/core';

const OPAQUE_OPACITY = 1;

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
    };
  }
  if (from) {
    const scale = 1 - (t ?? 0);
    return {
      rotate: scaleAxisRotation(from.rotate, scale),
      translate: scaleAxisTranslation(from.translate, scale),
    };
  }
  const scale = t ?? 0;
  return {
    rotate: scaleAxisRotation(to?.rotate, scale),
    translate: scaleAxisTranslation(to?.translate, scale),
  };
};

export const blendBodyOverrides = (
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
      const prevOpacity =
        typeof prev.opacity === 'number' ? prev.opacity : OPAQUE_OPACITY;
      const nextOpacity =
        typeof next.opacity === 'number' ? next.opacity : prevOpacity;
      result[key] = {
        ...(prev ?? next),
        ...(next ?? {}),
        opacity: blendOpacity(prevOpacity, nextOpacity, tFull),
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

export const blendSubparts = (
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

export const blendParts = (
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
      const prevContainedPosition = prev.containedPosition ?? next.containedPosition ?? [0, 0, 0];
      const nextContainedPosition = next.containedPosition ?? prev.containedPosition ?? [0, 0, 0];
      const prevContainedRotation = prev.containedRotation ?? next.containedRotation ?? [0, 0, 0];
      const nextContainedRotation = next.containedRotation ?? prev.containedRotation ?? [0, 0, 0];
      const prevContainedScale =
        typeof prev.containedScale === 'number'
          ? prev.containedScale
          : typeof next.containedScale === 'number'
            ? next.containedScale
            : 1;
      const nextContainedScale =
        typeof next.containedScale === 'number'
          ? next.containedScale
          : typeof prev.containedScale === 'number'
            ? prev.containedScale
            : 1;
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
        containedPosition: blendVec3(prevContainedPosition, nextContainedPosition, tFull) ?? nextContainedPosition,
        containedRotation: blendVec3(prevContainedRotation, nextContainedRotation, tFull) ?? nextContainedRotation,
        containedScale: blendNumber(prevContainedScale, nextContainedScale, tFull) ?? nextContainedScale,
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
      const prevContainedPosition = prev.containedPosition ?? [0, 0, 0];
      const prevContainedRotation = prev.containedRotation ?? [0, 0, 0];
      const prevContainedScale = typeof prev.containedScale === 'number' ? prev.containedScale : 1;
      const opacity = blendOpacity(prev.opacity, 0, tExit);
      const baseEnabled = prev.enabled ?? true;
      result[key] = {
        ...prev,
        enabled: baseEnabled === false ? false : resolveEnabledByOpacity(opacity, baseEnabled),
        opacity,
        position: prevPosition,
        rotation: prevRotation,
        scale: prevScale,
        containedPosition: prevContainedPosition,
        containedRotation: prevContainedRotation,
        containedScale: prevContainedScale,
      };
      continue;
    }
    if (next) {
      const nextPosition = next.position ?? [0, 0, 0];
      const nextRotation = next.rotation ?? [0, 0, 0];
      const nextScale = typeof next.scale === 'number' ? next.scale : 1;
      const nextContainedPosition = next.containedPosition ?? [0, 0, 0];
      const nextContainedRotation = next.containedRotation ?? [0, 0, 0];
      const nextContainedScale = typeof next.containedScale === 'number' ? next.containedScale : 1;
      const opacity = blendOpacity(0, next.opacity, tEnter);
      const baseEnabled = next.enabled ?? true;
      result[key] = {
        ...next,
        enabled: baseEnabled === false ? false : resolveEnabledByOpacity(opacity, baseEnabled),
        opacity,
        position: nextPosition,
        rotation: nextRotation,
        scale: nextScale,
        containedPosition: nextContainedPosition,
        containedRotation: nextContainedRotation,
        containedScale: nextContainedScale,
      };
    }
  }
  return Object.keys(result).length > 0 ? (result as Record<string, ModelPartSpec>) : undefined;
};

export const blendPoseGroups = (
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
    result[key] = poseGroupTransition(prev, next, t) as PoseGroup;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

// DEBT: Extract generic blendArrayById<T>() to reduce duplication with blendMotionScenes/blendCustomAnimations
export const blendCommands = (
  from?: MotionCommand[],
  to?: MotionCommand[],
  tExit = 1,
  tEnter = 0,
  tFull = 0,
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
    if (tExit < 1) {
      result.push({
        ...prev,
        rotate: blendAxisRotation(prev.rotate, undefined, tExit),
        translate: blendAxisTranslation(prev.translate, undefined, tExit),
        weight: blendNumber(prev.weight ?? 1, 0, tExit),
      });
    }
  }
  for (const next of byId.values()) {
    if (tEnter > 0) {
      result.push({
        ...next,
        rotate: blendAxisRotation(undefined, next.rotate, tEnter),
        translate: blendAxisTranslation(undefined, next.translate, tEnter),
        weight: blendNumber(0, next.weight ?? 1, tEnter),
      });
    }
  }
  return result;
};

export const blendMotionScenes = (
  from?: MotionScene[],
  to?: MotionScene[],
  tExit = 1,
  tEnter = 0,
  tFull = 0,
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
        start: blendNumber(prev.start, next.start, tFull) ?? next.start ?? prev.start,
        end: blendNumber(prev.end, next.end, tFull) ?? next.end ?? prev.end,
        ease: tFull < 0.5 ? prev.ease : next.ease,
        commands: next.commands ?? prev.commands,
        holdAtEnd: tFull < 0.5 ? prev.holdAtEnd : next.holdAtEnd,
      });
      byId.delete(prev.id);
      continue;
    }
    if (tExit < 1) {
      result.push(prev);
    }
  }
  for (const next of byId.values()) {
    if (tEnter > 0) {
      result.push(next);
    }
  }
  return result;
};

export const blendCustomAnimations = (
  from?: CustomAnimation[],
  to?: CustomAnimation[],
  tExit = 1,
  tEnter = 0,
  tFull = 0,
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
        enabled: (next.enabled ?? prev.enabled) && tFull > 0,
        layer: next.layer ?? prev.layer,
        apply: tFull < 0.5 ? prev.apply : next.apply,
      });
      byId.delete(prev.id);
      continue;
    }
    if (tExit < 1) {
      result.push({
        ...prev,
        weight: blendNumber(prev.weight ?? 1, 0, tExit),
        enabled: (prev.enabled ?? false) && tExit < 1,
      });
    }
  }
  for (const next of byId.values()) {
    if (tEnter > 0) {
      result.push({
        ...next,
        weight: blendNumber(0, next.weight ?? 1, tEnter),
        enabled: (next.enabled ?? false) && tEnter > 0,
      });
    }
  }
  return result;
};
