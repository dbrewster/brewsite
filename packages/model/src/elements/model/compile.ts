// compile.ts — Transition specs, animation compilation, and default state creation.
// Blend helpers live in modelBlend.ts.

import type {
  SceneAnimation,
  SceneModel,
  ScenePlayback,
  ClipMeta,
  SceneModelInstanceState,
} from './types';
import type { NVSRect } from '@brewsite/core';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import {
  blendNumber,
  blendOpacity,
  blendVec3,
} from '@brewsite/core';
import {
  blendBodyOverrides,
  blendParts,
  blendPoseGroups,
  blendCommands,
  blendMotionScenes,
  blendCustomAnimations,
} from './modelBlend';

/**
 * resolveClipRangeSeconds resolves animation clip start/end times.
 * Converts from percent (if specified) to absolute seconds.
 */
export const resolveClipRangeSeconds = (animation: SceneAnimation, clipDuration: number) => {
  const clipStart = animation.clipStart ?? 0;
  const rawClipEnd = animation.clipEnd;
  const clipRangeUnit = animation.clipRangeUnit ?? 'seconds';
  let startSeconds = clipStart;
  let endSeconds = rawClipEnd ?? clipDuration;
  if (clipRangeUnit === 'percent') {
    const startPct = clipStart > 1 ? clipStart / 100 : clipStart;
    const endRaw = rawClipEnd ?? 1;
    const endPct = endRaw > 1 ? endRaw / 100 : endRaw;
    startSeconds = startPct * clipDuration;
    endSeconds = endPct * clipDuration;
  } else if (typeof rawClipEnd === 'number' && rawClipEnd < 0) {
    endSeconds = Math.max(0, clipDuration + rawClipEnd);
  }
  const span = Math.max(1e-4, endSeconds - startSeconds);
  return { startSeconds, endSeconds, span };
};

// ─── Model transition spec ───────────────────────────────────────────────────

export const modelTransitionSpec = {
  exit: (from: SceneModel, t: number): SceneModel => ({
    ...from,
    nvsX: from.nvsX,
    nvsY: from.nvsY,
    z: from.z,
    rotation: from.rotation,
    scale: from.scale,
    opacity: blendOpacity(from.opacity ?? 1, 0, t),
    enabled: t >= 1 ? false : from.enabled,
    metalnessMultiplier: from.metalnessMultiplier,
    roughnessMultiplier: from.roughnessMultiplier,
    bodyPartOverrides: blendBodyOverrides(from.bodyPartOverrides, undefined, t, 0, t),
    parts: blendParts(from.parts, undefined, t, 0, t),
  }),
  enter: (to: SceneModel, t: number): SceneModel => ({
    ...to,
    scale: to.scale,
    opacity: blendOpacity(0, to.opacity ?? 1, t),
    enabled: t > 0 ? (to.enabled ?? true) : to.enabled,
    metalnessMultiplier: to.metalnessMultiplier,
    roughnessMultiplier: to.roughnessMultiplier,
    bodyPartOverrides: blendBodyOverrides(undefined, to.bodyPartOverrides, 0, t, t),
    parts: blendParts(undefined, to.parts, 0, t, t),
  }),
  interpolate: (from: SceneModel, to: SceneModel, t: number): SceneModel => ({
    ...from,
    ...to,
    nvsX: blendNumber(from.nvsX, to.nvsX, t) ?? to.nvsX ?? from.nvsX,
    nvsY: blendNumber(from.nvsY, to.nvsY, t) ?? to.nvsY ?? from.nvsY,
    z: blendNumber(from.z, to.z, t) ?? to.z ?? from.z,
    rotation: blendVec3(from.rotation, to.rotation, t) ?? to.rotation ?? from.rotation,
    scale: blendNumber(from.scale, to.scale, t) ?? to.scale ?? from.scale,
    opacity: blendOpacity(from.opacity ?? 1, to.opacity ?? 1, t),
    metalness: blendNumber(from.metalness, to.metalness, t) ?? to.metalness ?? from.metalness,
    roughness: blendNumber(from.roughness, to.roughness, t) ?? to.roughness ?? from.roughness,
    metalnessMultiplier:
      blendNumber(from.metalnessMultiplier, to.metalnessMultiplier, t)
      ?? to.metalnessMultiplier
      ?? from.metalnessMultiplier,
    roughnessMultiplier:
      blendNumber(from.roughnessMultiplier, to.roughnessMultiplier, t)
      ?? to.roughnessMultiplier
      ?? from.roughnessMultiplier,
    bodyPartOverrides: blendBodyOverrides(from.bodyPartOverrides, to.bodyPartOverrides, t, t, t),
    parts: blendParts(from.parts, to.parts, t, t, t),
  }),
};

// ─── Playback transition spec ────────────────────────────────────────────────

export const playbackTransitionSpec = {
  exit: (from: ScenePlayback, t: number): ScenePlayback => ({
    ...from,
    animation: {
      ...from.animation,
      weight: blendNumber(from.animation.weight ?? 1, 0, t),
      enabled: (from.animation.enabled ?? false) && t < 1,
    },
    motion: from.motion,
  }),
  enter: (to: ScenePlayback, t: number): ScenePlayback => ({
    ...to,
    animation: {
      ...to.animation,
      weight: blendNumber(0, to.animation.weight ?? 1, t),
      enabled: to.animation.enabled ?? false,
    },
    motion: to.motion,
  }),
  interpolate: (from: ScenePlayback, to: ScenePlayback, t: number): ScenePlayback => ({
    ...from,
    ...to,
    animation: {
      // Keep the current scene's animation for the full transition block.
      // The next scene's animation should not take over until the block boundary.
      ...from.animation,
      weight: from.animation.weight ?? 1,
      enabled: from.animation.enabled ?? false,
    },
    motion: {
      ...from.motion,
      ...to.motion,
      commands: blendCommands(from.motion.commands, to.motion.commands, t, t, t),
      scenes: blendMotionScenes(from.motion.scenes, to.motion.scenes, t, t, t),
      customAnimations: blendCustomAnimations(from.motion.customAnimations, to.motion.customAnimations, t, t, t),
      pose: (() => {
        const fromPose = from.motion.pose;
        const toPose = to.motion.pose;
        const toHasGroups = Object.keys(toPose?.groups ?? {}).length > 0;
        const resolvedToPose = toHasGroups ? toPose : undefined;
        if (fromPose && resolvedToPose) {
          const blendedGroups = blendPoseGroups(fromPose.groups, resolvedToPose.groups, t);
          return {
            ...resolvedToPose,
            groups: blendedGroups ?? resolvedToPose.groups,
          };
        }
        if (fromPose) {
          return {
            ...fromPose,
            groups: blendPoseGroups(fromPose.groups, undefined, t) ?? fromPose.groups ?? {},
          };
        }
        if (resolvedToPose && t > 0) {
          return {
            ...resolvedToPose,
            groups: blendPoseGroups(undefined, resolvedToPose.groups, t) ?? resolvedToPose.groups,
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

  const shouldUseClipDefaults =
    typeof animation.clipStart !== 'number' && typeof animation.clipEnd !== 'number';
  const effectiveAnimation: SceneAnimation = shouldUseClipDefaults
    ? {
        ...animation,
        clipStart: animation.clipStart ?? clip.clipStart,
        clipEnd: animation.clipEnd ?? clip.clipEnd,
      }
    : animation;
  const range = resolveClipRangeSeconds(effectiveAnimation, clip.duration);
  return {
    enabled: true,
    clipName: requestedClip,
    clipDuration: clip.duration,
    range,
  };
};

// ─── Default state factory ──────────────────────────────────────────────────

/** Fullscreen NVS bounds — the default when no region is specified. */
const FULLSCREEN_NVS_BOUNDS: NVSRect = { x: 0, y: 0, w: 1, h: 1 };

const cloneIdentityState = (state: SceneModelInstanceState): SceneModelInstanceState =>
  structuredClone(state) as SceneModelInstanceState;

export function createDefaultModelInstanceState(
  _modelId: string,
  identity: SceneModelInstanceState,
): SceneModelInstanceState {
  const cloned = cloneIdentityState(identity);
  // Ensure nvsBounds is always present — older identities (from JSON manifests) may omit it.
  if (!cloned.nvsBounds) {
    cloned.nvsBounds = { ...FULLSCREEN_NVS_BOUNDS };
  }
  return cloned;
}

// ─── Instance state transition spec (wraps model and playback) ─────────────

export const applyModelExit = (
  from: SceneModelInstanceState,
  t: number,
): SceneModelInstanceState => ({
  ...from,
  model: modelTransitionSpec.exit(from.model, t),
  playback: playbackTransitionSpec.exit(from.playback, t),
  enabled: t >= 1 ? false : from.enabled,
});

export const applyModelEnter = (
  to: SceneModelInstanceState,
  t: number,
): SceneModelInstanceState => ({
  ...to,
  model: modelTransitionSpec.enter(to.model, t),
  playback: playbackTransitionSpec.enter(to.playback, t),
  enabled: t > 0 ? (to.enabled ?? true) : to.enabled,
});

export const applyModelInterpolate = (
  from: SceneModelInstanceState,
  to: SceneModelInstanceState,
  t: number,
): SceneModelInstanceState => ({
  ...from,
  ...to,
  model: modelTransitionSpec.interpolate(from.model, to.model, t),
  playback: playbackTransitionSpec.interpolate(from.playback, to.playback, t),
  enabled: (to.enabled ?? from.enabled ?? true) && t < 1,
});

/**
 * Functional form of the model instance transition spec.
 * Evaluates at runtime for infinite easing fidelity without oversampling.
 *
 * Uses ctx.t for all properties (zero behavior change from old scalar-t path).
 * Scene authors may add <Transition channels={['opacity']} ...> children to the
 * <Model> DSL element to activate per-channel window/ease control.
 */
export const functionalInstanceTransitionSpec: FunctionalTransitionSpec<SceneModelInstanceState> = {
  exitFn: (from) => (ctx) => applyModelExit(from, ctx.t),
  enterFn: (to) => (ctx) => applyModelEnter(to, ctx.t),
  interpolateFn: (from, to) => (ctx) => applyModelInterpolate(from, to, ctx.t),
};
