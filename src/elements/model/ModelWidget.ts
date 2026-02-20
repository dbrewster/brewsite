/**
 * ModelWidget - the main widget class for model elements.
 *
 * Implements:
 * - ISceneElement: state and transition spec
 * - IRenderable: initialize, apply, dispose
 * - ILoadable: load assets
 * - IDslComposite: DSL child components
 */

import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import type * as React from 'react';
import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  ILoadable,
  IDslComposite,
  WidgetInitContext,
  WidgetRenderContext,
  CompileExtraContext,
} from '../../widget/types';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';
import type { NodeHandler, CompileHelpers } from '../../compiler/sceneDslTypes';
import type { SceneFrameContext } from '../../compiler/sceneTypes';
import type {
  Vec3,
  SceneModelInstanceState,
  ClipMeta,
  BodyPartOverride,
  BodyPartOverrideMap,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  CustomAnimation,
  SceneAnimation,
  AxisRotation,
  AxisTranslation,
} from './types';
import type { CompiledAnimation } from './compile';
import type { AssetManifest, ModelMeta } from './metadata';
import {
  instanceTransitionSpec,
  compileAnimation,
  createDefaultModelInstanceState,
} from './compile';
import {
  Model,
  BodyPart,
  BodyParts,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from './dsl';
import type {
  ModelProps,
  BodyPartByIdProps,
  AnimationProps,
  MotionProps,
  PoseProps,
  ModelPartProps,
  ContainedModelProps,
  SubpartProps,
} from './dsl';
import { ModelRenderer } from './ModelRenderer';

export type ModelWidgetConfig = {
  /**
   * The ModelMeta descriptor for this widget.  widgetId is derived from
   * modelMeta.id so there is no separate modelId field.
   */
  modelMeta: ModelMeta;
  clipMeta: ClipMeta[];
};

// ─── DSL child helper ────────────────────────────────────────────────────────

/**
 * Merge a single <BodyPart id="..."> element into the overrides map.
 * Also handles a nested <Pose> child of the BodyPart.
 */
const applyBodyPartToOverrides = (
  el: ReactElement,
  overrides: BodyPartOverrideMap,
  ctx: SceneFrameContext,
  helpers: CompileHelpers,
): void => {
  const bpProps = helpers.resolveObjectValues(el.props as BodyPartByIdProps, ctx);
  const id = bpProps.id;
  if (!id) return;
  const existing: BodyPartOverride = overrides[id] ?? {};
  // resolveObjectValues resolves function-valued props to plain values; cast to concrete types.
  const override: BodyPartOverride = {
    ...existing,
    ...(bpProps.opacity !== undefined ? { opacity: bpProps.opacity as number } : {}),
    ...(bpProps.color !== undefined ? { color: bpProps.color as string } : {}),
    ...(bpProps.metalness !== undefined ? { metalness: bpProps.metalness as number } : {}),
    ...(bpProps.roughness !== undefined ? { roughness: bpProps.roughness as number } : {}),
  };
  // <Pose> nested inside <BodyPart> contributes a per-part pose override
  const bpChildren = helpers.collectChildren(el);
  for (const c of bpChildren) {
    if (!isValidElement(c)) continue;
    const ce = c as ReactElement;
    if (ce.type === Pose) {
      const poseProps = helpers.resolveObjectValues(ce.props as PoseProps, ctx);
      override.pose = {
        ...(poseProps.rotate !== undefined ? { rotate: poseProps.rotate as AxisRotation } : {}),
        ...(poseProps.translate !== undefined ? { translate: poseProps.translate as AxisTranslation } : {}),
        ...(poseProps.space !== undefined ? { space: poseProps.space as 'local' | 'world' } : {}),
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
  ctx: SceneFrameContext,
  helpers: CompileHelpers,
): void => {
  const props = helpers.resolveObjectValues(el.props as ModelPartProps, ctx);
  if (!props?.id) return;
  const id = props.id as string;
  const base = parts[id] ?? {
    id,
    anchor: props.anchor ?? id,
    enabled: true,
    space: 'local',
    position: [0, 0, 0] as Vec3,
    rotation: [0, 0, 0] as Vec3,
    scale: 1,
  };

  let modelId = base.modelId;
  let position = base.position;
  let rotation = base.rotation;
  let scale = base.scale;
  const subparts: Partial<Record<string, ModelSubpartSpec>> = { ...(base.subparts ?? {}) };

  const children = helpers.collectChildren(el);
  for (const child of children) {
    if (!isValidElement(child)) continue;
    const ce = child as ReactElement;
    if (ce.type === ContainedModel) {
      const contained = helpers.resolveObjectValues(ce.props as ContainedModelProps, ctx);
      if (contained.modelId) modelId = contained.modelId as string;
      if (contained.position) position = contained.position as Vec3;
      if (contained.rotation) rotation = contained.rotation as Vec3;
      if (contained.scale !== undefined) scale = contained.scale as number;
    } else if (ce.type === Subpart) {
      const subProps = helpers.resolveObjectValues(ce.props as SubpartProps, ctx);
      if (!subProps.id) continue;
      subparts[subProps.id] = {
        id: subProps.id,
        enabled: subProps.enabled as boolean | undefined,
        opacity: subProps.opacity as number | undefined,
        color: subProps.color as string | undefined,
        metalness: subProps.metalness as number | undefined,
        roughness: subProps.roughness as number | undefined,
      };
    }
  }

  parts[id] = {
    ...base,
    anchor: props.anchor ?? base.anchor,
    enabled: props.enabled ?? base.enabled,
    opacity: props.opacity ?? base.opacity,
    position: props.position ?? position,
    rotation: props.rotation ?? rotation,
    scale: props.scale ?? scale,
    modelId,
    subparts,
  };
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
  readonly DslComponent = Model;
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

  constructor(config: ModelWidgetConfig) {
    this.widgetId = config.modelMeta.id;
    this.config = config;
    this.clipMeta = config.clipMeta;
    this.defaultState = createDefaultModelInstanceState(config.modelMeta.id);
    this.anchorTargets = config.modelMeta.anchorTargets ?? {};

    // Register CUSTOM_NODE_HANDLER for complex child DSL processing.
    // WidgetRegistry's routing handler calls this when it encounters
    // <Model id="<this.widgetId>"> in a scene, allowing full child traversal.
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (
      node,
      api,
      helpers,
    ) => {
      const ctx = api.context;
      const props = helpers.resolveObjectValues(node.props as ModelProps, ctx);
      const base =
        (api.state.widgets[this.widgetId] as SceneModelInstanceState | undefined) ??
        this.defaultState;

      // Mutable accumulators seeded from base state
      const bodyPartOverrides: BodyPartOverrideMap = { ...base.model.bodyPartOverrides };
      let motionCommands: MotionCommand[] = base.playback.motion.commands;
      let motionScenes: MotionScene[] = base.playback.motion.scenes;
      let motionCustomAnimations: CustomAnimation[] | undefined =
        base.playback.motion.customAnimations;
      let animation: SceneAnimation = { ...base.playback.animation };
      const modelParts: Record<string, ModelPartSpec> = { ...(base.model.parts ?? {}) };

      // Walk immediate children of <Model>
      const children = helpers.collectChildren(node);
      for (const child of children) {
        if (!isValidElement(child)) continue;
        const el = child as ReactElement;

        if (el.type === BodyParts) {
          // <BodyParts> container: each child is a <BodyPart id="...">
          const bpChildren = helpers.collectChildren(el);
          for (const bpChild of bpChildren) {
            if (!isValidElement(bpChild)) continue;
            const bpEl = bpChild as ReactElement;
            if (bpEl.type === BodyPart) {
              applyBodyPartToOverrides(bpEl, bodyPartOverrides, ctx, helpers);
            }
          }
        } else if (el.type === BodyPart) {
          // Direct <BodyPart id="..."> child of <Model>
          applyBodyPartToOverrides(el, bodyPartOverrides, ctx, helpers);
        } else if (el.type === ModelPart) {
          applyModelPartToOverrides(el, modelParts, ctx, helpers);
        } else if (el.type === Playback) {
          // <Playback> container: <Animation> and <Motion> children
          const pbChildren = helpers.collectChildren(el);
          for (const pbChild of pbChildren) {
            if (!isValidElement(pbChild)) continue;
            const pbEl = pbChild as ReactElement;

            if (pbEl.type === Animation) {
              const animProps = helpers.resolveObjectValues(
                pbEl.props as AnimationProps,
                ctx,
              );
              // children is not part of SceneAnimation — strip it before merging
              const { children: _ignored, ...animState } = animProps as AnimationProps & {
                children?: unknown;
              };
              animation = { ...animation, ...animState };
            } else if (pbEl.type === Motion) {
              const motionProps = helpers.resolveObjectValues(
                pbEl.props as MotionProps,
                ctx,
              );
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

  /**
   * Load assets from manifest.
   */
  async load(manifest: unknown): Promise<void> {
    const typedManifest = manifest as AssetManifest | null;
    if (!this.renderer) {
      console.warn('[ModelWidget] no renderer');
      return;
    }

    const modelMeta = typedManifest?.models?.find((m) => m.id === this.widgetId) ?? this.config.modelMeta;
    if (!modelMeta.glb) {
      console.warn(`[ModelWidget] no GLB URL for model "${this.widgetId}"`);
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
    this.renderer = new ModelRenderer(scene);
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
