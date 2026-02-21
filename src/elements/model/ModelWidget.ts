/**
 * ModelWidget - the main widget class for model elements.
 *
 * Implements:
 * - ISceneElement: state and transition spec
 * - IRenderable: initialize, apply, dispose
 * - ILoadable: load assets
 * - IDslComposite: DSL child components
 */

import type * as React from 'react';
import type {ReactElement} from 'react';
import {isValidElement} from 'react';
import type * as THREE from 'three';
import type {CompileExtraContext, IDslComposite, ILoadable, IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext,} from '../../widget/types';
import {CUSTOM_NODE_HANDLER} from '../../widget/WidgetRegistry';
import type {CompileHelpers, NodeHandler, SceneSnapshotContext} from '../../compiler/index';
import type {
  AxisRotation,
  AxisTranslation,
  BodyPartOverride,
  BodyPartOverrideMap,
  ClipMeta,
  CustomAnimation,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  SceneAnimation,
  SceneModelInstanceState,
  Vec3,
} from './types';
import type {CompiledAnimation} from './compile';
import {compileAnimation, createDefaultModelInstanceState, instanceTransitionSpec,} from './compile';
import type {AssetManifest, ModelMeta} from './metadata';
import type {AnimationProps, BodyPartByIdProps, ContainedModelProps, ModelPartProps, ModelProps, MotionProps, PlaybackProps, PoseProps, SubpartProps,} from './dsl';
import {Animation, BodyPart, BodyParts, ContainedModel, ModelPart, ModelRouter, Motion, Playback, Pose, Subpart,} from './dsl';
import {ModelRenderer} from './ModelRenderer';

export type ModelWidgetConfig = {
  /**
   * The ModelMeta descriptor for this widget. modelMeta.type is the model type.
   */
  modelMeta: ModelMeta;
  clipMeta: ClipMeta[];
  widgetId?: string;
};

type ModelAuthoredFlags = {
  model?: {
    reset?: boolean;
    scale?: boolean;
    position?: boolean;
    rotation?: boolean;
    metalness?: boolean;
    roughness?: boolean;
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

const hasProp = (props: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(props, key);
const isComponent = (el: ReactElement, component: React.ComponentType<any>): boolean => {
  if (el.type === component) return true;
  const a = el.type as { displayName?: string; name?: string };
  const b = component as { displayName?: string; name?: string };
  const nameA = a.displayName ?? a.name;
  const nameB = b.displayName ?? b.name;
  return Boolean(nameA && nameB && nameA === nameB);
};

// ─── DSL child helper ────────────────────────────────────────────────────────

/**
 * Merge a single <BodyPart id="..."> element into the overrides map.
 * Also handles a nested <Pose> child of the BodyPart.
 */
const applyBodyPartToOverrides = (
  el: ReactElement,
  overrides: BodyPartOverrideMap,
  ctx: SceneSnapshotContext,
  helpers: CompileHelpers,
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
  };
  // <Pose> nested inside <BodyPart> contributes a per-part pose override
  const bpChildren = helpers.collectChildren(el);
  for (const c of bpChildren) {
    if (!isValidElement(c)) continue;
    const ce = c as ReactElement;
    if (isComponent(ce, Pose)) {
      const poseProps = helpers.resolveObjectValues(ce.props as PoseProps, ctx);
      if (poseProps.reset) {
        override.poseReset = true;
      }
      override.pose = {
        ...(poseProps.rotate !== undefined ? { rotate: poseProps.rotate as AxisRotation } : {}),
        ...(poseProps.translate !== undefined ? { translate: poseProps.translate as AxisTranslation } : {}),
      };
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
  ctx: SceneSnapshotContext,
  helpers: CompileHelpers,
): void => {
  const props = helpers.resolveObjectValues(el.props as ModelPartProps, ctx);
  if (!props?.id) return;
  const id = props.id as string;
  const reset = (props.reset as boolean | undefined) === true;
  const base = (reset ? { id } : parts[id] ?? { id }) as Partial<ModelPartSpec>;

  let modelId = base.modelId;
  let position = base.position;
  let rotation = base.rotation;
  let scale = base.scale;
  const subparts: Partial<Record<string, ModelSubpartSpec>> = { ...(base.subparts ?? {}) };

  const children = helpers.collectChildren(el);
  for (const child of children) {
    if (!isValidElement(child)) continue;
    const ce = child as ReactElement;
    if (isComponent(ce, ContainedModel)) {
      const contained = helpers.resolveObjectValues(ce.props as ContainedModelProps, ctx);
      if (contained.modelId) modelId = contained.modelId as string;
      if (contained.position) position = contained.position as Vec3;
      if (contained.rotation) rotation = contained.rotation as Vec3;
      if (contained.scale !== undefined) scale = contained.scale as number;
    } else if (isComponent(ce, Subpart)) {
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
    }
  }

  const resolvedEnabled = props.enabled as boolean | undefined;
  const resolvedOpacity = props.opacity as number | undefined;
  const resolvedPosition = props.position as Vec3 | undefined;
  const resolvedRotation = props.rotation as Vec3 | undefined;
  const resolvedScale = props.scale as number | undefined;
  const nextPosition = resolvedPosition ?? position;
  const nextRotation = resolvedRotation ?? rotation;
  const nextScale = resolvedScale ?? scale;

  parts[id] = {
    ...(base as ModelPartSpec),
    id,
    ...(reset ? { reset: true } : {}),
    ...(props.anchor !== undefined ? { anchor: props.anchor } : {}),
    ...(resolvedEnabled !== undefined ? { enabled: resolvedEnabled } : {}),
    ...(resolvedOpacity !== undefined ? { opacity: resolvedOpacity } : {}),
    ...(nextPosition !== undefined ? { position: nextPosition } : {}),
    ...(nextRotation !== undefined ? { rotation: nextRotation } : {}),
    ...(nextScale !== undefined ? { scale: nextScale } : {}),
    ...(modelId !== undefined ? { modelId } : {}),
    ...(subparts && Object.keys(subparts).length > 0 ? { subparts } : {}),
  } as ModelPartSpec;
};

const mergeBodyPartOverrides = (
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
      pose = undefined;
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

const mergeSubparts = (
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

const mergeModelParts = (
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

// ─── Widget class ─────────────────────────────────────────────────────────────

/**
 * ModelWidget is the main widget implementation for model elements.
 *
 * It coordinates:
 * - DSL compilation (via CUSTOM_NODE_HANDLER registered in constructor)
 * - Asset loading
 * - Three.js rendering (via ModelRenderer)
 * - Animation and motion application
 */
export class ModelWidget
  implements
    ISceneElement<SceneModelInstanceState, CompiledAnimation>,
    IRenderable<SceneModelInstanceState>,
    ILoadable,
    IDslComposite {

  readonly widgetId: string;
  readonly defaultState: SceneModelInstanceState;
  readonly transitionSpec = instanceTransitionSpec;
  readonly DslComponent = ModelRouter;
  private anchorTargets: Record<string, string> = {};

  readonly childDslComponents: readonly {
    component: React.ComponentType<unknown>;
    displayName: string;
    topLevelError?: boolean;
  }[] = [
    { component: BodyPart as React.ComponentType<unknown>, displayName: 'BodyPart', topLevelError: true },
    { component: BodyParts as React.ComponentType<unknown>, displayName: 'BodyParts', topLevelError: true },
    { component: Pose as React.ComponentType<unknown>, displayName: 'Pose', topLevelError: true },
    { component: ModelPart as React.ComponentType<unknown>, displayName: 'ModelPart', topLevelError: true },
    { component: ContainedModel as React.ComponentType<unknown>, displayName: 'ContainedModel', topLevelError: false },
    { component: Subpart as React.ComponentType<unknown>, displayName: 'Subpart', topLevelError: false },
    { component: Playback as React.ComponentType<unknown>, displayName: 'Playback', topLevelError: true },
    { component: Motion as React.ComponentType<unknown>, displayName: 'Motion', topLevelError: true },
    { component: Animation as React.ComponentType<unknown>, displayName: 'Animation', topLevelError: true },
  ];

  isLoaded = false;
  readonly clipMeta: ClipMeta[];

  private config: ModelWidgetConfig;
  private renderer: ModelRenderer | null = null;
  private readonly modelType: string;

  constructor(config: ModelWidgetConfig) {
    this.widgetId = config.widgetId ?? config.modelMeta.type;
    this.modelType = config.modelMeta.type;
    this.config = config;
    this.clipMeta = config.clipMeta;
    this.defaultState = createDefaultModelInstanceState(this.modelType, this.config.modelMeta.identity);
    this.anchorTargets = config.modelMeta.anchorTargets ?? {};

    // Register CUSTOM_NODE_HANDLER for complex child DSL processing.
    // WidgetRegistry's routing handler calls this when it encounters
    // <Model type="<this.modelType>" id="<this.widgetId>"> in a scene, allowing full child traversal.
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (
      node,
      api,
      helpers,
    ) => {
      const ctx = api.context;
      const rawProps = node.props as ModelProps;
      const props = helpers.resolveObjectValues(rawProps, ctx);
      const base =
        (api.state.widgets[this.widgetId] as SceneModelInstanceState | undefined) ??
        this.defaultState;
      const authored: ModelAuthoredFlags = {
        model: {
          reset: props.reset === true,
          scale: hasProp(rawProps as Record<string, unknown>, 'scale'),
          position: hasProp(rawProps as Record<string, unknown>, 'position'),
          rotation: hasProp(rawProps as Record<string, unknown>, 'rotation'),
          metalness: hasProp(rawProps as Record<string, unknown>, 'metalness'),
          roughness: hasProp(rawProps as Record<string, unknown>, 'roughness'),
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
      const modelParts: Record<string, ModelPartSpec> = {};

      // Walk immediate children of <Model>
      const children = helpers.collectChildren(node);
  for (const child of children) {
    if (!isValidElement(child)) continue;
    const el = child as ReactElement;

    if (isComponent(el, BodyParts)) {
      // <BodyParts> container: each child is a <BodyPart id="...">
      const bpChildren = helpers.collectChildren(el);
      for (const bpChild of bpChildren) {
        if (!isValidElement(bpChild)) continue;
        const bpEl = bpChild as ReactElement;
        if (isComponent(bpEl, BodyPart)) {
          applyBodyPartToOverrides(bpEl, bodyPartOverrides, ctx, helpers);
        }
      }
    } else if (isComponent(el, BodyPart)) {
      // Direct <BodyPart id="..."> child of <Model>
      applyBodyPartToOverrides(el, bodyPartOverrides, ctx, helpers);
    } else if (isComponent(el, ModelPart)) {
      applyModelPartToOverrides(el, modelParts, ctx, helpers);
    } else if (isComponent(el, Playback)) {
      const pbRaw = el.props as PlaybackProps;
      if (helpers.resolveValue(pbRaw.reset, ctx)) {
        authored.playback!.reset = true;
      }
      // <Playback> container: <Animation> and <Motion> children
      const pbChildren = helpers.collectChildren(el);
      for (const pbChild of pbChildren) {
        if (!isValidElement(pbChild)) continue;
        const pbEl = pbChild as ReactElement;

        if (isComponent(pbEl, Animation)) {
          const animRaw = pbEl.props as AnimationProps;
          const animProps = helpers.resolveObjectValues(
            animRaw,
            ctx,
          );
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
                holdStartPose: hasProp(animRaw as Record<string, unknown>, 'holdStartPose'),
                allowRotation: hasProp(animRaw as Record<string, unknown>, 'allowRotation'),
                allowScale: hasProp(animRaw as Record<string, unknown>, 'allowScale'),
              };
              // children is not part of SceneAnimation — strip it before merging
              const { children: _ignored, ...animState } = animProps as AnimationProps & {
                children?: unknown;
              };
              animation = { ...animation, ...animState };
        } else if (isComponent(pbEl, Motion)) {
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
      const state: SceneModelInstanceState = {
        model: {
          ...base.model,
          ...(props.reset === true ? { reset: true } : {}),
          ...(props.scale !== undefined ? { scale: props.scale as number } : {}),
          ...(props.position !== undefined ? { position: props.position as Vec3 } : {}),
          ...(props.rotation !== undefined ? { rotation: props.rotation as Vec3 } : {}),
          ...(props.metalness !== undefined ? { metalness: props.metalness as number } : {}),
          ...(props.roughness !== undefined ? { roughness: props.roughness as number } : {}),
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
      };

      (state as SceneModelInstanceState & { __authored?: ModelAuthoredFlags }).__authored = authored;
      api.setWidgetState(this.widgetId, state);
    };
  }

  /**
   * Compile animation state for this frame.
   */
  compileExtra(state: SceneModelInstanceState, _ctx: CompileExtraContext): CompiledAnimation {
    return compileAnimation(
      state.playback?.animation,
      this.config.clipMeta,
      _ctx.prefersReducedMotion,
    );
  }

  mergeSnapshot(
    prev: SceneModelInstanceState | undefined,
    next: SceneModelInstanceState | undefined,
  ): SceneModelInstanceState | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev ?? this.defaultState;
    const authored = (next as SceneModelInstanceState & { __authored?: ModelAuthoredFlags }).__authored;
    const base = prev ?? this.defaultState;

    const modelBase = authored?.model?.reset || next.model?.reset
      ? this.defaultState.model
      : base.model;

    const mergedModel = {
      ...modelBase,
      ...(authored?.model?.scale ? { scale: next.model.scale } : {}),
      ...(authored?.model?.position ? { position: next.model.position } : {}),
      ...(authored?.model?.rotation ? { rotation: next.model.rotation } : {}),
      ...(authored?.model?.metalness ? { metalness: next.model.metalness } : {}),
      ...(authored?.model?.roughness ? { roughness: next.model.roughness } : {}),
      bodyPartOverrides: mergeBodyPartOverrides(base.model.bodyPartOverrides, next.model.bodyPartOverrides),
      parts: mergeModelParts(base.model.parts, next.model.parts),
    };

    const playbackBase = authored?.playback?.reset || next.playback?.reset
      ? this.defaultState.playback
      : base.playback;

    const animBase = authored?.playback?.animation?.reset || next.playback?.animation?.reset
      ? this.defaultState.playback.animation
      : playbackBase.animation;

    const mergedAnimation = {
      ...animBase,
      ...(authored?.playback?.animation?.enabled ? { enabled: next.playback.animation.enabled } : {}),
      ...(authored?.playback?.animation?.clipName ? { clipName: next.playback.animation.clipName } : {}),
      ...(authored?.playback?.animation?.gltfUrl ? { gltfUrl: next.playback.animation.gltfUrl } : {}),
      ...(authored?.playback?.animation?.gltfClipName ? { gltfClipName: next.playback.animation.gltfClipName } : {}),
      ...(authored?.playback?.animation?.fbxUrl ? { fbxUrl: next.playback.animation.fbxUrl } : {}),
      ...(authored?.playback?.animation?.fbxClipName ? { fbxClipName: next.playback.animation.fbxClipName } : {}),
      ...(authored?.playback?.animation?.fbxRetarget ? { fbxRetarget: next.playback.animation.fbxRetarget } : {}),
      ...(authored?.playback?.animation?.fadeInSeconds ? { fadeInSeconds: next.playback.animation.fadeInSeconds } : {}),
      ...(authored?.playback?.animation?.weight ? { weight: next.playback.animation.weight } : {}),
      ...(authored?.playback?.animation?.clipStart ? { clipStart: next.playback.animation.clipStart } : {}),
      ...(authored?.playback?.animation?.clipEnd ? { clipEnd: next.playback.animation.clipEnd } : {}),
      ...(authored?.playback?.animation?.clipRangeUnit ? { clipRangeUnit: next.playback.animation.clipRangeUnit } : {}),
      ...(authored?.playback?.animation?.clipRepeat ? { clipRepeat: next.playback.animation.clipRepeat } : {}),
      ...(authored?.playback?.animation?.holdStartPose ? { holdStartPose: next.playback.animation.holdStartPose } : {}),
      ...(authored?.playback?.animation?.allowRotation ? { allowRotation: next.playback.animation.allowRotation } : {}),
      ...(authored?.playback?.animation?.allowScale ? { allowScale: next.playback.animation.allowScale } : {}),
    };

    const motionBase = authored?.playback?.motion?.reset || next.playback?.motion?.reset
      ? this.defaultState.playback.motion
      : playbackBase.motion;

    const mergedMotion = {
      ...motionBase,
      ...(authored?.playback?.motion?.commands ? { commands: next.playback.motion.commands } : {}),
      ...(authored?.playback?.motion?.scenes ? { scenes: next.playback.motion.scenes } : {}),
      ...(authored?.playback?.motion?.customAnimations ? { customAnimations: next.playback.motion.customAnimations } : {}),
    };

    const merged: SceneModelInstanceState = {
      model: mergedModel,
      playback: {
        motion: mergedMotion,
        animation: mergedAnimation,
      },
      enabled: authored?.enabled ? next.enabled : base.enabled,
    };

    delete (merged as SceneModelInstanceState & { __authored?: ModelAuthoredFlags }).__authored;
    return merged;
  }

  /**
   * Load assets from manifest.
   */
  async load(manifest: unknown): Promise<void> {
    const typedManifest = manifest as AssetManifest | null;
    if (!this.renderer) {
      console.warn('[ModelWidget] no renderer');
      return;
    }

    const modelMeta = typedManifest?.models?.find((m) => m.type === this.modelType) ?? this.config.modelMeta;
    if (!modelMeta.glb) {
      console.warn(`[ModelWidget] no GLB URL for model "${this.modelType}" (instance "${this.widgetId}")`);
      return;
    }

    this.anchorTargets = modelMeta.anchorTargets ?? {};
    await this.renderer.loadGlb(modelMeta.glb, { anchorTargets: this.anchorTargets, manifest: typedManifest });
    this.isLoaded = true;
  }

  /**
   * Initialize Three.js rendering.
   */
  initialize(context: WidgetInitContext): void {
    const scene = context.scene as THREE.Scene;
    this.renderer = new ModelRenderer(scene, context.renderer);
  }

  /**
   * Apply state each frame.
   */
  apply(state: SceneModelInstanceState, context: WidgetRenderContext): void {
    if (!this.renderer) return;
    const animation = context.extra as CompiledAnimation | undefined;
    this.renderer.apply(state, animation, context);
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    this.renderer?.dispose();
  }

  getAnchorBoneName(anchorKey: string): string | undefined {
    return this.anchorTargets[anchorKey];
  }

  findBoneNode(boneName: string): THREE.Object3D | undefined {
    return this.renderer?.findNodeByName(boneName);
  }

  getBoneWorldPositions(): Map<string, [number, number, number]> {
    return this.renderer?.getBoneWorldPositions() ?? new Map();
  }
}
