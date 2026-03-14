/**
 * Model element public API.
 */
// DEBT: Audit which symbols here should be promoted to the public src/index.ts barrel

// Widget class
export { ModelWidget } from './ModelWidget';
export type { ModelWidgetConfig } from './ModelWidget';

// Types
export type {
  ClipMeta,
  ModelPartId,
  ModelPartAnchor,
  ModelSubpartId,
  ModelSubpartSpec,
  ModelPartSpec,
  ModelPartOverrides,
  BodyPartOverride,
  BodyPartOverrideMap,
  AxisRotation,
  AxisTranslation,
  MotionCommand,
  PoseGroup,
  ModelPose,
  MotionScene,
  MotionGroupLimits,
  CustomAnimationContext,
  CustomAnimationOp,
  CustomAnimation,
  SceneMotion,
  SceneAnimation,
  ScenePlayback,
  SceneModel,
  SceneModelInstanceState,
} from './types';

// Compilation
export { modelTransitionSpec, playbackTransitionSpec, compileAnimation, resolveClipRangeSeconds } from './compile';
export type { CompiledAnimation } from './compile';

// Blend helpers (public API for consumers that need custom transition composition)
export { poseGroupTransition, blendBodyOverrides } from './modelBlend';

// Metadata
export type { AnimationEntry, AnchorTargetMap, BodyPartGroup, ModelMeta, AssetManifest } from './metadata';
export { clipMetaFromManifest, findModelMeta, assertManifestValid, ASSET_MANIFEST_VERSION } from './metadata';

// Rendering
export { applyModelTransform } from './render';
export { ModelRenderer } from './ModelRenderer';

// DSL components
export {
  Model,
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from './ModelWidget';
export type {
  ModelProps,
  BodyPartProps,
  BodyPartByIdProps,
  PoseProps,
  ModelPartProps,
  ContainedModelProps,
  SubpartProps,
  PlaybackProps,
  MotionProps,
  AnimationProps,
} from './dsl';
