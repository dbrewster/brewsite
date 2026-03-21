// modelDslHandler.ts — Factory for ModelWidget CUSTOM_NODE_HANDLER and merge utilities.

import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import type * as React from 'react';
import type {
  CompileApi,
  CompileHelpers,
  NodeHandler,
  SceneSnapshotContext,
  NVSRect,
} from '@brewsite/core';
import { validateNVSScalar, validateNVSRect, resolveAngle } from '@brewsite/core';
import type { SceneAngle } from '@brewsite/core';
import type {
  AxisRotation,
  AxisTranslation,
  BodyPartOverride,
  BodyPartOverrideMap,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  CustomAnimation,
  SceneAnimation,
  SceneModelInstanceState,
  Vec3,
} from './types';
import type {
  AnimationProps,
  BodyPartByIdProps,
  ContainedModelProps,
  ModelPartProps,
  ModelProps,
  MotionProps,
  PlaybackProps,
  PoseProps,
  SubpartProps,
} from './dsl';
import type { LabelProps } from '../../labels/dsl';
import type { LabelResolved } from '../../labels/types';

// ─── Authored flags — WeakMap storage ────────────────────────────────────────

/**
 * Per-field "was it explicitly authored?" flags for a compiled model state.
 * Stored in a WeakMap keyed on the state object — no string-property pollution,
 * no unsafe casts. See Architecture Decision A in plan_model-package-refactor.md.
 */
export type ModelAuthoredFlags = {
  model?: {
    reset?: boolean;
    scale?: boolean;
    rotation?: boolean;
    opacity?: boolean;
    metalness?: boolean;
    roughness?: boolean;
    metalnessMultiplier?: boolean;
    roughnessMultiplier?: boolean;
  };
  enabled?: boolean;
  playback?: {
    reset?: boolean;
    animation?: Partial<Record<keyof SceneAnimation, boolean>>;
    motion?: {
      reset?: boolean;
      commands?: boolean;
      scenes?: boolean;
      customAnimations?: boolean;
    };
  };
};

// Module-level WeakMap — not exported. See Architecture Decision A.
const authoredFlagsMap = new WeakMap<SceneModelInstanceState, ModelAuthoredFlags>();

/**
 * Retrieve authored flags attached to a compiled model state.
 * Returns undefined if the state was not produced by buildModelNodeHandler
 * (e.g., it is the defaultState or a state created outside compilation).
 */
export function getModelAuthoredFlags(
  state: SceneModelInstanceState,
): ModelAuthoredFlags | undefined {
  return authoredFlagsMap.get(state);
}

/**
 * Attach authored flags to a state object for testing purposes.
 * Use this in tests that need to exercise mergeSnapshot authored-flag paths
 * without going through the full DSL compilation pipeline.
 *
 * @internal — test use only
 */
export function setModelAuthoredFlagsForTest(
  state: SceneModelInstanceState,
  flags: ModelAuthoredFlags,
): void {
  authoredFlagsMap.set(state, flags);
}

// ─── DSL component type references ───────────────────────────────────────────

/**
 * References to the DSL component stubs required by buildModelNodeHandler.
 * Using ComponentType<unknown> to avoid any.
 */
export type ModelDslComponents = {
  Model: React.ComponentType<unknown>;
  BodyParts: React.ComponentType<unknown>;
  BodyPart: React.ComponentType<unknown>;
  Pose: React.ComponentType<unknown>;
  ModelPart: React.ComponentType<unknown>;
  ContainedModel: React.ComponentType<unknown>;
  Subpart: React.ComponentType<unknown>;
  Playback: React.ComponentType<unknown>;
  Motion: React.ComponentType<unknown>;
  Animation: React.ComponentType<unknown>;
  Label: React.ComponentType<unknown>;
};

// ─── Handler config ───────────────────────────────────────────────────────────

/**
 * Configuration for buildModelNodeHandler.
 */
export type ModelNodeHandlerConfig = {
  widgetId: string;
  defaultState: SceneModelInstanceState;
  components: ModelDslComponents;
};

// ─── Private utilities ────────────────────────────────────────────────────────

const hasProp = (props: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(props, key);

// DEBT: Add test covering the displayName/name fallback path
const isComponent = (el: ReactElement, component: React.ComponentType<unknown>): boolean => {
  if (el.type === component) return true;
  const a = el.type as { displayName?: string; name?: string };
  const b = component as { displayName?: string; name?: string };
  const nameA = a.displayName ?? a.name;
  const nameB = b.displayName ?? b.name;
  return Boolean(nameA && nameB && nameA === nameB);
};

// ─── Public merge helpers ─────────────────────────────────────────────────────

/**
 * Merge body part override maps, applying reset semantics.
 * Exported for use by ModelWidget.mergeSnapshot() and testing.
 */
export const mergeBodyPartOverrides = (
  prev?: BodyPartOverrideMap,
  next?: BodyPartOverrideMap,
): BodyPartOverrideMap | undefined => {
  if (!prev && !next) return undefined;
  const result: BodyPartOverrideMap = { ...(prev ?? {}) };
  for (const [id, override] of Object.entries(next ?? {})) {
    if (!override) continue;
    const base = override.reset ? {} : (result[id] ?? {});
    let pose = base.pose;
    if (override.poseReset) {
      pose = {
        rotate: { yawPct: 0, pitchPct: 0, rollPct: 0 },
        translate: { xPct: 0, yPct: 0, zPct: 0 },
      };
    }
    if (override.pose) {
      pose = { ...(pose ?? {}), ...override.pose };
    }
    const merged: BodyPartOverride = {
      ...base,
      ...override,
      ...(pose ? { pose } : {}),
    };
    delete merged.reset;
    delete merged.poseReset;
    if (Object.keys(merged).length === 0) {
      delete result[id];
    } else {
      result[id] = merged;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

/**
 * Merge subpart spec maps, applying reset semantics.
 * Exported for use by ModelWidget.mergeSnapshot() and testing.
 */
export const mergeSubparts = (
  prev?: Partial<Record<string, ModelSubpartSpec>>,
  next?: Partial<Record<string, ModelSubpartSpec>>,
): Partial<Record<string, ModelSubpartSpec>> | undefined => {
  if (!prev && !next) return undefined;
  const result: Partial<Record<string, ModelSubpartSpec>> = { ...(prev ?? {}) };
  for (const [id, override] of Object.entries(next ?? {}) as Array<[string, ModelSubpartSpec]>) {
    if (!override) continue;
    const base = override.reset ? {} : (result[id] ?? {});
    const merged: ModelSubpartSpec = {
      ...(base as ModelSubpartSpec),
      ...override,
    };
    delete merged.reset;
    if (Object.keys(merged).length === 1 && merged.id) {
      delete result[id];
      continue;
    }
    result[id] = merged;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

/**
 * Merge model part maps, applying reset semantics.
 * Exported for use by ModelWidget.mergeSnapshot() and testing.
 */
export const mergeModelParts = (
  prev?: Record<string, ModelPartSpec>,
  next?: Record<string, ModelPartSpec>,
): Record<string, ModelPartSpec> | undefined => {
  if (!prev && !next) return undefined;
  const result: Record<string, ModelPartSpec> = { ...(prev ?? {}) };
  for (const [id, override] of Object.entries(next ?? {}) as Array<[string, ModelPartSpec]>) {
    if (!override) continue;
    const prevPart = result[id];
    const reset = override.reset;
    const base: ModelPartSpec = {
      id,
      anchor: override.anchor ?? (reset ? id : prevPart?.anchor ?? id),
      enabled: override.enabled ?? (reset ? true : prevPart?.enabled ?? true),
      space: override.space ?? (reset ? 'local' : prevPart?.space ?? 'local'),
      position: override.position ?? (reset ? ([0, 0, 0] as Vec3) : prevPart?.position ?? ([0, 0, 0] as Vec3)),
      rotation: override.rotation ?? (reset ? ([0, 0, 0] as Vec3) : prevPart?.rotation ?? ([0, 0, 0] as Vec3)),
      scale:
        typeof override.scale === 'number'
          ? override.scale
          : reset
            ? 1
            : typeof prevPart?.scale === 'number'
              ? prevPart.scale
              : 1,
      containedPosition: override.containedPosition ?? (reset ? undefined : prevPart?.containedPosition),
      containedRotation: override.containedRotation ?? (reset ? undefined : prevPart?.containedRotation),
      containedScale: override.containedScale ?? (reset ? undefined : prevPart?.containedScale),
      opacity: override.opacity ?? (reset ? undefined : prevPart?.opacity),
      metalness: override.metalness ?? (reset ? undefined : prevPart?.metalness),
      roughness: override.roughness ?? (reset ? undefined : prevPart?.roughness),
      modelId: override.modelId ?? (reset ? undefined : prevPart?.modelId),
      subparts: mergeSubparts(reset ? undefined : prevPart?.subparts, override.subparts),
    };
    const merged: ModelPartSpec = reset ? { ...base } : { ...prevPart, ...base };
    delete merged.reset;
    result[id] = merged;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

// ─── Handler factory ──────────────────────────────────────────────────────────

/**
 * Build the CUSTOM_NODE_HANDLER NodeHandler for a ModelWidget instance.
 * Encapsulates all DSL child traversal and state assembly logic.
 */
export function buildModelNodeHandler(config: ModelNodeHandlerConfig): NodeHandler {
  const { widgetId, defaultState, components } = config;

  /**
   * Merge a single <BodyPart id="..."> element into the overrides map.
   * Also handles a nested <Pose> child of the BodyPart.
   */
  const applyBodyPartToOverrides = (
    el: ReactElement,
    overrides: BodyPartOverrideMap,
    ctx: SceneSnapshotContext,
    helpers: CompileHelpers,
    pushLabel: (label: LabelResolved) => void,
  ): void => {
    const bpProps = helpers.resolveObjectValues(el.props as BodyPartByIdProps, ctx);
    const id = bpProps.id;
    if (!id) return;
    const reset = (bpProps.reset as boolean | undefined) === true;
    const existing: BodyPartOverride = reset ? {} : (overrides[id] ?? {});
    // resolveObjectValues resolves function-valued props to plain values; cast to concrete types.
    const override: BodyPartOverride = {
      ...existing,
      ...(reset ? { reset: true } : {}),
      ...(bpProps.opacity !== undefined ? { opacity: bpProps.opacity as number } : {}),
      ...(bpProps.color !== undefined ? { color: bpProps.color as string } : {}),
      ...(bpProps.metalness !== undefined ? { metalness: bpProps.metalness as number } : {}),
      ...(bpProps.roughness !== undefined ? { roughness: bpProps.roughness as number } : {}),
      ...(bpProps.targetKind ? { targetKind: bpProps.targetKind } : {}),
      ...(bpProps.boneId !== undefined ? { boneId: bpProps.boneId as string } : {}),
      ...(bpProps.meshId !== undefined ? { meshId: bpProps.meshId as string } : {}),
    };
    const labelTarget = (bpProps.boneId as string | undefined) ?? (bpProps.meshId as string | undefined) ?? id;
    // <Pose> nested inside <BodyPart> contributes a per-part pose override
    const bpChildren = helpers.collectChildren(el);
    for (const c of bpChildren) {
      if (!isValidElement(c)) continue;
      const ce = c as ReactElement;
      if (isComponent(ce, components.Pose)) {
        const poseProps = helpers.resolveObjectValues(ce.props as PoseProps, ctx);
        if (poseProps.reset) {
          override.poseReset = true;
        }
        // Merge nested object props and flat shorthand props into rotate/translate
        const rotate: AxisRotation = { ...(poseProps.rotate as AxisRotation | undefined) };
        if (poseProps.yawPct !== undefined) rotate.yawPct = poseProps.yawPct as number;
        if (poseProps.pitchPct !== undefined) rotate.pitchPct = poseProps.pitchPct as number;
        if (poseProps.rollPct !== undefined) rotate.rollPct = poseProps.rollPct as number;
        const translate: AxisTranslation = { ...(poseProps.translate as AxisTranslation | undefined) };
        if (poseProps.xPct !== undefined) translate.xPct = poseProps.xPct as number;
        if (poseProps.yPct !== undefined) translate.yPct = poseProps.yPct as number;
        if (poseProps.zPct !== undefined) translate.zPct = poseProps.zPct as number;
        override.pose = {
          ...(Object.keys(rotate).length > 0 ? { rotate } : {}),
          ...(Object.keys(translate).length > 0 ? { translate } : {}),
        };
      } else if (isComponent(ce, components.Label)) {
        const labelProps = helpers.resolveObjectValues(ce.props as LabelProps, ctx);
        if (!labelProps?.id || !labelProps?.text) continue;
        pushLabel({
          ...(labelProps as LabelProps),
          targetPartId: labelTarget,
        });
      }
    }
    overrides[id] = override;
  };

  /**
   * Merge a single <ModelPart id="..."> element into the parts map.
   * Handles nested <ContainedModel> and <Subpart> children.
   */
  const applyModelPartToOverrides = (
    el: ReactElement,
    parts: Record<string, ModelPartSpec>,
    baseParts: Record<string, ModelPartSpec>,
    ctx: SceneSnapshotContext,
    helpers: CompileHelpers,
    pushLabel: (label: LabelResolved) => void,
  ): void => {
    const props = helpers.resolveObjectValues(el.props as ModelPartProps, ctx);
    if (!props?.id) return;
    const id = props.id as string;
    const reset = (props.reset as boolean | undefined) === true;
    const base = (reset ? { id } : parts[id] ?? baseParts[id] ?? { id }) as Partial<ModelPartSpec>;

    let modelId = base.modelId;
    let position = base.position;
    let rotation = base.rotation;
    let scale = base.scale;
    let containedPosition = base.containedPosition;
    let containedRotation = base.containedRotation;
    let containedScale = base.containedScale;
    const subparts: Partial<Record<string, ModelSubpartSpec>> = { ...(base.subparts ?? {}) };

    const children = helpers.collectChildren(el);
    for (const child of children) {
      if (!isValidElement(child)) continue;
      const ce = child as ReactElement;
      if (isComponent(ce, components.ContainedModel)) {
        const contained = helpers.resolveObjectValues(ce.props as ContainedModelProps, ctx);
        if (contained.modelId) modelId = contained.modelId as string;
        if (contained.position) containedPosition = contained.position as Vec3;
        if (contained.rotation) containedRotation = contained.rotation as Vec3;
        if (contained.scale !== undefined) containedScale = contained.scale as number;
      } else if (isComponent(ce, components.Label)) {
        throw new Error('<Label> must be nested under <Subpart> or <BodyPart>.');
      } else if (isComponent(ce, components.Subpart)) {
        const subProps = helpers.resolveObjectValues(ce.props as SubpartProps, ctx);
        if (!subProps.id) continue;
        subparts[subProps.id] = {
          id: subProps.id,
          enabled: subProps.enabled as boolean | undefined,
          opacity: subProps.opacity as number | undefined,
          color: subProps.color as string | undefined,
          metalness: subProps.metalness as number | undefined,
          roughness: subProps.roughness as number | undefined,
          reset: subProps.reset as boolean | undefined,
        };
        const subChildren = helpers.collectChildren(ce);
        for (const sc of subChildren) {
          if (!isValidElement(sc)) continue;
          const se = sc as ReactElement;
          if (isComponent(se, components.Label)) {
            const labelProps = helpers.resolveObjectValues(se.props as LabelProps, ctx);
            if (!labelProps?.id || !labelProps?.text) continue;
            pushLabel({
              ...(labelProps as LabelProps),
              targetPartId: `${id}:${subProps.id}`,
            });
          }
        }
      }
    }

    const resolvedEnabled = props.enabled as boolean | undefined;
    const resolvedOpacity = props.opacity as number | undefined;
    const resolvedPosition = props.position as Vec3 | undefined;
    const resolvedRotation = props.rotation as Vec3 | undefined;
    const resolvedScale = props.scale as number | undefined;
    const resolvedSpace = props.space as ModelPartSpec['space'] | undefined;
    const nextPosition = resolvedPosition ?? position;
    const nextRotation = resolvedRotation ?? rotation;
    const nextScale = resolvedScale ?? scale;

    parts[id] = {
      ...(base as ModelPartSpec),
      id,
      ...(reset ? { reset: true } : {}),
      ...(props.anchor !== undefined ? { anchor: props.anchor } : {}),
      ...(resolvedSpace !== undefined ? { space: resolvedSpace } : {}),
      ...(resolvedEnabled !== undefined ? { enabled: resolvedEnabled } : {}),
      ...(resolvedOpacity !== undefined ? { opacity: resolvedOpacity } : {}),
      ...(nextPosition !== undefined ? { position: nextPosition } : {}),
      ...(nextRotation !== undefined ? { rotation: nextRotation } : {}),
      ...(nextScale !== undefined ? { scale: nextScale } : {}),
      ...(containedPosition !== undefined ? { containedPosition } : {}),
      ...(containedRotation !== undefined ? { containedRotation } : {}),
      ...(containedScale !== undefined ? { containedScale } : {}),
      ...(modelId !== undefined ? { modelId } : {}),
      ...(subparts && Object.keys(subparts).length > 0 ? { subparts } : {}),
    } as ModelPartSpec;
  };

  return (node, api: CompileApi, helpers) => {
    const ctx = api.context;
    const rawProps = node.props as ModelProps;
    const props = helpers.resolveObjectValues(rawProps, ctx);
    const sceneMetalnessMultiplier = api.state.materialMetalnessMultiplier;
    const sceneRoughnessMultiplier = api.state.materialRoughnessMultiplier;
    const rawRotation = props.rotation !== undefined
      ? (props.rotation as [SceneAngle, SceneAngle, SceneAngle])
      : undefined;
    const resolvedRotation: Vec3 | undefined = rawRotation !== undefined
      ? [resolveAngle(rawRotation[0]), resolveAngle(rawRotation[1]), resolveAngle(rawRotation[2])]
      : undefined;
    const base =
      (api.state.widgets[widgetId] as SceneModelInstanceState | undefined) ??
      defaultState;
    const authored: ModelAuthoredFlags = {
      model: {
        reset: props.reset === true,
        scale: hasProp(rawProps as Record<string, unknown>, 'scale'),
        rotation: hasProp(rawProps as Record<string, unknown>, 'rotation'),
        opacity: hasProp(rawProps as Record<string, unknown>, 'opacity'),
        metalness: hasProp(rawProps as Record<string, unknown>, 'metalness'),
        roughness: hasProp(rawProps as Record<string, unknown>, 'roughness'),
        metalnessMultiplier:
          hasProp(rawProps as Record<string, unknown>, 'metalnessMultiplier')
            || typeof sceneMetalnessMultiplier === 'number',
        roughnessMultiplier:
          hasProp(rawProps as Record<string, unknown>, 'roughnessMultiplier')
            || typeof sceneRoughnessMultiplier === 'number',
      },
      enabled: hasProp(rawProps as Record<string, unknown>, 'enabled'),
      playback: {
        animation: {},
        motion: {},
      },
    };

    // Mutable accumulators seeded from base state
    const bodyPartOverrides: BodyPartOverrideMap = {};
    let motionCommands: MotionCommand[] = base.playback.motion.commands;
    let motionScenes: MotionScene[] = base.playback.motion.scenes;
    let motionCustomAnimations: CustomAnimation[] | undefined =
      base.playback.motion.customAnimations;
    let animation: SceneAnimation = { ...base.playback.animation };
    const baseModelParts: Record<string, ModelPartSpec> = base.model.parts ?? {};
    const modelParts: Record<string, ModelPartSpec> = {};
    // Collect labels locally (moved from api.pushLabel to SceneModelInstanceState.labels in Phase 4)
    const collectedLabels: LabelResolved[] = [];
    const pushLabel = (label: LabelResolved): void => { collectedLabels.push(label); };

    // Walk immediate children of <Model>
    const children = helpers.collectChildren(node);
    for (const child of children) {
      if (!isValidElement(child)) continue;
      const el = child as ReactElement;

      if (isComponent(el, components.BodyParts)) {
        // <BodyParts> container: each child is a <BodyPart id="...">
        const bpChildren = helpers.collectChildren(el);
        for (const bpChild of bpChildren) {
          if (!isValidElement(bpChild)) continue;
          const bpEl = bpChild as ReactElement;
          if (isComponent(bpEl, components.BodyPart)) {
            applyBodyPartToOverrides(bpEl, bodyPartOverrides, ctx, helpers, pushLabel);
          }
        }
      } else if (isComponent(el, components.BodyPart)) {
        // Direct <BodyPart id="..."> child of <Model>
        applyBodyPartToOverrides(el, bodyPartOverrides, ctx, helpers, pushLabel);
      } else if (isComponent(el, components.ModelPart)) {
        applyModelPartToOverrides(el, modelParts, baseModelParts, ctx, helpers, pushLabel);
      } else if (isComponent(el, components.Playback)) {
        const pbRaw = el.props as PlaybackProps;
        if (helpers.resolveValue(pbRaw.reset, ctx)) {
          authored.playback!.reset = true;
        }
        // <Playback> container: <Animation> and <Motion> children
        const pbChildren = helpers.collectChildren(el);
        for (const pbChild of pbChildren) {
          if (!isValidElement(pbChild)) continue;
          const pbEl = pbChild as ReactElement;

          if (isComponent(pbEl, components.Animation)) {
            const animRaw = pbEl.props as AnimationProps;
            const animProps = helpers.resolveObjectValues(animRaw, ctx);
            if (helpers.resolveValue(animRaw.reset, ctx)) {
              authored.playback!.animation!.reset = true;
            }
            authored.playback!.animation = {
              ...authored.playback!.animation,
              enabled: hasProp(animRaw as Record<string, unknown>, 'enabled'),
              clipName: hasProp(animRaw as Record<string, unknown>, 'clipName'),
              gltfUrl: hasProp(animRaw as Record<string, unknown>, 'gltfUrl'),
              gltfClipName: hasProp(animRaw as Record<string, unknown>, 'gltfClipName'),
              fbxUrl: hasProp(animRaw as Record<string, unknown>, 'fbxUrl'),
              fbxClipName: hasProp(animRaw as Record<string, unknown>, 'fbxClipName'),
              fbxRetarget: hasProp(animRaw as Record<string, unknown>, 'fbxRetarget'),
              fadeInSeconds: hasProp(animRaw as Record<string, unknown>, 'fadeInSeconds'),
              weight: hasProp(animRaw as Record<string, unknown>, 'weight'),
              clipStart: hasProp(animRaw as Record<string, unknown>, 'clipStart'),
              clipEnd: hasProp(animRaw as Record<string, unknown>, 'clipEnd'),
              clipRangeUnit: hasProp(animRaw as Record<string, unknown>, 'clipRangeUnit'),
              clipRepeat: hasProp(animRaw as Record<string, unknown>, 'clipRepeat'),
              clipStartOnce: hasProp(animRaw as Record<string, unknown>, 'clipStartOnce'),
              trimStartKeyframes: hasProp(animRaw as Record<string, unknown>, 'trimStartKeyframes'),
              trimEndKeyframes: hasProp(animRaw as Record<string, unknown>, 'trimEndKeyframes'),
              holdStartPose: hasProp(animRaw as Record<string, unknown>, 'holdStartPose'),
              allowRotation: hasProp(animRaw as Record<string, unknown>, 'allowRotation'),
              allowScale: hasProp(animRaw as Record<string, unknown>, 'allowScale'),
            };
            // children/reset are not part of SceneAnimation merge payload.
            const {
              children: _ignored,
              reset: _reset,
              enabled: resolvedEnabled,
              ...animState
            } = animProps as AnimationProps & {
              children?: unknown;
            };
            animation = {
              ...animation,
              ...animState,
              ...(resolvedEnabled !== undefined ? { enabled: resolvedEnabled as boolean } : {}),
            };
          } else if (isComponent(pbEl, components.Motion)) {
            const motionRaw = pbEl.props as MotionProps;
            const motionProps = helpers.resolveObjectValues(
              motionRaw,
              ctx,
            );
            if (helpers.resolveValue(motionRaw.reset, ctx)) {
              authored.playback!.motion!.reset = true;
            }
            authored.playback!.motion = {
              ...authored.playback!.motion,
              commands: hasProp(motionRaw as Record<string, unknown>, 'commands'),
              scenes: hasProp(motionRaw as Record<string, unknown>, 'scenes'),
              customAnimations: hasProp(motionRaw as Record<string, unknown>, 'customAnimations'),
            };
            if (motionProps.commands !== undefined) {
              motionCommands = motionProps.commands as MotionCommand[];
            }
            if (motionProps.scenes !== undefined) {
              motionScenes = motionProps.scenes as MotionScene[];
            }
            if (motionProps.customAnimations !== undefined) {
              motionCustomAnimations = motionProps.customAnimations as CustomAnimation[];
            }
          }
        }
      }
      // <ModelPart>, <ContainedModel>, <Subpart> are Pattern A composites handled
      // separately — they are protected at the top level by childDslComponents and
      // are not processed here to keep this handler scope-tight.
    }

    // resolveObjectValues resolves function-valued props; cast to concrete scalar types.
    const resolvedSceneMetalnessMultiplier = sceneMetalnessMultiplier ?? 1;
    const resolvedSceneRoughnessMultiplier = sceneRoughnessMultiplier ?? 1;
    const modelMetalnessMultiplier =
      props.metalnessMultiplier !== undefined ? (props.metalnessMultiplier as number) : 1;
    const modelRoughnessMultiplier =
      props.roughnessMultiplier !== undefined ? (props.roughnessMultiplier as number) : 1;

    const localBounds: NVSRect = {
      x: props.x !== undefined ? (props.x as number) : 0,
      y: props.y !== undefined ? (props.y as number) : 0,
      w: props.w !== undefined ? (props.w as number) : 1,
      h: props.h !== undefined ? (props.h as number) : 1,
    };
    // Compose into parent view/region if present. Identity when no parent.
    const nvsBounds = api.composeBounds(localBounds);
    const nvsX = nvsBounds.x + nvsBounds.w / 2;
    const nvsY = nvsBounds.y + nvsBounds.h / 2;
    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(nvsX, 'nvsX', `<Model id="${widgetId}">`);
      validateNVSScalar(nvsY, 'nvsY', `<Model id="${widgetId}">`);
      validateNVSRect(nvsBounds, `<Model id="${widgetId}">`);
    }
    const state: SceneModelInstanceState = {
      model: {
        ...base.model,
        nvsX,
        nvsY,
        z: props.z !== undefined ? (props.z as number) : (base.model.z ?? 0),
        ...(props.reset === true ? { reset: true } : {}),
        ...(props.scale !== undefined ? { scale: props.scale as number } : {}),
        ...(resolvedRotation !== undefined ? { rotation: resolvedRotation } : {}),
        ...(props.opacity !== undefined ? { opacity: props.opacity as number } : {}),
        ...(props.metalness !== undefined ? { metalness: props.metalness as number } : {}),
        ...(props.roughness !== undefined ? { roughness: props.roughness as number } : {}),
        metalnessMultiplier: resolvedSceneMetalnessMultiplier * modelMetalnessMultiplier,
        roughnessMultiplier: resolvedSceneRoughnessMultiplier * modelRoughnessMultiplier,
        bodyPartOverrides,
        parts: Object.keys(modelParts).length > 0 ? modelParts : undefined,
      },
      playback: {
        motion: {
          commands: motionCommands,
          scenes: motionScenes,
          customAnimations: motionCustomAnimations,
        },
        animation,
      },
      ...(props.enabled !== undefined ? { enabled: props.enabled as boolean } : {}),
      ...(collectedLabels.length > 0 ? { labels: collectedLabels } : {}),
      nvsBounds,
    };

    authoredFlagsMap.set(state, authored);
    api.setWidgetState(widgetId, state);
  };
}
