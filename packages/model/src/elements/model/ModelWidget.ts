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
import type {ReactNode} from 'react';
import type * as THREE from 'three';
import type {CompileExtraContext, IDslComposite, ILoadable, IRenderable, ISceneElement, IAttachmentHost, IRenderContributor, RenderContribution, WidgetInitContext, WidgetRenderContext, INVSBounded, NVSRect, IHasCustomDslHandler,} from '@brewsite/core';
import {validateNVSScalar, CUSTOM_NODE_HANDLER} from '@brewsite/core';
import type {NodeHandler} from '@brewsite/core';
import type {
  ClipMeta,
  SceneModelInstanceState,
  Vec3,
} from './types';
import type {CompiledAnimation} from './compile';
import {compileAnimation, createDefaultModelInstanceState, functionalInstanceTransitionSpec,} from './compile';
import type {AssetManifest, ModelMeta} from './metadata';
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
import type {LabelProps} from '../../labels/dsl';
import {buildModelNodeHandler, getModelAuthoredFlags, mergeBodyPartOverrides, mergeModelParts} from './modelDslHandler';

import {ModelRenderer} from './ModelRenderer';
import type {ModelRenderInput} from './_renderTypes';

// ─── Model DSL stubs ──────────────────────────────────────────────────────────
export const Model = (_props: ModelProps) => null;
export const ModelRouter = (_props: ModelProps) => null;
export const BodyParts = (_props: { children?: ReactNode }) => null;
export const BodyPart = (_props: BodyPartByIdProps) => null;
export const Pose = (_props: PoseProps) => null;
export const ModelPart = (_props: ModelPartProps) => null;
export const ContainedModel = (_props: ContainedModelProps) => null;
export const Subpart = (_props: SubpartProps) => null;
export const Playback = (_props: PlaybackProps) => null;
export const Motion = (_props: MotionProps) => null;
export const Animation = (_props: AnimationProps) => null;

// ─── Label DSL stubs (compiled by this widget's CUSTOM_NODE_HANDLER) ──────────
/**
 * Label attached to a model part.
 *
 * Must be nested under `<BodyPart>` or `<Subpart>`.
 * `targetPartId` is resolved automatically from the parent body-part context
 * and is not set directly on `<Label>`.
 */
export const Label = (_props: LabelProps) => null;
Label.displayName = 'Label';

export const Labels = (_props: { children?: ReactNode }) => null;
Labels.displayName = 'Labels';

export type ModelWidgetConfig = {
  /**
   * The ModelMeta descriptor for this widget. modelMeta.type is the model type.
   */
  modelMeta: ModelMeta;
  clipMeta: ClipMeta[];
  widgetId?: string;
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
    IDslComposite,
    IAttachmentHost,
    IRenderContributor,
    IHasCustomDslHandler,
    INVSBounded {

  readonly widgetId: string;
  readonly defaultState: SceneModelInstanceState;
  readonly transitionSpec = functionalInstanceTransitionSpec;
  readonly DslComponent = Model;
  readonly disableWhenAbsent = true;
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

  /** Satisfies IHasCustomDslHandler. Assigned in constructor after instance properties are initialized. */
  readonly [CUSTOM_NODE_HANDLER]!: NodeHandler;

  /**
   * Returns the NVS bounds last applied to this widget.
   * Returns fullscreen { x:0, y:0, w:1, h:1 } before the first apply() call.
   * Satisfies INVSBounded.
   */
  get nvsBounds(): NVSRect {
    return this.lastAppliedState?.nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 };
  }

  isLoaded = false;
  readonly clipMeta: ClipMeta[];
  private loadedClipNames = new Set<string>();
  private warnedMissingClipNames = new Set<string>();

  private config: ModelWidgetConfig;
  private renderer: ModelRenderer | null = null;
  private readonly modelType: string;
  private readonly baseRotation: Vec3 | null;
  private lastAppliedState: SceneModelInstanceState | null = null;

  constructor(
    config: ModelWidgetConfig,
    defaultStateOverride?: Partial<SceneModelInstanceState['model']>,
  ) {
    this.widgetId = config.widgetId ?? config.modelMeta.type;
    this.modelType = config.modelMeta.type;
    this.config = config;
    this.clipMeta = config.clipMeta;
    this.defaultState = createDefaultModelInstanceState(this.modelType, this.config.modelMeta.identity);
    if (defaultStateOverride) {
      this.defaultState.model = {
        ...this.defaultState.model,
        ...defaultStateOverride,
      };
    }
    this.baseRotation = (this.config.modelMeta.baseRotation ?? null) as Vec3 | null;
    if (this.baseRotation) {
      this.defaultState.model.rotation = [0, 0, 0];
    }
    this.anchorTargets = config.modelMeta.anchorTargets ?? {};

    // Register CUSTOM_NODE_HANDLER via factory — all DSL traversal logic lives in modelDslHandler.ts.
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = buildModelNodeHandler({
      widgetId: this.widgetId,
      defaultState: this.defaultState,
      components: {
        Model: Model as React.ComponentType<unknown>,
        BodyParts: BodyParts as React.ComponentType<unknown>,
        BodyPart: BodyPart as React.ComponentType<unknown>,
        Pose: Pose as React.ComponentType<unknown>,
        ModelPart: ModelPart as React.ComponentType<unknown>,
        ContainedModel: ContainedModel as React.ComponentType<unknown>,
        Subpart: Subpart as React.ComponentType<unknown>,
        Playback: Playback as React.ComponentType<unknown>,
        Motion: Motion as React.ComponentType<unknown>,
        Animation: Animation as React.ComponentType<unknown>,
        Label: Label as React.ComponentType<unknown>,
      },
    });
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
    if (!next) return undefined;
    const authored = getModelAuthoredFlags(next);
    const base = prev ?? this.defaultState;

    const modelBase = authored?.model?.reset || next.model?.reset
      ? this.defaultState.model
      : base.model;

    const mergedNvsBounds = next.nvsBounds ?? base.nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 };
    const mergedModel = {
      ...modelBase,
      nvsX: mergedNvsBounds.x + mergedNvsBounds.w / 2,
      nvsY: mergedNvsBounds.y + mergedNvsBounds.h / 2,
      z: next.model.z ?? base.model.z ?? 0,
      ...(authored?.model?.scale ? { scale: next.model.scale } : {}),
      ...(authored?.model?.rotation ? { rotation: next.model.rotation } : {}),
      ...(authored?.model?.opacity ? { opacity: next.model.opacity } : {}),
      ...(authored?.model?.metalness ? { metalness: next.model.metalness } : {}),
      ...(authored?.model?.roughness ? { roughness: next.model.roughness } : {}),
      ...(authored?.model?.metalnessMultiplier ? { metalnessMultiplier: next.model.metalnessMultiplier } : {}),
      ...(authored?.model?.roughnessMultiplier ? { roughnessMultiplier: next.model.roughnessMultiplier } : {}),
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
      ...(authored?.playback?.animation?.clipStartOnce ? { clipStartOnce: next.playback.animation.clipStartOnce } : {}),
      ...(authored?.playback?.animation?.trimStartKeyframes ? { trimStartKeyframes: next.playback.animation.trimStartKeyframes } : {}),
      ...(authored?.playback?.animation?.trimEndKeyframes ? { trimEndKeyframes: next.playback.animation.trimEndKeyframes } : {}),
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
      nvsBounds: mergedNvsBounds,
    };

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
    const containedModelIds = new Set<string>();
    const parts = modelMeta.identity?.model?.parts ?? {};
    for (const part of Object.values(parts)) {
      if (part?.modelId) containedModelIds.add(part.modelId);
    }
    const containedModels = containedModelIds.size > 0
      ? (typedManifest?.models ?? []).filter((m) => containedModelIds.has(m.type))
      : [];
    for (const modelId of containedModelIds) {
      if (!containedModels.some((m) => m.type === modelId)) {
        console.warn(`[ModelWidget] contained model "${modelId}" not found in manifest`);
      }
    }
    await this.renderer.loadGlb(modelMeta.glb, {
      anchorTargets: this.anchorTargets,
      manifest: typedManifest,
      containedModels,
      footOffsetY: modelMeta.footOffsetY ?? 0,
      baseRotation: this.baseRotation ?? undefined,
    });
    this.loadedClipNames = new Set(this.config.clipMeta.map((clip) => clip.name));
    this.warnedMissingClipNames.clear();
    if (typedManifest?.animations?.length) {
      for (const clip of typedManifest.animations) {
        if (clip?.clipName) this.loadedClipNames.add(clip.clipName);
      }
    }
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
   * Converts NVS position (nvsX, nvsY, z) to world-space before passing to ModelRenderer.
   */
  apply(state: SceneModelInstanceState, context: WidgetRenderContext): void {
    this.lastAppliedState = state;
    if (!this.renderer) return;
    const clipName = state.playback.animation.clipName;
    if (
      this.isLoaded &&
      clipName &&
      this.loadedClipNames.size > 0 &&
      !this.loadedClipNames.has(clipName) &&
      !this.warnedMissingClipNames.has(clipName)
    ) {
      this.warnedMissingClipNames.add(clipName);
      console.warn(
        `[ModelWidget "${this.widgetId}"] Animation clip "${clipName}" not found. ` +
        `Available clips: ${Array.from(this.loadedClipNames).join(', ')}`,
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.model.nvsX, 'nvsX', `ModelWidget(${this.widgetId})`);
      validateNVSScalar(state.model.nvsY, 'nvsY', `ModelWidget(${this.widgetId})`);
    }
    // Convert NVS position to world-space using the live NVSCoordService injected by the engine.
    const worldPos = context.coords.toWorld(state.model.nvsX, state.model.nvsY, state.model.z);

    const { nvsX: _nx, nvsY: _ny, z: _z, ...modelRest } = state.model;
    // scale is now viewport-relative: multiply by visible world height
    const worldScale = state.model.scale * context.coords.visibleWorldHeight;
    const renderInput: ModelRenderInput = {
      ...modelRest,
      scale: worldScale,
      position: worldPos as Vec3,
    };
    const animation = context.extra as CompiledAnimation | undefined;
    this.renderer.apply({ ...state, model: renderInput }, animation, context);
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

  getTargetColors(): Map<string, string> {
    return this.renderer?.getTargetColors() ?? new Map();
  }

  // ─── IAttachmentHost (Phase 2) ────────────────────────────────────────────

  /**
   * Returns the Three.js Object3D for the named attachment point.
   * Resolves the bone name from anchorTargets and finds it in the model.
   * Returns null if the key is not found or the model is not yet loaded.
   */
  getAttachmentPoint(key: string): THREE.Object3D | null {
    const boneName = this.anchorTargets[key];
    if (!boneName) return null;
    return this.renderer?.findNodeByName(boneName) ?? null;
  }

  // ─── IRenderContributor (Phase 2) ────────────────────────────────────────

  /**
   * Contributes bone world positions and target colors to the render loop.
   * Called once per frame after renderer.render() by RuntimeDriverImpl.collectRenderContributions().
   */
  contributeRenderData(): RenderContribution {
    return {
      namedPositions: this.renderer?.getBoneWorldPositions() ?? new Map(),
      targetColors: this.renderer?.getTargetColors() ?? new Map(),
    };
  }
}
